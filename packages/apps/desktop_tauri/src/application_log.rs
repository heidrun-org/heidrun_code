//! Application log: the file `application_log.jsonl`, in the folder of the data of Heidrun Code, where the application
//! writes one JSON line for each event (issue #879):
//! - the start and the end of each call to `gh` and `glab`, and each answer that the cache of the answers gave;
//! - the start and the stop of a recording of the voice input, and the start and the end of its transcription.
//!
//! The developer uses the application, then asks a coding agent to read this file, to find which calls cost the most
//! points of the GitHub rate limit, which calls repeat, and how long each step takes. This log is separate from the
//! operation log of the package `data_layer_operation_log`. It never holds the text that the developer spoke.

use serde::Serialize;
use serde_json::{Map, Value};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

/// The name of the file of the log, in the folder of the data of Heidrun Code.
const LOG_FILE: &str = "application_log.jsonl";

/// The name of the former file of the log, which replaces the previous one when the log grows over `MAX_LOG_BYTES`.
const FORMER_LOG_FILE: &str = "application_log.1.jsonl";

/// The size of the file of the log above which it becomes the former file and a new file starts.
const MAX_LOG_BYTES: u64 = 8 * 1024 * 1024;

/// Two appends never run at the same time, so that two lines never mix.
static LOG_LOCK: Mutex<()> = Mutex::new(());

/// The last identifier given to a call, so that the end of a call names the same call as its start.
static LAST_CALL_ID: AtomicU64 = AtomicU64::new(0);

/// Where the answer of a call to `gh` or `glab` came from.
#[derive(Serialize, Debug, Clone, Copy, PartialEq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ForgeAnswerSource {
    /// GitHub or GitLab answered.
    Forge,
    /// GitHub or GitLab failed, and the cache gave an older answer instead.
    KeptAfterFailure,
    /// GitHub or GitLab failed, and the cache had no answer.
    Failed,
}

/// One line of the log.
#[derive(Serialize, Debug)]
struct LogLine<'a> {
    /// When the event happened, in milliseconds since 1970.
    at: i64,
    /// The kind of the event, for example `forge_call_start`.
    event: &'a str,
    /// The other fields of the event.
    #[serde(flatten)]
    fields: Map<String, Value>,
}

/// A call to `gh` or `glab` that started, and whose end is not written yet.
pub(crate) struct ForgeCall {
    /// The identifier that the start line and the end line share.
    call_id: u64,
    /// The part of the application that asked.
    caller: String,
    /// The command line tool: `gh` or `glab`.
    tool: String,
    /// When the call started, for the duration.
    started: Instant,
}

impl ForgeCall {
    /// Writes the line `forge_call_start` and gives the call, whose `end` writes the line `forge_call_end`. `caller` is the
    /// part of the application that asked, for example `code_hosting_list`.
    pub(crate) fn start(caller: Option<&str>, tool: &str, args: &[String], is_refresh: bool) -> Self {
        let call = ForgeCall {
            call_id: LAST_CALL_ID.fetch_add(1, Ordering::Relaxed) + 1,
            caller: caller_name(caller),
            tool: tool.to_string(),
            started: Instant::now(),
        };
        write(
            "forge_call_start",
            serde_json::json!({
                "call_id": call.call_id,
                "caller": call.caller,
                "tool": call.tool,
                "args": args,
                "is_refresh": is_refresh,
            }),
        );
        call
    }

    /// Writes the line `forge_call_end`, with the duration since the start, where the answer came from, and the failure.
    pub(crate) fn end(self, source: ForgeAnswerSource, error: Option<&str>) {
        write(
            "forge_call_end",
            serde_json::json!({
                "call_id": self.call_id,
                "caller": self.caller,
                "tool": self.tool,
                "source": source,
                "duration_ms": self.started.elapsed().as_millis() as u64,
                "error": error.map(first_line),
            }),
        );
    }
}

/// Writes the line `forge_cache_hit`: the cache of the answers gave the answer, and GitHub or GitLab was not asked.
pub(crate) fn record_forge_cache_hit(caller: Option<&str>, tool: &str, args: &[String]) {
    write(
        "forge_cache_hit",
        serde_json::json!({
            "caller": caller_name(caller),
            "tool": tool,
            "args": args,
        }),
    );
}

