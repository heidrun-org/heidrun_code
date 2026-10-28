//! Fixed workspace folders, saved independently of the working folders of panes.

use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

static LOCK: Mutex<()> = Mutex::new(());
type Folders = BTreeMap<String, BTreeMap<String, String>>;

fn file_path() -> PathBuf {
    crate::app_data::data_dir().join("workspace_folders.json")
}

fn session_key() -> String {
    crate::herdr::socket_path().to_string_lossy().into_owned()
}

/// Different Development applications can save different Herdr sessions in the same data folder.
fn lock_file() -> Result<std::fs::File, String> {
    let path = file_path().with_extension("lock");
    lock_at(&path)
}

fn lock_at(path: &Path) -> Result<std::fs::File, String> {
    std::fs::create_dir_all(path.parent().ok_or("Missing data folder")?).map_err(|error| error.to_string())?;
    let file = std::fs::OpenOptions::new().read(true).write(true).create(true).truncate(false)
        .open(path).map_err(|error| error.to_string())?;
    file.lock().map_err(|error| error.to_string())?;
    Ok(file)
}

fn read(path: &Path) -> Result<Folders, String> {
    match std::fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes).map_err(|error| format!("Cannot read workspace folders: {error}")),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(Folders::new()),
        Err(error) => Err(error.to_string()),
    }
}

fn write(path: &Path, folders: &Folders) -> Result<(), String> {
    std::fs::create_dir_all(path.parent().ok_or("Missing data folder")?).map_err(|error| error.to_string())?;
    let temporary = path.with_extension("json.tmp");
    std::fs::write(&temporary, serde_json::to_vec_pretty(folders).map_err(|error| error.to_string())?)
        .map_err(|error| error.to_string())?;
    std::fs::rename(temporary, path).map_err(|error| error.to_string())
}

/// Resolves an explicit creation folder, or the home folder when creation has no folder.
pub fn absolute_folder(folder: Option<&str>) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("Home folder unavailable")?;
    let path = match folder.filter(|folder| folder.is_empty() == false) {
        None | Some("~") => home,
        Some(folder) if folder.starts_with("~/") => home.join(&folder[2..]),
        Some(folder) => PathBuf::from(folder),
    };
    if path.is_absolute() == false {
        return Err("The workspace folder must be absolute".into());
    }
    let path = std::fs::canonicalize(path).map_err(|error| format!("Cannot open workspace folder: {error}"))?;
    if path.is_dir() == false {
        return Err("The workspace folder must be a folder".into());
    }
    Ok(path.to_string_lossy().into_owned())
}

fn save_at(path: &Path, session: &str, workspace_id: &str, folder: &str) -> Result<(), String> {
    let mut folders = read(path)?;
    let session = folders.entry(session.to_string()).or_default();
    if let Some(previous) = session.get(workspace_id) {
        if previous != folder {
            return Err("The workspace folder is already fixed".into());
        }
        return Ok(());
    }
    session.insert(workspace_id.to_string(), folder.to_string());
    write(path, &folders)
}

pub fn save(workspace_id: &str, folder: &str) -> Result<(), String> {
    let _lock = LOCK.lock().map_err(|error| error.to_string())?;
    let _file_lock = lock_file()?;
    save_at(&file_path(), &session_key(), workspace_id, folder)
}

/// Restores saved folders, explicit creation metadata, or worktree checkout metadata; never pane folders.
fn enrich_at(result: &mut Value, path: &Path, session: &str) -> Result<(), String> {
    let mut folders = read(path)?;
    let saved = folders.entry(session.to_string()).or_default();
    let mut changed = false;
    if let Some(workspaces) = result.pointer_mut("/snapshot/workspaces").and_then(Value::as_array_mut) {
        let previous_count = saved.len();
        saved.retain(|id, _| workspaces.iter().any(|workspace| workspace["workspace_id"].as_str() == Some(id.as_str())));
        changed = saved.len() != previous_count;
        for workspace in workspaces {
            let Some(id) = workspace.get("workspace_id").and_then(Value::as_str).map(str::to_string) else { continue };
            if saved.contains_key(&id) == false {
                if let Some(folder) = workspace.pointer("/tokens/heidrun_workspace_folder").and_then(Value::as_str)
                    .or_else(|| workspace.pointer("/worktree/checkout_path").and_then(Value::as_str)) {
                    if Path::new(folder).is_absolute() {
                        saved.insert(id.clone(), folder.to_string());
                        changed = true;
                    }
                }
            }
            workspace["workspace_folder"] = saved.get(&id).map(|folder| json!(folder)).unwrap_or(Value::Null);
        }
    }
    if changed {
        write(path, &folders)?;
    }
    Ok(())
}

