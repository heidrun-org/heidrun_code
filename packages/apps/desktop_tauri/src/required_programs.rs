//! The programs of other makers that Heidrun Code needs on the computer: Herdr, which is required, and ngrok, which is
//! optional and only for the mobile access. Heidrun Code installs neither of them. At the start, the web page asks which ones
//! are installed, and shows a notice with the install command of each missing program (issue 546).

use serde::Serialize;
use std::path::Path;
use std::process::Stdio;

/// The state of one program on this computer.
#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProgramStatus {
    /// True when the program is on this computer.
    pub is_installed: bool,
    /// True when the program is on this computer, but its version is older than the version that Heidrun Code needs.
    pub is_too_old: bool,
}

/// The oldest version of Herdr that Heidrun Code works with, as major and minor numbers.
const OLDEST_HERDR_VERSION: (u64, u64) = (0, 9);

/// The state of each program that Heidrun Code needs.
#[derive(Debug, Serialize, PartialEq)]
pub struct RequiredProgramsStatus {
    /// Herdr: required. Heidrun Code cannot show a terminal without it.
    pub herdr: ProgramStatus,
    /// ngrok: optional. Only the mobile access uses it.
    pub ngrok: ProgramStatus,
}

/// The coding agents whose command line tools can be found by the login shell.
#[tauri::command]
pub async fn coding_agents_available() -> Vec<String> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let command = concat!(
        "for coding_agent in claude codex agy; do ",
        "command -v \"$coding_agent\" >/dev/null 2>&1 && ",
        "printf '%s\\n' \"$coding_agent\"; ",
        "done"
    );
    let output = tokio::process::Command::new(shell)
        .arg("-lc")
        .arg(command)
        .stdin(Stdio::null())
        .stderr(Stdio::null())
        .output()
        .await;
    let Ok(output) = output else {
        return Vec::new();
    };
    if output.status.success() == false {
        return Vec::new();
    }
    coding_agent_ids_from_commands(&String::from_utf8_lossy(&output.stdout))
}

fn coding_agent_ids_from_commands(commands: &str) -> Vec<String> {
    commands
        .lines()
        .filter_map(|command| match command {
            "claude" => Some("claude".to_string()),
            "codex" => Some("codex".to_string()),
            "agy" => Some("antigravity".to_string()),
            _ => None,
        })
        .collect()
}

/// Tells which programs are installed. Herdr is searched like `herdr::herdr_bin` does, then on the `PATH` of the login
/// shell, because Heidrun Code starts the Herdr server through the login shell. ngrok is searched like the mobile server does.
#[tauri::command]
pub async fn required_programs_status() -> RequiredProgramsStatus {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let ngrok_path = mobile_server::find_ngrok();
    let herdr_path = crate::herdr::herdr_bin();
    let is_herdr_installed = is_herdr_installed(&herdr_path, &shell).await;
    let is_herdr_too_old = is_herdr_installed && is_version_too_old(&herdr_version_output(&herdr_path, &shell).await);
    RequiredProgramsStatus {
        herdr: ProgramStatus { is_installed: is_herdr_installed, is_too_old: is_herdr_too_old },
        ngrok: ProgramStatus { is_installed: ngrok_path.is_some(), is_too_old: false },
    }
}

/// The output of `herdr --version`, for example `herdr 0.9.3`, or an empty text when Herdr cannot start.
async fn herdr_version_output(herdr_path: &Path, shell: &str) -> String {
    let mut command = if herdr_path.is_absolute() {
        let mut command = tokio::process::Command::new(herdr_path);
        command.arg("--version");
        command
    } else {
        let mut command = tokio::process::Command::new(shell);
        command.arg("-lc").arg("herdr --version");
        command
    };
    command.stdin(Stdio::null()).stderr(Stdio::null());
    match command.output().await {
        Ok(output) => String::from_utf8_lossy(&output.stdout).into_owned(),
        Err(_) => String::new(),
    }
}

/// True when `version_output` gives a version older than `OLDEST_HERDR_VERSION`. When the output has no version that
/// Heidrun Code can read, the version is not called too old, so that a change of the output never blocks the end user.
fn is_version_too_old(version_output: &str) -> bool {
    let version = version_output
        .split_whitespace()
        .map(|word| word.trim_start_matches('v'))
        .find(|word| word.split('.').count() >= 2 && word.split('.').all(|part| part.parse::<u64>().is_ok()));
    let Some(version) = version else {
        return false;
    };
    let mut parts = version.split('.').map(|part| part.parse::<u64>().unwrap_or(0));
    let major = parts.next().unwrap_or(0);
    let minor = parts.next().unwrap_or(0);
    (major, minor) < OLDEST_HERDR_VERSION
}

