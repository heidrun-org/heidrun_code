//! Plugs Heidrun Code into Claude Code's status line, without losing the user's own.
//!
//! Claude Code gives its status line command the context window and the account
//! rate limits on stdin. Our script (embedded below) reports them to Herdr as pane
//! tokens, then hands the same input to the user's previous status line command,
//! so what Claude Code displays does not change.

use serde::Serialize;
use serde_json::{json, Map, Value};
use std::path::PathBuf;

const SCRIPT: &str = include_str!("../../../../scripts/claude-statusline.sh");

pub(crate) fn claude_dir() -> PathBuf {
    data_layer_coding_agents::claude_dir()
}

fn desk_dir() -> PathBuf {
    crate::app_data::data_dir()
}

fn settings_path() -> PathBuf {
    claude_dir().join("settings.json")
}

fn script_path() -> PathBuf {
    desk_dir().join("claude-statusline.sh")
}

fn next_path() -> PathBuf {
    desk_dir().join("claude-statusline-next")
}

fn hidden_path() -> PathBuf {
    desk_dir().join("claude-statusline-hidden")
}

#[derive(Serialize)]
pub struct StatuslineState {
    pub installed: bool,
    pub settings_path: String,
    /// The user's own status line, kept for display.
    pub chained: Option<String>,
    /// Nothing is printed in the terminal; the numbers only go to the app.
    pub hidden: bool,
}

fn read_settings() -> Result<Map<String, Value>, String> {
    match std::fs::read_to_string(settings_path()) {
        Ok(text) if !text.trim().is_empty() => match serde_json::from_str::<Value>(&text) {
            Ok(Value::Object(m)) => Ok(m),
            Ok(_) => Err("settings.json n’est pas un objet JSON".into()),
            Err(e) => Err(format!("settings.json illisible : {e}")),
        },
        _ => Ok(Map::new()),
    }
}

fn write_settings(m: &Map<String, Value>) -> Result<(), String> {
    let path = settings_path();
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let mut text = serde_json::to_string_pretty(&Value::Object(m.clone())).map_err(|e| e.to_string())?;
    text.push('\n');
    std::fs::write(&path, text).map_err(|e| format!("écriture de {} impossible : {e}", path.display()))
}

fn current_command(m: &Map<String, Value>) -> Option<String> {
    m.get("statusLine")?.get("command")?.as_str().map(String::from)
}

fn is_ours(cmd: &str) -> bool {
    cmd == script_path().to_string_lossy()
        || (crate::application_profile::is_development() == false
            && (cmd.contains("heidrun/claude-statusline.sh")
                || cmd.contains("heidrun_code/claude-statusline.sh")
                || cmd.contains("Heidrun/scripts/claude-statusline.sh")))
}

/// Moves what the former name "Herdr Desk" left in the Claude Code settings: the backup file, and the
/// status line command that points into the former configuration folder.
pub fn migrate_legacy() {
    let legacy_backup = claude_dir().join("settings.json.herdr-desk-backup");
    let backup = claude_dir().join("settings.json.heidrun-backup");
    if legacy_backup.exists() && !backup.exists() {
        let _ = std::fs::rename(legacy_backup, backup);
    }
    let Ok(mut m) = read_settings() else { return };
    let Some(cmd) = current_command(&m) else { return };
    if !cmd.contains("herdr-desk/claude-statusline.sh") {
        return;
    }
    if let Some(Value::Object(line)) = m.get_mut("statusLine") {
        line.insert("command".into(), json!(script_path().display().to_string()));
    }
    if write_settings(&m).is_ok() {
        let _ = std::fs::create_dir_all(desk_dir());
        let _ = std::fs::write(script_path(), SCRIPT);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(script_path(), std::fs::Permissions::from_mode(0o755));
        }
    }
}

#[tauri::command]
pub fn claude_statusline_state() -> Result<StatuslineState, String> {
    let m = read_settings()?;
    let installed = current_command(&m).map(|c| is_ours(&c)).unwrap_or(false);
    // Keep the installed copy in step with this version of the app.
    if installed && crate::application_profile::is_development() == false
        && std::fs::read_to_string(script_path()).ok().as_deref() != Some(SCRIPT) {
        let _ = std::fs::write(script_path(), SCRIPT);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(script_path(), std::fs::Permissions::from_mode(0o755));
        }
    }
    let chained = std::fs::read_to_string(next_path()).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    Ok(StatuslineState {
        installed,
        settings_path: settings_path().display().to_string(),
        chained,
        hidden: hidden_path().exists(),
    })
}

