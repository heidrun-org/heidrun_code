//! Client for the Herdr local socket API.
//!
//! Protocol: newline-delimited JSON over a Unix domain socket.
//! Request  `{"id","method","params"}` → response `{"id","result"}` or `{"id","error"}`.
//! `events.subscribe` keeps the connection open and pushes one event per line.

use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixStream;

static NEXT_ID: AtomicU64 = AtomicU64::new(1);

/// Lifecycle events. They need no pane id, so one long-lived subscription covers them.
const LIFECYCLE_EVENTS: &[&str] = &[
    "workspace.created",
    "workspace.updated",
    "workspace.metadata_updated",
    "workspace.renamed",
    "workspace.moved",
    "workspace.reordered",
    "workspace.closed",
    "workspace.focused",
    "tab.created",
    "tab.closed",
    "tab.focused",
    "tab.renamed",
    "tab.moved",
    "pane.created",
    "pane.closed",
    "pane.updated",
    "pane.focused",
    "pane.moved",
    "pane.exited",
    "pane.agent_detected",
    "layout.updated",
];

/// Same resolution as Herdr: `$XDG_CONFIG_HOME/herdr`, else `~/.config/herdr`.
pub fn config_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("XDG_CONFIG_HOME") {
        if !dir.is_empty() {
            return PathBuf::from(dir).join("herdr");
        }
    }
    dirs::home_dir().unwrap_or_default().join(".config").join("herdr")
}

/// The name of the Herdr session that Heidrun Code uses, unless the environment variable `HERDR_SOCKET_PATH` or
/// `HERDR_SESSION` chooses another one. Heidrun Code never uses the default session: that session belongs to the terminal.
/// A development build that runs from a worktree adds the name of the worktree, see `session_name`.
pub const HEIDRUN_CODE_SESSION: &str = "heidrun";

/// The part of a path that comes before the name of a worktree. The tool `pnpm worktree:create` makes every worktree
/// inside this folder of the main checkout.
const WORKTREES_FOLDER: &str = "/.claude/worktrees/";

/// The longest part of a session name that comes from the name of a worktree. The socket of a session is a Unix socket,
/// and its full path must stay shorter than 104 bytes on macOS.
const WORKTREE_PART_MAX_LENGTH: usize = 32;

/// The name of the Herdr session for the build whose package folder is `manifest_dir`. Herdr allows one attach client
/// for each terminal, so two Heidrun Code applications in one session refuse each other's terminals. A development build
/// that comes from a worktree therefore gets its own session, `heidrun_` followed by the name of the worktree. The installed
/// application uses `heidrun`; development in the main checkout uses `heidrun_development`.
/// The application identity selects development, including an optimised development bundle.
fn session_name_for(manifest_dir: &str, is_development_build: bool) -> String {
    if is_development_build == false {
        return HEIDRUN_CODE_SESSION.to_string();
    }
    let Some((_, after_worktrees_folder)) = manifest_dir.split_once(WORKTREES_FOLDER) else {
        return "heidrun_development".to_string();
    };
    let worktree = after_worktrees_folder.split("/packages/").next().unwrap_or(after_worktrees_folder);
    let cleaned: String = worktree
        .chars()
        .map(|character| if character.is_ascii_alphanumeric() || character == '-' { character } else { '_' })
        .collect();
    let end_of_name = cleaned.trim_matches('_');
    let start = end_of_name.len().saturating_sub(WORKTREE_PART_MAX_LENGTH);
    let worktree_part = end_of_name[start..].trim_start_matches('_');
    if worktree_part.is_empty() {
        return "heidrun_development".to_string();
    }
    format!("{HEIDRUN_CODE_SESSION}_{worktree_part}")
}

/// The name of the Herdr session that this build of Heidrun Code uses when no environment variable chooses one.
pub fn session_name() -> String {
    session_name_for(env!("CARGO_MANIFEST_DIR"), crate::application_profile::is_development())
}

