//! The folder of the data of Heidrun Code, and the paths of the files in it. This file reads the environment and opens no file.

use std::path::PathBuf;
use std::sync::Mutex;

/// The folder of the data of Heidrun Code: `HEIDRUN_CODE_DIR`, else `~/.config/heidrun_code`.
pub(crate) fn data_dir() -> PathBuf {
    std::env::var("HEIDRUN_CODE_DIR")
        .ok().filter(|value| value.is_empty() == false)
        .or_else(|| std::env::var("HEIDRUN_DIR").ok().filter(|value| value.is_empty() == false))
        .map(PathBuf::from)
        .unwrap_or_else(|| default_data_folder(&dirs::home_dir().unwrap_or_default()))
}

/// The file where the web page appends the records of the activity of the user: `user_activity.jsonl` in the folder of the data
/// of Heidrun Code.
pub(crate) fn user_activity_file_path() -> PathBuf {
    data_dir().join("user_activity.jsonl")
}

/// An append to the file of the records of the activity of the user and a read of the whole file never run at the same time, so
/// that a reader never sees half a line.
pub(crate) static USER_ACTIVITY_FILE_LOCK: Mutex<()> = Mutex::new(());

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

    fn temporary_home(name: &str) -> PathBuf {
        let home = std::env::temp_dir().join(format!("hd-app-data-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        std::fs::create_dir_all(&home).unwrap();
        home
    }

    #[test]
    fn a_new_installation_uses_the_folder_heidrun_code() {
        let home = temporary_home("new");
        assert_eq!(default_data_folder(&home), home.join(".config/heidrun_code"));
        std::fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn the_former_folder_is_used_while_the_new_folder_does_not_exist() {
        let home = temporary_home("former");
        std::fs::create_dir_all(home.join(".config/heidrun")).unwrap();
        assert_eq!(default_data_folder(&home), home.join(".config/heidrun"));
        std::fs::create_dir_all(home.join(".config/heidrun_code")).unwrap();
        assert_eq!(default_data_folder(&home), home.join(".config/heidrun_code"));
        std::fs::remove_dir_all(home).unwrap();
    }
}