pub fn enrich(result: &mut Value) -> Result<(), String> {
    let _lock = LOCK.lock().map_err(|error| error.to_string())?;
    let _file_lock = lock_file()?;
    enrich_at(result, &file_path(), &session_key())
}

pub fn forget(workspace_id: &str) -> Result<(), String> {
    let _lock = LOCK.lock().map_err(|error| error.to_string())?;
    let _file_lock = lock_file()?;
    let path = file_path();
    let mut folders = read(&path)?;
    if let Some(session) = folders.get_mut(&session_key()) {
        session.remove(workspace_id);
    }
    write(&path, &folders)
}

/// The developer explicitly recovers the folder of an existing workspace, once.
#[tauri::command]
pub async fn workspace_folder_recover(workspace_id: String, folder: String) -> Result<(), String> {
    let snapshot = crate::herdr::request("session.snapshot", json!({})).await?;
    let exists = snapshot.pointer("/snapshot/workspaces").and_then(Value::as_array)
        .is_some_and(|workspaces| workspaces.iter().any(|workspace| workspace["workspace_id"] == workspace_id));
    if exists == false {
        return Err("The workspace no longer exists".into());
    }
    save(&workspace_id, &absolute_folder(Some(&folder))?)
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestFolder(PathBuf);
    impl TestFolder {
        fn new() -> Self {
            static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
            let path = std::env::temp_dir().join(format!("heidrun-folders-{}-{}", std::process::id(),
                NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed)));
            std::fs::create_dir_all(&path).unwrap();
            Self(path)
        }
        fn path(&self) -> &Path { &self.0 }
    }
    impl Drop for TestFolder {
        fn drop(&mut self) { let _ = std::fs::remove_dir_all(&self.0); }
    }

    #[test]
    fn independent_applications_cannot_overwrite_each_others_saved_sessions() {
        let dir = TestFolder::new();
        let path = dir.path().join("folders.lock");
        let first = lock_at(&path).unwrap();
        let second = std::fs::OpenOptions::new().read(true).write(true).open(&path).unwrap();
        assert!(second.try_lock().is_err());
        drop(first);
        assert!(second.try_lock().is_ok());
    }

    #[test]
    fn survives_reload_changed_panes_and_missing_original_pane() {
        let dir = TestFolder::new();
        let path = dir.path().join("folders.json");
        save_at(&path, "session-a", "w1", "/original").unwrap();
        let mut snapshot = json!({"snapshot": {"workspaces": [{"workspace_id": "w1"}],
            "panes": [{"workspace_id": "w1", "cwd": "/unrelated", "foreground_cwd": "/worktree"}]}});
        enrich_at(&mut snapshot, &path, "session-a").unwrap();
        assert_eq!(snapshot["snapshot"]["workspaces"][0]["workspace_folder"], "/original");
        snapshot["snapshot"]["panes"] = json!([]);
        enrich_at(&mut snapshot, &path, "session-a").unwrap();
        assert_eq!(snapshot["snapshot"]["workspaces"][0]["workspace_folder"], "/original");
        assert!(save_at(&path, "session-a", "w1", "/changed").is_err());
        enrich_at(&mut snapshot, &path, "session-b").unwrap();
        assert!(snapshot["snapshot"]["workspaces"][0]["workspace_folder"].is_null());
    }

    #[test]
    fn recovers_checkout_metadata_but_never_a_pane_folder() {
        let dir = TestFolder::new();
        let path = dir.path().join("folders.json");
        let mut snapshot = json!({"snapshot": {"workspaces": [
            {"workspace_id": "w1", "worktree": {"checkout_path": "/checkout"}},
            {"workspace_id": "w2"}], "panes": [{"workspace_id": "w2", "cwd": "/unreliable"}]}});
        enrich_at(&mut snapshot, &path, "session").unwrap();
        assert_eq!(snapshot["snapshot"]["workspaces"][0]["workspace_folder"], "/checkout");
        assert!(snapshot["snapshot"]["workspaces"][1]["workspace_folder"].is_null());
        assert_eq!(read(&path).unwrap()["session"]["w1"], "/checkout");
    }

    #[test]
    fn restores_explicit_creation_metadata_once_and_keeps_the_folder_fixed() {
        let dir = TestFolder::new();
        let path = dir.path().join("folders.json");
        let mut snapshot = json!({"snapshot": {"workspaces": [
            {"workspace_id": "w1", "tokens": {"heidrun_workspace_folder": "/original"}},
            {"workspace_id": "w2", "tokens": {"heidrun_workspace_folder": "relative"}}]}});
        enrich_at(&mut snapshot, &path, "session").unwrap();
        assert_eq!(snapshot["snapshot"]["workspaces"][0]["workspace_folder"], "/original");
        assert!(snapshot["snapshot"]["workspaces"][1]["workspace_folder"].is_null());
        snapshot["snapshot"]["workspaces"][0]["tokens"]["heidrun_workspace_folder"] = json!("/changed");
        enrich_at(&mut snapshot, &path, "session").unwrap();
        assert_eq!(snapshot["snapshot"]["workspaces"][0]["workspace_folder"], "/original");
        assert_eq!(read(&path).unwrap()["session"]["w1"], "/original");
    }

    #[test]
    fn external_close_forgets_the_folder_before_a_workspace_id_can_be_reused() {
        let dir = TestFolder::new();
        let path = dir.path().join("folders.json");
        save_at(&path, "session", "w1", "/old").unwrap();
        let mut snapshot = json!({"snapshot": {"workspaces": []}});
        enrich_at(&mut snapshot, &path, "session").unwrap();
        assert!(read(&path).unwrap()["session"].is_empty());
        snapshot["snapshot"]["workspaces"] = json!([
            {"workspace_id": "w1", "tokens": {"heidrun_workspace_folder": "/new"}}]);
        enrich_at(&mut snapshot, &path, "session").unwrap();
        assert_eq!(snapshot["snapshot"]["workspaces"][0]["workspace_folder"], "/new");
    }

    #[test]
    fn resolves_non_git_creation_folders_and_refuses_files_and_relative_paths() {
        let dir = TestFolder::new();
        assert_eq!(absolute_folder(Some(dir.path().to_str().unwrap())).unwrap(),
            std::fs::canonicalize(dir.path()).unwrap().to_string_lossy());
        assert!(Path::new(&absolute_folder(None).unwrap()).is_absolute());
        assert!(absolute_folder(Some("relative")).is_err());
        let file = dir.path().join("file");
        std::fs::write(&file, "test").unwrap();
        assert!(absolute_folder(file.to_str()).is_err());
    }

    #[tokio::test]
    #[ignore = "Requires the disposable heidrun_issue_724 session and temporary Heidrun Code data"]
    async fn live_creation_saves_the_absolute_folder_in_the_real_herdr_session() {
        assert_eq!(std::env::var("HERDR_SESSION").unwrap(), "heidrun_issue_724");
        assert_eq!(crate::herdr::socket_path(),
            crate::herdr::config_dir().join("sessions/heidrun_issue_724/herdr.sock"));
        let data = crate::app_data::data_dir();
        assert_eq!(std::fs::canonicalize(data).unwrap(),
            std::fs::canonicalize("/tmp/heidrun-724-live-data").unwrap());
        let folder = absolute_folder(Some(env!("CARGO_MANIFEST_DIR"))).unwrap();
        let created = crate::herdr::request("workspace.create", json!({
            "cwd": folder, "label": "Creation persistence test 724", "focus": false
        })).await.unwrap();
        let id = created["workspace"]["workspace_id"].as_str().unwrap().to_string();
        let snapshot = crate::herdr::request("session.snapshot", json!({})).await;
        // Close the disposable workspace even when the snapshot could not be read.
        let closed = crate::herdr::request("workspace.close", json!({"workspace_id": id})).await;
        let snapshot = snapshot.unwrap();
        let restored = snapshot["snapshot"]["workspaces"].as_array().unwrap().iter()
            .find(|workspace| workspace["workspace_id"] == id).unwrap();
        println!("Live creation response: {created}");
        println!("Live restored workspace: {restored}");
        assert_eq!(created["workspace"]["workspace_folder"], folder);
        assert_eq!(created["root_pane"]["cwd"], folder);
        assert_eq!(restored["workspace_folder"], folder);
        closed.unwrap();
    }
}
