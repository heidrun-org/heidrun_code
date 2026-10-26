//! The file of the records of the activity of the user in front of Heidrun Code: one JSON line for each active period, in
//! ~/.config/heidrun_code/user_activity.jsonl (on this Mac, never in a repository). Every time in a record is an ISO 8601
//! text with the offset of the time zone. A record never holds a key that the user typed or a text of the screen.
//!
//! This file owns the file of the records: it appends a record, and it reads the file back for the User activity sidebar section.
//! The Statistics window never reads the file. It reads the records through `statistics::user_activity_records`, which uses the
//! package `data_layer_user_activity`.

use chrono::{DateTime, Utc};
use serde_json::Value;
use std::io::Write;
use std::path::Path;

/// Number of days that the file keeps a record. A record that ended earlier is removed at the next read.
const KEEP_DAYS: i64 = 400;

/// Name of the field of a record that holds the end of the period.
const ENDED_AT_FIELD: &str = "endedAt";

/// The file of the records, in the folder of the data of Heidrun Code.
fn path() -> std::path::PathBuf {
    crate::app_data::user_activity_file_path()
}

/// The time of a text in ISO 8601, in milliseconds since 1 January 1970, or `None` when the text is not a date.
fn parse_time(text: &str) -> Option<i64> {
    DateTime::parse_from_rfc3339(text).ok().map(|time| time.timestamp_millis())
}

/// The end of the period of a record, in milliseconds since 1 January 1970, or `None` when the record has no valid end.
fn ended_at(record: &Value) -> Option<i64> {
    record.get(ENDED_AT_FIELD).and_then(Value::as_str).and_then(parse_time)
}

/// Adds one record at the end of `file`, on its own line. The folder of the file is created when it does not exist.
pub(crate) fn append_to(file: &Path, record: &Value) -> Result<(), String> {
    if record.is_object() == false {
        return Err("the record of the activity of the user must be a JSON object".into());
    }
    let _guard = crate::app_data::USER_ACTIVITY_FILE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    if let Some(folder) = file.parent() {
        std::fs::create_dir_all(folder).map_err(|error| error.to_string())?;
    }
    let mut opened = std::fs::OpenOptions::new().create(true).append(true).open(file).map_err(|error| error.to_string())?;
    let line = serde_json::to_string(record).map_err(|error| error.to_string())?;
    writeln!(opened, "{line}").map_err(|error| error.to_string())
}

/// The records of `file` that ended at or after `since` (milliseconds since 1 January 1970), the oldest first. The
/// records that ended more than `KEEP_DAYS` days ago are removed from the file. A line that is not a JSON object with a
/// valid `endedAt` is removed too.
fn read_from(file: &Path, since: i64, now: i64) -> Result<Vec<Value>, String> {
    let _guard = crate::app_data::USER_ACTIVITY_FILE_LOCK.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let text = match std::fs::read_to_string(file) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(error.to_string()),
    };
    let oldest_kept = now - KEEP_DAYS * 86_400_000;
    let mut found = Vec::new();
    let mut kept_lines = Vec::new();
    let mut line_count = 0usize;
    for line in text.lines() {
        line_count += 1;
        let Ok(record) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        let Some(ended) = ended_at(&record) else {
            continue;
        };
        if ended < oldest_kept {
            continue;
        }
        kept_lines.push(line);
        if ended >= since {
            found.push(record);
        }
    }
    if kept_lines.len() < line_count {
        let mut body = kept_lines.join("\n");
        body.push('\n');
        // Written aside, then renamed: a crash never leaves half a file.
        let aside = file.with_extension("jsonl.tmp");
        if std::fs::write(&aside, body).is_ok() {
            let _ = std::fs::rename(&aside, file);
        }
    }
    Ok(found)
}

/// Called by the web page each time an active period of the user ends.
#[tauri::command]
pub fn user_activity_append(record: Value) -> Result<(), String> {
    append_to(&path(), &record)
}

