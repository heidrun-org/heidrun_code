//! A connection to the shared Codex server: JSON requests over a WebSocket on its Unix socket. The connection never starts
//! a server. Each connection has a fixed list of the methods that it may call, so the collector can only read.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use serde_json::{json, Value};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::UnixStream;

/// The methods of the collector: they read, and never start, resume, or answer a chat.
pub const READ_ONLY_METHODS: &[&str] = &["thread/read", "thread/list", "thread/items/list", "thread/turns/list"];
/// The methods of the start of a Codex pane: create one empty chat and give it a name.
pub const CHAT_PREPARATION_METHODS: &[&str] = &["thread/start", "thread/name/set"];

/// The largest message that the connection accepts, in bytes.
const MAXIMUM_MESSAGE_BYTES: usize = 16 * 1024 * 1024;
/// The largest answer to the opening request, in bytes.
const MAXIMUM_HANDSHAKE_BYTES: usize = 64 * 1024;

/// The socket of the shared Codex server: `app-server-control/app-server-control.sock` in the folder of Codex
/// (`CODEX_HOME`, else `~/.codex`).
pub fn shared_server_socket_path() -> PathBuf {
    let codex_folder = std::env::var("CODEX_HOME")
        .ok()
        .filter(|value| value.is_empty() == false)
        .map(PathBuf::from)
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default().join(".codex"));
    codex_folder.join("app-server-control").join("app-server-control.sock")
}

/// One open connection to the shared Codex server.
pub struct CodexConnection {
    stream: UnixStream,
    buffer: Vec<u8>,
    next_request_id: u64,
    allowed_methods: &'static [&'static str],
}

