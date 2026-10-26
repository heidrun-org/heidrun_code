//! Application log: the file `application_log.jsonl`, in the folder of the data of Heidrun Code, where the application
//! writes one JSON line for each event (issue #879):
//! - the start and the end of each call to `gh` and `glab`, and each answer that the cache of the answers gave;
//! - the start and the stop of a recording of the voice input, and the start and the end of its transcription;
//! - the start and the end of each call of the desktop application to a function of a data layer package, with the
//!   GitHub points of the GraphQL queries of `data_layer_code_hosting` (issue #883);
//! - the GitHub points left after each call to `gh` that GitHub answered, read with `gh api rate_limit` (issue #883).
//!
//! The developer uses the application, then asks a coding agent to read this file, to find which calls cost the most
//! points of the GitHub rate limit, which calls repeat, and how long each step takes. This log is separate from the
//! operation log of the package `data_layer_operation_log`. It never holds the text that the developer spoke.

use serde::Serialize;
use serde_json::{Map, Value};
use std::convert::Infallible;
use std::fmt::Display;
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

    /// The identifier that the start line and the end line share.
    pub(crate) fn call_id(&self) -> u64 {
        self.call_id
    }

    /// The part of the application that asked.
    pub(crate) fn caller(&self) -> &str {
        &self.caller
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

/// Runs a call of the desktop application to a function of a data layer package between the line `data_layer_call_start`
/// and the line `data_layer_call_end`, and gives back the result unchanged. `details` gives the numbers of a result that
/// explain the duration, for example the GitHub points of a synchronization, or `Value::Null`.
pub(crate) fn data_layer_call<T, E: Display>(
    package: &str,
    function: &str,
    run: impl FnOnce() -> Result<T, E>,
    details: impl FnOnce(&T) -> Value,
) -> Result<T, E> {
    if cfg!(test) {
        return run();
    }
    data_layer_call_in(&log_path(), package, function, run, details)
}

/// The same as `data_layer_call`, for a function of a data layer package that cannot fail.
pub(crate) fn data_layer_value<T>(package: &str, function: &str, run: impl FnOnce() -> T) -> T {
    match data_layer_call(package, function, || Ok::<T, Infallible>(run()), no_details) {
        Ok(value) => value,
        Err(never) => match never {},
    }
}

/// The details of a result that has no number to give.
pub(crate) fn no_details<T>(_result: &T) -> Value {
    Value::Null
}

/// The details of a result that is a list of rows: the number of rows.
pub(crate) fn row_count<T>(rows: &Vec<T>) -> Value {
    serde_json::json!({ "row_count": rows.len() })
}

/// The details of a synchronization of `data_layer_code_hosting`: the GitHub points of its GraphQL queries, from the field
/// `rateLimit { cost remaining }` of each answer. The caller gives the numbers, so that this file names no package of the
/// data layer, as `data_layer_boundary_checker` requires.
pub(crate) fn github_points_details(query_count: usize, cost: u64, remaining: Option<u64>) -> Value {
    serde_json::json!({
        "graphql_query_count": query_count,
        "graphql_cost": cost,
        "graphql_remaining": remaining,
    })
}

/// Writes the line `github_rate_limit`: the GitHub points left after the call `call_id`, from the answer of
/// `gh api rate_limit`. The difference of `graphql_used` between two lines gives the points of the calls between them.
pub(crate) fn record_github_rate_limit(call_id: u64, caller: &str, rate_limit_answer: Result<String, String>) {
    write("github_rate_limit", github_rate_limit_fields(call_id, caller, rate_limit_answer));
}

/// Writes one line in the log: `event` is the kind of the event, for example `voice_recording_start`, and `fields` is an
/// object with the other fields. A failure to write is ignored: the log never stops the application. The Rust tests write
/// nothing, so that a test never changes the log of the developer.
pub(crate) fn write(event: &str, fields: Value) {
    if cfg!(test) {
        return;
    }
    append_to(&log_path(), event, now_ms(), fields);
}

/// The body of `data_layer_call`, with the file of the log in `path`. The start line and the end line share `call_id`, and
/// the end line holds the duration, the first line of the failure, and the details of the result.
fn data_layer_call_in<T, E: Display>(
    path: &Path,
    package: &str,
    function: &str,
    run: impl FnOnce() -> Result<T, E>,
    details: impl FnOnce(&T) -> Value,
) -> Result<T, E> {
    let call_id = LAST_CALL_ID.fetch_add(1, Ordering::Relaxed) + 1;
    let start_fields = serde_json::json!({
        "call_id": call_id,
        "package": package,
        "function": function,
    });
    append_to(path, "data_layer_call_start", now_ms(), start_fields);
    let started = Instant::now();
    let result = run();
    let duration_ms = started.elapsed().as_millis() as u64;
    let (error, details) = match &result {
        Ok(value) => (None, details(value)),
        Err(error) => (Some(first_line(&error.to_string())), Value::Null),
    };
    let end_fields = serde_json::json!({
        "call_id": call_id,
        "package": package,
        "function": function,
        "duration_ms": duration_ms,
        "error": error,
        "details": details,
    });
    append_to(path, "data_layer_call_end", now_ms(), end_fields);
    result
}

/// The fields of the line `github_rate_limit`: the GitHub points of the GraphQL interface and of the REST interface, or the
/// failure of the read.
fn github_rate_limit_fields(call_id: u64, caller: &str, rate_limit_answer: Result<String, String>) -> Value {
    let resources = rate_limit_answer.and_then(|output| {
        let answer: Value = serde_json::from_str(&output).map_err(|error| error.to_string())?;
        answer.get("resources").cloned().ok_or_else(|| "gh api rate_limit : pas de ressources".to_string())
    });
    match resources {
        Ok(resources) => serde_json::json!({
            "after_call_id": call_id,
            "caller": caller,
            "graphql_used": resources.pointer("/graphql/used"),
            "graphql_remaining": resources.pointer("/graphql/remaining"),
            "graphql_reset": resources.pointer("/graphql/reset"),
            "core_used": resources.pointer("/core/used"),
            "core_remaining": resources.pointer("/core/remaining"),
            "error": null,
        }),
        Err(error) => serde_json::json!({
            "after_call_id": call_id,
            "caller": caller,
            "error": first_line(&error),
        }),
    }
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
    fn writes_a_call_to_a_data_layer_package_with_its_duration_its_details_and_its_failure() {
        let folder = temporary_folder("data_layer");
        let path = folder.join(LOG_FILE);
        let details = |count: &usize| serde_json::json!({ "row_count": count });
        let result = data_layer_call_in(&path, "source_control", "find_commits", || Ok::<_, String>(3_usize), details);
        assert_eq!(result, Ok(3));
        let failure: Result<usize, String> = data_layer_call_in(
            &path,
            "code_hosting",
            "refresh_code_hosting",
            || Err("gh : rate limit\nmore text".to_string()),
            details,
        );
        assert_eq!(failure, Err("gh : rate limit\nmore text".to_string()));
        let lines = read_lines(&path);
        assert_eq!(lines.len(), 4);
        assert_eq!(lines[0]["event"], "data_layer_call_start");
        assert_eq!(lines[0]["package"], "source_control");
        assert_eq!(lines[0]["function"], "find_commits");
        assert_eq!(lines[1]["event"], "data_layer_call_end");
        assert_eq!(lines[1]["call_id"], lines[0]["call_id"]);
        assert_eq!(lines[1]["duration_ms"].is_u64(), true);
        assert_eq!(lines[1]["error"], Value::Null);
        assert_eq!(lines[1]["details"]["row_count"], 3);
        assert_eq!(lines[3]["error"], "gh : rate limit");
        assert_eq!(lines[3]["details"], Value::Null);
        assert_ne!(lines[3]["call_id"], lines[1]["call_id"]);
        std::fs::remove_dir_all(folder).unwrap();
    }

    #[test]
    fn writes_the_github_points_of_a_synchronization_of_code_hosting() {
        let details = github_points_details(2, 3, Some(4990));
        assert_eq!(details["graphql_query_count"], 2);
        assert_eq!(details["graphql_cost"], 3);
        assert_eq!(details["graphql_remaining"], 4990);
        assert_eq!(github_points_details(1, 0, None)["graphql_remaining"], Value::Null);
    }

    #[test]
    fn writes_the_github_points_left_or_the_failure_of_the_read() {
        let answer = r#"{"resources":{"core":{"used":3,"remaining":4997},"graphql":{"used":8,"remaining":4992,"reset":1792993881}}}"#;
        let fields = github_rate_limit_fields(7, "code_hosting_list", Ok(answer.to_string()));
        assert_eq!(fields["after_call_id"], 7);
        assert_eq!(fields["caller"], "code_hosting_list");
        assert_eq!(fields["graphql_used"], 8);
        assert_eq!(fields["graphql_remaining"], 4992);
        assert_eq!(fields["graphql_reset"], 1792993881);
        assert_eq!(fields["core_used"], 3);
        assert_eq!(fields["core_remaining"], 4997);
        assert_eq!(fields["error"], Value::Null);
        let failure = github_rate_limit_fields(8, "merge", Err("gh : no login\nmore".to_string()));
        assert_eq!(failure["error"], "gh : no login");
        assert_eq!(github_rate_limit_fields(9, "merge", Ok("not json".into()))["error"].is_string(), true);
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
