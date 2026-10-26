//! The four orders on the launchers: list, add, update, and delete.

use crate::ids::unused_id;
use crate::launcher_types::Launcher;
use crate::project_launchers::{change_project_launchers, entry_id, launcher_of_entry, read_project_launchers};
use crate::project_config_file::project_config_path;
use serde_json::{json, Map, Value};
use std::path::Path;

/// The number of characters of the command line that become the name of a launcher that has no name. It is the number of
/// the window.
pub const LABEL_FROM_COMMAND_LENGTH: usize = 20;

/// The number of random characters at the end of the id that the order `add` makes. It is the number of the window.
const ID_SUFFIX_LENGTH: usize = 4;

/// What the order `add` makes.
#[derive(Debug, Clone, Default)]
pub struct NewLauncher {
    /// The id of the launcher. `None` makes an id from the name and four random characters, as the window does.
    pub id: Option<String>,
    /// The name. `None` or an empty text takes the first characters of the command line.
    pub label: Option<String>,
    /// The command line that the launcher runs. It cannot be empty.
    pub command: String,
    /// The description, on several lines. `None` or an empty text is no description.
    pub description: Option<String>,
    /// The folder where the command line runs, relative to the root of the project. `None` or an empty text is the root.
    pub cwd: Option<String>,
}

/// What the order `update` changes. A field that is `None` stays as it is.
#[derive(Debug, Clone, Default)]
pub struct LauncherChanges {
    /// The new name. An empty text takes the first characters of the command line of the launcher.
    pub label: Option<String>,
    /// The new command line. It cannot be empty, and a launcher of the kind Coding agent refuses it.
    pub command: Option<String>,
    /// The new description. An empty text removes the description.
    pub description: Option<String>,
    /// The new folder. An empty text removes the folder: the launcher then runs in the root of the project.
    pub cwd: Option<String>,
}

/// The name of a launcher that has none: the command line on one line, then its first 20 characters. It is the name that
/// the window makes.
pub fn label_from_command(command: &str) -> String {
    let one_line = command.split_whitespace().collect::<Vec<&str>>().join(" ");
    one_line.chars().take(LABEL_FROM_COMMAND_LENGTH).collect::<String>().trim().to_string()
}

/// Lists the launchers of the project at `project_root`.
///
/// # Errors
/// The file of the project cannot be read or is not valid.
pub fn list_launchers(project_root: &Path) -> Result<Vec<Launcher>, String> {
    read_project_launchers(project_root)
}

/// Adds a launcher with a command line to the project at `project_root`.
///
/// # Errors
/// The command line is empty, the id is empty or is already taken, or the file cannot be read, is not valid, or cannot be
/// written.
pub fn add_launcher(project_root: &Path, new: NewLauncher) -> Result<Launcher, String> {
    let command = new.command.trim().to_string();
    if command.is_empty() {
        return Err("The command line of a launcher cannot be empty.".to_string());
    }
    let taken: Vec<String> = list_launchers(project_root)?.into_iter().map(|launcher| launcher.id).collect();
    let label = match new.label.as_deref().map(str::trim) {
        Some(label) if !label.is_empty() => label.to_string(),
        _ => label_from_command(&command),
    };
    let id = match new.id {
        Some(id) if id.trim().is_empty() => return Err("The id of a launcher cannot be empty.".to_string()),
        Some(id) if taken.contains(&id) => return Err(format!("A launcher with the id {id} already exists.")),
        Some(id) => id,
        None => unused_id(&slug(&label), ID_SUFFIX_LENGTH, &taken),
    };
    let mut entry = Map::new();
    entry.insert("id".to_string(), json!(id));
    entry.insert("label".to_string(), json!(label));
    entry.insert("command".to_string(), json!(command));
    for (key, value) in [("description", &new.description), ("cwd", &new.cwd)] {
        if let Some(text) = value.as_deref().map(str::trim).filter(|text| !text.is_empty()) {
            entry.insert(key.to_string(), json!(text));
        }
    }
    let path = project_config_path(project_root);
    let launcher = launcher_of_entry(&Value::Object(entry.clone()), 0, &path)?;
    change_project_launchers(project_root, |mut entries| {
        entries.push(Value::Object(entry));
        Ok(entries)
    })?;
    Ok(launcher)
}

