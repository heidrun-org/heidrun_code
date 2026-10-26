//! The file of the personal macros: a JSON list of macros in the folder of the data of Heidrun Code.

use crate::macro_types::Macro;
use std::path::{Path, PathBuf};

/// The name of the file of the personal macros, in the folder of the data of Heidrun Code.
const PERSONAL_MACROS_FILE: &str = "macros.json";

/// The folder of the data of Heidrun Code: the variable `HEIDRUN_CODE_DIR`, else `~/.config/heidrun_code`.
pub fn data_folder() -> PathBuf {
    std::env::var("HEIDRUN_CODE_DIR")
        .ok().filter(|value| value.is_empty() == false)
        .or_else(|| std::env::var("HEIDRUN_DIR").ok().filter(|value| value.is_empty() == false))
        .map(PathBuf::from)
        .unwrap_or_else(|| default_data_folder(&dirs::home_dir().unwrap_or_default()))
}

/// The file of the personal macros.
pub fn personal_macros_path() -> PathBuf {
    data_folder().join(PERSONAL_MACROS_FILE)
}

/// Reads the personal macros from the file `path`.
///
/// # Errors
/// The file cannot be read, is not a JSON list of macros, or has two macros with the same id. The file is never changed
/// in this case, so a file written by hand with a mistake is never lost.
///
/// # Returns
/// `None` when the file does not exist, else the macros in the order of the file.
pub fn read_personal_macros(path: &Path) -> Result<Option<Vec<Macro>>, String> {
    let text = match std::fs::read_to_string(path) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("The file {} cannot be read: {error}", path.display())),
    };
    let macros: Vec<Macro> = serde_json::from_str(&text).map_err(|error| {
        format!("The file {} is not a list of macros with the fields id, label, description, and text: {error}", path.display())
    })?;
    for (index, content) in macros.iter().enumerate() {
        if macros[..index].iter().any(|before| before.id == content.id) {
            return Err(format!("The file {} has two macros with the id {}.", path.display(), content.id));
        }
    }
    Ok(Some(macros))
}

/// Writes the personal macros to the file `path`, as a JSON list on several lines. The folder is created when it does not
/// exist.
///
/// # Errors
/// The folder or the file cannot be written.
pub fn write_personal_macros(path: &Path, macros: &[Macro]) -> Result<(), String> {
    let mut text = serde_json::to_string_pretty(macros).map_err(|error| error.to_string())?;
    text.push('\n');
    write_file_aside(path, &text)
}

/// Writes `text` to a file next to `path`, then renames it to `path`: a crash never leaves half a file, and a program that
/// reads the file never reads half a file.
pub(crate) fn write_file_aside(path: &Path, text: &str) -> Result<(), String> {
    if let Some(folder) = path.parent() {
        std::fs::create_dir_all(folder).map_err(|error| format!("The folder {} cannot be created: {error}", folder.display()))?;
    }
    let mut aside_name = path.file_name().map(|name| name.to_os_string()).unwrap_or_default();
    aside_name.push(".aside");
    let aside = path.with_file_name(aside_name);
    std::fs::write(&aside, text).map_err(|error| format!("The file {} cannot be written: {error}", aside.display()))?;
    std::fs::rename(&aside, path).map_err(|error| format!("The file {} cannot be written: {error}", path.display()))
}

/// `~/.config/heidrun_code`, or the former folder `~/.config/heidrun` when it exists and the new folder does not.
fn default_data_folder(home: &std::path::Path) -> PathBuf {
    let current = home.join(".config").join("heidrun_code");
    let former = home.join(".config").join("heidrun");
    if current.is_dir() == false && former.is_dir() {
        return former;
    }
    current
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A new empty folder for one test.
    fn test_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("heidrun_code_ctrl_personal_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        folder
    }

    fn sample(id: &str) -> Macro {
        Macro { id: id.to_string(), label: format!("Label {id}"), description: String::new(), text: format!("Text {id}") }
    }

    #[test]
    fn a_missing_file_gives_none() {
        let folder = test_folder("missing");
        assert_eq!(read_personal_macros(&folder.join("macros.json")), Ok(None));
    }

    #[test]
    fn a_written_file_is_read_back_the_same() {
        let folder = test_folder("round_trip");
        let path = folder.join("deeper").join("macros.json");
        let macros = vec![sample("a"), sample("b")];
        write_personal_macros(&path, &macros).unwrap();
        assert_eq!(read_personal_macros(&path), Ok(Some(macros)));
        assert!(std::fs::read_to_string(&path).unwrap().ends_with("]\n"));
        assert!(!folder.join("deeper").join("macros.json.aside").exists());
    }

    #[test]
    fn a_file_in_the_format_of_the_window_storage_is_read() {
        let folder = test_folder("window_format");
        let path = folder.join("macros.json");
        std::fs::write(&path, r#"[{"id":"x","label":"X","text":"Hello"}]"#).unwrap();
        assert_eq!(read_personal_macros(&path).unwrap().unwrap()[0].description, "");
    }

    #[test]
    fn a_file_that_is_not_a_list_of_macros_is_an_error_and_stays_as_it_is() {
        let folder = test_folder("not_valid");
        let path = folder.join("macros.json");
        std::fs::write(&path, r#"{"id":"x"}"#).unwrap();
        assert!(read_personal_macros(&path).unwrap_err().contains("is not a list of macros"));
        assert_eq!(std::fs::read_to_string(&path).unwrap(), r#"{"id":"x"}"#);
    }

    #[test]
    fn two_macros_with_the_same_id_are_an_error() {
        let folder = test_folder("same_id");
        let path = folder.join("macros.json");
        write_personal_macros(&path, &[sample("a"), sample("a")]).unwrap();
        assert!(read_personal_macros(&path).unwrap_err().contains("two macros with the id a"));
    }
}
