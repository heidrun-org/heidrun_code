//! The push to the phones: the key of the server, the list of the phones that asked for a push, and the request that wakes
//! a phone. The request has no body, so the push service sees nothing about the coding agents; the phone shows a fixed text.

use crate::config::{config_folder, random_bytes, write_private};
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use p256::ecdsa::signature::Signer;
use p256::ecdsa::{Signature, SigningKey};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// The most phones that the server keeps.
const MAX_SUBSCRIPTIONS: usize = 20;
/// The longest address of a push service that the server keeps.
const MAX_ENDPOINT_BYTES: usize = 2048;
/// The token of one request is valid for 12 hours (the push services accept 24 hours at most).
const TOKEN_SECONDS: u64 = 12 * 60 * 60;
/// Who runs the server, as the push services ask.
const SUBJECT: &str = "https://github.com/heidrun-org/heidrun_code";

/// The content of the file `mobile_push.json`.
#[derive(Serialize, Deserialize, Default)]
struct PushFile {
    /// The private key of the server: 32 bytes as URL-safe base 64.
    private_key: String,
    /// The public key of the server: 65 bytes as URL-safe base 64. The phone needs it to ask for a push.
    public_key: String,
    /// The address of the push service of each phone.
    subscriptions: Vec<String>,
}

/// What `send_all` did.
#[derive(Serialize, Debug, PartialEq, Eq)]
pub struct PushReport {
    /// The count of the phones that the push service accepted.
    pub sent: usize,
    /// The count of the phones that the push service refused for ever, which the server forgot.
    pub removed: usize,
    /// One line for each phone that the push service did not accept: the code and the text of its answer.
    pub failures: Vec<String>,
}

fn push_path() -> PathBuf {
    config_folder().join("mobile_push.json")
}

fn load_from(path: &Path) -> PushFile {
    std::fs::read_to_string(path).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}

fn save_to(path: &Path, file: &PushFile) -> Result<(), String> {
    write_private(path, &serde_json::to_string_pretty(file).map_err(|e| e.to_string())?)
}

fn signing_key_of(file: &PushFile) -> Option<SigningKey> {
    let bytes = URL_SAFE_NO_PAD.decode(&file.private_key).ok()?;
    SigningKey::from_slice(&bytes).ok()
}

/// Loads the file, and makes the key of the server when the file has none.
fn load_with_key(path: &Path) -> Result<(PushFile, SigningKey), String> {
    let mut file = load_from(path);
    if let Some(key) = signing_key_of(&file) {
        return Ok((file, key));
    }
    let key = loop {
        if let Ok(key) = SigningKey::from_slice(&random_bytes()?) {
            break key;
        }
    };
    file.private_key = URL_SAFE_NO_PAD.encode(key.to_bytes());
    file.public_key = URL_SAFE_NO_PAD.encode(key.verifying_key().to_encoded_point(false).as_bytes());
    save_to(path, &file)?;
    Ok((file, key))
}

fn is_push_address(endpoint: &str) -> bool {
    endpoint.len() <= MAX_ENDPOINT_BYTES && endpoint.starts_with("https://") && !endpoint.contains(char::is_whitespace)
}

fn origin_of(endpoint: &str) -> Option<String> {
    let (scheme, rest) = endpoint.split_once("://")?;
    let host = rest.split(['/', '?', '#']).next().filter(|h| !h.is_empty())?;
    Some(format!("{scheme}://{host}"))
}

fn now_seconds() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

