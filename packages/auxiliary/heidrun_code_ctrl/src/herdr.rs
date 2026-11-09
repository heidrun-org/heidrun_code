//! The calls to Herdr that the groups `workspaces`, `tabs`, and `panes` share: its executable, its socket, the focus request
//! for the window, and the output of a Herdr value. No call starts a Herdr server.

use heidrun_code_ctrl::Format;
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::UnixStream;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::Duration;

/// The session that the commands use when neither `--session` nor the inherited connection chooses one: the installed
/// Heidrun Code.
const DEFAULT_SESSION: &str = "heidrun";

/// The longest wait for the answer of the Herdr socket.
const SOCKET_TIMEOUT: Duration = Duration::from_secs(10);

/// One Herdr session, chosen by `--session`, else by the inherited `HERDR_SOCKET_PATH` or `HERDR_SESSION`, else `heidrun`.
pub struct Herdr<'a> {
    /// The session of the option `--session`, or `None` to use the inherited connection.
    session: Option<&'a str>,
}

impl<'a> Herdr<'a> {
    /// The session of the option `--session`, or `None` to use the inherited connection, else `heidrun`.
    pub fn new(session: Option<&'a str>) -> Herdr<'a> {
        Herdr { session }
    }

    /// Runs the Herdr executable with the arguments, and gives its standard output.
    fn run(&self, arguments: &[&str]) -> Result<Vec<u8>, String> {
        let mut command = Command::new("herdr");
        if let Some(session) = self.session {
            command.args(["--session", session]);
            command.env_remove("HERDR_SESSION").env_remove("HERDR_SOCKET_PATH");
        } else if !is_session_inherited() {
            command.args(["--session", DEFAULT_SESSION]);
        }
        let output = command
            .args(arguments)
            .stdin(Stdio::null())
            .output()
            .map_err(|error| format!("Cannot run Herdr. Check that herdr is installed and on the shell path: {error}"))?;
        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            let detail = serde_json::from_str::<Value>(&error)
                .ok()
                .and_then(|value| value.pointer("/error/message").and_then(Value::as_str).map(str::to_string))
                .unwrap_or_else(|| error.trim().to_string());
            return Err(format!("Herdr failed: {}", if detail.is_empty() { "no error message was returned" } else { &detail }));
        }
        Ok(output.stdout)
    }

    /// Runs a Herdr command that answers in JSON, and gives the field `result`, or `None` for a command that writes nothing.
    pub fn call(&self, arguments: &[&str]) -> Result<Option<Value>, String> {
        let stdout = self.run(arguments)?;
        // report-metadata, send-text, and send-keys succeed without writing a response body.
        if stdout.is_empty() {
            return Ok(None);
        }
        let response: Value = serde_json::from_slice(&stdout).map_err(|error| format!("Herdr returned invalid JSON: {error}"))?;
        if let Some(error) = response.get("error") {
            return Err(format!("Herdr failed: {error}"));
        }
        response.get("result").cloned().map(Some).ok_or_else(|| "Herdr returned no result.".into())
    }

    /// Like `call`, for a command that always gives a result.
    pub fn result(&self, arguments: &[&str]) -> Result<Value, String> {
        self.call(arguments)?.ok_or_else(|| "Herdr returned no result.".into())
    }

    /// Runs a Herdr command that writes plain text, such as `pane read`, and gives the text.
    pub fn text(&self, arguments: &[&str]) -> Result<String, String> {
        let stdout = self.run(arguments)?;
        String::from_utf8(stdout).map_err(|error| format!("Herdr returned text that is not valid UTF-8: {error}"))
    }

    /// The object in the field `key` of the result, which must have the string field `id_field`. `what` names the object in
    /// the error.
    pub fn object(&self, arguments: &[&str], key: &str, id_field: &str, what: &str) -> Result<Value, String> {
        let result = self.result(arguments)?;
        let object = result.get(key).filter(|object| object.get(id_field).and_then(Value::as_str).is_some());
        object.cloned().ok_or_else(|| format!("Herdr returned no {what}."))
    }