/// Called by the web page to read the records that ended at or after `since`, an ISO 8601 text.
#[tauri::command]
pub async fn user_activity_read(since: String) -> Result<Vec<Value>, String> {
    let since = parse_time(&since).ok_or_else(|| format!("`{since}` is not a date in ISO 8601"))?;
    let now = Utc::now().timestamp_millis();
    tauri::async_runtime::spawn_blocking(move || read_from(&path(), since, now)).await.map_err(|error| error.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::path::PathBuf;

    /// A file in a new folder of the system temporary folder. The folder is removed when the value is dropped.
    struct TemporaryFile(PathBuf);

    impl TemporaryFile {
        fn new(name: &str) -> Self {
            let folder = std::env::temp_dir().join(format!("heidrun-user-activity-{name}-{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&folder);
            TemporaryFile(folder.join("user_activity.jsonl"))
        }
    }

    impl Drop for TemporaryFile {
        fn drop(&mut self) {
            if let Some(folder) = self.0.parent() {
                let _ = std::fs::remove_dir_all(folder);
            }
        }
    }

    /// 14 October 2026, 12:00:00 in UTC, in milliseconds since 1 January 1970.
    const NOW: i64 = 1_791_979_200_000;

    fn record(ended_at: &str) -> Value {
        json!({ "workspaceFolder": "/work/heidrun", "startedAt": "2026-10-14T11:00:00.000+00:00", "endedAt": ended_at })
    }

    #[test]
    fn the_file_does_not_exist_before_the_first_record_and_reads_as_empty() {
        let file = TemporaryFile::new("empty");
        assert_eq!(read_from(&file.0, 0, NOW).unwrap(), Vec::<Value>::new());
        assert!(file.0.exists() == false);
    }

    #[test]
    fn a_record_is_one_line_and_is_read_back_unchanged() {
        let file = TemporaryFile::new("round-trip");
        let first = record("2026-10-14T11:00:05.000+00:00");
        let second = record("2026-10-14T11:30:05.000+02:00");
        append_to(&file.0, &first).unwrap();
        append_to(&file.0, &second).unwrap();
        assert_eq!(std::fs::read_to_string(&file.0).unwrap().lines().count(), 2);
        assert_eq!(read_from(&file.0, 0, NOW).unwrap(), vec![first, second]);
    }

    #[test]
    fn only_the_records_that_ended_at_or_after_since_are_read() {
        let file = TemporaryFile::new("since");
        append_to(&file.0, &record("2026-10-14T10:00:00.000+00:00")).unwrap();
        append_to(&file.0, &record("2026-10-14T11:00:00.000+00:00")).unwrap();
        let since = parse_time("2026-10-14T11:00:00.000+00:00").unwrap();
        assert_eq!(read_from(&file.0, since, NOW).unwrap().len(), 1);
        assert_eq!(read_from(&file.0, since + 1, NOW).unwrap().len(), 0);
    }

    #[test]
    fn the_offset_of_the_time_zone_is_part_of_the_time() {
        let file = TemporaryFile::new("offset");
        append_to(&file.0, &record("2026-10-14T13:00:00.000+02:00")).unwrap();
        let eleven_utc = parse_time("2026-10-14T11:00:00.000+00:00").unwrap();
        assert_eq!(read_from(&file.0, eleven_utc, NOW).unwrap().len(), 1);
        assert_eq!(read_from(&file.0, eleven_utc + 1, NOW).unwrap().len(), 0);
    }

    #[test]
    fn a_record_older_than_the_keep_days_is_removed_from_the_file() {
        let file = TemporaryFile::new("old");
        append_to(&file.0, &record("2025-01-01T00:00:00.000+00:00")).unwrap();
        append_to(&file.0, &record("2026-10-14T11:00:00.000+00:00")).unwrap();
        assert_eq!(read_from(&file.0, 0, NOW).unwrap().len(), 1);
        assert_eq!(std::fs::read_to_string(&file.0).unwrap().lines().count(), 1);
    }

    #[test]
    fn a_line_without_a_valid_end_is_removed_and_does_not_stop_the_read() {
        let file = TemporaryFile::new("invalid");
        append_to(&file.0, &record("2026-10-14T11:00:00.000+00:00")).unwrap();
        append_to(&file.0, &json!({ "endedAt": "yesterday" })).unwrap();
        append_to(&file.0, &json!({ "workspaceFolder": "/work/heidrun" })).unwrap();
        std::fs::OpenOptions::new().append(true).open(&file.0).unwrap().write_all(b"not json\n").unwrap();
        assert_eq!(read_from(&file.0, 0, NOW).unwrap().len(), 1);
        assert_eq!(std::fs::read_to_string(&file.0).unwrap().lines().count(), 1);
    }

    #[test]
    fn a_value_that_is_not_an_object_is_refused_and_nothing_is_written() {
        let file = TemporaryFile::new("refused");
        assert!(append_to(&file.0, &json!("text")).is_err());
        assert!(file.0.exists() == false);
    }

    #[test]
    fn a_text_that_is_not_a_date_is_not_a_time() {
        assert_eq!(parse_time("2026-10-14"), None);
        assert_eq!(parse_time("yesterday"), None);
        assert!(parse_time("2026-10-14T11:00:00.000+02:00").is_some());
    }
}
