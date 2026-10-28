//! The copy of the saved state of the web page (its `localStorage` entries) in the data folder of Heidrun Code.
//!
//! The web view keeps `localStorage` in a folder named after the application identifier, so a change of the identifier
//! shows an empty `localStorage` and every option returns to its default value (issue 772). The data folder does not depend
//! on the identifier, so a copy there survives it. The web page restores the entries that are missing, then writes every
//! change here.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

/// The file of the copy, in the folder of the data of Heidrun Code. Installed Heidrun Code and Heidrun Code Development have separate folders.
const FILE_NAME: &str = "local_storage.json";

/// Two writes never use the same temporary file at the same time.
static WRITE_LOCK: Mutex<()> = Mutex::new(());

fn file_path() -> PathBuf {
    crate::app_data::data_dir().join(FILE_NAME)
}

/// The entries of the last copy, or `None` when the copy does not exist yet or cannot be read.
#[tauri::command]
pub fn durable_storage_read() -> Option<BTreeMap<String, String>> {
    read_entries(&file_path())
}

/// Replaces the copy with these entries. The file changes in one step, so a crash never leaves half a file.
#[tauri::command]
pub fn durable_storage_write(entries: BTreeMap<String, String>) -> Result<(), String> {
    write_entries(&file_path(), &entries)
}

fn read_entries(path: &Path) -> Option<BTreeMap<String, String>> {
    let text = match std::fs::read_to_string(path) {
        Ok(text) => text,
        Err(error) => {
            if error.kind() != std::io::ErrorKind::NotFound {
                eprintln!("durable storage: cannot read {}: {error}", path.display());
            }
            return None;
        }
    };
    match serde_json::from_str(&text) {
        Ok(entries) => Some(entries),
        Err(error) => {
            eprintln!("durable storage: {} is not valid: {error}", path.display());
            None
        }
    }
}

fn write_entries(path: &Path, entries: &BTreeMap<String, String>) -> Result<(), String> {
    let _guard = WRITE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let folder = path.parent().ok_or_else(|| format!("{} has no folder", path.display()))?;
    std::fs::create_dir_all(folder).map_err(|error| format!("cannot create {}: {error}", folder.display()))?;
    let text = serde_json::to_string_pretty(entries).map_err(|error| error.to_string())?;
    let temporary = path.with_extension("json.tmp");
    std::fs::write(&temporary, text).map_err(|error| format!("cannot write {}: {error}", temporary.display()))?;
    std::fs::rename(&temporary, path).map_err(|error| {
        let _ = std::fs::remove_file(&temporary);
        format!("cannot replace {}: {error}", path.display())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("hd-durable-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        folder
    }

    fn entries(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
        pairs.iter().map(|(key, value)| (key.to_string(), value.to_string())).collect()
    }

    #[test]
    fn a_missing_file_gives_none() {
        let folder = test_folder("missing");
        assert_eq!(read_entries(&folder.join(FILE_NAME)), None);
    }

    #[test]
    fn written_entries_come_back_unchanged_and_the_folder_is_created() {
        let folder = test_folder("round-trip");
        let path = folder.join("inner").join(FILE_NAME);
        let saved = entries(&[("heidrun.settings", "{\"fontSize\":18}"), ("heidrun.notes", "[\"é \\\" \\n\"]")]);
        write_entries(&path, &saved).unwrap();
        assert_eq!(read_entries(&path), Some(saved));
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn a_second_write_replaces_the_first_and_leaves_no_temporary_file() {
        let folder = test_folder("replace");
        let path = folder.join(FILE_NAME);
        write_entries(&path, &entries(&[("heidrun.a", "1"), ("heidrun.b", "2")])).unwrap();
        write_entries(&path, &entries(&[("heidrun.a", "3")])).unwrap();
        assert_eq!(read_entries(&path), Some(entries(&[("heidrun.a", "3")])));
        let names: Vec<_> = std::fs::read_dir(&folder).unwrap().map(|e| e.unwrap().file_name()).collect();
        assert_eq!(names, vec![std::ffi::OsString::from(FILE_NAME)]);
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn a_file_that_is_not_valid_gives_none() {
        let folder = test_folder("corrupt");
        std::fs::create_dir_all(&folder).unwrap();
        let path = folder.join(FILE_NAME);
        std::fs::write(&path, "{\"heidrun.settings\": ").unwrap();
        assert_eq!(read_entries(&path), None);
        std::fs::write(&path, "{\"heidrun.settings\": 4}").unwrap();
        assert_eq!(read_entries(&path), None);
        let _ = std::fs::remove_dir_all(&folder);
    }
}
