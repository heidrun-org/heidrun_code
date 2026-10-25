//! The tab "User activity" of the Statistics window.
//!
//! Two commands, never mixed:
//!
//! - `user_activity_synchronize` copies the new lines of the file of the records of the activity of the user into the SQLite file
//!   of the data layer, with the package `data_layer_user_activity`.
//! - `user_activity_records_in_range` reads the SQLite file only and gives the records whose active period overlaps a time range.
//!
//! The file of the records is written by `crate::user_activity`. This file never reads it.

use data_layer_user_activity::{default_database_path, find_user_activity_records, refresh_user_activity, UserActivityRecord};
use serde::Serialize;
use std::path::Path;

/// What `user_activity_synchronize` did.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UserActivitySynchronization {
    /// The number of records that the synchronization wrote.
    pub record_count: usize,
}

/// Called by the tab "User activity" to copy the new lines of the file of the records into the SQLite file, so a record that
/// ended a moment ago is there.
#[tauri::command]
pub async fn user_activity_synchronize() -> Result<UserActivitySynchronization, String> {
    tauri::async_runtime::spawn_blocking(|| {
        synchronize(&crate::app_data::user_activity_file_path(), &default_database_path())
    })
    .await
    .map_err(|error| error.to_string())?
}

/// Called by the tab "User activity" to read the records whose active period overlaps the time range from `since` to `until`,
/// two texts in ISO 8601, the oldest first. It reads the SQLite file only. The times of the records are in UTC.
#[tauri::command]
pub async fn user_activity_records_in_range(since: String, until: String) -> Result<Vec<UserActivityRecord>, String> {
    tauri::async_runtime::spawn_blocking(move || find_user_activity_records(&default_database_path(), &since, &until))
        .await
        .map_err(|error| error.to_string())?
}

/// Copies the new lines of the file at `file_path` into the SQLite file at `database_path`.
fn synchronize(file_path: &Path, database_path: &Path) -> Result<UserActivitySynchronization, String> {
    // An append of a line must not run while the package reads the file, or the package could see half a line.
    let _file_guard = crate::app_data::USER_ACTIVITY_FILE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    // The other commands of the Statistics window and the command line heidrun_data write the same SQLite file, and the file has
    // no waiting time.
    let _database_guard = heidrun_data::lock_database(database_path)?;
    let report = refresh_user_activity(database_path, file_path)?;
    Ok(UserActivitySynchronization { record_count: report.record_count })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::path::PathBuf;

    fn temporary_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("hd-statistics-user-activity-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        folder
    }

    fn write_record(file: &Path, started_at: &str, ended_at: &str) {
        let record = json!({
            "workspaceFolder": "/work/heidrun",
            "startedAt": started_at,
            "lastActionAt": started_at,
            "endedAt": ended_at,
            "keyboardActionCount": 3,
            "mouseActionCount": 4,
            "endReason": "cool_down",
        });
        crate::user_activity::append_to(file, &record).unwrap();
    }

    #[test]
    fn the_records_are_read_from_the_stored_rows_after_the_file_of_the_records_is_gone() {
        let folder = temporary_folder("file_gone");
        let file = folder.join("user_activity.jsonl");
        let database = folder.join("data_layer.sqlite");
        write_record(&file, "2026-10-14T10:00:00.000+00:00", "2026-10-14T10:05:00.000+00:00");
        write_record(&file, "2026-10-14T11:00:00.000+00:00", "2026-10-14T11:05:00.000+00:00");
        assert_eq!(synchronize(&file, &database).unwrap().record_count, 2);
        std::fs::remove_file(&file).unwrap();
        let records = find_user_activity_records(&database, "2026-10-14T10:30:00Z", "2026-10-14T12:00:00Z").unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].started_at, "2026-10-14T11:00:00.000Z");
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn a_read_before_the_first_synchronization_is_empty_and_creates_nothing() {
        let folder = temporary_folder("before");
        let database = folder.join("data_layer.sqlite");
        let records = find_user_activity_records(&database, "2026-10-14T00:00:00Z", "2026-10-15T00:00:00Z").unwrap();
        assert!(records.is_empty());
        assert!(!database.exists());
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn a_synchronization_without_a_file_of_records_writes_nothing() {
        let folder = temporary_folder("no_file");
        let answer = synchronize(&folder.join("none.jsonl"), &folder.join("data_layer.sqlite")).unwrap();
        assert_eq!(answer.record_count, 0);
        let _ = std::fs::remove_dir_all(&folder);
    }
}
