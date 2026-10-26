//! Moves the data written under the former name "Herdr Desk" to the places named "Heidrun Code".

use std::path::PathBuf;

/// Renames `~/.config/herdr-desk`, the former configuration folder, to `~/.config/heidrun_code`.
/// Does nothing when `~/.config/heidrun_code` or `~/.config/heidrun`, the folder of the versions 0.3.0 and older, exists already.
pub fn migrate_config_dir() {
    let config = dirs::home_dir().unwrap_or_default().join(".config");
    let legacy: PathBuf = config.join("herdr-desk");
    let current: PathBuf = config.join("heidrun_code");
    let former: PathBuf = config.join("heidrun");
    if legacy.is_dir() && !current.exists() && !former.exists() {
        let _ = std::fs::rename(legacy, current);
    }
}