/// The value of an environment variable, or `None` when the variable is not set or is empty.
fn non_empty_variable(name: &str) -> Option<String> {
    std::env::var(name).ok().filter(|value| value.is_empty() == false)
}

/// True when the environment variable `HERDR_SOCKET_PATH` or `HERDR_SESSION` chooses the session. Every Herdr command
/// line that Heidrun Code runs reads the same variables, so Heidrun Code adds no `--session` argument in this case.
fn is_session_chosen_by_environment() -> bool {
    non_empty_variable("HERDR_SOCKET_PATH").is_some() || non_empty_variable("HERDR_SESSION").is_some()
}

/// The socket of the session that Heidrun Code uses: the path in `HERDR_SOCKET_PATH`, else the socket of the session named
/// in `HERDR_SESSION`, else the socket of the session that `session_name` gives.
pub fn socket_path() -> PathBuf {
    if let Some(path) = non_empty_variable("HERDR_SOCKET_PATH") {
        return PathBuf::from(path);
    }
    let name = non_empty_variable("HERDR_SESSION").unwrap_or_else(session_name);
    config_dir().join("sessions").join(name).join("herdr.sock")
}

/// The arguments of a Herdr command line: `--session` and the name that `session_name` gives first, then `arguments`.
/// When the environment chooses the session, the arguments are `arguments` alone.
pub fn command_arguments(arguments: &[&str]) -> Vec<String> {
    let mut result: Vec<String> = Vec::new();
    if is_session_chosen_by_environment() == false {
        result.push("--session".to_string());
        result.push(session_name());
    }
    result.extend(arguments.iter().map(|argument| argument.to_string()));
    result
}

/// Like `command_arguments`, for the arguments that the web page sends.
pub fn command_arguments_from(arguments: &[String]) -> Vec<String> {
    let borrowed: Vec<&str> = arguments.iter().map(String::as_str).collect();
    command_arguments(&borrowed)
}

/// The shell command that starts the Herdr server of the session that Heidrun Code uses, for `shell -lc`.
pub fn server_shell_command(bin: &std::path::Path) -> String {
    let quoted_bin = bin.display().to_string().replace('\'', "'\\''");
    format!("exec '{quoted_bin}' {}", command_arguments(&["server"]).join(" "))
}

/// The environment variables that tell a coding agent in a pane that it runs inside the terminal of Visual Studio Code.
/// The variables whose name starts with `VSCODE_` are removed too, see `is_editor_variable`.
const EDITOR_VARIABLE_NAMES: &[&str] = &["CLAUDE_CODE_SSE_PORT", "TERM_PROGRAM", "TERM_PROGRAM_VERSION"];

/// True when the environment variable `name` connects a coding agent to Visual Studio Code. A coding agent that sees
/// these variables connects to the window of Visual Studio Code that has the same folder open, and reads the open file
/// and the selected lines as if the developer had pasted them.
pub fn is_editor_variable(name: &str) -> bool {
    EDITOR_VARIABLE_NAMES.contains(&name) || name.starts_with("VSCODE_")
}

/// Removes the editor variables from the environment of `command`. Every pane inherits the environment of the Herdr
/// server, so the server must not receive these variables when the developer starts Heidrun Code from the terminal of
/// Visual Studio Code.
pub fn remove_editor_variables(command: &mut std::process::Command) {
    for (name, _) in std::env::vars_os() {
        let Some(name) = name.to_str() else {
            continue;
        };
        if is_editor_variable(name) {
            command.env_remove(name);
        }
    }
}

/// The arguments of the command that stops the session of Heidrun Code, the name that `session_name` gives, when the user
/// quits Heidrun Code. `None` when the session stays running: the user chose "Keep agents running after quit", or the
/// environment chooses a session that is not the session of Heidrun Code.
pub fn stop_session_arguments(is_keeping_agents_running: bool) -> Option<Vec<String>> {
    if is_keeping_agents_running || is_session_chosen_by_environment() {
        return None;
    }
    Some(vec!["session".to_string(), "stop".to_string(), session_name()])
}

