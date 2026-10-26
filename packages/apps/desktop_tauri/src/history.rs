//! Agents' work history: one JSON line per finished run, in
//! ~/.config/heidrun_code/history.jsonl (on this Mac, never in a repo).

use serde_json::Value;
use std::io::Write;
use std::path::PathBuf;

const KEEP_DAYS: i64 = 400;

// Appends and the occasional prune never run at the same time (no lost line).
static LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

fn path() -> PathBuf {
    std::env::var("HEIDRUN_CODE_DIR")
        .ok().filter(|value| value.is_empty() == false)
        .or_else(|| std::env::var("HEIDRUN_DIR").ok().filter(|value| value.is_empty() == false))
        .map(PathBuf::from)
        .unwrap_or_else(|| default_data_folder(&dirs::home_dir().unwrap_or_default()))
        .join("history.jsonl")
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

#[tauri::command]
pub fn history_append(entry: Value) -> Result<(), String> {
    if !entry.is_object() {
        return Err("entrée invalide".into());
    }
    let _g = LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let p = path();
    if let Some(dir) = p.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let mut f = std::fs::OpenOptions::new().create(true).append(true).open(&p).map_err(|e| e.to_string())?;
    let line = serde_json::to_string(&entry).map_err(|e| e.to_string())?;
    writeln!(f, "{line}").map_err(|e| e.to_string())
}

/// Runs that ended at or after `since` (ms). Very old lines are dropped from the file
/// now and then, so it does not grow forever.
#[tauri::command]
pub async fn history_read(since: i64) -> Result<Vec<Value>, String> {
    tauri::async_runtime::spawn_blocking(move || read(since)).await.map_err(|e| e.to_string())?
}

fn read(since: i64) -> Result<Vec<Value>, String> {
    let _g = LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let text = match std::fs::read_to_string(path()) {
        Ok(t) => t,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(vec![]),
        Err(e) => return Err(e.to_string()),
    };
    let limit = now_ms() - KEEP_DAYS * 86_400_000;
    let mut out = Vec::new();
    let mut kept = 0usize;
    let mut total = 0usize;
    let mut keep_lines = Vec::new();
    for line in text.lines() {
        let Ok(v) = serde_json::from_str::<Value>(line) else { continue };
        total += 1;
        let end = v.get("end").and_then(Value::as_i64).unwrap_or(0);
        if end >= limit {
            kept += 1;
            keep_lines.push(line);
        }
        if end >= since && end >= limit {
            out.push(v);
        }
    }
    if kept < total {
        let mut body = keep_lines.join("\n");
        body.push('\n');
        // Written aside then renamed: a crash never leaves half a file.
        let tmp = path().with_extension("jsonl.tmp");
        if std::fs::write(&tmp, body).is_ok() {
            let _ = std::fs::rename(&tmp, path());
        }
    }
    Ok(out)
}

/// Writes the CSV to ~/Downloads and returns its path.
#[tauri::command]
pub fn history_export(csv: String, name: String) -> Result<String, String> {
    if name.is_empty() || name.contains('/') || name.contains("..") || !name.ends_with(".csv") {
        return Err("nom de fichier invalide".into());
    }
    let dir = dirs::download_dir().unwrap_or_else(|| dirs::home_dir().unwrap_or_default());
    let p = dir.join(name);
    // BOM: Excel then reads the accents correctly.
    std::fs::write(&p, format!("\u{feff}{csv}")).map_err(|e| e.to_string())?;
    Ok(p.display().to_string())
}

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

    #[test]
    fn appends_and_reads() {
        let dir = std::env::temp_dir().join(format!("hd-hist-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::env::set_var("HEIDRUN_CODE_DIR", &dir);
        let now = now_ms();
        history_append(serde_json::json!({ "end": now, "ws": "a" })).unwrap();
        history_append(serde_json::json!({ "end": now - 500 * 86_400_000_i64, "ws": "old" })).unwrap();
        let all = read(0).unwrap();
        assert_eq!(all.len(), 1); // the old one is past KEEP_DAYS
        assert_eq!(read(now + 1).unwrap().len(), 0);
        assert_eq!(std::fs::read_to_string(path()).unwrap().lines().count(), 1);
        assert!(history_export("a".into(), "../x.csv".into()).is_err());
        let _ = std::fs::remove_dir_all(&dir);
    }
}