    /// The workspace in the result of a Herdr command.
    pub fn workspace(&self, arguments: &[&str]) -> Result<Value, String> {
        self.object(arguments, "workspace", "workspace_id", "workspace")
    }

    /// The list in the field `key` of the result. `what` names the list in the error.
    pub fn list(&self, arguments: &[&str], key: &str, what: &str) -> Result<Vec<Value>, String> {
        let result = self.result(arguments)?;
        result.get(key).and_then(Value::as_array).cloned().ok_or_else(|| format!("Herdr returned no {what}."))
    }

    /// The panes of one workspace.
    pub fn panes_of_workspace(&self, workspace_id: &str) -> Result<Vec<Value>, String> {
        self.list(&["pane", "list", "--workspace", workspace_id], "panes", "pane list")
    }

    /// Sends one request to the socket of the session, and gives the field `result` of the answer. The Herdr executable has
    /// no command for some requests, such as `pane.focus` with a pane id.
    pub fn socket_request(&self, method: &str, params: Value) -> Result<Value, String> {
        let path = self.socket_path();
        let mut stream = UnixStream::connect(&path).map_err(|error| {
            format!("Cannot reach the Herdr socket {}: {error}. Check that the Herdr session is running.", path.display())
        })?;
        stream.set_read_timeout(Some(SOCKET_TIMEOUT)).map_err(|error| error.to_string())?;
        let request = json!({ "id": format!("heidrun_code_ctrl:{method}"), "method": method, "params": params });
        let line = format!("{request}\n");
        stream.write_all(line.as_bytes()).map_err(|error| format!("Cannot write to the Herdr socket {}: {error}", path.display()))?;
        let mut answer = String::new();
        BufReader::new(&stream)
            .read_line(&mut answer)
            .map_err(|error| format!("Cannot read the answer of the Herdr socket {}: {error}", path.display()))?;
        let response: Value =
            serde_json::from_str(&answer).map_err(|error| format!("The Herdr socket returned invalid JSON: {error}"))?;
        if let Some(error) = response.get("error") {
            let detail = error.get("message").and_then(Value::as_str).map(str::to_string).unwrap_or_else(|| error.to_string());
            return Err(format!("Herdr failed: {detail}"));
        }
        response.get("result").cloned().ok_or_else(|| "The Herdr socket returned no result.".into())
    }

    /// The path of the socket of the session, with the same choice as the executable: `--session`, else the inherited
    /// `HERDR_SOCKET_PATH`, else the inherited `HERDR_SESSION`, else `heidrun`. The folder of the sessions is
    /// `$XDG_CONFIG_HOME/herdr`, or else `~/.config/herdr`.
    fn socket_path(&self) -> PathBuf {
        let session = match self.session {
            Some(session) => session.to_string(),
            None => {
                if let Some(path) = non_empty_variable("HERDR_SOCKET_PATH") {
                    return PathBuf::from(path);
                }
                non_empty_variable("HERDR_SESSION").unwrap_or_else(|| DEFAULT_SESSION.to_string())
            }
        };
        let config = match non_empty_variable("XDG_CONFIG_HOME") {
            Some(folder) => PathBuf::from(folder).join("herdr"),
            None => dirs::home_dir().unwrap_or_default().join(".config").join("herdr"),
        };
        config.join("sessions").join(session).join("herdr.sock")
    }

    /// Publishes a new focus request on the workspace, so that the running window selects the workspace, and the pane when
    /// one is given, even when the focus of Herdr does not change.
    pub fn publish_focus_request(&self, workspace_id: &str, pane_id: Option<&str>) -> Result<(), String> {
        let token = focus_token(pane_id)?;
        self.call(&["workspace", "report-metadata", workspace_id, "--source", "heidrun_code_ctrl", "--token", &token])?;
        Ok(())
    }
}

/// True when the inherited `HERDR_SESSION` or `HERDR_SOCKET_PATH` chooses the session.
fn is_session_inherited() -> bool {
    ["HERDR_SESSION", "HERDR_SOCKET_PATH"].iter().any(|name| non_empty_variable(name).is_some())
}

