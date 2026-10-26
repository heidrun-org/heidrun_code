//! Connects Antigravity's custom status line to quota tracking in Heidrun Code.

use serde::Serialize;
use serde_json::{json, Map, Value};
use std::path::PathBuf;

const SCRIPT: &str = include_str!("../../../../scripts/antigravity-statusline.sh");

fn antigravity_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_default()
        .join(".gemini/antigravity-cli")
}

fn desk_dir() -> PathBuf {
    crate::app_data::data_dir()
}

fn settings_path() -> PathBuf {
    antigravity_dir().join("settings.json")
}

fn script_path() -> PathBuf {
    desk_dir().join("antigravity-statusline.sh")
}

fn next_path() -> PathBuf {
    desk_dir().join("antigravity-statusline-next")
}

fn saved_path() -> PathBuf {
    desk_dir().join("antigravity-statusline-settings-backup")
}

#[derive(Serialize)]
pub struct AntigravityStatuslineState {
    pub installed: bool,
    pub can_change: bool,
    pub settings_path: String,
    pub chained: Option<String>,
}

fn read_settings() -> Result<Map<String, Value>, String> {
    match std::fs::read_to_string(settings_path()) {
        Ok(text) if !text.trim().is_empty() => match serde_json::from_str::<Value>(&text) {
            Ok(Value::Object(m)) => Ok(m),
            Ok(_) => Err("settings.json is not a JSON object".into()),
            Err(e) => Err(format!("settings.json cannot be read: {e}")),
        },
        _ => Ok(Map::new()),
    }
}

fn write_settings(m: &Map<String, Value>) -> Result<(), String> {
    let path = settings_path();
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let mut text =
        serde_json::to_string_pretty(&Value::Object(m.clone())).map_err(|e| e.to_string())?;
    text.push('\n');
    std::fs::write(&path, text).map_err(|e| format!("cannot write {}: {e}", path.display()))
}

fn current_line(m: &Map<String, Value>) -> Option<Map<String, Value>> {
    m.get("statusLine")?.as_object().cloned()
}

fn current_command(m: &Map<String, Value>) -> Option<String> {
    current_line(m)?.get("command")?.as_str().map(String::from)
}

fn is_ours(command: &str) -> bool {
    command == script_path().to_string_lossy()
}

fn saved_line() -> Option<Map<String, Value>> {
    serde_json::from_str(&std::fs::read_to_string(saved_path()).ok()?).ok()
}

#[tauri::command]
pub fn antigravity_statusline_state() -> Result<AntigravityStatuslineState, String> {
    let m = read_settings()?;
    Ok(AntigravityStatuslineState {
        installed: current_command(&m)
            .map(|command| is_ours(&command))
            .unwrap_or(false),
        can_change: !crate::application_profile::is_development(),
        settings_path: settings_path().display().to_string(),
        chained: saved_line().and_then(|line| line.get("command")?.as_str().map(String::from)),
    })
}

#[tauri::command]
pub fn antigravity_statusline_install() -> Result<AntigravityStatuslineState, String> {
    crate::application_profile::require_installed_integration_for("Antigravity")?;
    let mut m = read_settings()?;
    std::fs::create_dir_all(desk_dir()).map_err(|e| e.to_string())?;
    std::fs::write(script_path(), SCRIPT).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(script_path(), std::fs::Permissions::from_mode(0o755))
            .map_err(|e| e.to_string())?;
    }

    match current_command(&m) {
        Some(command) if is_ours(&command) => {}
        Some(command) => {
            let line = current_line(&m).unwrap_or_default();
            let mut text = serde_json::to_string(&line).map_err(|e| e.to_string())?;
            text.push('\n');
            std::fs::write(saved_path(), text).map_err(|e| e.to_string())?;
            std::fs::write(next_path(), format!("{command}\n")).map_err(|e| e.to_string())?;
        }
        None => {
            if let Some(line) = current_line(&m) {
                let mut text = serde_json::to_string(&line).map_err(|e| e.to_string())?;
                text.push('\n');
                std::fs::write(saved_path(), text).map_err(|e| e.to_string())?;
            } else {
                let _ = std::fs::remove_file(saved_path());
            }
            let _ = std::fs::remove_file(next_path());
        }
    }

    let backup = antigravity_dir().join("settings.json.heidrun-backup");
    if settings_path().exists() && !backup.exists() {
        let _ = std::fs::copy(settings_path(), backup);
    }

    let mut line = current_line(&m).unwrap_or_default();
    line.insert("type".into(), json!("command"));
    line.insert("command".into(), json!(script_path().display().to_string()));
    if !next_path().exists() {
        line.insert("stack_with_default".into(), json!(true));
    }
    line.insert("enabled".into(), json!(true));
    m.insert("statusLine".into(), Value::Object(line));
    write_settings(&m)?;
    antigravity_statusline_state()
}

#[tauri::command]
pub fn antigravity_statusline_uninstall() -> Result<AntigravityStatuslineState, String> {
    crate::application_profile::require_installed_integration_for("Antigravity")?;
    let mut m = read_settings()?;
    match saved_line() {
        Some(line) => {
            m.insert("statusLine".into(), Value::Object(line));
        }
        None => {
            m.remove("statusLine");
        }
    }
    write_settings(&m)?;
    let _ = std::fs::remove_file(next_path());
    let _ = std::fs::remove_file(saved_path());
    antigravity_statusline_state()
}
