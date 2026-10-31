//! Workspace commands talk only to Herdr, through its executable, without starting a server.

use crate::command_line::WorkspaceCommand;
use crate::herdr::{existing_folder, focus_token, has_coding_agent, output_text, Herdr};
use heidrun_code_ctrl::Format;
use serde_json::{json, Value};

/// Runs one workspace action, returning Herdr's workspace fields in either output format.
pub fn run(action: WorkspaceCommand, session: Option<&str>, format: Format) -> Result<String, String> {
    let herdr = Herdr::new(session);
    let value = match action {
        WorkspaceCommand::List => Value::Array(herdr.list(&["workspace", "list"], "workspaces", "workspace list")?),
        WorkspaceCommand::Open { cwd, label } => {
            let cwd = existing_folder(&cwd, "workspace folder")?;
            let label = label.unwrap_or_else(|| {
                let path = std::path::Path::new(&cwd);
                path.file_name().unwrap_or(path.as_os_str()).to_string_lossy().into_owned()
            });
            let workspace = herdr.workspace(&["workspace", "create", "--cwd", &cwd, "--label", &label, "--focus"])?;
            let id = workspace["workspace_id"].as_str().ok_or("Herdr returned no workspace id.")?;
            let token = format!("heidrun_workspace_folder={cwd}");
            let focus = focus_token(None)?;
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
            if let Err(error) = herdr.publish_focus_request(&id, None) {
                return Err(format!("Herdr focused workspace {id}, but the window focus request failed: {error}"));
            }
            herdr.workspace(&["workspace", "get", &id])?
        }
        WorkspaceCommand::Close { id, force } => {
            let workspace = herdr.workspace(&["workspace", "get", &id])?;
            if !force {
                let panes = herdr.panes_of_workspace(&id).map_err(|error| format!("{error} The workspace was not closed."))?;
                if has_coding_agent(&panes) {
                    return Err(format!("Workspace {id} contains a coding agent. Closing stops its processes. Use --force to close it."));
                }
            }
            herdr.result(&["workspace", "close", &id])?;
            json!({ "closed": workspace })
        }
    };
    let heading = if value.is_array() {
        "Workspaces"
    } else if value.get("closed").is_some() {
        "Closed workspace"
    } else {
        "Workspace"
    };
    output_text(&value, heading, format)
}