/// The value of an environment variable, or `None` when it is missing or empty.
fn non_empty_variable(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|value| !value.is_empty())
}

/// The token `heidrun_focus_request`. A different value makes Herdr publish an event even when its focus is unchanged.
/// Herdr keeps each token until a new value replaces it, so the pane to select is part of the same value, after `;pane=`:
/// a later workspace focus replaces the whole value and never selects an old pane.
pub fn focus_token(pane_id: Option<&str>) -> Result<String, String> {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|error| error.to_string())?;
    let request = format!("heidrun_focus_request={}-{}", std::process::id(), now.as_nanos());
    Ok(match pane_id {
        Some(pane_id) => format!("{request};pane={pane_id}"),
        None => request,
    })
}

/// True when one of the panes has a coding agent: a field `agent` that is not empty, or a field `agent_session` that is not
/// null.
pub fn has_coding_agent(panes: &[Value]) -> bool {
    panes.iter().any(|pane| {
        pane.get("agent").and_then(Value::as_str).is_some_and(|agent| !agent.is_empty())
            || pane.get("agent_session").is_some_and(|session| !session.is_null())
    })
}

/// The absolute path of an existing folder: `~` and `~/` are the home folder, and a relative path starts at the current
/// folder. `what` names the folder in the errors, for example "workspace folder".
pub fn existing_folder(cwd: &str, what: &str) -> Result<String, String> {
    let path = if cwd == "~" || cwd.starts_with("~/") {
        let home = dirs::home_dir().ok_or("The home folder cannot be found.")?;
        if cwd == "~" {
            home
        } else {
            home.join(&cwd[2..])
        }
    } else {
        PathBuf::from(cwd)
    };
    let path = std::fs::canonicalize(&path).map_err(|error| format!("Cannot open {what} {}: {error}", path.display()))?;
    if !path.is_dir() {
        return Err(format!("The {what} must be a folder."));
    }
    path.to_str().map(str::to_string).ok_or_else(|| format!("The {what} is not valid UTF-8."))
}

/// The text of a Herdr value: pretty JSON, or for Markdown the same JSON in a fenced block under the heading.
pub fn output_text(value: &Value, heading: &str, format: Format) -> Result<String, String> {
    let json = serde_json::to_string_pretty(value).map_err(|error| error.to_string())?;
    match format {
        Format::Json => Ok(format!("{json}\n")),
        Format::Markdown => {
            let fence = "`".repeat(longest_backquotes(&json).max(2) + 1);
            Ok(format!("# {heading}\n\n{fence}json\n{json}\n{fence}\n"))
        }
    }
}

/// The length of the longest run of backquotes in the text, so that the fence of a code block is longer.
fn longest_backquotes(text: &str) -> usize {
    text.split(|character| character != '`').map(str::len).max().unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_focus_request_holds_the_pane_in_the_same_value() {
        let workspace = focus_token(None).unwrap();
        assert!(workspace.starts_with("heidrun_focus_request=") && !workspace.contains(";pane="), "{workspace}");
        let pane = focus_token(Some("w1:p2")).unwrap();
        assert!(pane.starts_with("heidrun_focus_request=") && pane.ends_with(";pane=w1:p2"), "{pane}");
    }

    #[test]
    fn a_coding_agent_is_a_field_agent_that_is_not_empty_or_a_field_agent_session_that_is_not_null() {
        assert!(!has_coding_agent(&[json!({}), json!({ "agent": "", "agent_session": null })]));
        assert!(has_coding_agent(&[json!({}), json!({ "agent": "claude" })]));
        assert!(has_coding_agent(&[json!({ "agent_session": { "agent": "codex" } })]));
    }

    #[test]
    fn the_markdown_fence_is_longer_than_any_run_of_backquotes() {
        let text = output_text(&json!({ "text": "````" }), "Pane output", Format::Markdown).unwrap();
        assert!(text.starts_with("# Pane output\n\n`````json\n"), "{text}");
    }
}
