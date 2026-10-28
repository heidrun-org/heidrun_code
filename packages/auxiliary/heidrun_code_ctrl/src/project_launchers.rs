//! The launchers: the key `launchers` of the file `.heidrun/config.json` of a project.
//!
//! A file written before the rename of "action" to "launcher" holds the list under the old key `actions`. This file reads
//! that key too, and writes only the key `launchers`, in the place of the old key, as the window does. It reads and changes
//! only this key and keeps every other key, in its order, and every other field of a launcher. The file as a whole is in
//! `project_config_file.rs`.

use crate::launcher_types::Launcher;
use crate::project_config_file::{new_config, project_config_path, read_config, write_config};
use serde_json::{Map, Value};
use std::path::Path;

/// The key of the list of launchers.
const LAUNCHERS_KEY: &str = "launchers";

/// The key of the list of launchers in the files written before the rename, when a launcher was called an action.
const LEGACY_LAUNCHERS_KEY: &str = "actions";

/// The entries of the list of launchers of a configuration: the key `launchers`, else the old key `actions`, else none.
fn entries_of(config: &Map<String, Value>, path: &Path) -> Result<Vec<Value>, String> {
    if config.contains_key(LAUNCHERS_KEY) && config.contains_key(LEGACY_LAUNCHERS_KEY) {
        return Err(format!(
            "The file {} is not valid: it has the key {LAUNCHERS_KEY} and the old key {LEGACY_LAUNCHERS_KEY}. Keep only the key {LAUNCHERS_KEY}.",
            path.display()
        ));
    }
    let key = if config.contains_key(LEGACY_LAUNCHERS_KEY) { LEGACY_LAUNCHERS_KEY } else { LAUNCHERS_KEY };
    match config.get(key) {
        None => Ok(Vec::new()),
        Some(Value::Array(entries)) => Ok(entries.clone()),
        Some(_) => Err(format!("The file {} is not valid: the key {key} is not a list.", path.display())),
    }
}

/// The configuration with `entries` under the key `launchers`. The old key `actions` becomes the key `launchers` in its
/// place, so every other key keeps its order. A configuration without any of the two keys gets the key `launchers` at the
/// end.
fn with_entries(config: Map<String, Value>, entries: Vec<Value>) -> Map<String, Value> {
    let mut is_placed = false;
    let mut changed: Map<String, Value> = Map::new();
    for (key, value) in config {
        if key == LAUNCHERS_KEY || key == LEGACY_LAUNCHERS_KEY {
            changed.insert(LAUNCHERS_KEY.to_string(), Value::Array(entries.clone()));
            is_placed = true;
        } else {
            changed.insert(key, value);
        }
    }
    if !is_placed {
        changed.insert(LAUNCHERS_KEY.to_string(), Value::Array(entries));
    }
    changed
}

/// The text of the field `key` of an entry: `Ok(None)` when the entry has no such field.
fn text_field<'a>(entry: &'a Value, key: &str, index: usize, path: &Path) -> Result<Option<&'a str>, String> {
    match entry.get(key) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(text)) => Ok(Some(text)),
        Some(_) => Err(format!(
            "The file {} is not valid: the field {key} of the launcher {} of the key {LAUNCHERS_KEY} is not a text.",
            path.display(),
            index + 1
        )),
    }
}

/// The launcher that an entry of the list holds.
///
/// # Errors
/// The entry is not an object, has no id, no name, or no command line, or has a field that is not a text.
pub(crate) fn launcher_of_entry(entry: &Value, index: usize, path: &Path) -> Result<Launcher, String> {
    if !entry.is_object() {
        return Err(format!(
            "The file {} is not valid: the launcher {} of the key {LAUNCHERS_KEY} is not an object.",
            path.display(),
            index + 1
        ));
    }
    let required = |key: &str| -> Result<String, String> {
        match text_field(entry, key, index, path)? {
            Some(text) if !text.is_empty() => Ok(text.to_string()),
            _ => Err(format!(
                "The file {} is not valid: the launcher {} of the key {LAUNCHERS_KEY} has no {key}.",
                path.display(),
                index + 1
            )),
        }
    };
    Ok(Launcher {
        id: required("id")?,
        label: required("label")?,
        command: required("command")?,
        description: text_field(entry, "description", index, path)?.map(str::to_string),
        cwd: text_field(entry, "cwd", index, path)?.map(str::to_string),
        agent: entry.get("agent").filter(|agent| !agent.is_null()).cloned(),
    })
}