/// True when Herdr is installed. `herdr_path` is the path that `herdr::herdr_bin` gives: an absolute path when Herdr is in
/// one of the usual places, or the bare name `herdr` when it is not. For the bare name, the login shell `shell` searches
/// its `PATH`.
async fn is_herdr_installed(herdr_path: &Path, shell: &str) -> bool {
    if herdr_path.is_absolute() {
        return herdr_path.is_file();
    }
    tokio::process::Command::new(shell)
        .arg("-lc")
        .arg("command -v herdr")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|status| status.success())
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temporary_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("heidrun_required_programs_{}_{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        folder
    }

    #[test]
    fn maps_only_the_supported_coding_agent_commands_to_settings_ids() {
        assert_eq!(
            coding_agent_ids_from_commands("claude\ncodex\nagy\nother\n"),
            ["claude", "codex", "antigravity"]
        );
    }

    #[test]
    fn gives_no_coding_agents_when_no_supported_command_is_available() {
        assert!(coding_agent_ids_from_commands("other\n").is_empty());
    }

    #[tokio::test]
    async fn herdr_is_installed_when_its_absolute_path_is_a_file() {
        let folder = temporary_folder("herdr_file");
        let herdr_path = folder.join("herdr");
        std::fs::write(&herdr_path, "#!/bin/sh\n").unwrap();
        assert_eq!(is_herdr_installed(&herdr_path, "/usr/bin/false").await, true);
    }

    #[tokio::test]
    async fn herdr_is_missing_when_its_absolute_path_is_not_there() {
        let folder = temporary_folder("herdr_missing");
        assert_eq!(is_herdr_installed(&folder.join("herdr"), "/usr/bin/true").await, false);
    }

    #[tokio::test]
    async fn herdr_is_missing_when_its_absolute_path_is_a_folder() {
        let folder = temporary_folder("herdr_folder");
        let herdr_path = folder.join("herdr");
        std::fs::create_dir_all(&herdr_path).unwrap();
        assert_eq!(is_herdr_installed(&herdr_path, "/usr/bin/true").await, false);
    }

    #[tokio::test]
    async fn the_bare_name_asks_the_login_shell() {
        assert_eq!(is_herdr_installed(Path::new("herdr"), "/usr/bin/true").await, true);
        assert_eq!(is_herdr_installed(Path::new("herdr"), "/usr/bin/false").await, false);
    }

    #[tokio::test]
    async fn the_bare_name_is_missing_when_the_shell_cannot_start() {
        let folder = temporary_folder("no_shell");
        let shell = folder.join("no_such_shell");
        assert_eq!(is_herdr_installed(Path::new("herdr"), &shell.display().to_string()).await, false);
    }

    #[test]
    fn a_version_older_than_0_9_is_too_old() {
        assert_eq!(is_version_too_old("herdr 0.8.7\n"), true);
        assert_eq!(is_version_too_old("herdr v0.1.0"), true);
    }

    #[test]
    fn the_version_0_9_and_later_is_not_too_old() {
        assert_eq!(is_version_too_old("herdr 0.9.0\n"), false);
        assert_eq!(is_version_too_old("herdr 0.9.3"), false);
        assert_eq!(is_version_too_old("herdr 0.10.0"), false);
        assert_eq!(is_version_too_old("herdr 1.0.0"), false);
    }

    #[test]
    fn an_output_with_no_version_is_not_too_old() {
        assert_eq!(is_version_too_old(""), false);
        assert_eq!(is_version_too_old("herdr unknown"), false);
    }

    #[tokio::test]
    async fn the_version_is_read_from_a_fake_herdr() {
        let folder = temporary_folder("herdr_version");
        let herdr_path = folder.join("herdr");
        std::fs::write(&herdr_path, "#!/bin/sh\necho herdr 0.8.1\n").unwrap();
        std::fs::set_permissions(&herdr_path, std::os::unix::fs::PermissionsExt::from_mode(0o755)).unwrap();
        let output = herdr_version_output(&herdr_path, "/usr/bin/false").await;
        assert_eq!(output.trim(), "herdr 0.8.1");
        assert_eq!(is_version_too_old(&output), true);
    }

    #[tokio::test]
    async fn the_version_output_is_empty_when_herdr_cannot_start() {
        let folder = temporary_folder("herdr_no_start");
        assert_eq!(herdr_version_output(&folder.join("herdr"), "/usr/bin/false").await, "");
    }

    #[test]
    fn the_status_is_sent_with_the_names_that_the_web_page_reads() {
        let status = RequiredProgramsStatus {
            herdr: ProgramStatus { is_installed: true, is_too_old: true },
            ngrok: ProgramStatus { is_installed: true, is_too_old: false },
        };
        assert_eq!(
            serde_json::to_value(&status).unwrap(),
            serde_json::json!({
                "herdr": { "isInstalled": true, "isTooOld": true },
                "ngrok": { "isInstalled": true, "isTooOld": false },
            })
        );
    }
}