/// Stops the session of Heidrun Code, and waits for the end of the command. Does nothing when `stop_session_arguments` gives
/// `None`. The error of the command is ignored: the application quits anyway.
pub fn stop_session_on_quit(is_keeping_agents_running: bool) {
    let Some(arguments) = stop_session_arguments(is_keeping_agents_running) else {
        return;
    };
    let _ = std::process::Command::new(herdr_bin())
        .args(arguments)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status();
}

/// Apps launched from the Finder do not inherit the shell PATH, so look in the usual places.
pub fn herdr_bin() -> PathBuf {
    if let Ok(p) = std::env::var("HERDR_BIN_PATH") {
        if !p.is_empty() {
            return PathBuf::from(p);
        }
    }
    let home = dirs::home_dir().unwrap_or_default();
    let candidates = [
        home.join(".local/bin/herdr"),
        PathBuf::from("/opt/homebrew/bin/herdr"),
        PathBuf::from("/usr/local/bin/herdr"),
        home.join(".local/share/mise/shims/herdr"),
        home.join(".nix-profile/bin/herdr"),
        home.join(".cargo/bin/herdr"),
    ];
    candidates
        .into_iter()
        .find(|p| p.exists())
        .unwrap_or_else(|| PathBuf::from("herdr"))
}

fn next_id() -> String {
    format!("hd_{}", NEXT_ID.fetch_add(1, Ordering::Relaxed))
}

fn format_error(err: &Value) -> String {
    let code = err.get("code").and_then(Value::as_str).unwrap_or("error");
    let message = err.get("message").and_then(Value::as_str).unwrap_or("");
    format!("{code}: {message}")
}

async fn connect() -> Result<UnixStream, String> {
    let path = socket_path();
    UnixStream::connect(&path)
        .await
        .map_err(|e| format!("herdr_unreachable: {} ({e})", path.display()))
}

/// One request on a fresh connection. Waits for the matching response line.
pub async fn request(method: &str, params: Value) -> Result<Value, String> {
    let mut params = params;
    let folder = if method == "workspace.create" {
        let folder = crate::workspace_folders::absolute_folder(params.get("cwd").and_then(Value::as_str))?;
        params["cwd"] = json!(folder);
        Some(folder)
    } else {
        None
    };
    let mut result = raw_request(method, params.clone()).await?;
    if let Some(folder) = folder {
        let workspace_id = result.pointer("/workspace/workspace_id").and_then(Value::as_str)
            .ok_or("Workspace creation returned no identifier")?;
        crate::workspace_folders::save(workspace_id, &folder)?;
        result["workspace"]["workspace_folder"] = json!(folder);
    }
    if method == "session.snapshot" {
        crate::workspace_folders::enrich(&mut result)?;
    }
    if method == "workspace.close" {
        if let Some(workspace_id) = params.get("workspace_id").and_then(Value::as_str) {
            crate::workspace_folders::forget(workspace_id)?;
        }
    }
    Ok(result)
}

async fn raw_request(method: &str, params: Value) -> Result<Value, String> {
    let mut stream = connect().await?;
    let id = next_id();
    let mut line = serde_json::to_string(&json!({ "id": id, "method": method, "params": params }))
        .map_err(|e| e.to_string())?;
    line.push('\n');
    stream.write_all(line.as_bytes()).await.map_err(|e| e.to_string())?;

    let mut reader = BufReader::new(stream);
    let mut buf = String::new();
    loop {
        buf.clear();
        let n = reader.read_line(&mut buf).await.map_err(|e| e.to_string())?;
        if n == 0 {
            return Err("herdr_closed: connection closed without a response".into());
        }
        let Ok(v) = serde_json::from_str::<Value>(buf.trim()) else { continue };
        let rid = v.get("id").and_then(Value::as_str).unwrap_or("");
        if rid != id && !rid.is_empty() {
            continue;
        }
        if let Some(err) = v.get("error") {
            return Err(format_error(err));
        }
        return Ok(v.get("result").cloned().unwrap_or(Value::Null));
    }
}

