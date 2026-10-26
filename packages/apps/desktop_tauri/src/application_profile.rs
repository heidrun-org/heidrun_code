//! Selects installed or development resources from the compiled application identity, before any worker starts.

use std::path::{Path, PathBuf};
use std::sync::OnceLock;

const DEVELOPMENT_IDENTIFIER: &str = "dev.heidrun-org.heidrun-code.development";
static IS_DEVELOPMENT: OnceLock<bool> = OnceLock::new();

pub fn is_development() -> bool {
    IS_DEVELOPMENT.get().copied().unwrap_or(false)
}

pub fn name() -> &'static str {
    if is_development() {
        "Heidrun Code Development"
    } else {
        "Heidrun Code"
    }
}

/// Called before Tauri creates threads or starts a server. The identity is independent of Rust optimisation settings.
pub fn initialize(identifier: &str) {
    let is_development = identifier == DEVELOPMENT_IDENTIFIER;
    IS_DEVELOPMENT
        .set(is_development)
        .expect("the application profile is selected once");
    crate::environment_file::load(is_development);
    if is_development {
        let home = dirs::home_dir().unwrap_or_default();
        let custom = std::env::var("HEIDRUN_CODE_DEVELOPMENT_DIR").ok();
        let folder = development_data_dir(&home, custom.as_deref())
            .unwrap_or_else(|error| panic!("Heidrun Code Development: {error}"));
        std::env::set_var("HEIDRUN_CODE_DIR", folder);
        // A development command often runs inside a daily-work pane. Never inherit that pane's session or socket.
        for variable in [
            "HERDR_SOCKET_PATH",
            "HERDR_SESSION",
            "HERDR_PANE_ID",
            "HERDR_TAB_ID",
            "HERDR_WORKSPACE_ID",
            "HERDR_ENV",
            "HEIDRUN_CODE_OPERATION_LOG_FILE",
        ] {
            std::env::remove_var(variable);
        }
        if let Ok(session) = std::env::var("HEIDRUN_CODE_DEVELOPMENT_SESSION") {
            if session.is_empty() == false {
                validate_development_session(&session).unwrap_or_else(|error| panic!("Heidrun Code Development: {error}"));
                std::env::set_var("HERDR_SESSION", session);
            }
        }
        std::env::set_var("HEIDRUN_CODE_MOBILE_PORT", "47824");
    }
    eprintln!(
        "{}: identifier={identifier}; data={}; session={}; socket={}",
        name(),
        crate::app_data::data_dir().display(),
        std::env::var("HERDR_SESSION").unwrap_or_else(|_| crate::herdr::session_name()),
        crate::herdr::socket_path().display()
    );
}

fn development_data_dir(home: &Path, custom: Option<&str>) -> Result<PathBuf, String> {
    let folder = custom
        .filter(|value| value.is_empty() == false)
        .map(PathBuf::from)
        .unwrap_or_else(|| default_development_data_dir(home));
    if folder.is_absolute() == false {
        return Err("HEIDRUN_CODE_DEVELOPMENT_DIR must be an absolute path".into());
    }
    for installed_default in [home.join(".config/heidrun_code"), home.join(".config/heidrun")] {
        if same_folder(&folder, &installed_default) {
            return Err("the development data folder must differ from the installed data folder".into());
        }
    }
    Ok(folder)
}

/// `~/.config/heidrun_code_development`, or the former folder `~/.config/heidrun-development` when it exists and the new
/// folder does not.
fn default_development_data_dir(home: &Path) -> PathBuf {
    let current = home.join(".config/heidrun_code_development");
    let former = home.join(".config/heidrun-development");
    if current.is_dir() == false && former.is_dir() {
        return former;
    }
    current
}

fn same_folder(left: &Path, right: &Path) -> bool {
    let left = normalized_path(left);
    let right = normalized_path(right);
    left == right
}

fn normalized_path(path: &Path) -> PathBuf {
    if let Ok(path) = path.canonicalize() {
        return path;
    }
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            std::path::Component::ParentDir => {
                normalized.pop();
            }
            std::path::Component::CurDir => {}
            component => normalized.push(component.as_os_str()),
        }
    }
    normalized.canonicalize().unwrap_or(normalized)
}

fn validate_development_session(session: &str) -> Result<(), String> {
    if session == "heidrun"
        || session == "default"
        || session.len() > 40
        || session
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
            == false
    {
        return Err("HEIDRUN_CODE_DEVELOPMENT_SESSION must name a separate session, with at most 40 letters, digits, hyphens or underscores".into());
    }
    Ok(())
}

/// Development can use the existing integration, but cannot replace the globally installed Claude Code script.
pub fn require_installed_integration() -> Result<(), String> {
    require_installed_integration_for("Claude Code")
}

