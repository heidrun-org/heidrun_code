//! Creates the chat of a new Codex pane on the shared Codex server, before the pane starts `codex resume <identifier>`, so
//! that Herdr gives the pane its chat identifier at once. The live test is in
//! https://github.com/heidrun-org/heidrun_code/issues/968#issuecomment-6516752765.

use std::path::Path;
use std::time::Duration;

use serde_json::{json, Value};

use super::codex_connection::{shared_server_socket_path, CodexConnection, CHAT_PREPARATION_METHODS};

/// The longest wait for the shared Codex server. After it, the pane starts plain `codex`.
pub const PREPARATION_TIMEOUT: Duration = Duration::from_secs(3);

/// Creates a chat with `thread/start` and names it with `thread/name/set`. The name saves the empty chat, so that
/// `codex resume` finds it. Gives the chat identifier, or null when the shared Codex server is not available: the
/// command never fails for an unavailable server.
#[tauri::command]
pub async fn codex_prepare_chat(cwd: String, name: String, model: Option<String>) -> Option<String> {
    let socket_path = shared_server_socket_path();
    let started = std::time::Instant::now();
    let result = prepare_chat(&socket_path, &cwd, &name, model.as_deref(), PREPARATION_TIMEOUT).await;
    if let Err(error) = &result {
        eprintln!(
            "Heidrun Code: the chat of the new Codex pane was not prepared after {:?}: {error}",
            started.elapsed()
        );
    }
    result.ok()
}

/// Creates and names a chat on the server of `socket_path`, within `timeout`.
pub async fn prepare_chat(
    socket_path: &Path,
    cwd: &str,
    name: &str,
    model: Option<&str>,
    timeout: Duration,
) -> Result<String, String> {
    if cwd.is_empty() {
        return Err("The folder of the chat is empty".into());
    }
    let cwd = expand_home(cwd);
    let cwd = cwd.as_str();
    let name = name.trim();
    let name = if name.is_empty() { "Codex" } else { name };
    tokio::time::timeout(timeout, async {
        let mut connection = CodexConnection::open(socket_path, CHAT_PREPARATION_METHODS).await?;
        let mut params = json!({ "cwd": cwd });
        if let Some(model) = model.filter(|model| model.is_empty() == false) {
            params["model"] = json!(model);
        }
        let started = connection.request("thread/start", params).await?;
        let identifier = started
            .pointer("/thread/id")
            .and_then(Value::as_str)
            .filter(|identifier| is_safe_identifier(identifier))
            .ok_or("thread/start: the answer has no valid chat identifier")?
            .to_string();
        connection
            .request("thread/name/set", json!({ "threadId": identifier, "name": name }))
            .await?;
        Ok(identifier)
    })
    .await
    .map_err(|_| {
        format!(
            "The shared Codex server did not answer in {} seconds",
            timeout.as_secs()
        )
    })?
}

/// The folder with a starting `~` replaced by the home folder: Codex does not expand it.
fn expand_home(cwd: &str) -> String {
    let Some(home) = dirs::home_dir() else {
        return cwd.to_string();
    };
    if cwd == "~" {
        return home.display().to_string();
    }
    match cwd.strip_prefix("~/") {
        Some(rest) => home.join(rest).display().to_string(),
        None => cwd.to_string(),
    }
}

/// True when the identifier can go on the command line of a shell: letters, digits, and `-` only, as in a UUID.
fn is_safe_identifier(identifier: &str) -> bool {
    identifier.is_empty() == false
        && identifier
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
}

#[cfg(test)]
mod tests {
    use super::super::codex_connection::fake_server;
    use super::*;

    #[tokio::test]
    async fn a_chat_is_started_in_the_folder_with_the_model_then_named() {
        let (socket_path, requests) = fake_server::start("prepare", |method, _| match method {
            "thread/start" => Ok(json!({ "thread": { "id": "01a18b90-ca10-7083-b5e0-1bd76b17f8d8" } })),
            "thread/name/set" => Ok(json!({})),
            _ => Err("unexpected".into()),
        });
        let identifier = prepare_chat(
            &socket_path,
            "/work",
            "My tab",
            Some("gpt-6.1-sol"),
            PREPARATION_TIMEOUT,
        )
        .await
        .unwrap();
        assert_eq!(identifier, "01a18b90-ca10-7083-b5e0-1bd76b17f8d8");
        let requests = requests.lock().unwrap().clone();
        assert_eq!(
            requests[2],
            (
                "thread/start".to_string(),
                json!({ "cwd": "/work", "model": "gpt-6.1-sol" })
            )
        );
        assert_eq!(
            requests[3],
            (
                "thread/name/set".to_string(),
                json!({ "threadId": identifier, "name": "My tab" })
            )
        );
        assert_eq!(requests.len(), 4);
    }

    #[tokio::test]
    async fn without_a_model_and_a_name_the_chat_has_the_default_model_and_the_name_codex() {
        let (socket_path, requests) = fake_server::start("prepare_default", |method, _| match method {
            "thread/start" => Ok(json!({ "thread": { "id": "abc-1" } })),
            _ => Ok(json!({})),
        });
        prepare_chat(&socket_path, "/work", "  ", None, PREPARATION_TIMEOUT)
            .await
            .unwrap();
        let requests = requests.lock().unwrap().clone();
        assert_eq!(requests[2].1, json!({ "cwd": "/work" }));
        assert_eq!(requests[3].1["name"], json!("Codex"));
    }

    #[test]
    fn a_folder_that_starts_with_a_tilde_is_in_the_home_folder() {
        let home = dirs::home_dir().unwrap();
        assert_eq!(expand_home("~/work"), home.join("work").display().to_string());
        assert_eq!(expand_home("~"), home.display().to_string());
        assert_eq!(expand_home("/work/~"), "/work/~");
    }

    #[tokio::test]
    async fn an_identifier_that_a_shell_could_misread_is_refused() {
        let (socket_path, _) = fake_server::start("prepare_unsafe", |method, _| match method {
            "thread/start" => Ok(json!({ "thread": { "id": "x'; rm -rf ~" } })),
            _ => Ok(json!({})),
        });
        assert!(prepare_chat(&socket_path, "/work", "tab", None, PREPARATION_TIMEOUT)
            .await
            .is_err());
    }

    #[tokio::test]
    async fn a_missing_server_or_an_error_gives_no_identifier() {
        let path = std::env::temp_dir().join(format!("heidrun_mire_prepare_missing_{}.sock", std::process::id()));
        assert!(prepare_chat(&path, "/work", "tab", None, PREPARATION_TIMEOUT)
            .await
            .is_err());
        let (socket_path, _) = fake_server::start("prepare_error", |_, _| Err("refused".into()));
        assert!(prepare_chat(&socket_path, "/work", "tab", None, PREPARATION_TIMEOUT)
            .await
            .is_err());
    }

    #[tokio::test]
    async fn a_server_that_does_not_answer_stops_after_the_timeout() {
        let folder = std::env::temp_dir().join(format!("heidrun_mire_prepare_silent_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        let socket_path = folder.join("silent.sock");
        let listener = tokio::net::UnixListener::bind(&socket_path).unwrap();
        tokio::spawn(async move {
            let mut streams = Vec::new();
            while let Ok((stream, _)) = listener.accept().await {
                streams.push(stream);
            }
        });
        let started = std::time::Instant::now();
        let error = prepare_chat(&socket_path, "/work", "tab", None, Duration::from_millis(200))
            .await
            .unwrap_err();
        assert!(error.contains("did not answer"));
        assert!(started.elapsed() < Duration::from_secs(2));
    }
}