/// The header `Authorization` of a push request: a signed token for the origin of the push service, and the public key.
fn authorization(file: &PushFile, key: &SigningKey, endpoint: &str, now: u64) -> Result<String, String> {
    let audience = origin_of(endpoint).ok_or("The address of the push service is wrong")?;
    let header = URL_SAFE_NO_PAD.encode(r#"{"typ":"JWT","alg":"ES256"}"#);
    let claims = serde_json::json!({ "aud": audience, "exp": now + TOKEN_SECONDS, "sub": SUBJECT });
    let payload = URL_SAFE_NO_PAD.encode(claims.to_string());
    let signed = format!("{header}.{payload}");
    let signature: Signature = key.sign(signed.as_bytes());
    Ok(format!("vapid t={signed}.{}, k={}", URL_SAFE_NO_PAD.encode(signature.to_bytes()), file.public_key))
}

/// Gives the public key of the server, and makes the key the first time.
pub fn public_key() -> Result<String, String> {
    public_key_from(&push_path())
}

fn public_key_from(path: &Path) -> Result<String, String> {
    Ok(load_with_key(path)?.0.public_key)
}

/// Remembers the push service address of a phone.
pub fn subscribe(endpoint: &str) -> Result<(), String> {
    subscribe_to(&push_path(), endpoint, true)
}

fn subscribe_to(path: &Path, endpoint: &str, is_https_required: bool) -> Result<(), String> {
    if is_https_required && !is_push_address(endpoint) {
        return Err("The address of the push service is wrong".into());
    }
    let (mut file, _) = load_with_key(path)?;
    file.subscriptions.retain(|known| known != endpoint);
    file.subscriptions.push(endpoint.to_string());
    if file.subscriptions.len() > MAX_SUBSCRIPTIONS {
        let extra = file.subscriptions.len() - MAX_SUBSCRIPTIONS;
        file.subscriptions.drain(..extra);
    }
    save_to(path, &file)
}

/// Forgets the push service address of a phone.
pub fn unsubscribe(endpoint: &str) -> Result<(), String> {
    unsubscribe_from(&push_path(), endpoint)
}

fn unsubscribe_from(path: &Path, endpoint: &str) -> Result<(), String> {
    let mut file = load_from(path);
    file.subscriptions.retain(|known| known != endpoint);
    save_to(path, &file)
}

/// Wakes every phone that asked for a push. A push service that answers "gone" removes its phone.
pub async fn send_all() -> Result<PushReport, String> {
    send_all_from(&push_path()).await
}

async fn send_all_from(path: &Path) -> Result<PushReport, String> {
    let (file, key) = load_with_key(path)?;
    if file.subscriptions.is_empty() {
        return Ok(PushReport { sent: 0, removed: 0, failures: Vec::new() });
    }
    let client = reqwest::Client::builder().timeout(Duration::from_secs(10)).build().map_err(|e| e.to_string())?;
    let mut report = PushReport { sent: 0, removed: 0, failures: Vec::new() };
    for endpoint in &file.subscriptions {
        let value = authorization(&file, &key, endpoint, now_seconds())?;
        let answer = client
            .post(endpoint)
            .header("Authorization", value)
            .header("TTL", "600")
            .header("Urgency", "high")
            .header("Content-Length", "0")
            .send()
            .await;
        match answer {
            Ok(response) => {
                let code = response.status().as_u16();
                if (200..300).contains(&code) {
                    report.sent += 1;
                } else if code == 404 || code == 410 {
                    unsubscribe_from(path, endpoint)?;
                    report.removed += 1;
                } else {
                    let text = response.text().await.unwrap_or_default();
                    report.failures.push(format!("{code} {text}"));
                }
            }
            Err(error) => report.failures.push(error.to_string()),
        }
    }
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    use p256::ecdsa::signature::Verifier;
    use p256::ecdsa::VerifyingKey;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    fn temporary_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("mobile_server_push_{}_{name}", std::process::id())).join("mobile_push.json")
    }

    #[test]
    fn makes_the_key_once_and_keeps_it() {
        let path = temporary_path("key");
        let first = public_key_from(&path).unwrap();
        assert_eq!(URL_SAFE_NO_PAD.decode(&first).unwrap().len(), 65);
        assert_eq!(public_key_from(&path).unwrap(), first);
    }

    #[cfg(unix)]
    #[test]
    fn the_file_is_readable_by_this_user_only() {
        use std::os::unix::fs::PermissionsExt;
        let path = temporary_path("permissions");
        public_key_from(&path).unwrap();
        assert_eq!(std::fs::metadata(&path).unwrap().permissions().mode() & 0o777, 0o600);
    }

    #[test]
    fn the_token_is_signed_for_the_origin_of_the_push_service() {
        let path = temporary_path("token");
        let (file, key) = load_with_key(&path).unwrap();
        let value = authorization(&file, &key, "https://push.example.com/send/abc?x=1", 1000).unwrap();
        let rest = value.strip_prefix("vapid t=").unwrap();
        let (token, public) = rest.split_once(", k=").unwrap();
        assert_eq!(public, file.public_key);
        let parts: Vec<&str> = token.split('.').collect();
        let claims: serde_json::Value = serde_json::from_slice(&URL_SAFE_NO_PAD.decode(parts[1]).unwrap()).unwrap();
        assert_eq!(claims["aud"], "https://push.example.com");
        assert_eq!(claims["exp"], 1000 + TOKEN_SECONDS);
        let verifying = VerifyingKey::from_sec1_bytes(&URL_SAFE_NO_PAD.decode(public).unwrap()).unwrap();
        let signature = Signature::from_slice(&URL_SAFE_NO_PAD.decode(parts[2]).unwrap()).unwrap();
        assert!(verifying.verify(format!("{}.{}", parts[0], parts[1]).as_bytes(), &signature).is_ok());
    }

    #[test]
    fn keeps_a_phone_once_and_forgets_it() {
        let path = temporary_path("list");
        subscribe_to(&path, "https://push.example.com/a", true).unwrap();
        subscribe_to(&path, "https://push.example.com/a", true).unwrap();
        subscribe_to(&path, "https://push.example.com/b", true).unwrap();
        assert_eq!(load_from(&path).subscriptions, ["https://push.example.com/a", "https://push.example.com/b"]);
        unsubscribe_from(&path, "https://push.example.com/a").unwrap();
        assert_eq!(load_from(&path).subscriptions, ["https://push.example.com/b"]);
    }

    #[test]
    fn refuses_an_address_that_is_not_https_or_is_too_long() {
        let path = temporary_path("refuse");
        for endpoint in ["http://push.example.com/a", "file:///etc/passwd", "https://a b", &format!("https://x/{}", "a".repeat(3000))] {
            assert!(subscribe_to(&path, endpoint, true).is_err(), "{endpoint}");
        }
    }

    #[test]
    fn keeps_the_last_twenty_phones() {
        let path = temporary_path("cap");
        for n in 0..25 {
            subscribe_to(&path, &format!("https://push.example.com/{n}"), true).unwrap();
        }
        let list = load_from(&path).subscriptions;
        assert_eq!(list.len(), MAX_SUBSCRIPTIONS);
        assert_eq!(list[0], "https://push.example.com/5");
    }

    /// A push service on the loopback address that answers each request with the next code of the list.
    async fn fake_push_service(codes: Vec<u16>) -> (String, tokio::task::JoinHandle<Vec<String>>) {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let address = format!("http://{}", listener.local_addr().unwrap());
        let task = tokio::spawn(async move {
            let mut requests = Vec::new();
            for code in codes {
                let (mut stream, _) = listener.accept().await.unwrap();
                let mut buffer = vec![0u8; 8192];
                let count = stream.read(&mut buffer).await.unwrap();
                requests.push(String::from_utf8_lossy(&buffer[..count]).to_lowercase());
                let answer = format!("HTTP/1.1 {code} X\r\ncontent-length: 0\r\nconnection: close\r\n\r\n");
                stream.write_all(answer.as_bytes()).await.unwrap();
            }
            requests
        });
        (address, task)
    }

    #[tokio::test]
    async fn sends_a_request_without_body_and_forgets_a_phone_that_is_gone() {
        let path = temporary_path("send");
        let (address, task) = fake_push_service(vec![201, 410]).await;
        subscribe_to(&path, &format!("{address}/a"), false).unwrap();
        subscribe_to(&path, &format!("{address}/b"), false).unwrap();
        let report = send_all_from(&path).await.unwrap();
        assert_eq!(report, PushReport { sent: 1, removed: 1, failures: Vec::new() });
        assert_eq!(load_from(&path).subscriptions, [format!("{address}/a")]);
        let requests = task.await.unwrap();
        assert!(requests[0].starts_with("post /a "));
        assert!(requests[0].contains("authorization: vapid t="));
        assert!(requests[0].contains("ttl: 600"));
    }

    /// Wakes the real phones of this computer. Run by hand: `cargo test live_ -- --ignored --nocapture`.
    #[tokio::test]
    #[ignore]
    async fn live_sends_to_the_real_phones() {
        println!("{:?}", send_all().await);
    }

    #[tokio::test]
    async fn sends_nothing_when_no_phone_asked() {
        let path = temporary_path("empty");
        assert_eq!(send_all_from(&path).await.unwrap(), PushReport { sent: 0, removed: 0, failures: Vec::new() });
    }
}
