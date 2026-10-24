//! The launchers of the user level, the Tauri side: the file `launchers.json` of the folder of the data of Heidrun Code.
//!
//! A launcher of the user level shows in every workspace. The format of the file has one place, the package
//! `heidrun_code_ctrl`. The web frontend reads the file again about every second, so a change that another program makes shows
//! in the window. The launchers of the workspace level are in the key `launchers` of the file `.heidrun/config.json`: the
//! commands of `project.rs` read and write that file.

use heidrun_code_ctrl::{read_user_launchers, user_launchers_path, write_user_launchers};
use serde::Serialize;
use serde_json::Value;
use std::path::{Component, Path};

/// What the file of the user level launchers holds.
#[derive(Serialize, Debug, PartialEq)]
pub struct UserLaunchersFile {
    /// False when the file does not exist.
    pub exists: bool,
    /// The launchers of the file, in its order. Empty when the file does not exist or is not valid.
    pub launchers: Vec<Value>,
    /// Why the file cannot be read. The web frontend then writes nothing, so the file is never overwritten.
    pub error: Option<String>,
}

/// Reads the file of the user level launchers at `path`.
fn read_file(path: &Path) -> UserLaunchersFile {
    match read_user_launchers(path) {
        Ok(Some(launchers)) => UserLaunchersFile { exists: true, launchers, error: None },
        Ok(None) => UserLaunchersFile { exists: false, launchers: Vec::new(), error: None },
        Err(error) => UserLaunchersFile { exists: true, launchers: Vec::new(), error: Some(error) },
    }
}

/// Is `folder` an existing folder inside `root`? A folder that is absolute or goes up with `..` is never inside `root`.
fn is_folder_inside(root: &str, folder: &str) -> bool {
    let relative = Path::new(folder);
    let stays_inside = relative.components().all(|component| matches!(component, Component::Normal(_) | Component::CurDir));
    stays_inside && Path::new(root).join(relative).is_dir()
}

/// The user level launchers: the content of the file `launchers.json` of the folder of the data of Heidrun Code.
#[tauri::command]
pub fn launchers_user_read() -> UserLaunchersFile {
    read_file(&user_launchers_path())
}

/// Writes the user level launchers to the file `launchers.json` of the folder of the data of Heidrun Code.
#[tauri::command]
pub fn launchers_user_write(launchers: Vec<Value>) -> Result<(), String> {
    write_user_launchers(&user_launchers_path(), &launchers)
}

/// Tells whether `folder`, the current work directory of a launcher relative to the root of a workspace, exists in `root`.
#[tauri::command(async)]
pub fn launcher_folder_exists(root: String, folder: String) -> bool {
    is_folder_inside(&root, &folder)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn test_folder(name: &str) -> std::path::PathBuf {
        let folder = std::env::temp_dir().join(format!("heidrun_user_launchers_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        folder
    }

    #[test]
    fn a_missing_file_does_not_exist_and_has_no_error() {
        let file = read_file(&test_folder("missing").join("launchers.json"));
        assert_eq!(file, UserLaunchersFile { exists: false, launchers: Vec::new(), error: None });
    }

    #[test]
    fn a_file_that_is_not_valid_gives_an_error_and_no_launcher() {
        let path = test_folder("invalid").join("launchers.json");
        std::fs::write(&path, "not json").unwrap();
        let file = read_file(&path);
        assert!(file.exists && file.launchers.is_empty() && file.error.is_some());
    }

    #[test]
    fn a_written_file_is_read_back() {
        let path = test_folder("round_trip").join("launchers.json");
        let launchers = vec![json!({ "id": "a", "label": "A", "command": "ls", "cwd": "web" })];
        write_user_launchers(&path, &launchers).unwrap();
        assert_eq!(read_file(&path), UserLaunchersFile { exists: true, launchers, error: None });
    }

    #[test]
    fn the_file_of_the_commands_is_the_file_of_the_package_heidrun_code_ctrl() {
        assert!(user_launchers_path().ends_with("launchers.json"));
    }

    #[test]
    fn a_folder_that_exists_in_the_root_is_found() {
        let root = test_folder("folder_found");
        std::fs::create_dir_all(root.join("web").join("src")).unwrap();
        let root_text = root.to_str().unwrap();
        assert!(is_folder_inside(root_text, "web"));
        assert!(is_folder_inside(root_text, "web/src"));
        assert!(is_folder_inside(root_text, "./web"));
        assert!(is_folder_inside(root_text, ""));
    }

    #[test]
    fn a_folder_that_does_not_exist_or_is_a_file_is_not_found() {
        let root = test_folder("folder_missing");
        std::fs::write(root.join("file.txt"), "text").unwrap();
        let root_text = root.to_str().unwrap();
        assert!(!is_folder_inside(root_text, "web"));
        assert!(!is_folder_inside(root_text, "file.txt"));
    }

    #[test]
    fn a_folder_outside_the_root_is_never_found() {
        let root = test_folder("folder_outside");
        let outside = test_folder("folder_outside_other");
        let root_text = root.to_str().unwrap();
        assert!(!is_folder_inside(root_text, ".."));
        assert!(!is_folder_inside(root_text, "../"));
        assert!(!is_folder_inside(root_text, outside.to_str().unwrap()));
    }
}