#[tauri::command]
pub fn claude_statusline_install() -> Result<StatuslineState, String> {
    crate::application_profile::require_installed_integration()?;
    let mut m = read_settings()?;
    std::fs::create_dir_all(desk_dir()).map_err(|e| e.to_string())?;

    // Always (re)write the script so updates of Heidrun Code reach it.
    std::fs::write(script_path(), SCRIPT).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(script_path(), std::fs::Permissions::from_mode(0o755));
    }

    match current_command(&m) {
        Some(cmd) if is_ours(&cmd) => {} // already installed: keep the saved chain as is
        Some(cmd) => {
            std::fs::write(next_path(), format!("{cmd}\n")).map_err(|e| e.to_string())?;
        }
        None => {
            let _ = std::fs::remove_file(next_path());
        }
    }

    // Backup once, before the first change.
    let backup = claude_dir().join("settings.json.heidrun-backup");
    if settings_path().exists() && !backup.exists() {
        let _ = std::fs::copy(settings_path(), &backup);
    }

    let mut line = match m.get("statusLine") {
        Some(Value::Object(o)) => o.clone(),
        _ => Map::new(),
    };
    line.insert("type".into(), json!("command"));
    line.insert("command".into(), json!(script_path().display().to_string()));
    m.insert("statusLine".into(), Value::Object(line));
    write_settings(&m)?;
    claude_statusline_state()
}

/// `remoteControlAtStartup` in the user settings: true / false, or absent (default).
#[tauri::command]
pub fn claude_rc_startup() -> Result<Option<bool>, String> {
    Ok(read_settings()?.get("remoteControlAtStartup").and_then(Value::as_bool))
}

#[tauri::command]
pub fn claude_set_rc_startup(enabled: bool) -> Result<Option<bool>, String> {
    let mut m = read_settings()?;
    let backup = claude_dir().join("settings.json.heidrun-backup");
    if settings_path().exists() && !backup.exists() {
        let _ = std::fs::copy(settings_path(), &backup);
    }
    if enabled {
        m.insert("remoteControlAtStartup".into(), json!(true));
    } else {
        // Back to Claude Code's default rather than forcing "false".
        m.remove("remoteControlAtStartup");
    }
    write_settings(&m)?;
    claude_rc_startup()
}

/// Hides (or shows again) the status line row in Claude Code; reporting continues.
#[tauri::command]
pub fn claude_statusline_set_hidden(hidden: bool) -> Result<StatuslineState, String> {
    crate::application_profile::require_installed_integration()?;
    std::fs::create_dir_all(desk_dir()).map_err(|e| e.to_string())?;
    if hidden {
        std::fs::write(hidden_path(), "1\n").map_err(|e| e.to_string())?;
    } else {
        let _ = std::fs::remove_file(hidden_path());
    }
    claude_statusline_state()
}

