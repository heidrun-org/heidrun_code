//! The file of the user level launchers: a JSON list of launchers in the folder of the data of Heidrun Code.
//!
//! A launcher of the user level shows in every workspace. The launchers of the workspace level are in the key `launchers` of
//! the file `.heidrun/config.json`: `project_launchers.rs` reads and changes that key. This file keeps each launcher as a JSON
//! object, so that a field that this package does not know is written back as it was.

use crate::personal_macros::{data_folder, write_file_aside};
use serde_json::Value;
use std::path::{Path, PathBuf};

/// The name of the file of the user level launchers, in the folder of the data of Heidrun Code.
const USER_LAUNCHERS_FILE: &str = "launchers.json";

/// The file of the user level launchers.
pub fn user_launchers_path() -> PathBuf {
    data_folder().join(USER_LAUNCHERS_FILE)
}

/// Reads the user level launchers from the file `path`.
///
/// # Errors
/// The file cannot be read, is not a JSON list of objects, has a launcher without an id, a name, or a command line, or has
/// two launchers with the same id. The file is never changed in this case, so a file written by hand with a mistake is never
/// lost.
///
/// # Returns
/// `None` when the file does not exist, else the launchers in the order of the file.
pub fn read_user_launchers(path: &Path) -> Result<Option<Vec<Value>>, String> {
    let text = match std::fs::read_to_string(path) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("The file {} cannot be read: {error}", path.display())),
    };
    let value: Value = serde_json::from_str(&text)
        .map_err(|error| format!("The file {} is not a JSON list of launchers: {error}", path.display()))?;
    let Value::Array(launchers) = value else {
        return Err(format!("The file {} is not a JSON list of launchers.", path.display()));
    };
    check_launchers(&launchers, path)?;
    Ok(Some(launchers))
}

/// Writes the user level launchers to the file `path`, as a JSON list on several lines. The folder is created when it does
/// not exist. The file is replaced in one step, so a program that reads it never reads half a file.
///
/// # Errors
/// A launcher has no id, no name, or no command line, two launchers have the same id, or the folder or the file cannot be
/// written. The file is not changed in this case.
pub fn write_user_launchers(path: &Path, launchers: &[Value]) -> Result<(), String> {
    check_launchers(launchers, path)?;
    let mut text = serde_json::to_string_pretty(launchers).map_err(|error| error.to_string())?;
    text.push('\n');
    write_file_aside(path, &text)
}

/// Checks that every launcher is an object with a text id, a text name, and a text command line that are not empty, and that
/// no two launchers have the same id.
fn check_launchers(launchers: &[Value], path: &Path) -> Result<(), String> {
    for (index, launcher) in launchers.iter().enumerate() {
        let position = index + 1;
        if launcher.is_object() == false {
            return Err(format!("The file {} is not valid: the launcher {position} is not an object.", path.display()));
        }
        for field in ["id", "label", "command"] {
            let is_filled = launcher.get(field).and_then(Value::as_str).is_some_and(|text| text.is_empty() == false);
            if is_filled == false {
                return Err(format!(
                    "The file {} is not valid: the launcher {position} has no field {field} with a text.",
                    path.display()
                ));
            }
        }
        let id = launcher.get("id").and_then(Value::as_str).unwrap_or_default();
        let is_repeated = launchers[..index].iter().any(|before| before.get("id").and_then(Value::as_str) == Some(id));
        if is_repeated {
            return Err(format!("The file {} is not valid: two launchers have the id {id}.", path.display()));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// A new empty folder for one test.
    fn test_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("heidrun_code_ctrl_user_launchers_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        folder
    }

    fn sample(id: &str) -> Value {
        json!({ "id": id, "label": format!("Label {id}"), "command": format!("make {id}") })
    }

    #[test]
    fn the_file_is_named_launchers_json_in_the_folder_of_the_data() {
        assert_eq!(user_launchers_path(), data_folder().join("launchers.json"));
    }

    #[test]
    fn a_missing_file_gives_none() {
        let folder = test_folder("missing");
        assert_eq!(read_user_launchers(&folder.join("launchers.json")), Ok(None));
    }

    #[test]
    fn a_written_file_is_read_back_the_same_with_the_fields_that_the_package_does_not_know() {
        let folder = test_folder("round_trip");
        let path = folder.join("deeper").join("launchers.json");
        let launchers = vec![
            sample("a"),
            json!({ "id": "b", "label": "B", "command": "claude 'x'", "cwd": "web", "agent": { "name": "claude", "prompt": "x" }, "later": 1 }),
        ];
        write_user_launchers(&path, &launchers).unwrap();
        assert_eq!(read_user_launchers(&path), Ok(Some(launchers)));
        assert!(std::fs::read_to_string(&path).unwrap().ends_with("]\n"));
        assert!(!folder.join("deeper").join("launchers.json.aside").exists());
    }

    #[test]
    fn an_empty_list_is_a_valid_file() {
        let path = test_folder("empty").join("launchers.json");
        write_user_launchers(&path, &[]).unwrap();
        assert_eq!(read_user_launchers(&path), Ok(Some(Vec::new())));
    }

    #[test]
    fn a_file_that_is_not_a_list_is_an_error_and_stays_as_it_is() {
        let path = test_folder("not_a_list").join("launchers.json");
        std::fs::write(&path, r#"{"id":"x"}"#).unwrap();
        assert!(read_user_launchers(&path).unwrap_err().contains("is not a JSON list of launchers"));
        assert_eq!(std::fs::read_to_string(&path).unwrap(), r#"{"id":"x"}"#);
    }

    #[test]
    fn a_file_that_is_not_json_is_an_error() {
        let path = test_folder("not_json").join("launchers.json");
        std::fs::write(&path, "not json").unwrap();
        assert!(read_user_launchers(&path).unwrap_err().contains("is not a JSON list of launchers"));
    }

    #[test]
    fn a_launcher_without_an_id_a_name_or_a_command_line_is_an_error() {
        let path = test_folder("missing_field").join("launchers.json");
        for field in ["id", "label", "command"] {
            let mut launcher = sample("a");
            launcher.as_object_mut().unwrap().remove(field);
            std::fs::write(&path, serde_json::to_string(&vec![launcher]).unwrap()).unwrap();
            assert!(read_user_launchers(&path).unwrap_err().contains(&format!("no field {field}")));
        }
    }

    #[test]
    fn an_item_that_is_not_an_object_is_an_error() {
        let path = test_folder("not_object").join("launchers.json");
        std::fs::write(&path, r#"["ls"]"#).unwrap();
        assert!(read_user_launchers(&path).unwrap_err().contains("the launcher 1 is not an object"));
    }

    #[test]
    fn two_launchers_with_the_same_id_are_an_error_when_reading_and_when_writing() {
        let path = test_folder("same_id").join("launchers.json");
        std::fs::write(&path, serde_json::to_string(&vec![sample("a"), sample("a")]).unwrap()).unwrap();
        assert!(read_user_launchers(&path).unwrap_err().contains("two launchers have the id a"));
        std::fs::remove_file(&path).unwrap();
        assert!(write_user_launchers(&path, &[sample("a"), sample("a")]).unwrap_err().contains("two launchers have the id a"));
        assert!(!path.exists());
    }
}