/// Opens a subscription and forwards every pushed line to the frontend as `herdr://event`.
/// Returns when the server closes the stream or reports an error such as `events_lost`.
async fn run_subscription(app: &AppHandle, subscriptions: Value, alive: Option<&AtomicBool>) -> Result<(), String> {
    let mut stream = connect().await?;
    let id = next_id();
    let mut line = serde_json::to_string(&json!({
        "id": id,
        "method": "events.subscribe",
        "params": { "subscriptions": subscriptions }
    }))
    .map_err(|e| e.to_string())?;
    line.push('\n');
    stream.write_all(line.as_bytes()).await.map_err(|e| e.to_string())?;

    let mut reader = BufReader::new(stream);
    let mut buf = String::new();
    let mut started = false;
    loop {
        if let Some(flag) = alive {
            if !flag.load(Ordering::Relaxed) {
                return Ok(());
            }
        }
        buf.clear();
        let n = reader.read_line(&mut buf).await.map_err(|e| e.to_string())?;
        if n == 0 {
            return Err("herdr_closed".into());
        }
        let Ok(v) = serde_json::from_str::<Value>(buf.trim()) else { continue };
        if let Some(err) = v.get("error") {
            let msg = format_error(err);
            let _ = app.emit("herdr://resync", &msg);
            return Err(msg);
        }
        if !started {
            started = true;
            if v.pointer("/result/type").and_then(Value::as_str) == Some("subscription_started") {
                if alive.is_none() {
                    let _ = app.emit("herdr://connected", ());
                }
                continue;
            }
        }
        let _ = app.emit("herdr://event", &v);
    }
}

/// Background loop: keeps the lifecycle subscription alive and reconnects when Herdr restarts.
pub fn spawn_event_loop(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let subs: Vec<Value> = LIFECYCLE_EVENTS.iter().map(|t| json!({ "type": t })).collect();
        let subs = Value::Array(subs);
        loop {
            if let Err(e) = run_subscription(&app, subs.clone(), None).await {
                let _ = app.emit("herdr://disconnected", e);
            }
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    });
}

/// Per-pane agent status subscription. `pane.agent_status_changed` requires a pane id,
/// so the set is rebuilt whenever the frontend sees the pane list change.
#[derive(Default)]
pub struct StatusWatcher {
    inner: Mutex<WatcherInner>,
}

#[derive(Default)]
struct WatcherInner {
    pane_ids: Vec<String>,
    alive: Option<Arc<AtomicBool>>,
}

impl StatusWatcher {
    pub fn watch(&self, app: AppHandle, mut pane_ids: Vec<String>) {
        pane_ids.sort();
        pane_ids.dedup();
        let mut inner = self.inner.lock().unwrap();
        let running = inner.alive.as_ref().map(|a| a.load(Ordering::Relaxed)).unwrap_or(false);
        if running && inner.pane_ids == pane_ids {
            return;
        }
        if let Some(old) = inner.alive.take() {
            old.store(false, Ordering::Relaxed);
        }
        inner.pane_ids = pane_ids.clone();
        if pane_ids.is_empty() {
            return;
        }
        let alive = Arc::new(AtomicBool::new(true));
        inner.alive = Some(alive.clone());
        drop(inner);

        tauri::async_runtime::spawn(async move {
            let subs: Vec<Value> = pane_ids
                .iter()
                .map(|p| json!({ "type": "pane.agent_status_changed", "pane_id": p }))
                .collect();
            // A closed pane makes the server reject the whole set: stop and let the
            // frontend rebuild it from the next snapshot.
            let _ = run_subscription(&app, Value::Array(subs), Some(&alive)).await;
            alive.store(false, Ordering::Relaxed);
        });
    }
}