/// Writes one line in the log: `event` is the kind of the event, for example `voice_recording_start`, and `fields` is an
/// object with the other fields. A failure to write is ignored: the log never stops the application.
pub(crate) fn write(event: &str, fields: Value) {
    append_to(&log_path(), event, now_ms(), fields);
}

/// The file of the log: `application_log.jsonl` in the folder of the data of Heidrun Code.
fn log_path() -> PathBuf {
    crate::app_data::data_dir().join(LOG_FILE)
}

/// The current time, in milliseconds since 1970.
fn now_ms() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

/// The name of the part of the application that asked, or `unknown`.
fn caller_name(caller: Option<&str>) -> String {
    caller.filter(|caller| caller.is_empty() == false).unwrap_or("unknown").to_string()
}

/// The first line of a failure, at most 300 characters long.
pub(crate) fn first_line(text: &str) -> String {
    text.lines().next().unwrap_or("").chars().take(300).collect()
}

/// Appends one line to the file `path`. When the file is larger than `MAX_LOG_BYTES`, it first becomes the former file,
/// which replaces the previous former file.
fn append_to(path: &Path, event: &str, at: i64, fields: Value) {
    let fields = match fields {
        Value::Object(fields) => fields,
        _ => Map::new(),
    };
    let Ok(mut line) = serde_json::to_string(&LogLine { at, event, fields }) else { return };
    line.push('\n');
    let _guard = LOG_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    if std::fs::metadata(path).map(|meta| meta.len() > MAX_LOG_BYTES).unwrap_or(false) {
        let _ = std::fs::rename(path, path.with_file_name(FORMER_LOG_FILE));
    }
    if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = file.write_all(line.as_bytes());
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temporary_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("hd-application-log-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        folder
    }

    fn read_lines(path: &Path) -> Vec<Value> {
        std::fs::read_to_string(path).unwrap().lines().map(|line| serde_json::from_str(line).unwrap()).collect()
    }

    #[test]
    fn writes_one_json_line_with_the_time_the_event_and_the_fields() {
        let folder = temporary_folder("lines");
        let path = folder.join(LOG_FILE);
        append_to(&path, "voice_recording_start", 42, serde_json::json!({ "error": null }));
        append_to(&path, "voice_transcription_end", 43, serde_json::json!({ "duration_ms": 900, "characters": 12 }));
        let lines = read_lines(&path);
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0], serde_json::json!({ "at": 42, "event": "voice_recording_start", "error": null }));
        assert_eq!(lines[1]["event"], "voice_transcription_end");
        assert_eq!(lines[1]["duration_ms"], 900);
        std::fs::remove_dir_all(folder).unwrap();
    }

    #[test]
    fn gives_a_new_identifier_to_each_call() {
        let first = LAST_CALL_ID.fetch_add(1, Ordering::Relaxed) + 1;
        let second = LAST_CALL_ID.fetch_add(1, Ordering::Relaxed) + 1;
        assert!(second > first);
    }

    #[test]
    fn names_an_unknown_caller_and_keeps_the_first_line_of_a_failure() {
        assert_eq!(caller_name(None), "unknown");
        assert_eq!(caller_name(Some("")), "unknown");
        assert_eq!(caller_name(Some("source_control")), "source_control");
        assert_eq!(first_line("API rate limit exceeded\nmore text"), "API rate limit exceeded");
    }

    #[test]
    fn writes_each_source_in_snake_case() {
        let text = |source| serde_json::to_string(&source).unwrap();
        assert_eq!(text(ForgeAnswerSource::Forge), "\"forge\"");
        assert_eq!(text(ForgeAnswerSource::KeptAfterFailure), "\"kept_after_failure\"");
        assert_eq!(text(ForgeAnswerSource::Failed), "\"failed\"");
    }

    #[test]
    fn starts_a_new_file_when_the_file_is_too_large() {
        let folder = temporary_folder("rotation");
        std::fs::create_dir_all(&folder).unwrap();
        let path = folder.join(LOG_FILE);
        std::fs::write(&path, vec![b'x'; MAX_LOG_BYTES as usize + 1]).unwrap();
        append_to(&path, "forge_cache_hit", 1, serde_json::json!({}));
        assert_eq!(std::fs::metadata(folder.join(FORMER_LOG_FILE)).unwrap().len(), MAX_LOG_BYTES + 1);
        assert_eq!(read_lines(&path).len(), 1);
        std::fs::remove_dir_all(folder).unwrap();
    }
}
