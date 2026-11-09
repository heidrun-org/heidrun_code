//! Pane commands talk only to Herdr, through its executable and, to focus a pane by its id, through its socket. No command
//! starts a server.

use crate::command_line::{OutputOptions, OutputPattern, PaneCommand};
use crate::herdr::{existing_folder, has_coding_agent, output_text, Herdr};
use crate::text_of;
use heidrun_code_ctrl::Format;
use serde_json::{json, Value};

/// Runs one pane action, returning Herdr's pane fields in either output format.
pub fn run(action: PaneCommand, session: Option<&str>, format: Format) -> Result<String, String> {
    let herdr = Herdr::new(session);
    let (heading, value) = match action {
        PaneCommand::List { workspace } => {
            let mut arguments = vec!["pane", "list"];
            if let Some(workspace) = &workspace {
                arguments.extend(["--workspace", workspace]);
            }
            ("Panes", Value::Array(herdr.list(&arguments, "panes", "pane list")?))
        }
        PaneCommand::Split { id, direction, cwd, focus } => {
            let cwd = cwd.map(|cwd| existing_folder(&cwd, "pane folder")).transpose()?;
            let mut arguments = vec!["pane", "split", &id];
            if let Some(direction) = &direction {
                arguments.extend(["--direction", direction]);
            }
            if let Some(cwd) = &cwd {
                arguments.extend(["--cwd", cwd]);
            }
            arguments.push(if focus { "--focus" } else { "--no-focus" });
            let pane = herdr.object(&arguments, "pane", "pane_id", "pane")?;
            if focus {
                let pane_id = pane["pane_id"].as_str().unwrap_or_default();
                let published = match pane.get("workspace_id").and_then(Value::as_str) {
                    Some(workspace_id) => herdr.publish_focus_request(workspace_id, Some(pane_id)),
                    None => Err("Herdr returned a pane without a workspace id.".to_string()),
                };
                if let Err(error) = published {
                    return Err(format!(
                        "Pane {pane_id} was created, but the window focus request failed: {error}. Do not retry split; inspect panes list."
                    ));
                }
            }
            ("Created pane", pane)
        }
        PaneCommand::Rename { id, label } => ("Pane", herdr.object(&["pane", "rename", &id, &label], "pane", "pane_id", "pane")?),
        PaneCommand::Focus { id } => {
            // `herdr pane focus` only moves to a neighbor; the socket request focuses the pane and switches to its tab.
            let result = herdr.socket_request("pane.focus", json!({ "pane_id": id }))?;
            let workspace_id = result.pointer("/pane/workspace_id").and_then(Value::as_str).map(str::to_string);
            let published = match workspace_id {
                Some(workspace_id) => herdr.publish_focus_request(&workspace_id, Some(&id)),
                None => Err("Herdr returned a pane without a workspace id.".to_string()),
            };
            if let Err(error) = published {
                return Err(format!("Herdr focused pane {id}, but the window focus request failed: {error}"));
            }
            ("Pane", pane_by_id(&herdr, &id)?)
        }
        PaneCommand::Close { id, force } => {
            let pane = pane_by_id(&herdr, &id)?;
            if !force && has_coding_agent(std::slice::from_ref(&pane)) {
                return Err(format!("Pane {id} contains a coding agent. Closing stops its processes. Use --force to close it."));
            }
            herdr.result(&["pane", "close", &id])?;
            ("Closed pane", json!({ "closed": pane }))
        }
        PaneCommand::SendText { id, text } => {
            let text = text_of(text)?;
            if text.is_empty() {
                return Err("The command panes send-text needs a text that is not empty.".into());
            }
            herdr.call(&["pane", "send-text", &id, &text])?;
            ("Sent text", json!({ "pane_id": id, "sent_text": text }))
        }
        PaneCommand::SendKeys { id, keys } => {
            let mut arguments = vec!["pane", "send-keys", id.as_str()];
            arguments.extend(keys.iter().map(String::as_str));
            herdr.call(&arguments)?;
            ("Sent keys", json!({ "pane_id": id, "sent_keys": keys }))
        }
        PaneCommand::WaitOutput { id, pattern, timeout, output } => {
            let timeout = timeout.map(|timeout| timeout.to_string());
            let lines = output.lines.map(|lines| lines.to_string());
            let mut arguments = vec!["pane", "wait-output", id.as_str()];
            match &pattern {
                OutputPattern::Match(text) => arguments.extend(["--match", text]),
                OutputPattern::Regex(pattern) => arguments.extend(["--regex", pattern]),
            }
            if let Some(timeout) = &timeout {
                arguments.extend(["--timeout", timeout]);
            }
            add_output_options(&mut arguments, &output, lines.as_deref());
            ("Matched output", herdr.result(&arguments)?)
        }
        PaneCommand::Read { id, output } => {
            let lines = output.lines.map(|lines| lines.to_string());
            let mut arguments = vec!["pane", "read", id.as_str()];
            add_output_options(&mut arguments, &output, lines.as_deref());
            let mut text = herdr.text(&arguments)?;
            // Herdr ends the text with one new line that the pane does not have.
            if text.ends_with('\n') {
                text.pop();
            }
            ("Pane output", json!({ "pane_id": id, "text": text }))
        }
    };
    output_text(&value, heading, format)
}

/// Adds `--source` and `--lines` to the arguments of `pane wait-output` or `pane read`. `lines` is the text of the number.
fn add_output_options<'a>(arguments: &mut Vec<&'a str>, output: &'a OutputOptions, lines: Option<&'a str>) {
    if let Some(source) = &output.source {
        arguments.extend(["--source", source]);
    }
    if let Some(lines) = lines {
        arguments.extend(["--lines", lines]);
    }
}

/// The pane with the id.
fn pane_by_id(herdr: &Herdr, id: &str) -> Result<Value, String> {
    herdr.object(&["pane", "get", id], "pane", "pane_id", "pane")
}
