//! The macros, the Tauri side: the hard-coded macros, and the file of the personal macros.
//!
//! A macro is a reusable text that the developer writes into a pane. The format of each file has one place, the package
//! `heidrun_code_ctrl`, which the command line `heidrun_code_ctrl` uses too. The web frontend reads the file again about every
//! second, so a change that the command line makes shows in the window. The project macros are in the key `prompts` of the
//! file `.heidrun/config.json`: the commands of `project.rs` read and write that file.

use heidrun_code_ctrl::{hard_coded_macros, personal_macros_path, read_personal_macros, write_personal_macros, Macro};
use serde::Serialize;
use std::path::Path;

/// What the file of the personal macros holds.
#[derive(Serialize, Debug, PartialEq)]
pub struct PersonalMacrosFile {
    /// False when the file does not exist. The web frontend then moves the macros of the old storage of the window to the file.
    pub exists: bool,
    /// The macros of the file, in its order. Empty when the file does not exist or is not valid.
    pub macros: Vec<Macro>,
    /// Why the file cannot be read. The web frontend then writes nothing, so the file is never overwritten.
    pub error: Option<String>,
}

/// Reads the file of the personal macros at `path`.
fn read_file(path: &Path) -> PersonalMacrosFile {
    match read_personal_macros(path) {
        Ok(Some(macros)) => PersonalMacrosFile { exists: true, macros, error: None },
        Ok(None) => PersonalMacrosFile { exists: false, macros: Vec::new(), error: None },
        Err(error) => PersonalMacrosFile { exists: true, macros: Vec::new(), error: Some(error) },
    }
}

/// The hard-coded macros.
#[tauri::command]
pub fn macros_hard_coded() -> Vec<Macro> {
    hard_coded_macros()
}

/// The personal macros: the content of the file `macros.json` of the folder of the data of Heidrun Code.
#[tauri::command]
pub fn macros_personal_read() -> PersonalMacrosFile {
    read_file(&personal_macros_path())
}

/// Writes the personal macros to the file `macros.json` of the folder of the data of Heidrun Code.
#[tauri::command]
pub fn macros_personal_write(macros: Vec<Macro>) -> Result<(), String> {
    write_personal_macros(&personal_macros_path(), &macros)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_folder(name: &str) -> std::path::PathBuf {
        let folder = std::env::temp_dir().join(format!("heidrun_macros_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        folder
    }

    #[test]
    fn a_missing_file_does_not_exist_and_has_no_error() {
        let file = read_file(&test_folder("missing").join("macros.json"));
        assert_eq!(file, PersonalMacrosFile { exists: false, macros: Vec::new(), error: None });
    }

    #[test]
    fn a_file_that_is_not_valid_gives_an_error_and_no_macro() {
        let path = test_folder("invalid").join("macros.json");
        std::fs::write(&path, "not json").unwrap();
        let file = read_file(&path);
        assert!(file.exists && file.macros.is_empty() && file.error.is_some());
    }

    #[test]
    fn a_written_file_is_read_back() {
        let path = test_folder("round_trip").join("macros.json");
        let macros = vec![Macro { id: "a".into(), label: "A".into(), description: String::new(), text: "Text".into() }];
        write_personal_macros(&path, &macros).unwrap();
        assert_eq!(read_file(&path), PersonalMacrosFile { exists: true, macros, error: None });
    }

    #[test]
    fn the_hard_coded_macros_come_from_the_package_heidrun_code_ctrl() {
        assert_eq!(macros_hard_coded(), hard_coded_macros());
    }
}