/// Changes the launcher `id` of the project at `project_root`. The fields that are not given, and the fields that the
/// order does not know, stay as they are.
///
/// # Errors
/// No change is given, the new command line is empty, no launcher has the id, the launcher is of the kind Coding agent and
/// a new command line is given, or the file cannot be read, is not valid, or cannot be written.
pub fn update_launcher(project_root: &Path, id: &str, changes: LauncherChanges) -> Result<Launcher, String> {
    if changes.label.is_none() && changes.command.is_none() && changes.description.is_none() && changes.cwd.is_none() {
        return Err("Give at least one of --label, --command, --description, and --cwd.".to_string());
    }
    let command = changes.command.as_deref().map(str::trim);
    if command.is_some_and(str::is_empty) {
        return Err("The command line of a launcher cannot be empty.".to_string());
    }
    let path = project_config_path(project_root);
    let mut updated: Option<Launcher> = None;
    change_project_launchers(project_root, |entries| {
        let index = position_of(&entries, id)?;
        let mut fields = match &entries[index] {
            Value::Object(fields) => fields.clone(),
            _ => Map::new(),
        };
        if command.is_some() && fields.get("agent").is_some_and(|agent| !agent.is_null()) {
            return Err(format!(
                "The launcher {id} is of the kind Coding agent: its command line is made from its field agent, so --command cannot change it. Change it in the window, or delete the launcher and add a new one."
            ));
        }
        if let Some(command) = command {
            fields.insert("command".to_string(), json!(command));
        }
        if let Some(label) = changes.label.as_deref().map(str::trim) {
            let label = if label.is_empty() {
                label_from_command(fields.get("command").and_then(Value::as_str).unwrap_or_default())
            } else {
                label.to_string()
            };
            fields.insert("label".to_string(), json!(label));
        }
        for (key, value) in [("description", &changes.description), ("cwd", &changes.cwd)] {
            if let Some(text) = value.as_deref().map(str::trim) {
                fields = with_text(fields, key, text);
            }
        }
        let entry = Value::Object(fields);
        updated = Some(launcher_of_entry(&entry, index, &path)?);
        let mut entries = entries;
        entries[index] = entry;
        Ok(entries)
    })?;
    updated.ok_or_else(|| format!("No launcher has the id {id}. Run `heidrun_code_ctrl launchers list` to see the ids."))
}

/// Deletes the launcher `id` of the project at `project_root`, and gives the launcher that it deleted. It does not close
/// the tab where the launcher runs: the command line never talks to the running application.
///
/// # Errors
/// No launcher has the id, or the file cannot be read, is not valid, or cannot be written.
pub fn delete_launcher(project_root: &Path, id: &str) -> Result<Launcher, String> {
    let path = project_config_path(project_root);
    let mut deleted: Option<Launcher> = None;
    change_project_launchers(project_root, |mut entries| {
        let index = position_of(&entries, id)?;
        let entry = entries.remove(index);
        deleted = Some(launcher_of_entry(&entry, index, &path)?);
        Ok(entries)
    })?;
    deleted.ok_or_else(|| format!("No launcher has the id {id}. Run `heidrun_code_ctrl launchers list` to see the ids."))
}

/// The place of the first entry that has the id, or an error that says how to find the ids.
fn position_of(entries: &[Value], id: &str) -> Result<usize, String> {
    entries
        .iter()
        .position(|entry| entry_id(entry) == Some(id))
        .ok_or_else(|| format!("No launcher has the id {id}. Run `heidrun_code_ctrl launchers list` to see the ids."))
}

/// The fields with the field `key` set to `text`, or without the field `key` when `text` is empty. A field that stays keeps
/// its place.
fn with_text(fields: Map<String, Value>, key: &str, text: &str) -> Map<String, Value> {
    if text.is_empty() {
        return fields.into_iter().filter(|(name, _)| name != key).collect();
    }
    let mut fields = fields;
    fields.insert(key.to_string(), json!(text));
    fields
}