/// Puts the user's own status line back (or removes ours if there was none).
#[tauri::command]
pub fn claude_statusline_uninstall() -> Result<StatuslineState, String> {
    crate::application_profile::require_installed_integration()?;
    let mut m = read_settings()?;
    let chained = std::fs::read_to_string(next_path()).ok().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());
    match chained {
        Some(cmd) => {
            if let Some(Value::Object(line)) = m.get_mut("statusLine") {
                line.insert("command".into(), json!(cmd));
            }
        }
        None => {
            m.remove("statusLine");
        }
    }
    write_settings(&m)?;
    let _ = std::fs::remove_file(next_path());
    let _ = std::fs::remove_file(hidden_path());
    claude_statusline_state()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Puts the environment variable `HOME` back when the test ends, so other tests see the real home folder.
    struct RestoreHome(Option<std::ffi::OsString>);

    impl Drop for RestoreHome {
        fn drop(&mut self) {
            match &self.0 {
                Some(value) => std::env::set_var("HOME", value),
                None => std::env::remove_var("HOME"),
            }
        }
    }

    #[test]
    fn install_chains_and_uninstall_restores() {
        let _home_lock = crate::HOME_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _home_restore = RestoreHome(std::env::var_os("HOME"));
        let home = std::env::temp_dir().join(format!("hd-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&home);
        std::fs::create_dir_all(home.join(".claude")).unwrap();
        std::env::set_var("HOME", &home);
        std::env::remove_var("CLAUDE_CONFIG_DIR");
        std::fs::write(
            home.join(".claude/settings.json"),
            r#"{"model":"opus","statusLine":{"type":"command","command":"~/.claude/mine.sh","padding":1}}"#,
        )
        .unwrap();

        let st = claude_statusline_install().unwrap();
        assert!(st.installed);
        assert_eq!(st.chained.as_deref(), Some("~/.claude/mine.sh"));
        let m = read_settings().unwrap();
        assert_eq!(m["statusLine"]["padding"], 1);
        assert_eq!(m.keys().next().unwrap(), "model"); // order preserved
        assert!(script_path().exists());

        // Installing twice keeps the original chain.
        let st = claude_statusline_install().unwrap();
        assert_eq!(st.chained.as_deref(), Some("~/.claude/mine.sh"));

        let st = claude_statusline_uninstall().unwrap();
        assert!(!st.installed);
        assert_eq!(read_settings().unwrap()["statusLine"]["command"], "~/.claude/mine.sh");
        let _ = std::fs::remove_dir_all(&home);
    }
}

// ---- Slash commands -------------------------------------------------------

/// Built-in Claude Code commands, recognized in the agent's output.
const BUILTIN_COMMANDS: &[&str] = &[
    "add-dir", "agents", "bashes", "bug", "clear", "compact", "config", "context", "cost", "doctor",
    "export", "help", "hooks", "ide", "init", "install-github-app", "login", "logout", "mcp", "memory",
    "model", "output-style", "permissions", "plugin", "pr-comments", "privacy-settings", "release-notes",
    "remote-control", "resume", "review", "rewind", "sandbox", "security-review", "status", "statusline",
    "terminal-setup", "todos", "upgrade", "usage", "vim",
];

/// `commands/**/*.md` → "name" or "sub:name"; `skills/<name>/SKILL.md` → "name".
fn collect(dir: &std::path::Path, out: &mut Vec<String>, prefix: Option<&str>) {
    fn walk(base: &std::path::Path, dir: &std::path::Path, out: &mut Vec<String>, prefix: Option<&str>, depth: u8) {
        let Ok(entries) = std::fs::read_dir(dir) else { return };
        for e in entries.flatten() {
            let p = e.path();
            if p.is_dir() && depth < 4 {
                walk(base, &p, out, prefix, depth + 1);
            } else if p.extension().is_some_and(|x| x == "md") {
                let rel = p.strip_prefix(base).unwrap_or(&p).with_extension("");
                let name = rel.to_string_lossy().replace(['/', '\\'], ":");
                push(out, prefix, name);
            }
        }
    }
    fn push(out: &mut Vec<String>, prefix: Option<&str>, name: String) {
        if let Some(pre) = prefix {
            out.push(format!("{pre}:{name}"));
        }
        out.push(name);
    }
    walk(&dir.join("commands"), &dir.join("commands"), out, prefix, 0);
    if let Ok(entries) = std::fs::read_dir(dir.join("skills")) {
        for e in entries.flatten() {
            if e.path().join("SKILL.md").exists() {
                push(out, prefix, e.file_name().to_string_lossy().into_owned());
            }
        }
    }
}

/// Plugins: any folder holding `.claude-plugin/` under ~/.claude/plugins.
fn collect_plugins(dir: &std::path::Path, out: &mut Vec<String>, depth: u8) {
    if dir.join(".claude-plugin").is_dir() {
        let name = dir.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        collect(dir, out, Some(&name));
        return;
    }
    if depth >= 5 {
        return;
    }
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.flatten() {
            let p = e.path();
            if p.is_dir() && !e.file_name().to_string_lossy().starts_with('.') {
                collect_plugins(&p, out, depth + 1);
            }
        }
    }
}

/// The slash commands Claude Code knows in this folder: built-ins, user and
/// project commands and skills, plugins. Lets the terminal offer "run /fin-tache"
/// only for real commands, not for paths like /tmp.
#[tauri::command]
pub fn claude_commands(cwd: Option<String>) -> Vec<String> {
    let mut out: Vec<String> = BUILTIN_COMMANDS.iter().map(|s| s.to_string()).collect();
    let home = dirs::home_dir().unwrap_or_default();
    collect(&claude_dir(), &mut out, None);
    collect_plugins(&claude_dir().join("plugins"), &mut out, 0);
    if let Some(cwd) = cwd {
        let mut dir = Some(std::path::Path::new(&cwd));
        while let Some(d) = dir {
            if d == home {
                break;
            }
            collect(&d.join(".claude"), &mut out, None);
            dir = d.parent();
        }
    }
    out.sort();
    out.dedup();
    out
}

// ---- Transcripts (mosaic of a session's agents) ------------------------------

