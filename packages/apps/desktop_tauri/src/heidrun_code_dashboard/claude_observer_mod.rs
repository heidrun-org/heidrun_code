//! The Claude Code observer mod that Heidrun Code includes. The application bundle must stay unchanged, and Claude Code
//! writes type files beside a mod that it loads, so Heidrun Code copies the mod into the folder of its data and gives
//! Claude Code that copy.

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

use super::claude_snapshots::{ensure_private_folder, observation_folder};

/// The folder of the mod in the resources of the application, and in the folder of the data of Heidrun Code.
pub const MOD_FOLDER_NAME: &str = "heidrun_code_dashboard_claude_observer";
/// The files of the mod, relative to its folder. Nothing else is copied.
pub const MOD_FILES: [&str; 3] = [".claude-plugin/plugin.json", "hooks/hooks.json", "hooks/register.js"];

/// The absolute folder of the observer mod, ready for `claude --plugin-dir`, or null when the application has no mod.
#[tauri::command]
pub fn heidrun_code_dashboard_claude_observer_mod_path(app: AppHandle) -> Option<String> {
    let resource_folder = app.path().resource_dir().ok()?;
    let destination = crate::app_data::data_dir().join(MOD_FOLDER_NAME);
    match copy_mod(&resource_folder.join(MOD_FOLDER_NAME), &destination) {
        Ok(()) => Some(destination.display().to_string()),
        Err(error) => {
            eprintln!("Heidrun Code: the Claude Code observer mod is not available: {error}");
            None
        }
    }
}

/// The absolute folder where the observer mod writes its snapshot files, created with the permissions 700. Heidrun Code
/// gives it to Claude Code in the environment variable `HEIDRUN_CODE_DASHBOARD_OBSERVATION_DIR`.
#[tauri::command]
pub fn heidrun_code_dashboard_claude_observation_folder() -> Result<String, String> {
    let folder = observation_folder();
    ensure_private_folder(&folder)?;
    Ok(folder.display().to_string())
}

/// Copies the files of the mod from `source` to `destination`, and writes only a file whose content changed. Fails when
/// a file of the mod is missing from `source`.
pub fn copy_mod(source: &Path, destination: &Path) -> Result<(), String> {
    for relative in MOD_FILES {
        let from: PathBuf = source.join(relative);
        let content = std::fs::read(&from).map_err(|error| format!("{}: {error}", from.display()))?;
        let to = destination.join(relative);
        if std::fs::read(&to).ok().as_deref() == Some(content.as_slice()) {
            continue;
        }
        if let Some(parent) = to.parent() {
            std::fs::create_dir_all(parent).map_err(|error| format!("{}: {error}", parent.display()))?;
        }
        std::fs::write(&to, content).map_err(|error| format!("{}: {error}", to.display()))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bundled_mod_folder() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join(MOD_FOLDER_NAME)
    }

    #[test]
    fn the_bundled_mod_has_every_file_and_the_bundle_includes_it() {
        for relative in MOD_FILES {
            assert!(bundled_mod_folder().join(relative).is_file(), "missing {relative}");
        }
        let config: serde_json::Value = serde_json::from_str(include_str!("../../tauri.conf.json")).unwrap();
        assert_eq!(
            config["bundle"]["resources"]["resources/heidrun_code_dashboard_claude_observer/"],
            serde_json::json!("heidrun_code_dashboard_claude_observer/")
        );
    }

    #[test]
    fn the_mod_reads_the_folder_of_the_observations_and_the_herdr_pane_from_the_environment() {
        let source = std::fs::read_to_string(bundled_mod_folder().join("hooks/register.js")).unwrap();
        for name in ["HEIDRUN_CODE_DASHBOARD_OBSERVATION_DIR", "HERDR_PANE_ID", "HERDR_SOCKET_PATH"] {
            assert!(
                source.contains(&format!("$.env.get('{name}')")),
                "the mod does not read {name}"
            );
        }
    }

    #[test]
    fn the_copy_writes_the_files_once_and_fails_when_a_file_is_missing() {
        let folder = std::env::temp_dir().join(format!("heidrun_code_dashboard_mod_copy_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        let destination = folder.join("copy");
        copy_mod(&bundled_mod_folder(), &destination).unwrap();
        for relative in MOD_FILES {
            assert_eq!(
                std::fs::read(destination.join(relative)).unwrap(),
                std::fs::read(bundled_mod_folder().join(relative)).unwrap()
            );
        }
        let modified = std::fs::metadata(destination.join("hooks/register.js"))
            .unwrap()
            .modified()
            .unwrap();
        std::thread::sleep(std::time::Duration::from_millis(20));
        copy_mod(&bundled_mod_folder(), &destination).unwrap();
        assert_eq!(
            std::fs::metadata(destination.join("hooks/register.js"))
                .unwrap()
                .modified()
                .unwrap(),
            modified
        );
        assert!(copy_mod(&folder.join("missing"), &folder.join("other")).is_err());
        std::fs::remove_dir_all(&folder).unwrap();
    }
}
