//! Helpers shared by the tests of the skills modules.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

pub fn temp_folder(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("hd-skills-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

/// Writes a skill folder with a `SKILL.md` file at `dir/name`.
pub fn write_skill_folder(dir: &Path, name: &str, text: &str) -> PathBuf {
    let folder = dir.join(name);
    std::fs::create_dir_all(&folder).unwrap();
    std::fs::write(folder.join("SKILL.md"), text).unwrap();
    folder
}

pub(super) fn cwd_of(dir: &Path) -> Option<String> {
    Some(dir.display().to_string())
}

/// An answer of the fake web server.
pub(super) struct FakeResponse {
    status: u16,
    headers: Vec<(String, String)>,
    body: String,
}

impl FakeResponse {
    /// The status 200 with a body.
    pub(super) fn ok(body: &str) -> Self {
        FakeResponse { status: 200, headers: Vec::new(), body: body.to_string() }
    }

    /// A status with no body.
    pub(super) fn status(status: u16) -> Self {
        FakeResponse { status, headers: Vec::new(), body: String::new() }
    }

    /// The same answer, with one more header.
    pub(super) fn with_header(mut self, name: &str, value: &str) -> Self {
        self.headers.push((name.to_string(), value.to_string()));
        self
    }
}

/// A web server on the loopback address, for the tests that need an answer of GitLab. It stays up until the end of the test.
pub(super) struct FakeServer {
    /// The address to give to the code in place of `https://gitlab.com`: `http://127.0.0.1:<port>`.
    pub(super) base: String,
    requests: Arc<Mutex<Vec<String>>>,
}

impl FakeServer {
    /// The request targets (the path and the query, as sent) that the server received, in order.
    pub(super) fn requests(&self) -> Vec<String> {
        self.requests.lock().unwrap().clone()
    }
}

/// Starts a web server that answers each request with `handler`, which gets the request target, for example
/// `/api/v4/projects/a%2Fb/repository/tree?ref=main`.
pub(super) async fn fake_server(handler: impl Fn(&str) -> FakeResponse + Send + Sync + 'static) -> FakeServer {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    let requests = Arc::new(Mutex::new(Vec::new()));
    let handler = Arc::new(handler);
    let recorded = requests.clone();
    tokio::spawn(async move {
        loop {
            let Ok((mut stream, _)) = listener.accept().await else {
                return;
            };
            let handler = handler.clone();
            let recorded = recorded.clone();
            tokio::spawn(async move {
                let mut received = Vec::new();
                let mut chunk = [0u8; 4096];
                while received.windows(4).any(|window| window == b"\r\n\r\n") == false {
                    match stream.read(&mut chunk).await {
                        Ok(0) | Err(_) => return,
                        Ok(count) => received.extend_from_slice(&chunk[..count]),
                    }
                }
                let text = String::from_utf8_lossy(&received).to_string();
                let target = text.lines().next().and_then(|line| line.split(' ').nth(1)).unwrap_or_default().to_string();
                recorded.lock().unwrap().push(target.clone());
                let response = handler(&target);
                let mut head = format!("HTTP/1.1 {} Answer\r\nContent-Length: {}\r\nConnection: close\r\n", response.status, response.body.len());
                for (name, value) in &response.headers {
                    head.push_str(&format!("{name}: {value}\r\n"));
                }
                head.push_str("\r\n");
                let _ = stream.write_all(head.as_bytes()).await;
                let _ = stream.write_all(response.body.as_bytes()).await;
                let _ = stream.shutdown().await;
            });
        }
    });
    FakeServer { base, requests }
}
