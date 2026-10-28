//! The `PATH` of the login shell, put into the environment of the application at the start. An application opened from
//! the Finder or the Dock gets a short `PATH` from macOS, without `/opt/homebrew/bin`, so the programs that Heidrun Code
//! starts by their name only, such as `gh` and `glab` in the data layer, are not found
//! ([issue 660](https://github.com/heidrun-org/heidrun/issues/660)).

use std::ffi::OsString;
use std::io::Read;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

/// The longest time that Heidrun Code waits for the login shell. A slow shell configuration must not hold the start.
const LOGIN_SHELL_TIMEOUT: Duration = Duration::from_secs(2);

/// The folders that Heidrun Code adds when the login shell cannot give its `PATH`: the folders of Homebrew on Apple silicon
/// and on Intel.
const USUAL_FOLDERS: [&str; 2] = ["/opt/homebrew/bin", "/usr/local/bin"];

/// The text around the `PATH` in the output of the login shell, so that a text that the shell configuration writes is
/// never read as a folder.
const MARKER: &str = "__HEIDRUN_CODE_LOGIN_SHELL_PATH__";

/// Puts the folders of the `PATH` of the login shell, then the usual folders, into the `PATH` of the application. The
/// folders of the current `PATH` stay. Called once, before Tauri creates threads, because a change of the environment
/// is not safe while other threads read it.
pub fn apply() {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let login_shell_path = read(&shell, LOGIN_SHELL_TIMEOUT);
    if login_shell_path.is_none() {
        eprintln!("Heidrun Code: the PATH of the login shell {shell} cannot be read, so the usual folders are added.");
    }
    let current_path = std::env::var_os("PATH").unwrap_or_default();
    let mut path = merge(&current_path, login_shell_path.as_deref());
    if let Some(user_bin_folder) = crate::skills::bundled::user_bin_folder() {
        let mut folders: Vec<PathBuf> = std::env::split_paths(&path).collect();
        if folders.contains(&user_bin_folder) == false {
            folders.push(user_bin_folder);
            path = std::env::join_paths(folders).unwrap_or(path);
        }
    }
    std::env::set_var("PATH", path);
}

/// Reads the `PATH` of the login shell `shell`. `None` when the shell does not start, fails, gives no `PATH`, or takes
/// more than `timeout`.
fn read(shell: &str, timeout: Duration) -> Option<String> {
    let mut child = Command::new(shell)
        .arg("-lc")
        .arg(format!("printf '{MARKER}%s{MARKER}' \"$PATH\""))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    let deadline = Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Ok(Some(status)) if status.success() => break,
            Ok(Some(_)) | Err(_) => return None,
            Ok(None) if Instant::now() >= deadline => {
                let _ = child.kill();
                let _ = child.wait();
                return None;
            }
            Ok(None) => std::thread::sleep(Duration::from_millis(10)),
        }
    }
    let mut output = String::new();
    child.stdout.take()?.read_to_string(&mut output).ok()?;
    extract(&output)
}

/// The `PATH` between the two markers of the output of the login shell, or `None` when the output has no `PATH`.
fn extract(output: &str) -> Option<String> {
    let start = output.find(MARKER)? + MARKER.len();
    let length = output[start..].find(MARKER)?;
    let path = &output[start..start + length];
    if path.is_empty() {
        return None;
    }
    Some(path.to_string())
}

/// The new `PATH`: the folders of the login shell first, then the folders of `current_path`, then the usual folders,
/// each folder once, in this order.
fn merge(current_path: &OsString, login_shell_path: Option<&str>) -> OsString {
    let mut folders: Vec<PathBuf> = Vec::new();
    let login_shell_folders = login_shell_path.map(|path| std::env::split_paths(path).collect()).unwrap_or_else(Vec::new);
    let current_folders: Vec<PathBuf> = std::env::split_paths(current_path).collect();
    let usual_folders: Vec<PathBuf> = USUAL_FOLDERS.iter().map(PathBuf::from).collect();
    for folder in login_shell_folders.into_iter().chain(current_folders).chain(usual_folders) {
        if folder.as_os_str().is_empty() == false && folders.contains(&folder) == false {
            folders.push(folder);
        }
    }
    std::env::join_paths(folders).unwrap_or_else(|_| current_path.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A new folder for one test, with an executable fake shell `shell` inside that runs `script`.
    fn fake_shell(name: &str, script: &str) -> PathBuf {
        use std::os::unix::fs::PermissionsExt;
        let folder = std::env::temp_dir().join(format!("heidrun_login_shell_path_{}_{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        let shell = folder.join("shell");
        std::fs::write(&shell, format!("#!/bin/sh\n{script}\n")).unwrap();
        std::fs::set_permissions(&shell, std::fs::Permissions::from_mode(0o755)).unwrap();
        shell
    }

    #[test]
    fn reads_the_path_of_a_login_shell_that_writes_other_text_too() {
        let shell = fake_shell(
            "chatty",
            "echo 'Welcome to the shell'\nPATH=/opt/homebrew/bin:/usr/bin\nexec /bin/sh -c \"$2\"",
        );
        assert_eq!(read(shell.to_str().unwrap(), LOGIN_SHELL_TIMEOUT).as_deref(), Some("/opt/homebrew/bin:/usr/bin"));
    }

    #[test]
    fn reads_the_path_of_the_real_login_shell() {
        let path = read("/bin/sh", LOGIN_SHELL_TIMEOUT).unwrap();
        assert!(path.contains("/usr/bin"), "the PATH of the login shell: {path}");
    }

    #[test]
    fn gives_nothing_when_the_shell_is_missing() {
        assert_eq!(read("/heidrun/no/such/shell", LOGIN_SHELL_TIMEOUT), None);
    }

    #[test]
    fn gives_nothing_when_the_shell_fails() {
        let shell = fake_shell("failing", "exit 1");
        assert_eq!(read(shell.to_str().unwrap(), LOGIN_SHELL_TIMEOUT), None);
    }

    #[test]
    fn stops_waiting_for_a_slow_shell() {
        let shell = fake_shell("slow", "sleep 5");
        let start = Instant::now();
        assert_eq!(read(shell.to_str().unwrap(), Duration::from_millis(200)), None);
        assert!(start.elapsed() < Duration::from_secs(2), "waited {:?}", start.elapsed());
    }

    #[test]
    fn gives_nothing_for_an_output_without_the_markers() {
        assert_eq!(extract("/usr/bin:/bin"), None);
        assert_eq!(extract(&format!("{MARKER}{MARKER}")), None);
    }

    #[test]
    fn puts_the_login_shell_folders_first_and_keeps_the_current_folders() {
        let merged = merge(&OsString::from("/usr/bin:/bin:/Users/me/tools"), Some("/opt/homebrew/bin:/usr/bin"));
        assert_eq!(merged, OsString::from("/opt/homebrew/bin:/usr/bin:/bin:/Users/me/tools:/usr/local/bin"));
    }

    #[test]
    fn adds_the_usual_folders_when_the_login_shell_gives_nothing() {
        let merged = merge(&OsString::from("/usr/bin:/bin:/usr/sbin:/sbin"), None);
        assert_eq!(merged, OsString::from("/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin"));
    }
}