impl CodexConnection {
    /// Connects to the socket, opens the WebSocket, and sends `initialize` then `initialized`.
    pub async fn open(socket_path: &Path, allowed_methods: &'static [&'static str]) -> Result<Self, String> {
        let stream = UnixStream::connect(socket_path)
            .await
            .map_err(|error| format!("Cannot connect to {}: {error}", socket_path.display()))?;
        let mut connection = CodexConnection {
            stream,
            buffer: Vec::new(),
            next_request_id: 0,
            allowed_methods,
        };
        connection.handshake().await?;
        connection
            .call(
                "initialize",
                json!({
                    "clientInfo": { "name": "heidrun_code_heidrun_code_dashboard", "version": env!("CARGO_PKG_VERSION") },
                    "capabilities": { "experimentalApi": true },
                }),
            )
            .await?;
        connection.send_json(&json!({ "method": "initialized" })).await?;
        Ok(connection)
    }

    /// Sends one request and waits for its answer. A method that is not in the list of the connection is refused before
    /// anything is sent.
    pub async fn request(&mut self, method: &str, params: Value) -> Result<Value, String> {
        if self.allowed_methods.contains(&method) == false {
            return Err(format!("The method {method} is not allowed on this connection"));
        }
        self.call(method, params).await
    }

    async fn call(&mut self, method: &str, params: Value) -> Result<Value, String> {
        self.next_request_id += 1;
        let id = self.next_request_id;
        self.send_json(&json!({ "id": id, "method": method, "params": params }))
            .await?;
        loop {
            let message = self.receive_json().await?;
            if message.get("id").and_then(Value::as_u64) != Some(id) || message.get("method").is_some() {
                continue;
            }
            if let Some(error) = message.get("error") {
                let text = error
                    .get("message")
                    .and_then(Value::as_str)
                    .unwrap_or("Codex request failed");
                return Err(format!("{method}: {text}"));
            }
            return Ok(message.get("result").cloned().unwrap_or(Value::Null));
        }
    }

    async fn handshake(&mut self) -> Result<(), String> {
        let key = base64_key();
        let request = format!(
            "GET / HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        );
        self.stream
            .write_all(request.as_bytes())
            .await
            .map_err(|error| error.to_string())?;
        loop {
            if let Some(end) = find(&self.buffer, b"\r\n\r\n") {
                let header = String::from_utf8_lossy(&self.buffer[..end]).to_string();
                self.buffer.drain(..end + 4);
                if header.starts_with("HTTP/1.1 101") == false {
                    return Err(format!(
                        "The Codex server refused the WebSocket: {}",
                        header.lines().next().unwrap_or("")
                    ));
                }
                return Ok(());
            }
            if self.buffer.len() > MAXIMUM_HANDSHAKE_BYTES {
                return Err("The answer of the Codex server to the WebSocket request is too large".into());
            }
            self.receive_bytes().await?;
        }
    }

    async fn send_json(&mut self, value: &Value) -> Result<(), String> {
        let payload = serde_json::to_vec(value).map_err(|error| error.to_string())?;
        self.send_frame(OPCODE_TEXT, &payload).await
    }

    async fn send_frame(&mut self, opcode: u8, payload: &[u8]) -> Result<(), String> {
        let frame = encode_client_frame(opcode, payload, mask_key());
        self.stream.write_all(&frame).await.map_err(|error| error.to_string())
    }

    async fn receive_bytes(&mut self) -> Result<(), String> {
        // On the heap: a 64 kilobyte array inside the future overflowed the stack of a worker thread (issue 968).
        let mut chunk = vec![0u8; 65536];
        let count = self.stream.read(&mut chunk).await.map_err(|error| error.to_string())?;
        if count == 0 {
            return Err("The Codex server closed the connection".into());
        }
        self.buffer.extend_from_slice(&chunk[..count]);
        Ok(())
    }

    async fn receive_json(&mut self) -> Result<Value, String> {
        let mut message: Vec<u8> = Vec::new();
        loop {
            let frame = loop {
                match decode_frame(&self.buffer, MAXIMUM_MESSAGE_BYTES)? {
                    Some((frame, used)) => {
                        self.buffer.drain(..used);
                        break frame;
                    }
                    None => self.receive_bytes().await?,
                }
            };
            match frame.opcode {
                OPCODE_CLOSE => return Err("The Codex server closed the WebSocket".into()),
                OPCODE_PING => self.send_frame(OPCODE_PONG, &frame.payload).await?,
                OPCODE_PONG => {}
                OPCODE_TEXT | OPCODE_BINARY | OPCODE_CONTINUATION => {
                    if message.len() + frame.payload.len() > MAXIMUM_MESSAGE_BYTES {
                        return Err("The message of the Codex server is too large".into());
                    }
                    message.extend_from_slice(&frame.payload);
                    if frame.is_final {
                        return serde_json::from_slice(&message)
                            .map_err(|error| format!("The message of the Codex server does not parse: {error}"));
                    }
                }
                other => return Err(format!("Unknown WebSocket opcode {other}")),
            }
        }
    }
}

pub const OPCODE_CONTINUATION: u8 = 0;
pub const OPCODE_TEXT: u8 = 1;
pub const OPCODE_BINARY: u8 = 2;
pub const OPCODE_CLOSE: u8 = 8;
pub const OPCODE_PING: u8 = 9;
pub const OPCODE_PONG: u8 = 10;

/// One WebSocket frame, without its mask.
#[derive(Debug, PartialEq)]
pub struct Frame {
    pub is_final: bool,
    pub opcode: u8,
    pub payload: Vec<u8>,
}

/// Builds one final frame of a client: a client always masks its payload.
pub fn encode_client_frame(opcode: u8, payload: &[u8], mask: [u8; 4]) -> Vec<u8> {
    let mut frame = vec![0x80 | opcode];
    let length = payload.len();
    if length < 126 {
        frame.push(0x80 | length as u8);
    } else if length < 65536 {
        frame.push(0x80 | 126);
        frame.extend_from_slice(&(length as u16).to_be_bytes());
    } else {
        frame.push(0x80 | 127);
        frame.extend_from_slice(&(length as u64).to_be_bytes());
    }
    frame.extend_from_slice(&mask);
    frame.extend(payload.iter().enumerate().map(|(index, byte)| byte ^ mask[index % 4]));
    frame
}

