//! Helpers shared by the tests of the skills modules.

use std::path::{Path, PathBuf};

pub(super) fn temp_folder(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("hd-skills-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

/// Writes a skill folder with a `SKILL.md` file at `dir/name`.
pub(super) fn write_skill_folder(dir: &Path, name: &str, text: &str) -> PathBuf {
    let folder = dir.join(name);
    std::fs::create_dir_all(&folder).unwrap();
    std::fs::write(folder.join("SKILL.md"), text).unwrap();
    folder
}
