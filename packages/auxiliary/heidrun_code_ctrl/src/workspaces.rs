//! Workspace commands talk only to Herdr, through its executable, without starting a server.

use crate::command_line::WorkspaceCommand;
use heidrun_code_ctrl::Format;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::process::{Command, Stdio};

struct Herdr<'a> {
    session: Option<&'a str>,
}

impl Herdr<'_> {
    fn call(&self, arguments: &[&str]) -> Result<Option<Value>, String> {
        let mut command = Command::new("herdr");
        if let Some(session) = self.session {
            command.args(["--session", session]);
            command.env_remove("HERDR_SESSION").env_remove("HERDR_SOCKET_PATH");
        } else if ["HERDR_SESSION", "HERDR_SOCKET_PATH"].iter().all(|name| std::env::var(name).map_or(true, |value| value.is_empty())) {
            command.args(["--session", "heidrun"]);
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
        // report-metadata succeeds without writing a response body.
        if output.stdout.is_empty() {
            return Ok(None);
        }
        let response: Value = serde_json::from_slice(&output.stdout).map_err(|error| format!("Herdr returned invalid JSON: {error}"))?;
        if let Some(error) = response.get("error") {
            return Err(format!("Herdr failed: {error}"));
        }
        response.get("result").cloned().map(Some).ok_or_else(|| "Herdr returned no result.".into())
    }

    fn result(&self, arguments: &[&str]) -> Result<Value, String> {
        self.call(arguments)?.ok_or_else(|| "Herdr returned no result.".into())
    }

    fn workspace(&self, arguments: &[&str]) -> Result<Value, String> {
        let result = self.result(arguments)?;
        let workspace = result.get("workspace").filter(|workspace| workspace.get("workspace_id").and_then(Value::as_str).is_some());
        workspace.cloned().ok_or_else(|| "Herdr returned no workspace.".into())
    }
}

/// Runs one workspace action, returning Herdr's workspace fields in either output format.
pub fn run(action: WorkspaceCommand, session: Option<&str>, format: Format) -> Result<String, String> {
    let herdr = Herdr { session };
    let value = match action {
        WorkspaceCommand::List => {
            let result = herdr.result(&["workspace", "list"])?;
            result.get("workspaces").filter(|value| value.is_array()).cloned().ok_or("Herdr returned no workspace list.")?
        }
        WorkspaceCommand::Open { cwd, label } => {
            let path = if cwd == "~" || cwd.starts_with("~/") {
                let home = dirs::home_dir().ok_or("The home folder cannot be found.")?;
                if cwd == "~" {
                    home
                } else {
                    home.join(&cwd[2..])
                }
            } else {
                PathBuf::from(&cwd)
            };
            let path = std::fs::canonicalize(&path).map_err(|error| format!("Cannot open workspace folder {}: {error}", path.display()))?;
            if !path.is_dir() {
                return Err("The workspace folder must be a folder.".into());
            }
            let cwd = path.to_str().ok_or("The workspace folder is not valid UTF-8.")?;
            let label = label.unwrap_or_else(|| path.file_name().unwrap_or(path.as_os_str()).to_string_lossy().into_owned());
            let workspace = herdr.workspace(&["workspace", "create", "--cwd", cwd, "--label", &label, "--focus"])?;
            let id = workspace["workspace_id"].as_str().ok_or("Herdr returned no workspace id.")?;
            let token = format!("heidrun_workspace_folder={cwd}");
            let focus = focus_token()?;
            // Heidrun Code saves this explicit creation folder once, without deriving it from a pane.
            if let Err(error) =
                herdr.call(&["workspace", "report-metadata", id, "--source", "heidrun_code_ctrl", "--token", &token, "--token", &focus])
            {
                return Err(format!("Workspace {id} was opened, but its folder could not be published: {error}. Do not retry open; inspect workspaces list."));
            }
            herdr.workspace(&["workspace", "get", id])?
        }
        WorkspaceCommand::Rename { id, label } => herdr.workspace(&["workspace", "rename", &id, &label])?,
        WorkspaceCommand::Focus { id } => {
            herdr.workspace(&["workspace", "focus", &id])?;
            let token = focus_token()?;
            if let Err(error) = herdr.call(&["workspace", "report-metadata", &id, "--source", "heidrun_code_ctrl", "--token", &token]) {
                return Err(format!("Herdr focused workspace {id}, but the window focus request failed: {error}"));
            }
            herdr.workspace(&["workspace", "get", &id])?
        }
        WorkspaceCommand::Close { id, force } => {
            let workspace = herdr.workspace(&["workspace", "get", &id])?;
            if !force {
                let result = herdr.result(&["pane", "list", "--workspace", &id])?;
                let panes =
                    result.get("panes").and_then(Value::as_array).ok_or("Herdr returned no pane list; the workspace was not closed.")?;
                if panes.iter().any(|pane| {
                    pane.get("agent").and_then(Value::as_str).is_some_and(|agent| !agent.is_empty())
                        || pane.get("agent_session").is_some_and(|session| !session.is_null())
                }) {
                    return Err(format!("Workspace {id} contains a coding agent. Closing stops its processes. Use --force to close it."));
                }
            }
            herdr.result(&["workspace", "close", &id])?;
            json!({ "closed": workspace })
        }
    };
    let json = serde_json::to_string_pretty(&value).map_err(|error| error.to_string())?;
    match format {
        Format::Json => Ok(format!("{json}\n")),
        Format::Markdown => {
            let heading = if value.is_array() {
                "Workspaces"
            } else if value.get("closed").is_some() {
                "Closed workspace"
            } else {
                "Workspace"
            };
            let fence = "`".repeat(longest_backquotes(&json).max(2) + 1);
            Ok(format!("# {heading}\n\n{fence}json\n{json}\n{fence}\n"))
        }
    }
}

fn longest_backquotes(text: &str) -> usize {
    text.split(|character| character != '`').map(str::len).max().unwrap_or(0)
}

/// A different value makes Herdr publish an event even when its focus is unchanged.
fn focus_token() -> Result<String, String> {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|error| error.to_string())?;
    Ok(format!("heidrun_focus_request={}-{}", std::process::id(), now.as_nanos()))
}