/// Reads one frame at the start of `buffer`. Gives the frame and the number of bytes that it used, or `None` when the
/// buffer does not hold the whole frame yet.
pub fn decode_frame(buffer: &[u8], maximum_bytes: usize) -> Result<Option<(Frame, usize)>, String> {
    if buffer.len() < 2 {
        return Ok(None);
    }
    let is_final = buffer[0] & 0x80 != 0;
    let opcode = buffer[0] & 0x0f;
    let is_masked = buffer[1] & 0x80 != 0;
    let mut position = 2;
    let length = match buffer[1] & 0x7f {
        126 => {
            if buffer.len() < 4 {
                return Ok(None);
            }
            position = 4;
            u16::from_be_bytes([buffer[2], buffer[3]]) as u64
        }
        127 => {
            if buffer.len() < 10 {
                return Ok(None);
            }
            position = 10;
            u64::from_be_bytes(buffer[2..10].try_into().unwrap())
        }
        short => short as u64,
    };
    if length > maximum_bytes as u64 {
        return Err("The message of the Codex server is too large".into());
    }
    let length = length as usize;
    let mask = if is_masked {
        if buffer.len() < position + 4 {
            return Ok(None);
        }
        let mask = [
            buffer[position],
            buffer[position + 1],
            buffer[position + 2],
            buffer[position + 3],
        ];
        position += 4;
        Some(mask)
    } else {
        None
    };
    if buffer.len() < position + length {
        return Ok(None);
    }
    let mut payload = buffer[position..position + length].to_vec();
    if let Some(mask) = mask {
        for (index, byte) in payload.iter_mut().enumerate() {
            *byte ^= mask[index % 4];
        }
    }
    Ok(Some((
        Frame {
            is_final,
            opcode,
            payload,
        },
        position + length,
    )))
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|window| window == needle)
}

static MASK_COUNTER: AtomicU64 = AtomicU64::new(0x9e37_79b9_7f4a_7c15);

/// Changing bytes for the masks and the key of the WebSocket. The socket is local, so the bytes need no strong randomness.
fn changing_bytes() -> u64 {
    let nanoseconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_nanos() as u64)
        .unwrap_or(0);
    let mut value =
        nanoseconds ^ MASK_COUNTER.fetch_add(0x9e37_79b9_7f4a_7c15, Ordering::Relaxed) ^ std::process::id() as u64;
    value ^= value << 13;
    value ^= value >> 7;
    value ^= value << 17;
    value
}

fn mask_key() -> [u8; 4] {
    let bytes = changing_bytes().to_be_bytes();
    [bytes[0], bytes[1], bytes[2], bytes[3]]
}