pub fn require_installed_integration_for(coding_agent: &str) -> Result<(), String> {
    if is_development() {
        return Err(format!("Change the shared {coding_agent} status-line integration in installed Heidrun Code. Heidrun Code Development does not replace that integration."));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn development_ignores_an_inherited_daily_work_folder() {
        let home = Path::new("/Users/test");
        assert_eq!(
            development_data_dir(home, None).unwrap(),
            home.join(".config/heidrun_code_development")
        );
        assert_eq!(
            development_data_dir(home, Some("/separate/test")).unwrap(),
            PathBuf::from("/separate/test")
        );
        assert!(development_data_dir(home, Some("/Users/test/.config/heidrun_code")).is_err());
        assert!(development_data_dir(home, Some("relative")).is_err());
        assert!(development_data_dir(home, Some("/Users/test/.config/new/../heidrun")).is_err());
    }

    #[test]
    fn development_keeps_using_its_former_data_folder_until_the_new_folder_exists() {
        let home = std::env::temp_dir().join(format!("hd-profile-former-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        std::fs::create_dir_all(home.join(".config/heidrun-development")).unwrap();
        assert_eq!(development_data_dir(&home, None).unwrap(), home.join(".config/heidrun-development"));
        std::fs::create_dir_all(home.join(".config/heidrun_code_development")).unwrap();
        assert_eq!(development_data_dir(&home, None).unwrap(), home.join(".config/heidrun_code_development"));
        std::fs::remove_dir_all(home).unwrap();
    }

    #[test]
    #[cfg(unix)]
    fn a_symbolic_link_cannot_select_the_installed_data_folder() {
        let home = std::env::temp_dir().join(format!("hd-profile-link-{}", std::process::id()));
        let installed = home.join(".config/heidrun_code");
        std::fs::create_dir_all(&installed).unwrap();
        let alias = home.join("alias");
        std::os::unix::fs::symlink(&installed, &alias).unwrap();
        assert!(development_data_dir(&home, alias.to_str()).is_err());
        std::fs::remove_dir_all(home).unwrap();
    }

    #[test]
    fn a_development_session_cannot_select_the_installed_or_default_session() {
        for session in ["heidrun", "default", "../heidrun", "a/b", "with space"] {
            assert!(validate_development_session(session).is_err());
        }
        assert!(validate_development_session("heidrun_development_test").is_ok());
    }

    #[test]
    fn development_configuration_has_a_distinct_identity_and_visible_name() {
        let installed: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let development: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.development.conf.json")).unwrap();
        assert_eq!(development["identifier"], DEVELOPMENT_IDENTIFIER);
        assert_ne!(installed["identifier"], development["identifier"]);
        assert_eq!(development["productName"], "Heidrun Code Development");
        assert_eq!(development["app"]["windows"][0]["hiddenTitle"], false);
        assert_eq!(development["app"]["windows"][0]["titleBarStyle"], "Visible");
    }

    #[test]
    fn the_installed_application_identifier_names_heidrun_and_not_a_person_or_an_old_project() {
        let installed: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(installed["identifier"], "dev.heidrun-org.heidrun-code");
        assert_ne!(installed["identifier"], DEVELOPMENT_IDENTIFIER);
    }

    #[test]
    fn the_application_identifiers_hold_only_the_characters_that_a_bundle_identifier_allows() {
        for configuration in [
            include_str!("../tauri.conf.json"),
            include_str!("../tauri.development.conf.json"),
        ] {
            let parsed: serde_json::Value = serde_json::from_str(configuration).unwrap();
            let identifier = parsed["identifier"].as_str().unwrap();
            assert!(
                identifier
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '.'),
                "{identifier}"
            );
        }
    }

    #[test]
    fn development_startup_isolates_inherited_daily_work_environment() {
        let folder = std::env::temp_dir().join(format!("hd-profile-{}", std::process::id()));
        std::fs::create_dir_all(&folder).unwrap();
        std::fs::write(folder.join(".env"), "HERDR_SESSION=heidrun\nHEIDRUN_CODE_DIR=/daily/work\n").unwrap();
        let output = std::process::Command::new(std::env::current_exe().unwrap())
            .args([
                "--ignored",
                "--exact",
                "application_profile::tests::development_startup_child",
                "--nocapture",
            ])
            .current_dir(&folder)
            .env("HEIDRUN_CODE_DEVELOPMENT_DIR", folder.join("development"))
            .env_remove("HEIDRUN_CODE_DEVELOPMENT_SESSION")
            .env("HERDR_SESSION", "heidrun")
            .env("HERDR_SOCKET_PATH", "/daily/herdr.sock")
            .env("HERDR_PANE_ID", "w1:p1")
            .env("HEIDRUN_CODE_DIR", "/daily/work")
            .env("HEIDRUN_CODE_OPERATION_LOG_FILE", "/daily/operations.jsonl")
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "{}\n{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        std::fs::remove_dir_all(folder).unwrap();
    }

    #[test]
    #[ignore = "runs only in the isolated child process above"]
    fn development_startup_child() {
        initialize(DEVELOPMENT_IDENTIFIER);
        assert!(is_development());
        assert_eq!(
            crate::app_data::data_dir(),
            PathBuf::from(std::env::var("HEIDRUN_CODE_DEVELOPMENT_DIR").unwrap())
        );
        for variable in [
            "HERDR_SESSION",
            "HERDR_SOCKET_PATH",
            "HERDR_PANE_ID",
            "HEIDRUN_CODE_OPERATION_LOG_FILE",
        ] {
            assert!(std::env::var_os(variable).is_none());
        }
        assert_ne!(crate::herdr::session_name(), "heidrun");
        assert!(require_installed_integration().is_err());
        assert_eq!(std::env::var("HEIDRUN_CODE_MOBILE_PORT").unwrap(), "47824");
    }
}
