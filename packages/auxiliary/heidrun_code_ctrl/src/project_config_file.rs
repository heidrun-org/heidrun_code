//! The file `.heidrun/config.json` of a project, as a whole: where it is, how it is read, and how it is written. The keys
//! `prompts` (the project macros) and `launchers` (the launchers) are read and changed in `project_macros.rs` and in
//! `project_launchers.rs`. The format of the file is checked by the Zod schema of the web frontend
//! (`packages/apps/web_frontend/src/lib/project_config.ts`).

use crate::personal_macros::write_file_aside;
use serde_json::{json, Map, Value};
use std::path::{Path, PathBuf};

/// The folder of the project configuration, at the root of a project.
const CONFIG_FOLDER: &str = ".heidrun";

/// The file of the project configuration, in the folder `.heidrun`.
const CONFIG_FILE: &str = "config.json";

/// The root of the project that holds `folder`: the nearest folder, from `folder` up, that has a folder `.heidrun` or a
/// folder `.git`, else `folder` itself. It is the same search as the window makes.
pub fn find_project_root(folder: &Path) -> PathBuf {
    let mut candidate = Some(folder);
    while let Some(current) = candidate {
        if current.join(CONFIG_FOLDER).is_dir() || current.join(".git").exists() {
            return current.to_path_buf();
        }
        candidate = current.parent();
    }
    folder.to_path_buf()
}

/// The file `.heidrun/config.json` of the project at `root`.
pub fn project_config_path(root: &Path) -> PathBuf {
    root.join(CONFIG_FOLDER).join(CONFIG_FILE)
}

/// Reads the whole file `.heidrun/config.json` as a JSON object. A missing file gives `None`.
pub(crate) fn read_config(path: &Path) -> Result<Option<Map<String, Value>>, String> {
    let text = match std::fs::read_to_string(path) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("The file {} cannot be read: {error}", path.display())),
    };
    match serde_json::from_str::<Value>(&text) {
        Ok(Value::Object(config)) => Ok(Some(config)),
        Ok(_) => Err(format!("The file {} is not a JSON object.", path.display())),
        Err(error) => Err(format!("The file {} is not valid JSON: {error}", path.display())),
    }
}

/// The content of a new file, for a project that has none: the version 1 and no launcher.
pub(crate) fn new_config() -> Map<String, Value> {
    let mut config = Map::new();
    config.insert("version".to_string(), json!(1));
    config.insert("launchers".to_string(), json!([]));
    config
}

/// Writes the configuration to the file `path`, on several lines, with a new line at the end. The write goes to a file next
/// to `path`, then renames it.
pub(crate) fn write_config(path: &Path, config: Map<String, Value>) -> Result<(), String> {
    let mut text = serde_json::to_string_pretty(&Value::Object(config)).map_err(|error| error.to_string())?;
    text.push('\n');
    write_file_aside(path, &text)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A new empty project folder for one test, with the folder `.heidrun`.
    fn test_project(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("heidrun_code_ctrl_config_file_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        std::fs::create_dir_all(root.join(".heidrun")).unwrap();
        root
    }

    #[test]
    fn the_root_is_the_nearest_folder_with_a_folder_heidrun_or_git() {
        let root = test_project("root");
        let deeper = root.join("a").join("b");
        std::fs::create_dir_all(&deeper).unwrap();
        assert_eq!(find_project_root(&deeper), root);
    }

    #[test]
    fn a_missing_file_reads_as_none_and_a_file_that_is_not_an_object_is_an_error() {
        let root = test_project("read");
        let path = project_config_path(&root);
        assert_eq!(read_config(&path), Ok(None));
        std::fs::write(&path, "[]").unwrap();
        assert!(read_config(&path).unwrap_err().contains("is not a JSON object"));
        std::fs::write(&path, "{ not json").unwrap();
        assert!(read_config(&path).unwrap_err().contains("is not valid JSON"));
    }

    #[test]
    fn a_new_configuration_has_the_version_1_and_no_launcher() {
        assert_eq!(Value::Object(new_config()), json!({ "version": 1, "launchers": [] }));
    }

    #[test]
    fn a_written_configuration_has_several_lines_and_a_new_line_at_the_end() {
        let root = test_project("write");
        let path = project_config_path(&root);
        write_config(&path, new_config()).unwrap();
        let text = std::fs::read_to_string(&path).unwrap();
        assert_eq!(text, "{\n  \"version\": 1,\n  \"launchers\": []\n}\n");
        assert!(!path.with_file_name("config.json.aside").exists());
    }
}
