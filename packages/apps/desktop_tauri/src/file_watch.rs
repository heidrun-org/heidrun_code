//! Watches the file of each open file view pane with the library notify, and tells the window when the file changes on
//! the disk (issue #931). The watcher watches the folder of the file, not the file: a coding agent often writes a new
//! file next to the file and renames it over the file, and a save of the file view pane does the same. A watch on the
//! file itself stops at the first rename. The window compares the fingerprint of the file, so an event for its own
//! save shows nothing.

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, State};

/// The event that the window receives when the file of a file view pane changed on the disk.
pub const FILE_CHANGED_EVENT: &str = "file-changed";

/// The payload of `FILE_CHANGED_EVENT`.
#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileChanged {
    /// The identifier of the watch whose file changed. Each drawing of a file view pane has its own identifier, so a pane
    /// drawn again never stops the watch of the new drawing.
    pub watch_id: String,
}

/// The real path of the file of each watch, by watch identifier.
type WatchedFiles = Arc<Mutex<HashMap<String, PathBuf>>>;

/// One watcher for every file view pane. A folder is watched while at least one watch has a file of the folder.
pub struct FileWatcher {
    files: WatchedFiles,
    watcher: RecommendedWatcher,
}

impl FileWatcher {
    /// Creates the watcher. `on_change` receives the identifier of each watch whose file changed.
    pub fn new(on_change: impl Fn(String) + Send + 'static) -> Result<Self, String> {
        let files: WatchedFiles = Default::default();
        let seen = files.clone();
        let watcher = notify::recommended_watcher(move |result: notify::Result<Event>| {
            let Ok(event) = result else { return };
            if matches!(event.kind, EventKind::Access(_)) {
                return;
            }
            let watch_ids = watches_of_paths(&seen.lock().unwrap_or_else(|e| e.into_inner()), &event.paths);
            for watch_id in watch_ids {
                on_change(watch_id);
            }
        })
        .map_err(|e| format!("cannot watch the files: {e}"))?;
        Ok(Self { files, watcher })
    }

    /// Watches `file` for `watch_id`, in place of the file that this watch had before.
    pub fn watch(&mut self, watch_id: &str, file: PathBuf) -> Result<(), String> {
        self.unwatch(watch_id);
        let folder = file.parent().ok_or("folder not found")?.to_path_buf();
        let is_watched = self.is_folder_watched(&folder);
        if !is_watched {
            self.watcher.watch(&folder, RecursiveMode::NonRecursive).map_err(|e| format!("cannot watch the file: {e}"))?;
        }
        self.files.lock().unwrap_or_else(|e| e.into_inner()).insert(watch_id.to_string(), file);
        Ok(())
    }

    /// Stops the watch `watch_id`. The folder stays watched while another watch has a file of the folder.
    pub fn unwatch(&mut self, watch_id: &str) {
        let removed = self.files.lock().unwrap_or_else(|e| e.into_inner()).remove(watch_id);
        let Some(folder) = removed.as_deref().and_then(Path::parent).map(Path::to_path_buf) else { return };
        if !self.is_folder_watched(&folder) {
            let _ = self.watcher.unwatch(&folder);
        }
    }

    fn is_folder_watched(&self, folder: &Path) -> bool {
        self.files.lock().unwrap_or_else(|e| e.into_inner()).values().any(|file| file.parent() == Some(folder))
    }
}

/// The watches whose file is one of `paths`, sorted.
fn watches_of_paths(files: &HashMap<String, PathBuf>, paths: &[PathBuf]) -> Vec<String> {
    let mut watch_ids: Vec<String> = files.iter().filter(|(_, file)| paths.contains(file)).map(|(watch_id, _)| watch_id.clone()).collect();
    watch_ids.sort();
    watch_ids
}

/// The watcher of the application, created at the first file view pane.
#[derive(Default)]
pub struct FileWatchState(Mutex<Option<FileWatcher>>);

/// Starts to watch the file of a file view pane. The window receives `file-changed` with `watch_id` when the file
/// changes.
#[tauri::command(async)]
pub fn file_watch_start(app: AppHandle, state: State<'_, FileWatchState>, watch_id: String, root: String, path: String) -> Result<(), String> {
    let file = crate::files::watch_path(&root, &path)?;
    let mut slot = state.0.lock().unwrap_or_else(|e| e.into_inner());
    if slot.is_none() {
        *slot = Some(FileWatcher::new(move |watch_id| {
            let _ = app.emit(FILE_CHANGED_EVENT, FileChanged { watch_id });
        })?);
    }
    slot.as_mut().ok_or("cannot watch the files")?.watch(&watch_id, file)
}