#[derive(Serialize, Debug)]
pub struct AgentTranscript {
    /// "main" for the session itself, else the subagent id from its file name.
    pub id: String,
    pub agent_type: Option<String>,
    pub description: Option<String>,
    /// Last write, in seconds since the epoch.
    pub modified: u64,
    /// Last lines, rendered roughly like Claude Code shows them.
    pub lines: Vec<String>,
}

/// The end of a file (whole lines only), without reading a long transcript entirely.
fn tail(path: &std::path::Path, max: u64) -> String {
    use std::io::{Read, Seek, SeekFrom};
    let Ok(mut f) = std::fs::File::open(path) else { return String::new() };
    let len = f.metadata().map(|m| m.len()).unwrap_or(0);
    let start = len.saturating_sub(max);
    if f.seek(SeekFrom::Start(start)).is_err() {
        return String::new();
    }
    let mut buf = Vec::new();
    let _ = f.read_to_end(&mut buf);
    let text = String::from_utf8_lossy(&buf).into_owned();
    if start > 0 {
        // The first line is cut: drop it.
        text.split_once('\n').map(|(_, rest)| rest.to_string()).unwrap_or_default()
    } else {
        text
    }
}

pub(crate) fn short(s: &str, n: usize) -> String {
    let one = s.split_whitespace().collect::<Vec<_>>().join(" ");
    if one.chars().count() > n {
        format!("{}…", one.chars().take(n).collect::<String>())
    } else {
        one
    }
}

/// One transcript line (JSON) → display lines.
fn render_entry(v: &Value, out: &mut Vec<String>) {
    let Some(msg) = v.get("message") else { return };
    let role = msg.get("role").and_then(Value::as_str).unwrap_or("");
    let content = msg.get("content");
    fn push_text(out: &mut Vec<String>, prefix: &str, t: &str) {
        let mut first = true;
        for l in t.lines() {
            if l.trim().is_empty() {
                continue;
            }
            out.push(format!("{}{}", if first { prefix } else { "  " }, l));
            first = false;
        }
    }
    match content {
        Some(Value::String(t)) if role == "user" => push_text(out, "> ", t),
        Some(Value::String(t)) => push_text(out, "⏺ ", t),
        Some(Value::Array(parts)) => {
            for p in parts {
                match p.get("type").and_then(Value::as_str) {
                    Some("text") => {
                        let t = p.get("text").and_then(Value::as_str).unwrap_or("");
                        push_text(out, if role == "user" { "> " } else { "⏺ " }, t);
                    }
                    Some("tool_use") => {
                        let name = p.get("name").and_then(Value::as_str).unwrap_or("tool");
                        let input = p.get("input");
                        // The most telling argument: command, file, pattern, description.
                        let arg = ["command", "file_path", "path", "pattern", "description", "prompt", "url"]
                            .iter()
                            .find_map(|k| input.and_then(|i| i.get(*k)).and_then(Value::as_str))
                            .unwrap_or("");
                        out.push(format!("⏺ {name}({})", short(arg, 90)));
                    }
                    Some("tool_result") => {
                        let text = match p.get("content") {
                            Some(Value::String(s)) => s.clone(),
                            Some(Value::Array(a)) => a.iter().filter_map(|x| x.get("text").and_then(Value::as_str)).collect::<Vec<_>>().join(" "),
                            _ => String::new(),
                        };
                        let first = text.lines().find(|l| !l.trim().is_empty()).unwrap_or("");
                        if !first.is_empty() {
                            out.push(format!("  ⎿ {}", short(first, 100)));
                        }
                    }
                    _ => {}
                }
            }
        }
        _ => {}
    }
}

fn transcript(path: &std::path::Path, id: String, meta: Option<&std::path::Path>, keep: usize) -> AgentTranscript {
    let text = tail(path, 256 * 1024);
    let mut lines = Vec::new();
    for l in text.lines() {
        if let Ok(v) = serde_json::from_str::<Value>(l) {
            render_entry(&v, &mut lines);
        }
    }
    let skip = lines.len().saturating_sub(keep);
    let lines = lines.split_off(skip);
    let modified = std::fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let meta: Option<Value> = meta.and_then(|m| std::fs::read_to_string(m).ok()).and_then(|t| serde_json::from_str(&t).ok());
    let get = |k: &str| meta.as_ref().and_then(|m| m.get(k)).and_then(Value::as_str).map(String::from);
    AgentTranscript { id, agent_type: get("agentType"), description: get("description"), modified, lines }
}