/// The name in lower case, with each run of signs that are not the letters a to z or the digits turned into one dash. An
/// empty result is `launcher`. It is the base of the id that the window makes.
fn slug(label: &str) -> String {
    let mut slug = String::new();
    for character in label.to_lowercase().chars() {
        if character.is_ascii_alphanumeric() {
            slug.push(character);
        } else if !slug.is_empty() && !slug.ends_with('-') {
            slug.push('-');
        }
    }
    let slug = slug.trim_end_matches('-').to_string();
    if slug.is_empty() {
        "launcher".to_string()
    } else {
        slug
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    /// A new empty project folder for one test, with the folder `.heidrun`.
    fn test_project(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("heidrun_code_ctrl_launcher_orders_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join(".heidrun")).unwrap();
        root
    }

    fn new_launcher(label: &str, command: &str) -> NewLauncher {
        NewLauncher { label: Some(label.to_string()), command: command.to_string(), ..NewLauncher::default() }
    }

    fn written(root: &Path) -> Value {
        serde_json::from_str(&std::fs::read_to_string(project_config_path(root)).unwrap()).unwrap()
    }

    #[test]
    fn a_project_with_no_launcher_lists_none() {
        assert_eq!(list_launchers(&test_project("list_empty")), Ok(Vec::new()));
    }

    #[test]
    fn an_added_launcher_is_listed_and_written_in_the_key_launchers() {
        let root = test_project("add");
        let added = add_launcher(&root, new_launcher("Run the tests", "pnpm test")).unwrap();
        assert!(added.id.starts_with("run-the-tests-") && added.id.len() == "run-the-tests-".len() + 4);
        assert_eq!(list_launchers(&root).unwrap(), vec![added.clone()]);
        assert_eq!(written(&root)["launchers"][0], json!({ "id": added.id, "label": "Run the tests", "command": "pnpm test" }));
    }

    #[test]
    fn a_launcher_without_a_name_takes_the_first_20_characters_of_its_command_line_on_one_line() {
        let root = test_project("label");
        let added = add_launcher(&root, NewLauncher { command: "  pnpm   --filter web_frontend\n   test  ".into(), ..NewLauncher::default() }).unwrap();
        assert_eq!(added.label, "pnpm --filter web_fr");
        assert_eq!(label_from_command("a   b"), "a b");
        assert_eq!(label_from_command("12345678901234567 9 abc"), "12345678901234567 9");
        assert_eq!(label_from_command("1234567890123456789 x"), "1234567890123456789");
    }

    #[test]
    fn the_id_base_is_the_name_in_lower_case_with_dashes_and_launcher_when_it_is_empty() {
        assert_eq!(slug("Run the TESTS !"), "run-the-tests");
        assert_eq!(slug("--a--b--"), "a-b");
        assert_eq!(slug("???"), "launcher");
        assert_eq!(slug("Où"), "o");
    }

    #[test]
    fn the_description_and_the_folder_are_trimmed_and_written_only_when_they_are_not_empty() {
        let root = test_project("optional");
        let with = add_launcher(
            &root,
            NewLauncher { description: Some("  Two\nlines ".into()), cwd: Some(" web ".into()), ..new_launcher("A", "ls") },
        )
        .unwrap();
        assert_eq!(with.description.as_deref(), Some("Two\nlines"));
        assert_eq!(with.cwd.as_deref(), Some("web"));
        let without = add_launcher(&root, NewLauncher { description: Some("  ".into()), cwd: Some(String::new()), ..new_launcher("B", "ls") }).unwrap();
        assert_eq!((without.description, without.cwd), (None, None));
        assert!(written(&root)["launchers"][1].get("description").is_none());
    }

    #[test]
    fn an_empty_command_line_and_an_empty_or_taken_id_are_refused_and_write_no_file() {
        let root = test_project("add_refused");
        assert!(add_launcher(&root, new_launcher("A", "  ")).unwrap_err().contains("cannot be empty"));
        assert!(add_launcher(&root, NewLauncher { id: Some(" ".into()), ..new_launcher("A", "ls") }).unwrap_err().contains("id of a launcher"));
        add_launcher(&root, NewLauncher { id: Some("same".into()), ..new_launcher("A", "ls") }).unwrap();
        let error = add_launcher(&root, NewLauncher { id: Some("same".into()), ..new_launcher("B", "pwd") }).unwrap_err();
        assert!(error.contains("already exists"));
        assert_eq!(list_launchers(&root).unwrap().len(), 1);
    }

    #[test]
    fn an_update_changes_only_the_fields_that_are_given() {
        let root = test_project("update");
        let added = add_launcher(&root, NewLauncher { description: Some("Old".into()), cwd: Some("web".into()), ..new_launcher("Title", "ls") }).unwrap();
        let updated = update_launcher(&root, &added.id, LauncherChanges { command: Some("ls -la".into()), ..LauncherChanges::default() }).unwrap();
        assert_eq!((updated.label.as_str(), updated.command.as_str()), ("Title", "ls -la"));
        assert_eq!((updated.description.as_deref(), updated.cwd.as_deref()), (Some("Old"), Some("web")));
        assert_eq!(list_launchers(&root).unwrap(), vec![updated]);
    }

    #[test]
    fn an_empty_description_or_folder_removes_the_field_and_an_empty_name_takes_the_command_line() {
        let root = test_project("update_empty");
        let added = add_launcher(&root, NewLauncher { description: Some("Old".into()), cwd: Some("web".into()), ..new_launcher("Title", "pnpm test") }).unwrap();
        let changes = LauncherChanges { label: Some(String::new()), description: Some(String::new()), cwd: Some(" ".into()), ..LauncherChanges::default() };
        let updated = update_launcher(&root, &added.id, changes).unwrap();
        assert_eq!((updated.label.as_str(), updated.description, updated.cwd), ("pnpm test", None, None));
        let entry = &written(&root)["launchers"][0];
        assert!(entry.get("description").is_none() && entry.get("cwd").is_none());
    }

    #[test]
    fn an_update_keeps_the_fields_that_the_command_does_not_know_and_the_order_of_the_fields() {
        let root = test_project("update_extra");
        std::fs::write(project_config_path(&root), r#"{"version":1,"launchers":[{"id":"a","extra":true,"label":"A","command":"ls"}]}"#).unwrap();
        update_launcher(&root, "a", LauncherChanges { label: Some("B".into()), ..LauncherChanges::default() }).unwrap();
        let entry = &written(&root)["launchers"][0];
        assert_eq!(entry["extra"], true);
        let keys: Vec<&String> = entry.as_object().unwrap().keys().collect();
        assert_eq!(keys, ["id", "extra", "label", "command"]);
    }

    #[test]
    fn an_update_of_a_launcher_of_the_kind_coding_agent_keeps_its_agent_and_refuses_a_new_command_line() {
        let root = test_project("update_agent");
        let text = r#"{"version":1,"launchers":[{"id":"a","label":"A","command":"claude 'x'","agent":{"name":"claude","model":"opus","prompt":"x"}}]}"#;
        std::fs::write(project_config_path(&root), text).unwrap();
        let renamed = update_launcher(&root, "a", LauncherChanges { label: Some("B".into()), cwd: Some("web".into()), ..LauncherChanges::default() }).unwrap();
        assert_eq!(renamed.agent, Some(json!({ "name": "claude", "model": "opus", "prompt": "x" })));
        assert_eq!(written(&root)["launchers"][0]["command"], "claude 'x'");
        let before = std::fs::read_to_string(project_config_path(&root)).unwrap();
        let error = update_launcher(&root, "a", LauncherChanges { command: Some("ls".into()), ..LauncherChanges::default() }).unwrap_err();
        assert!(error.contains("kind Coding agent") && error.contains("--command"));
        assert_eq!(std::fs::read_to_string(project_config_path(&root)).unwrap(), before);
    }

    #[test]
    fn an_update_with_nothing_to_change_an_empty_command_line_or_an_unknown_id_is_an_error() {
        let root = test_project("update_refused");
        let added = add_launcher(&root, new_launcher("A", "ls")).unwrap();
        assert!(update_launcher(&root, &added.id, LauncherChanges::default()).unwrap_err().contains("at least one of"));
        let empty = LauncherChanges { command: Some("  ".into()), ..LauncherChanges::default() };
        assert!(update_launcher(&root, &added.id, empty).unwrap_err().contains("cannot be empty"));
        let label = LauncherChanges { label: Some("B".into()), ..LauncherChanges::default() };
        assert!(update_launcher(&root, "nothing", label).unwrap_err().contains("launchers list"));
        assert_eq!(list_launchers(&root).unwrap(), vec![added]);
    }

    #[test]
    fn a_delete_removes_the_launcher_from_the_file_and_keeps_the_others() {
        let root = test_project("delete");
        let first = add_launcher(&root, new_launcher("First", "1")).unwrap();
        let second = add_launcher(&root, new_launcher("Second", "2")).unwrap();
        assert_eq!(delete_launcher(&root, &first.id), Ok(first));
        assert_eq!(list_launchers(&root).unwrap(), vec![second]);
    }

    #[test]
    fn a_delete_of_an_unknown_id_says_how_to_find_the_ids_and_writes_no_file() {
        let root = test_project("delete_unknown");
        assert!(delete_launcher(&root, "nothing").unwrap_err().contains("launchers list"));
        assert!(!project_config_path(&root).exists());
    }
}