/// Stops to watch the file of a file view pane, when the pane closes or shows another file.
#[tauri::command(async)]
pub fn file_watch_stop(state: State<'_, FileWatchState>, watch_id: String) {
    if let Some(watcher) = state.0.lock().unwrap_or_else(|e| e.into_inner()).as_mut() {
        watcher.unwatch(&watch_id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;
    use std::time::Duration;

    /// A new real folder for one test: the events of the library notify name real paths.
    fn temporary_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("hd-file-watch-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        std::fs::canonicalize(&folder).unwrap()
    }

    /// Waits for the identifier of a watch, and drops the repeated events of the same change.
    fn next_watch(receiver: &mpsc::Receiver<String>) -> Option<String> {
        let watch_id = receiver.recv_timeout(Duration::from_secs(10)).ok();
        std::thread::sleep(Duration::from_millis(300));
        while receiver.try_recv().is_ok() {}
        watch_id
    }

    fn watcher() -> (FileWatcher, mpsc::Receiver<String>) {
        let (sender, receiver) = mpsc::channel();
        let watcher = FileWatcher::new(move |watch_id| {
            let _ = sender.send(watch_id);
        })
        .unwrap();
        (watcher, receiver)
    }

    #[test]
    fn finds_the_watches_of_the_changed_paths() {
        let files = HashMap::from([
            ("p1".to_string(), PathBuf::from("/a/x.md")),
            ("p2".to_string(), PathBuf::from("/a/y.md")),
            ("p3".to_string(), PathBuf::from("/a/x.md")),
        ]);
        assert_eq!(watches_of_paths(&files, &[PathBuf::from("/a/x.md")]), vec!["p1", "p3"]);
        assert_eq!(watches_of_paths(&files, &[PathBuf::from("/a/.x.md.heidrun-1-0")]), Vec::<String>::new());
    }

    #[test]
    fn tells_a_write_a_rename_over_the_file_and_a_deletion() {
        let folder = temporary_folder("changes");
        let file = folder.join("notes.md");
        std::fs::write(&file, "one").unwrap();
        let (mut watcher, receiver) = watcher();
        watcher.watch("p1", file.clone()).unwrap();
        std::thread::sleep(Duration::from_millis(300));

        std::fs::write(&file, "two").unwrap();
        assert_eq!(next_watch(&receiver).as_deref(), Some("p1"));

        // A coding agent, and the save of the file view pane, write a new file next to the file and rename it.
        let next = folder.join(".notes.md.tmp");
        std::fs::write(&next, "three").unwrap();
        std::fs::rename(&next, &file).unwrap();
        assert_eq!(next_watch(&receiver).as_deref(), Some("p1"));

        std::fs::write(&file, "four").unwrap();
        assert_eq!(next_watch(&receiver).as_deref(), Some("p1"), "the watch continues after a rename over the file");

        std::fs::remove_file(&file).unwrap();
        assert_eq!(next_watch(&receiver).as_deref(), Some("p1"));

        std::fs::write(&file, "five").unwrap();
        assert_eq!(next_watch(&receiver).as_deref(), Some("p1"), "a file written again is seen again");
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn tells_nothing_for_another_file_of_the_folder_or_after_the_stop() {
        let folder = temporary_folder("stop");
        let first = folder.join("first.md");
        let second = folder.join("second.md");
        std::fs::write(&first, "one").unwrap();
        std::fs::write(&second, "one").unwrap();
        let (mut watcher, receiver) = watcher();
        watcher.watch("p1", first.clone()).unwrap();
        watcher.watch("p2", second.clone()).unwrap();
        std::thread::sleep(Duration::from_millis(300));

        std::fs::write(&folder.join("other.md"), "one").unwrap();
        assert_eq!(receiver.recv_timeout(Duration::from_millis(1500)).ok(), None);

        // The folder stays watched while the second watch has a file of the folder.
        watcher.unwatch("p1");
        std::fs::write(&first, "two").unwrap();
        std::fs::write(&second, "two").unwrap();
        assert_eq!(next_watch(&receiver).as_deref(), Some("p2"));

        watcher.unwatch("p2");
        std::thread::sleep(Duration::from_millis(300));
        while receiver.try_recv().is_ok() {}
        std::fs::write(&second, "three").unwrap();
        assert_eq!(receiver.recv_timeout(Duration::from_millis(1500)).ok(), None);
        let _ = std::fs::remove_dir_all(&folder);
    }
}