fn base64_key() -> String {
    use base64::Engine;
    let mut bytes = [0u8; 16];
    bytes[..8].copy_from_slice(&changing_bytes().to_be_bytes());
    bytes[8..].copy_from_slice(&changing_bytes().to_be_bytes());
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

/// A fake shared Codex server on a Unix socket in a temporary folder, for the tests of this folder. It never touches
/// `~/.codex`.
#[cfg(test)]
pub mod fake_server {
    use super::*;
    use tokio::net::UnixListener;

    /// The answer of the fake server to one request: the result, or an error message.
    pub type Answer = Result<Value, String>;

    /// Starts a fake server that answers each request with `answer(method, params)`. Every request is also recorded.
    pub fn start<F>(name: &str, answer: F) -> (PathBuf, std::sync::Arc<std::sync::Mutex<Vec<(String, Value)>>>)
    where
        F: Fn(&str, &Value) -> Answer + Send + Sync + 'static,
    {
        // A socket path has at most 104 bytes on macOS: the folder `/tmp` is shorter than the temporary folder of the system.
        let folder = std::path::Path::new("/tmp").join(format!("heidrun_code_dashboard_codex_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        let socket_path = folder.join("server.sock");
        let listener = UnixListener::bind(&socket_path).unwrap();
        let requests = std::sync::Arc::new(std::sync::Mutex::new(Vec::new()));
        let recorded = requests.clone();
        let answer = std::sync::Arc::new(answer);
        tokio::spawn(async move {
            loop {
                let Ok((stream, _)) = listener.accept().await else {
                    return;
                };
                let answer = answer.clone();
                let recorded = recorded.clone();
                tokio::spawn(async move {
                    let _ = serve(stream, answer, recorded).await;
                });
            }
        });
        (socket_path, requests)
    }

    async fn serve<F>(
        mut stream: UnixStream,
        answer: std::sync::Arc<F>,
        recorded: std::sync::Arc<std::sync::Mutex<Vec<(String, Value)>>>,
    ) -> Result<(), String>
    where
        F: Fn(&str, &Value) -> Answer + Send + Sync + 'static,
    {
        let mut buffer = Vec::new();
        let mut chunk = vec![0u8; 65536];
        while find(&buffer, b"\r\n\r\n").is_none() {
            let count = stream.read(&mut chunk).await.map_err(|error| error.to_string())?;
            if count == 0 {
                return Ok(());
            }
            buffer.extend_from_slice(&chunk[..count]);
        }
        let end = find(&buffer, b"\r\n\r\n").unwrap();
        buffer.drain(..end + 4);
        stream
            .write_all(b"HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n\r\n")
            .await
            .map_err(|error| error.to_string())?;
        // A ping first: the client must answer it and go on.
        stream
            .write_all(&[0x80 | OPCODE_PING, 2, b'h', b'i'])
            .await
            .map_err(|error| error.to_string())?;
        loop {
            let (frame, used) = loop {
                if let Some(found) = decode_frame(&buffer, MAXIMUM_MESSAGE_BYTES)? {
                    break found;
                }
                let count = stream.read(&mut chunk).await.map_err(|error| error.to_string())?;
                if count == 0 {
                    return Ok(());
                }
                buffer.extend_from_slice(&chunk[..count]);
            };
            buffer.drain(..used);
            if frame.opcode != OPCODE_TEXT {
                continue;
            }
            let message: Value = serde_json::from_slice(&frame.payload).map_err(|error| error.to_string())?;
            let method = message.get("method").and_then(Value::as_str).unwrap_or("").to_string();
            let params = message.get("params").cloned().unwrap_or(Value::Null);
            recorded.lock().unwrap().push((method.clone(), params.clone()));
            let Some(id) = message.get("id").cloned() else { continue };
            let response = if method == "initialize" {
                json!({ "id": id, "result": {} })
            } else {
                match answer(&method, &params) {
                    Ok(result) => json!({ "id": id, "result": result }),
                    Err(text) => json!({ "id": id, "error": { "code": -1, "message": text } }),
                }
            };
            // A notification first, which the client must skip, then the answer in two frames.
            let notification = serde_json::to_vec(&json!({ "method": "thread/status/changed", "params": {} })).unwrap();
            stream
                .write_all(&server_frame(true, OPCODE_TEXT, &notification))
                .await
                .map_err(|error| error.to_string())?;
            let bytes = serde_json::to_vec(&response).unwrap();
            let middle = bytes.len() / 2;
            stream
                .write_all(&server_frame(false, OPCODE_TEXT, &bytes[..middle]))
                .await
                .map_err(|error| error.to_string())?;
            stream
                .write_all(&server_frame(true, OPCODE_CONTINUATION, &bytes[middle..]))
                .await
                .map_err(|error| error.to_string())?;
        }
    }

    /// One frame of a server: a server never masks its payload.
    pub fn server_frame(is_final: bool, opcode: u8, payload: &[u8]) -> Vec<u8> {
        let mut frame = vec![if is_final { 0x80 | opcode } else { opcode }];
        let length = payload.len();
        if length < 126 {
            frame.push(length as u8);
        } else if length < 65536 {
            frame.push(126);
            frame.extend_from_slice(&(length as u16).to_be_bytes());
        } else {
            frame.push(127);
            frame.extend_from_slice(&(length as u64).to_be_bytes());
        }
        frame.extend_from_slice(payload);
        frame
    }
}

#[cfg(test)]
mod tests {
    use super::fake_server::server_frame;
    use super::*;

    #[test]
    fn a_client_frame_is_masked_and_decodes_to_its_payload() {
        for length in [0usize, 5, 125, 126, 65535, 65536, 70000] {
            let payload: Vec<u8> = (0..length).map(|index| (index % 251) as u8).collect();
            let frame = encode_client_frame(OPCODE_TEXT, &payload, [1, 2, 3, 4]);
            assert_eq!(frame[1] & 0x80, 0x80, "a client frame is masked");
            let (decoded, used) = decode_frame(&frame, MAXIMUM_MESSAGE_BYTES).unwrap().unwrap();
            assert_eq!(used, frame.len());
            assert_eq!(decoded.payload, payload);
            assert!(decoded.is_final);
            assert_eq!(decoded.opcode, OPCODE_TEXT);
        }
    }

    #[test]
    fn a_part_of_a_frame_waits_for_more_bytes() {
        let frame = server_frame(true, OPCODE_TEXT, &[7u8; 300]);
        for cut in [0, 1, 3, 100, frame.len() - 1] {
            assert_eq!(decode_frame(&frame[..cut], MAXIMUM_MESSAGE_BYTES).unwrap(), None);
        }
        let (decoded, used) = decode_frame(&frame, MAXIMUM_MESSAGE_BYTES).unwrap().unwrap();
        assert_eq!(used, frame.len());
        assert_eq!(decoded.payload.len(), 300);
    }

    #[test]
    fn a_frame_larger_than_the_maximum_is_refused() {
        let frame = server_frame(true, OPCODE_TEXT, &[0u8; 200]);
        assert!(decode_frame(&frame, 100).is_err());
    }

    #[tokio::test]
    async fn a_request_goes_over_the_websocket_and_gets_its_answer() {
        let (socket_path, requests) = fake_server::start("request", |method, params| {
            Ok(json!({ "echo": method, "params": params }))
        });
        let mut connection = CodexConnection::open(&socket_path, READ_ONLY_METHODS).await.unwrap();
        let big = "x".repeat(100_000);
        let result = connection
            .request("thread/read", json!({ "threadId": big }))
            .await
            .unwrap();
        assert_eq!(result["echo"], json!("thread/read"));
        assert_eq!(result["params"]["threadId"].as_str().unwrap().len(), 100_000);
        let methods: Vec<String> = requests
            .lock()
            .unwrap()
            .iter()
            .map(|(method, _)| method.clone())
            .collect();
        assert_eq!(methods, ["initialize", "initialized", "thread/read"]);
    }

    #[tokio::test]
    async fn an_error_of_the_server_is_an_error_of_the_request() {
        let (socket_path, _) = fake_server::start("error", |_, _| Err("no such thread".into()));
        let mut connection = CodexConnection::open(&socket_path, READ_ONLY_METHODS).await.unwrap();
        let error = connection.request("thread/read", json!({})).await.unwrap_err();
        assert_eq!(error, "thread/read: no such thread");
    }

    #[tokio::test]
    async fn a_method_outside_the_list_of_the_connection_is_never_sent() {
        let (socket_path, requests) = fake_server::start("refused", |_, _| Ok(json!({})));
        let mut connection = CodexConnection::open(&socket_path, READ_ONLY_METHODS).await.unwrap();
        for method in ["thread/start", "thread/resume", "turn/start", "thread/name/set"] {
            assert!(connection.request(method, json!({})).await.is_err());
        }
        // One allowed request, so that the server has read everything that the client sent before it.
        connection.request("thread/read", json!({})).await.unwrap();
        let methods: Vec<String> = requests
            .lock()
            .unwrap()
            .iter()
            .map(|(method, _)| method.clone())
            .collect();
        assert_eq!(methods, ["initialize", "initialized", "thread/read"]);
    }

    #[tokio::test]
    async fn a_missing_socket_is_an_error() {
        let path = std::env::temp_dir().join(format!("heidrun_code_dashboard_missing_{}.sock", std::process::id()));
        let error = CodexConnection::open(&path, READ_ONLY_METHODS).await.err().unwrap();
        assert!(error.starts_with("Cannot connect to"));
    }

    #[test]
    fn the_socket_of_the_shared_server_is_in_the_folder_of_codex() {
        let path = shared_server_socket_path();
        assert!(path.ends_with("app-server-control/app-server-control.sock"));
    }
}