/// The tests change environment variables of the whole process: they run one at a time, in every module.
#[cfg(test)]
pub(crate) static ENV_LOCK: Mutex<()> = Mutex::new(());

/// Removes the environment variables that the functions of this file read.
#[cfg(test)]
pub(crate) fn clear_env() {
    for name in ["HERDR_SOCKET_PATH", "HERDR_SESSION", "XDG_CONFIG_HOME", "HERDR_BIN_PATH"] {
        std::env::remove_var(name);
    }
}

#[cfg(test)]
mod herdr_tests {
    use super::*;

    #[test]
    fn config_dir_follows_the_xdg_variable() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        std::env::set_var("XDG_CONFIG_HOME", "/xdg");
        assert_eq!(config_dir(), PathBuf::from("/xdg/herdr"));
        std::env::set_var("XDG_CONFIG_HOME", "");
        assert!(config_dir().ends_with(".config/herdr"));
        clear_env();
    }

    #[test]
    fn socket_path_prefers_the_explicit_path() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        std::env::set_var("HERDR_SOCKET_PATH", "/run/herdr.sock");
        std::env::set_var("HERDR_SESSION", "work");
        assert_eq!(socket_path(), PathBuf::from("/run/herdr.sock"));
        clear_env();
    }

    #[test]
    fn socket_path_uses_the_named_session() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        std::env::set_var("XDG_CONFIG_HOME", "/xdg");
        std::env::set_var("HERDR_SESSION", "work");
        assert_eq!(socket_path(), PathBuf::from("/xdg/herdr/sessions/work/herdr.sock"));
        clear_env();
    }

    #[test]
    fn socket_path_defaults_to_the_socket_of_the_heidrun_session() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        std::env::set_var("XDG_CONFIG_HOME", "/xdg");
        assert_eq!(socket_path(), PathBuf::from(format!("/xdg/herdr/sessions/{}/herdr.sock", session_name())));
        clear_env();
    }

    #[test]
    fn the_installed_application_uses_heidrun_and_main_checkout_development_is_separate() {
        let main_checkout = "/Users/someone/webwork/heidrun/packages/apps/desktop_tauri";
        let worktree = "/Users/someone/webwork/heidrun/.claude/worktrees/fix-terminal-detached-483/packages/apps/desktop_tauri";
        assert_eq!(session_name_for(main_checkout, true), "heidrun_development");
        assert_eq!(session_name_for(main_checkout, false), "heidrun");
        assert_eq!(session_name_for(worktree, false), "heidrun");
    }

    #[test]
    fn a_worktree_without_a_usable_name_never_selects_the_installed_session() {
        assert_eq!(session_name_for("/project/.claude/worktrees/___/packages/apps/desktop_tauri", true), "heidrun_development");
    }

    #[test]
    fn a_development_build_in_a_worktree_uses_its_own_session() {
        let worktree = "/Users/someone/webwork/heidrun/.claude/worktrees/fix-terminal-detached-483/packages/apps/desktop_tauri";
        assert_eq!(session_name_for(worktree, true), "heidrun_fix-terminal-detached-483");
        let other_worktree = "/Users/someone/webwork/heidrun/.claude/worktrees/other-fix-12/packages/apps/desktop_tauri";
        assert_ne!(session_name_for(worktree, true), session_name_for(other_worktree, true));
    }

    #[test]
    fn the_session_of_a_nested_worktree_uses_every_folder_of_its_name() {
        let nested = "/Users/someone/webwork/heidrun/.claude/worktrees/codex/files-ai-documentation-409/packages/apps/desktop_tauri";
        assert_eq!(session_name_for(nested, true), "heidrun_codex_files-ai-documentation-409");
    }

    #[test]
    fn the_session_of_a_worktree_with_a_long_name_keeps_the_end_of_the_name() {
        let long_name = "a-very-long-name-for-a-worktree-that-would-make-the-socket-path-too-long-1234";
        let manifest_dir = format!("/Users/someone/heidrun/.claude/worktrees/{long_name}/packages/apps/desktop_tauri");
        let session = session_name_for(&manifest_dir, true);
        assert!(session.starts_with("heidrun_"));
        assert!(session.ends_with("too-long-1234"));
        assert!(session.len() <= "heidrun_".len() + WORKTREE_PART_MAX_LENGTH);
    }

    #[test]
    fn the_session_of_a_worktree_has_only_letters_digits_hyphens_and_underscores() {
        let manifest_dir = "/Users/someone/heidrun/.claude/worktrees/my fix.v2/packages/apps/desktop_tauri";
        assert_eq!(session_name_for(manifest_dir, true), "heidrun_my_fix_v2");
    }

    #[test]
    fn socket_path_ignores_empty_environment_variables() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        std::env::set_var("XDG_CONFIG_HOME", "/xdg");
        std::env::set_var("HERDR_SOCKET_PATH", "");
        std::env::set_var("HERDR_SESSION", "");
        assert_eq!(socket_path(), PathBuf::from(format!("/xdg/herdr/sessions/{}/herdr.sock", session_name())));
        clear_env();
    }

    #[test]
    fn a_command_line_uses_the_heidrun_session_when_no_environment_variable_is_set() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        let session = session_name();
        assert_eq!(command_arguments(&["pane", "run", "w1:p1", "ls"]), vec!["--session", session.as_str(), "pane", "run", "w1:p1", "ls"]);
        assert_eq!(
            command_arguments_from(&["workspace".to_string(), "list".to_string()]),
            vec!["--session", session.as_str(), "workspace", "list"]
        );
        clear_env();
    }

    #[test]
    fn a_command_line_adds_no_session_when_an_environment_variable_chooses_it() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        std::env::set_var("HERDR_SESSION", "work");
        assert_eq!(command_arguments(&["workspace", "list"]), vec!["workspace", "list"]);
        clear_env();
        std::env::set_var("HERDR_SOCKET_PATH", "/run/herdr.sock");
        assert_eq!(command_arguments(&["workspace", "list"]), vec!["workspace", "list"]);
        clear_env();
    }

    #[test]
    fn the_server_starts_in_the_heidrun_session() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        let session = session_name();
        assert_eq!(
            server_shell_command(std::path::Path::new("/opt/homebrew/bin/herdr")),
            format!("exec '/opt/homebrew/bin/herdr' --session {session} server")
        );
        assert_eq!(
            server_shell_command(std::path::Path::new("/it's/herdr")),
            format!("exec '/it'\\''s/herdr' --session {session} server")
        );
        std::env::set_var("HERDR_SESSION", "work");
        assert_eq!(server_shell_command(std::path::Path::new("/opt/herdr")), "exec '/opt/herdr' server");
        clear_env();
    }

    #[test]
    fn the_editor_variables_are_recognized() {
        for name in ["CLAUDE_CODE_SSE_PORT", "TERM_PROGRAM", "TERM_PROGRAM_VERSION", "VSCODE_INJECTION", "VSCODE_GIT_IPC_HANDLE"] {
            assert!(is_editor_variable(name), "{name} must be an editor variable");
        }
        for name in ["PATH", "HOME", "TERM", "COLORTERM", "HERDR_SESSION", "MY_VSCODE_VARIABLE", "CLAUDE_CODE_OTHER"] {
            assert_eq!(is_editor_variable(name), false, "{name} must not be an editor variable");
        }
    }

    #[test]
    fn the_server_command_loses_the_editor_variables_and_keeps_the_other_variables() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        std::env::set_var("CLAUDE_CODE_SSE_PORT", "41752");
        std::env::set_var("TERM_PROGRAM", "vscode");
        std::env::set_var("TERM_PROGRAM_VERSION", "1.0.0");
        std::env::set_var("VSCODE_INJECTION", "1");
        std::env::set_var("KEPT_TEST_VARIABLE", "kept");
        let mut command = std::process::Command::new("herdr");
        remove_editor_variables(&mut command);
        let changes: std::collections::HashMap<String, Option<String>> = command
            .get_envs()
            .map(|(name, value)| (name.to_string_lossy().into_owned(), value.map(|v| v.to_string_lossy().into_owned())))
            .collect();
        for name in ["CLAUDE_CODE_SSE_PORT", "TERM_PROGRAM", "TERM_PROGRAM_VERSION", "VSCODE_INJECTION"] {
            assert_eq!(changes.get(name), Some(&None), "{name} must be removed");
        }
        assert_eq!(changes.contains_key("KEPT_TEST_VARIABLE"), false);
        for name in ["CLAUDE_CODE_SSE_PORT", "TERM_PROGRAM", "TERM_PROGRAM_VERSION", "VSCODE_INJECTION", "KEPT_TEST_VARIABLE"] {
            std::env::remove_var(name);
        }
    }

    #[test]
    fn a_started_process_does_not_receive_the_editor_variables() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        std::env::set_var("CLAUDE_CODE_SSE_PORT", "41752");
        std::env::set_var("VSCODE_INJECTION", "1");
        std::env::set_var("KEPT_TEST_VARIABLE", "kept");
        let mut command = std::process::Command::new("/usr/bin/env");
        remove_editor_variables(&mut command);
        let output = command.output().expect("the command env must run");
        let text = String::from_utf8_lossy(&output.stdout).into_owned();
        for name in ["CLAUDE_CODE_SSE_PORT", "VSCODE_INJECTION", "KEPT_TEST_VARIABLE"] {
            std::env::remove_var(name);
        }
        assert_eq!(text.contains("CLAUDE_CODE_SSE_PORT="), false);
        assert_eq!(text.contains("VSCODE_INJECTION="), false);
        assert!(text.contains("KEPT_TEST_VARIABLE=kept"));
    }

    #[test]
    fn the_quit_step_stops_only_the_heidrun_session() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        assert_eq!(stop_session_arguments(false), Some(vec!["session".to_string(), "stop".to_string(), session_name()]));
        clear_env();
    }

    #[test]
    fn the_quit_step_does_not_stop_the_session_when_the_setting_keeps_the_agents_running() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        assert_eq!(stop_session_arguments(true), None);
        clear_env();
    }

    #[test]
    fn the_quit_step_does_not_stop_a_session_chosen_by_the_environment() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        std::env::set_var("HERDR_SESSION", "work");
        assert_eq!(stop_session_arguments(false), None);
        clear_env();
        std::env::set_var("HERDR_SOCKET_PATH", "/run/herdr.sock");
        assert_eq!(stop_session_arguments(false), None);
        clear_env();
    }

    #[test]
    fn binary_path_follows_the_variable() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        clear_env();
        std::env::set_var("HERDR_BIN_PATH", "/opt/herdr");
        assert_eq!(herdr_bin(), PathBuf::from("/opt/herdr"));
        clear_env();
    }

    #[test]
    fn request_identifiers_are_unique_and_prefixed() {
        let a = next_id();
        let b = next_id();
        assert_ne!(a, b);
        assert!(a.starts_with("hd_"));
    }

    #[test]
    fn formats_an_error_with_its_code_and_message() {
        assert_eq!(format_error(&json!({ "code": "not_found", "message": "no pane" })), "not_found: no pane");
        assert_eq!(format_error(&json!({})), "error: ");
    }

    #[test]
    fn subscribes_to_the_lifecycle_events_without_duplicates() {
        let mut seen = std::collections::HashSet::new();
        for event in LIFECYCLE_EVENTS {
            assert!(seen.insert(*event), "duplicate {event}");
            assert!(event.contains('.'));
        }
    }
}
