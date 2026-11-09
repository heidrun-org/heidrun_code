//! Tab commands talk only to Herdr, through its executable, without starting a server.

use crate::command_line::TabCommand;
use crate::herdr::{existing_folder, has_coding_agent, output_text, Herdr};
use heidrun_code_ctrl::Format;
use serde_json::{json, Value};

/// Runs one tab action, returning Herdr's tab fields in either output format.
pub fn run(action: TabCommand, session: Option<&str>, format: Format) -> Result<String, String> {
    let herdr = Herdr::new(session);
    let (heading, value) = match action {
        TabCommand::List { workspace } => {
            let mut arguments = vec!["tab", "list"];
            if let Some(workspace) = &workspace {
                arguments.extend(["--workspace", workspace]);
            }
            ("Tabs", Value::Array(herdr.list(&arguments, "tabs", "tab list")?))
        }
        TabCommand::Create { workspace, label, cwd, focus } => {
            let cwd = cwd.map(|cwd| existing_folder(&cwd, "tab folder")).transpose()?;
            let mut arguments = vec!["tab", "create", "--workspace", &workspace];
            if let Some(label) = &label {
                arguments.extend(["--label", label]);
            }
            if let Some(cwd) = &cwd {
                arguments.extend(["--cwd", cwd]);
            }
            arguments.push(if focus { "--focus" } else { "--no-focus" });
            let result = herdr.result(&arguments)?;
            let tab = result.get("tab").filter(|tab| tab.get("tab_id").and_then(Value::as_str).is_some()).ok_or("Herdr returned no tab.")?;
            let root_pane = result.get("root_pane").cloned().unwrap_or(Value::Null);
            let id = tab["tab_id"].as_str().unwrap_or_default();
            if focus {
                let pane_id = root_pane.get("pane_id").and_then(Value::as_str);
                let workspace_id = tab.get("workspace_id").and_then(Value::as_str).unwrap_or(&workspace);
                if let Err(error) = herdr.publish_focus_request(workspace_id, pane_id) {
                    return Err(format!(
                        "Tab {id} was created, but the window focus request failed: {error}. Do not retry create; inspect tabs list."
                    ));
                }
            }
            ("Created tab", json!({ "tab": tab, "root_pane": root_pane }))
        }
        TabCommand::Rename { id, label } => ("Tab", herdr.object(&["tab", "rename", &id, &label], "tab", "tab_id", "tab")?),
        TabCommand::Focus { id } => {
            let tab = herdr.object(&["tab", "focus", &id], "tab", "tab_id", "tab")?;
            let workspace_id = tab["workspace_id"].as_str().ok_or("Herdr returned a tab without a workspace id.")?;
            let published = herdr.panes_of_workspace(workspace_id).and_then(|panes| {
                let pane_id = focused_pane_of_tab(&panes, &id);
                herdr.publish_focus_request(workspace_id, pane_id.as_deref())
            });
            if let Err(error) = published {
                return Err(format!("Herdr focused tab {id}, but the window focus request failed: {error}"));
            }
            ("Tab", tab_by_id(&herdr, &id)?)
        }
        TabCommand::Close { id, force } => {
            let tab = tab_by_id(&herdr, &id)?;
            if !force {
                let workspace_id = tab["workspace_id"].as_str().ok_or("Herdr returned a tab without a workspace id.")?;
                let panes = herdr.panes_of_workspace(workspace_id).map_err(|error| format!("{error} The tab was not closed."))?;
                let tab_panes: Vec<Value> = panes.into_iter().filter(|pane| pane.get("tab_id").and_then(Value::as_str) == Some(&id)).collect();
                if has_coding_agent(&tab_panes) {
                    return Err(format!("Tab {id} contains a coding agent. Closing stops its processes. Use --force to close it."));
                }
            }
            herdr.result(&["tab", "close", &id])?;
            ("Closed tab", json!({ "closed": tab }))
        }
    };
    output_text(&value, heading, format)
}

/// The tab with the id, from the list of every tab, because `herdr tab` has no documented `get`.
fn tab_by_id(herdr: &Herdr, id: &str) -> Result<Value, String> {
    let tabs = herdr.list(&["tab", "list"], "tabs", "tab list")?;
    tabs.into_iter()
        .find(|tab| tab.get("tab_id").and_then(Value::as_str) == Some(id))
        .ok_or_else(|| format!("No tab has the id {id}. Run tabs list in the same session and copy the id."))
}

/// The pane that Herdr focuses in the tab: the pane with the field `focused`, else the first pane of the tab.
fn focused_pane_of_tab(panes: &[Value], tab_id: &str) -> Option<String> {
    let tab_panes: Vec<&Value> = panes.iter().filter(|pane| pane.get("tab_id").and_then(Value::as_str) == Some(tab_id)).collect();
    let pane = tab_panes.iter().find(|pane| pane.get("focused").and_then(Value::as_bool) == Some(true)).or(tab_panes.first());
    pane.and_then(|pane| pane.get("pane_id").and_then(Value::as_str)).map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_focused_pane_of_a_tab_is_the_pane_that_herdr_focuses_or_else_its_first_pane() {
        let panes = vec![
            json!({ "pane_id": "w1:p1", "tab_id": "w1:t1", "focused": false }),
            json!({ "pane_id": "w1:p2", "tab_id": "w1:t2", "focused": false }),
            json!({ "pane_id": "w1:p3", "tab_id": "w1:t2", "focused": true }),
        ];
        assert_eq!(focused_pane_of_tab(&panes, "w1:t2").as_deref(), Some("w1:p3"));
        assert_eq!(focused_pane_of_tab(&panes, "w1:t1").as_deref(), Some("w1:p1"));
        assert_eq!(focused_pane_of_tab(&panes, "w1:t9"), None);
    }
}