/// The id of an entry, or `None` when the entry has no id.
pub(crate) fn entry_id(entry: &Value) -> Option<&str> {
    entry.get("id").and_then(Value::as_str)
}

/// Reads the launchers of the project at `root`. A project with no file, or with no list of launchers, has none.
///
/// # Errors
/// The file cannot be read, is not a JSON object, has both the key `launchers` and the old key `actions`, or has a launcher
/// that is not valid.
pub fn read_project_launchers(root: &Path) -> Result<Vec<Launcher>, String> {
    let path = project_config_path(root);
    let Some(config) = read_config(&path)? else {
        return Ok(Vec::new());
    };
    entries_of(&config, &path)?.iter().enumerate().map(|(index, entry)| launcher_of_entry(entry, index, &path)).collect()
}

/// Changes the list of launchers of the file `.heidrun/config.json` of the project at `root` with `change`, and keeps every
/// other key and every other field of a launcher as it is. A project that has no file gets a new file. The file keeps the
/// old key `actions` no longer: the list is written under the key `launchers`.
///
/// `change` receives the entries of the list and returns the new entries. When `change` gives an error, no file changes.
///
/// # Errors
/// The file cannot be read, is not a JSON object, has both keys, has a launcher that is not valid, or cannot be written, or
/// `change` gives an error.
pub(crate) fn change_project_launchers(
    root: &Path,
    change: impl FnOnce(Vec<Value>) -> Result<Vec<Value>, String>,
) -> Result<(), String> {
    let path = project_config_path(root);
    let config = read_config(&path)?.unwrap_or_else(new_config);
    let entries = entries_of(&config, &path)?;
    for (index, entry) in entries.iter().enumerate() {
        launcher_of_entry(entry, index, &path)?;
    }
    let changed = with_entries(config, change(entries)?);
    write_config(&path, changed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::path::PathBuf;

    /// A new empty project folder for one test, with the folder `.heidrun`.
    fn test_project(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("heidrun_code_ctrl_project_launchers_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join(".heidrun")).unwrap();
        root
    }

    fn written(root: &Path) -> Value {
        serde_json::from_str(&std::fs::read_to_string(project_config_path(root)).unwrap()).unwrap()
    }

    #[test]
    fn a_project_with_no_file_or_no_list_has_no_launcher() {
        let root = test_project("none");
        assert_eq!(read_project_launchers(&root), Ok(Vec::new()));
        std::fs::write(project_config_path(&root), r#"{"version":1}"#).unwrap();
        assert_eq!(read_project_launchers(&root), Ok(Vec::new()));
    }

    #[test]
    fn a_launcher_has_its_fields_and_the_agent_object_as_it_is() {
        let root = test_project("fields");
        std::fs::write(
            project_config_path(&root),
            r#"{"version":1,"launchers":[
                {"id":"a","label":"A","command":"ls","description":"Two\nlines","cwd":"web"},
                {"id":"b","label":"B","command":"claude 'x'","agent":{"name":"claude","prompt":"x"}}]}"#,
        )
        .unwrap();
        let launchers = read_project_launchers(&root).unwrap();
        assert_eq!(launchers[0].description.as_deref(), Some("Two\nlines"));
        assert_eq!(launchers[0].cwd.as_deref(), Some("web"));
        assert_eq!(launchers[0].agent, None);
        assert_eq!(launchers[1].agent, Some(json!({ "name": "claude", "prompt": "x" })));
        assert_eq!(launchers[1].description, None);
    }

    #[test]
    fn the_old_key_actions_is_read_as_the_key_launchers() {
        let root = test_project("legacy_read");
        std::fs::write(project_config_path(&root), r#"{"version":1,"actions":[{"id":"a","label":"A","command":"ls"}]}"#).unwrap();
        assert_eq!(read_project_launchers(&root).unwrap()[0].id, "a");
    }

    #[test]
    fn a_change_writes_the_old_key_actions_as_the_key_launchers_in_the_same_place() {
        let root = test_project("legacy_write");
        std::fs::write(
            project_config_path(&root),
            r#"{"version":1,"actions":[{"id":"a","label":"A","command":"ls"}],"guards":{"block":["rm"]}}"#,
        )
        .unwrap();
        change_project_launchers(&root, |mut entries| {
            entries.push(json!({ "id": "b", "label": "B", "command": "pwd" }));
            Ok(entries)
        })
        .unwrap();
        let config = written(&root);
        let keys: Vec<&String> = config.as_object().unwrap().keys().collect();
        assert_eq!(keys, ["version", "launchers", "guards"]);
        assert_eq!(config["launchers"].as_array().unwrap().len(), 2);
    }

    #[test]
    fn a_file_with_both_keys_is_an_error_that_names_them_and_stays_as_it_is() {
        let root = test_project("both_keys");
        let text = r#"{"version":1,"launchers":[],"actions":[]}"#;
        std::fs::write(project_config_path(&root), text).unwrap();
        let error = change_project_launchers(&root, Ok).unwrap_err();
        assert!(error.contains("the key launchers and the old key actions"));
        assert!(read_project_launchers(&root).is_err());
        assert_eq!(std::fs::read_to_string(project_config_path(&root)).unwrap(), text);
    }

    #[test]
    fn a_change_keeps_every_other_key_in_its_order_and_every_other_field_of_a_launcher() {
        let root = test_project("keep_keys");
        std::fs::write(
            project_config_path(&root),
            r#"{"version":1,"guards":{"block":["rm"]},"launchers":[{"id":"a","label":"A","command":"ls","extra":true}],"prompts":[]}"#,
        )
        .unwrap();
        change_project_launchers(&root, Ok).unwrap();
        let config = written(&root);
        let keys: Vec<&String> = config.as_object().unwrap().keys().collect();
        assert_eq!(keys, ["version", "guards", "launchers", "prompts"]);
        assert_eq!(config["launchers"][0]["extra"], true);
    }

    #[test]
    fn a_change_makes_the_file_when_the_project_has_none() {
        let root = std::env::temp_dir().join(format!("heidrun_code_ctrl_project_launchers_new_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(&root).unwrap();
        change_project_launchers(&root, |_| Ok(vec![json!({ "id": "a", "label": "A", "command": "ls" })])).unwrap();
        assert_eq!(written(&root), json!({ "version": 1, "launchers": [{ "id": "a", "label": "A", "command": "ls" }] }));
    }

    #[test]
    fn a_file_without_the_list_gets_the_key_launchers_at_the_end() {
        let root = test_project("no_list");
        std::fs::write(project_config_path(&root), r#"{"version":1,"prompts":[]}"#).unwrap();
        change_project_launchers(&root, |_| Ok(vec![json!({ "id": "a", "label": "A", "command": "ls" })])).unwrap();
        let config = written(&root);
        let keys: Vec<&String> = config.as_object().unwrap().keys().collect();
        assert_eq!(keys, ["version", "prompts", "launchers"]);
    }

    #[test]
    fn a_file_that_is_not_valid_is_an_error_and_stays_as_it_is() {
        let root = test_project("not_valid");
        for text in ["{ not json", r#"{"version":1,"launchers":"ls"}"#, r#"{"version":1,"launchers":[{"id":"a","label":"A"}]}"#] {
            std::fs::write(project_config_path(&root), text).unwrap();
            assert!(read_project_launchers(&root).is_err(), "{text}");
            assert!(change_project_launchers(&root, Ok).is_err(), "{text}");
            assert_eq!(std::fs::read_to_string(project_config_path(&root)).unwrap(), text);
        }
    }

    #[test]
    fn the_error_of_an_entry_names_its_place_and_its_field() {
        let root = test_project("entry_error");
        std::fs::write(project_config_path(&root), r#"{"version":1,"launchers":[{"id":"a","label":"A","command":"ls"},{"id":"b","label":"B"}]}"#)
            .unwrap();
        assert!(read_project_launchers(&root).unwrap_err().contains("the launcher 2 of the key launchers has no command"));
        std::fs::write(project_config_path(&root), r#"{"version":1,"launchers":[{"id":"a","label":"A","command":"ls","cwd":5}]}"#).unwrap();
        assert!(read_project_launchers(&root).unwrap_err().contains("the field cwd of the launcher 1"));
    }

    #[test]
    fn an_error_of_the_change_function_writes_no_file() {
        let root = test_project("change_error");
        let text = r#"{"version":1,"launchers":[]}"#;
        std::fs::write(project_config_path(&root), text).unwrap();
        assert!(change_project_launchers(&root, |_| Err("Stop.".to_string())).is_err());
        assert_eq!(std::fs::read_to_string(project_config_path(&root)).unwrap(), text);
    }
}
