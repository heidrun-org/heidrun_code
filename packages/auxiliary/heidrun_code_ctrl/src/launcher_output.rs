//! The output of the orders on the launchers: Markdown for a person or a renderer such as glow, or JSON for a program.

use crate::launcher_types::Launcher;
use crate::output::{longest_run_of_backquotes, to_json_text, Format};
use crate::project_config_file::project_config_path;
use serde_json::{json, Value};
use std::path::Path;

/// The text of the order `list`: the file and the launchers in Markdown, or the list of the launchers in JSON.
pub fn launcher_list_text(launchers: &[Launcher], project_root: &Path, format: Format) -> String {
    match format {
        Format::Json => to_json_text(&Value::Array(launchers.iter().map(launcher_json).collect())),
        Format::Markdown => {
            let mut text = format!("# Launchers\n\nFile: `{}`\n\n", project_config_path(project_root).display());
            if launchers.is_empty() {
                text.push_str("None.\n");
            }
            let blocks: Vec<String> = launchers.iter().map(launcher_block).collect();
            text.push_str(&blocks.join("\n"));
            text
        }
    }
}

/// The text of the order `add` or `update`: a sentence and the launcher in Markdown, or the launcher in JSON.
pub fn launcher_changed_text(verb: &str, launcher: &Launcher, project_root: &Path, format: Format) -> String {
    match format {
        Format::Json => to_json_text(&launcher_json(launcher)),
        Format::Markdown => format!(
            "{verb} the launcher `{}` in the file `{}`.\n\n{}",
            launcher.id,
            project_config_path(project_root).display(),
            launcher_block(launcher)
        ),
    }
}

/// The text of the order `delete`: a sentence in Markdown, or the deleted launcher in JSON.
pub fn launcher_deleted_text(launcher: &Launcher, format: Format) -> String {
    match format {
        Format::Json => to_json_text(&json!({ "deleted": launcher_json(launcher) })),
        Format::Markdown => format!("Deleted the launcher `{}` ({}).\n", launcher.id, launcher.label),
    }
}

/// A launcher as a JSON object with the fields `id`, `label`, `command`, `description`, `cwd`, and `agent`.
fn launcher_json(launcher: &Launcher) -> Value {
    serde_json::to_value(launcher).unwrap_or(Value::Null)
}

/// One launcher in Markdown: its name as a heading, its id, its folder, its coding agent, its description, and its command
/// line in a code block. The code block uses more backquotes than the longest run of backquotes in the command line.
fn launcher_block(launcher: &Launcher) -> String {
    let mut text = format!("## {}\n\n- id: `{}`\n", launcher.label, launcher.id);
    if let Some(cwd) = &launcher.cwd {
        text.push_str(&format!("- folder: `{cwd}`\n"));
    }
    if let Some(agent) = &launcher.agent {
        text.push_str(&format!("- agent: {}\n", agent_words(agent)));
    }
    if let Some(description) = &launcher.description {
        text.push_str(&format!("- description: {description}\n"));
    }
    let fence = "`".repeat(longest_run_of_backquotes(&launcher.command).max(2) + 1);
    text.push_str(&format!("\n{fence}bash\n{}\n{fence}\n", launcher.command));
    text
}

/// The coding agent of a launcher in one line: its name, then its model and its effort when it has them.
fn agent_words(agent: &Value) -> String {
    let field = |key: &str| agent.get(key).and_then(Value::as_str);
    let mut words = field("name").unwrap_or("unknown").to_string();
    if let Some(model) = field("model") {
        words.push_str(&format!(", model {model}"));
    }
    if let Some(effort) = field("effort") {
        words.push_str(&format!(", effort {effort}"));
    }
    words
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn launcher(command: &str) -> Launcher {
        Launcher {
            id: "run-tests-x7q2".into(),
            label: "Run tests".into(),
            command: command.into(),
            description: None,
            cwd: None,
            agent: None,
        }
    }

    fn root() -> PathBuf {
        PathBuf::from("/project")
    }

    #[test]
    fn the_markdown_list_has_the_file_and_one_section_for_each_launcher() {
        let text = launcher_list_text(&[launcher("pnpm test")], &root(), Format::Markdown);
        assert_eq!(
            text,
            "# Launchers\n\nFile: `/project/.heidrun/config.json`\n\n## Run tests\n\n- id: `run-tests-x7q2`\n\n```bash\npnpm test\n```\n"
        );
    }

    #[test]
    fn an_empty_markdown_list_says_none() {
        assert_eq!(launcher_list_text(&[], &root(), Format::Markdown), "# Launchers\n\nFile: `/project/.heidrun/config.json`\n\nNone.\n");
    }

    #[test]
    fn the_folder_the_agent_and_the_description_are_lines_of_the_section() {
        let mut item = launcher("claude 'x'");
        item.cwd = Some("web".into());
        item.description = Some("Two\nlines".into());
        item.agent = Some(json!({ "name": "claude", "model": "opus", "prompt": "x" }));
        let text = launcher_list_text(&[item], &root(), Format::Markdown);
        assert!(text.contains("- id: `run-tests-x7q2`\n- folder: `web`\n- agent: claude, model opus\n- description: Two\nlines\n"));
    }

    #[test]
    fn the_code_block_is_longer_than_the_backquotes_of_the_command_line() {
        let text = launcher_list_text(&[launcher("echo ```")], &root(), Format::Markdown);
        assert!(text.contains("````bash\necho ```\n````\n"));
    }

    #[test]
    fn the_json_list_has_the_six_fields_and_null_for_a_field_the_launcher_does_not_have() {
        let text = launcher_list_text(&[launcher("pnpm test")], &root(), Format::Json);
        let value: Value = serde_json::from_str(&text).unwrap();
        let keys: Vec<&String> = value[0].as_object().unwrap().keys().collect();
        assert_eq!(keys, ["id", "label", "command", "description", "cwd", "agent"]);
        assert_eq!(value[0]["description"], Value::Null);
        assert_eq!(value[0]["command"], "pnpm test");
    }

    #[test]
    fn a_changed_launcher_and_a_deleted_launcher_have_a_sentence_in_markdown_and_an_object_in_json() {
        let item = launcher("pnpm test");
        let added = launcher_changed_text("Added", &item, &root(), Format::Markdown);
        assert!(added.starts_with("Added the launcher `run-tests-x7q2` in the file `/project/.heidrun/config.json`.\n\n## Run tests"));
        assert_eq!(launcher_deleted_text(&item, Format::Markdown), "Deleted the launcher `run-tests-x7q2` (Run tests).\n");
        let deleted: Value = serde_json::from_str(&launcher_deleted_text(&item, Format::Json)).unwrap();
        assert_eq!(deleted["deleted"]["id"], "run-tests-x7q2");
        let changed: Value = serde_json::from_str(&launcher_changed_text("Updated", &item, &root(), Format::Json)).unwrap();
        assert_eq!(changed["label"], "Run tests");
    }
}