/// The session's own transcript and its subagents' (`<session>/subagents/agent-*.jsonl`),
/// found under ~/.claude/projects/* by session id. Most recent first, at most 12.
#[tauri::command]
pub async fn claude_session_agents(session_id: String, lines: Option<usize>) -> Result<Vec<AgentTranscript>, String> {
    // Off the main thread: the mosaic polls this every few seconds.
    tauri::async_runtime::spawn_blocking(move || session_agents(&session_id, lines))
        .await
        .map_err(|e| e.to_string())?
}

fn session_agents(session_id: &str, lines: Option<usize>) -> Result<Vec<AgentTranscript>, String> {
    // Only an id: it becomes part of a path.
    if session_id.is_empty() || !session_id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err("identifiant de session invalide".into());
    }
    let keep = lines.unwrap_or(40).clamp(5, 200);
    let projects = claude_dir().join("projects");
    let Ok(entries) = std::fs::read_dir(&projects) else { return Ok(vec![]) };
    for e in entries.flatten() {
        let dir = e.path();
        let main = dir.join(format!("{session_id}.jsonl"));
        let subs = dir.join(&session_id).join("subagents");
        if !main.exists() && !subs.is_dir() {
            continue;
        }
        let mut out = Vec::new();
        if main.exists() {
            out.push(transcript(&main, "main".into(), None, keep));
        }
        let mut files: Vec<std::path::PathBuf> = Vec::new();
        let mut walk = |d: &std::path::Path| {
            if let Ok(rd) = std::fs::read_dir(d) {
                for f in rd.flatten() {
                    let p = f.path();
                    let name = p.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
                    if name.starts_with("agent-") && name.ends_with(".jsonl") {
                        files.push(p);
                    }
                }
            }
        };
        walk(&subs);
        if let Ok(rd) = std::fs::read_dir(subs.join("workflows")) {
            for w in rd.flatten() {
                walk(&w.path());
            }
        }
        // Most recent first, and only those shown are read.
        let mtime = |p: &std::path::PathBuf| std::fs::metadata(p).and_then(|m| m.modified()).ok();
        files.sort_by_key(|p| std::cmp::Reverse(mtime(p)));
        files.truncate(11);
        let mut subs_out: Vec<AgentTranscript> = files
            .iter()
            .map(|p| {
                let stem = p.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
                let id = stem.trim_start_matches("agent-").to_string();
                let meta = p.with_file_name(format!("{stem}.meta.json"));
                transcript(p, id, Some(&meta), keep)
            })
            .collect();
        subs_out.sort_by(|a, b| b.modified.cmp(&a.modified));
        out.extend(subs_out);
        return Ok(out);
    }
    Ok(vec![])
}

#[cfg(test)]
mod transcript_tests {
    use super::*;

    #[test]
    fn renders_transcript_lines() {
        let mut out = Vec::new();
        let v: Value = serde_json::from_str(r#"{"message":{"role":"assistant","content":[{"type":"text","text":"Je regarde.\n\nOK"},{"type":"tool_use","name":"Bash","input":{"command":"ls -la"}}]}}"#).unwrap();
        render_entry(&v, &mut out);
        let v: Value = serde_json::from_str(r#"{"message":{"role":"user","content":[{"type":"tool_result","content":"total 8\nfoo"}]}}"#).unwrap();
        render_entry(&v, &mut out);
        assert_eq!(out, vec!["⏺ Je regarde.", "  OK", "⏺ Bash(ls -la)", "  ⎿ total 8"]);
        assert!(session_agents("../etc", None).is_err());
    }
}

#[cfg(test)]
mod text_tests {
    use super::*;

    #[test]
    fn short_collapses_whitespace() {
        assert_eq!(short("a   b\n\tc", 20), "a b c");
    }

    #[test]
    fn short_cuts_long_text_with_an_ellipsis() {
        assert_eq!(short("abcdefghij", 4), "abcd…");
        assert_eq!(short("abcd", 4), "abcd");
    }

    #[test]
    fn short_counts_characters_not_bytes() {
        assert_eq!(short("éééé", 2), "éé…");
    }
}

#[cfg(test)]
mod status_line_ownership_tests {
    use super::*;

    #[test]
    fn the_status_line_script_in_the_former_or_the_new_data_folder_is_ours() {
        assert!(is_ours("/Users/someone/.config/heidrun/claude-statusline.sh"));
        assert!(is_ours("/Users/someone/.config/heidrun_code/claude-statusline.sh"));
    }

    #[test]
    fn the_status_line_script_of_another_program_is_not_ours() {
        assert!(is_ours("/Users/someone/.config/other_program/claude-statusline.sh") == false);
        assert!(is_ours("/Users/someone/.config/heidrun_code_development/claude-statusline.sh") == false);
    }
}
