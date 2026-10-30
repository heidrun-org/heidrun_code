//! Reads the snapshot files that the Claude Code observer mod writes, one file for each Claude Code session.
//! A file that does not parse becomes an error entry. The reading is bounded: the newest 200 files only.

use std::path::{Path, PathBuf};

use serde::Deserialize;
use serde_json::Value;

use super::contract::{
    ClaudeObservations, ClaudeSessionObservation, ClaudeSubagentObservation, MessageObservation, ObservationError,
    PendingRequestObservation,
};

/// The most snapshot files that one collection reads: the newest ones.
pub const MAXIMUM_SNAPSHOT_FILES: usize = 200;
/// A snapshot older than this is stale: the mod writes again every 500 milliseconds while its session runs.
pub const STALE_AFTER_MS: i64 = 30_000;
/// A snapshot later than the clock by more than this is in the future, so it is stale.
pub const FUTURE_TOLERANCE_MS: i64 = 2_000;
/// The most messages of one session.
const MAXIMUM_MESSAGES: usize = 200;
/// The longest summary of a pending request, in characters.
const MAXIMUM_SUMMARY_LENGTH: usize = 500;
/// The largest snapshot file that a collection reads, in bytes.
const MAXIMUM_FILE_BYTES: u64 = 4 * 1024 * 1024;
/// The version of the snapshot file that this reader accepts.
const SNAPSHOT_SCHEMA_VERSION: u64 = 1;

/// The name of the folder of the snapshot files, inside the folder of the data of Heidrun Code.
pub const OBSERVATION_FOLDER_NAME: &str = "heidrun_code_dashboard_claude_observations";

/// The folder where the observer mod writes, as Heidrun Code gives it to each Claude Code that it starts.
pub fn observation_folder() -> PathBuf {
    crate::app_data::data_dir().join(OBSERVATION_FOLDER_NAME)
}

/// Creates the folder with the permissions 700, or gives it these permissions.
pub fn ensure_private_folder(folder: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    std::fs::create_dir_all(folder).map_err(|error| format!("{}: {error}", folder.display()))?;
    std::fs::set_permissions(folder, std::fs::Permissions::from_mode(0o700))
        .map_err(|error| format!("{}: {error}", folder.display()))
}

/// Reads every snapshot file of the folder. A missing folder gives no session and no error: no Claude Code was observed.
pub async fn read_folder(folder: &Path, now_ms: i64) -> ClaudeObservations {
    let mut errors = Vec::new();
    let files = match newest_snapshot_files(folder) {
        Ok(files) => files,
        Err(error) => {
            if folder.exists() {
                errors.push(ObservationError::new(folder.display().to_string(), error));
            }
            return ClaudeObservations {
                sessions: Vec::new(),
                errors,
            };
        }
    };
    if files.skipped_count > 0 {
        errors.push(ObservationError::new(
            folder.display().to_string(),
            format!(
                "{} older snapshot files were not read: a collection reads the newest {MAXIMUM_SNAPSHOT_FILES} only",
                files.skipped_count
            ),
        ));
    }
    let mut sessions = Vec::new();
    for path in files.paths {
        make_private(&path);
        match read_snapshot_file(&path, now_ms).await {
            Ok(session) => sessions.push(session),
            Err(message) => errors.push(ObservationError::new(path.display().to_string(), message)),
        }
    }
    ClaudeObservations { sessions, errors }
}

/// The snapshot files to read, the newest first, and how many older files are left out.
struct SnapshotFiles {
    paths: Vec<PathBuf>,
    skipped_count: usize,
}

fn newest_snapshot_files(folder: &Path) -> Result<SnapshotFiles, String> {
    let entries = std::fs::read_dir(folder).map_err(|error| error.to_string())?;
    let mut files: Vec<(std::time::SystemTime, PathBuf)> = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().is_some_and(|extension| extension == "json") == false {
            continue;
        }
        let Ok(metadata) = entry.metadata() else { continue };
        if metadata.is_file() == false {
            continue;
        }
        files.push((metadata.modified().unwrap_or(std::time::UNIX_EPOCH), path));
    }
    files.sort_by(|left, right| right.0.cmp(&left.0).then_with(|| left.1.cmp(&right.1)));
    let skipped_count = files.len().saturating_sub(MAXIMUM_SNAPSHOT_FILES);
    files.truncate(MAXIMUM_SNAPSHOT_FILES);
    Ok(SnapshotFiles {
        paths: files.into_iter().map(|(_, path)| path).collect(),
        skipped_count,
    })
}

/// Gives a snapshot file the permissions 600. The mod sets them too; a failure changes nothing else.
fn make_private(path: &Path) {
    use std::os::unix::fs::PermissionsExt;
    let Ok(metadata) = std::fs::metadata(path) else { return };
    if metadata.permissions().mode() & 0o077 != 0 {
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
    }
}

/// Reads one snapshot file. The mod can be writing the file at this moment, so a text that does not parse is read again
/// twice.
async fn read_snapshot_file(path: &Path, now_ms: i64) -> Result<ClaudeSessionObservation, String> {
    let mut last_error = String::new();
    for attempt in 0..3 {
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(20)).await;
        }
        let size = std::fs::metadata(path).map_err(|error| error.to_string())?.len();
        if size > MAXIMUM_FILE_BYTES {
            return Err(format!(
                "The snapshot file has {size} bytes, more than {MAXIMUM_FILE_BYTES}"
            ));
        }
        let text = std::fs::read_to_string(path).map_err(|error| error.to_string())?;
        let file_stem = path.file_stem().and_then(|stem| stem.to_str()).unwrap_or("");
        match parse_snapshot(&text, file_stem, now_ms) {
            Ok(session) => return Ok(session),
            Err(error) => last_error = error,
        }
    }
    Err(last_error)
}

/// One snapshot file, as the mod writes it.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Snapshot {
    schema_version: u64,
    coding_agent: String,
    session_id: String,
    herdr_pane_id: Option<String>,
    herdr_socket_path: Option<String>,
    cwd: Option<String>,
    observed_at_ms: f64,
    #[serde(default)]
    sequence: f64,
    observer_started_at_ms: f64,
    ended_at_ms: Option<f64>,
    #[serde(default)]
    subagents: Vec<Value>,
    #[serde(default)]
    pending_requests: Vec<Value>,
    #[serde(default)]
    messages: Vec<Value>,
}

/// Reads the text of one snapshot file into one session. `file_stem` is the file name without `.json`: it must be the
/// session identifier, so that one file cannot speak for another session.
pub fn parse_snapshot(text: &str, file_stem: &str, now_ms: i64) -> Result<ClaudeSessionObservation, String> {
    let snapshot: Snapshot =
        serde_json::from_str(text).map_err(|error| format!("The snapshot does not parse: {error}"))?;
    if snapshot.schema_version != SNAPSHOT_SCHEMA_VERSION {
        return Err(format!("Unsupported snapshot version {}", snapshot.schema_version));
    }
    if snapshot.coding_agent != "claude" {
        return Err("The snapshot is not a Claude Code observation".into());
    }
    if snapshot.session_id.is_empty() || snapshot.session_id != file_stem {
        return Err("The file name is not the session identifier of the snapshot".into());
    }
    let observed_at_ms = snapshot.observed_at_ms as i64;
    let is_ended = snapshot.ended_at_ms.is_some();
    let mut messages: Vec<MessageObservation> = snapshot.messages.iter().filter_map(read_message).collect();
    let extra = messages.len().saturating_sub(MAXIMUM_MESSAGES);
    messages.drain(0..extra);
    Ok(ClaudeSessionObservation {
        session_id: snapshot.session_id,
        herdr_pane_id: snapshot.herdr_pane_id.filter(|value| value.is_empty() == false),
        herdr_socket_path: snapshot.herdr_socket_path.filter(|value| value.is_empty() == false),
        cwd: snapshot.cwd,
        observed_at_ms,
        sequence: snapshot.sequence as i64,
        is_stale: is_stale(observed_at_ms, is_ended, now_ms),
        observer_started_at_ms: snapshot.observer_started_at_ms as i64,
        subagents: snapshot.subagents.iter().filter_map(read_subagent).collect(),
        pending_requests: snapshot
            .pending_requests
            .iter()
            .filter_map(read_pending_request)
            .collect(),
        messages,
    })
}

/// A snapshot is stale when its time is older than 30 seconds, when its time is in the future, or when the mod wrote
/// that its session ended (for example after `/clear` or `/resume`, which start a new file).
pub fn is_stale(observed_at_ms: i64, is_ended: bool, now_ms: i64) -> bool {
    is_ended || now_ms - observed_at_ms > STALE_AFTER_MS || observed_at_ms > now_ms + FUTURE_TOLERANCE_MS
}

/// The native status of a subagent in the words of the contract. A subagent that waits for its start or for a message
/// still runs.
pub fn subagent_status(native: &str) -> &'static str {
    match native {
        "running" | "pending" | "waiting" => "running",
        "completed" => "completed",
        "failed" => "failed",
        "killed" => "killed",
        _ => "unknown",
    }
}

fn text(value: &Value, key: &str) -> Option<String> {
    value.get(key).and_then(Value::as_str).map(str::to_string)
}

fn milliseconds(value: &Value, key: &str) -> Option<i64> {
    value.get(key).and_then(Value::as_f64).map(|number| number as i64)
}

fn cut(text: String, maximum: usize) -> String {
    match text.char_indices().nth(maximum) {
        Some((index, _)) => text[..index].to_string(),
        None => text,
    }
}

fn read_subagent(value: &Value) -> Option<ClaudeSubagentObservation> {
    Some(ClaudeSubagentObservation {
        id: text(value, "id")?,
        description: text(value, "description"),
        kind: text(value, "type"),
        native_status: subagent_status(value.get("nativeStatus").and_then(Value::as_str).unwrap_or("")),
        started_at_ms: milliseconds(value, "startedAtMs"),
        ended_at_ms: milliseconds(value, "endedAtMs"),
        initial_instructions: text(value, "initialInstructions"),
    })
}

fn read_pending_request(value: &Value) -> Option<PendingRequestObservation> {
    let kind = match value.get("kind").and_then(Value::as_str)? {
        "question" => "question",
        _ => "approval",
    };
    Some(PendingRequestObservation {
        id: text(value, "id")?,
        agent_id: text(value, "agentId"),
        kind,
        tool: text(value, "tool"),
        summary: text(value, "summary").map(|summary| cut(summary, MAXIMUM_SUMMARY_LENGTH)),
        at_ms: milliseconds(value, "atMs")?,
    })
}

fn read_message(value: &Value) -> Option<MessageObservation> {
    let message_text = text(value, "text");
    let delivery = match value.get("delivery").and_then(Value::as_str).unwrap_or("") {
        "queued" => "queued",
        "received" => "received",
        "failed" => "failed",
        _ => "unknown",
    };
    Some(MessageObservation {
        id: text(value, "id")?,
        at_ms: milliseconds(value, "atMs")?,
        from_id: text(value, "fromId")?,
        to_id: text(value, "toId"),
        content_availability: if message_text.is_some() {
            "available"
        } else {
            "not_exposed"
        },
        text: message_text,
        delivery,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const NOW: i64 = 1_793_000_000_000;

    fn good_snapshot(session_id: &str, observed_at_ms: i64) -> Value {
        json!({
            "schemaVersion": 1,
            "codingAgent": "claude",
            "sessionId": session_id,
            "herdrPaneId": "w1:p2",
            "herdrSocketPath": "/tmp/herdr.sock",
            "cwd": "/work",
            "observedAtMs": observed_at_ms,
            "sequence": 7,
            "observerStartedAtMs": observed_at_ms - 1000,
            "endedAtMs": null,
            "endReason": null,
            "subagents": [
                {
                    "id": "a1",
                    "description": "Explore the code",
                    "type": "Explore",
                    "nativeStatus": "running",
                    "startedAtMs": observed_at_ms - 500,
                    "endedAtMs": null,
                    "initialInstructions": "Find the parser"
                },
                { "id": "a2", "description": null, "type": null, "nativeStatus": "idle" }
            ],
            "pendingRequests": [
                { "id": "toolu_1", "agentId": "a1", "kind": "approval", "tool": "Bash", "summary": "ls", "atMs": observed_at_ms }
            ],
            "messages": [
                { "id": "m1", "atMs": observed_at_ms, "fromId": session_id, "toId": "a1", "text": "hello", "delivery": "queued" },
                { "id": "m2", "atMs": observed_at_ms, "fromId": "a1", "toId": null, "text": null, "delivery": "strange" }
            ]
        })
    }

    #[test]
    fn a_good_snapshot_gives_the_session_with_its_pane_its_subagents_its_requests_and_its_messages() {
        let text = good_snapshot("s1", NOW - 1000).to_string();
        let session = parse_snapshot(&text, "s1", NOW).unwrap();
        assert_eq!(session.session_id, "s1");
        assert_eq!(session.herdr_pane_id.as_deref(), Some("w1:p2"));
        assert_eq!(session.herdr_socket_path.as_deref(), Some("/tmp/herdr.sock"));
        assert!(session.is_stale == false);
        assert_eq!(session.observer_started_at_ms, NOW - 2000);
        assert_eq!(session.subagents.len(), 2);
        assert_eq!(session.subagents[0].native_status, "running");
        assert_eq!(
            session.subagents[0].initial_instructions.as_deref(),
            Some("Find the parser")
        );
        assert_eq!(session.subagents[1].native_status, "unknown");
        assert_eq!(session.pending_requests[0].kind, "approval");
        assert_eq!(session.pending_requests[0].agent_id.as_deref(), Some("a1"));
        assert_eq!(session.messages[0].content_availability, "available");
        assert_eq!(session.messages[0].delivery, "queued");
        assert_eq!(session.messages[1].content_availability, "not_exposed");
        assert_eq!(session.messages[1].delivery, "unknown");
    }

    /// The file that the mod wrote in a real `claude -p` run with Claude Code 2.1.314, on 30 October 2026.
    const REAL_ENDED_SNAPSHOT: &str = r#"{"schemaVersion":1,"codingAgent":"claude","sessionId":"e241d998-f8e1-44b4-b4e7-b0e5763507f8","herdrPaneId":"test:p1","herdrSocketPath":"/tmp/fake_herdr.sock","cwd":"/private/tmp/liveproject","observedAtMs":1793345207167,"sequence":11,"observerStartedAtMs":1793345202848,"endedAtMs":1793345207166,"endReason":"other","subagents":[],"pendingRequests":[],"messages":[]}"#;

    #[test]
    fn a_snapshot_written_by_the_real_mod_parses_and_its_ended_session_is_stale() {
        let session = parse_snapshot(
            REAL_ENDED_SNAPSHOT,
            "e241d998-f8e1-44b4-b4e7-b0e5763507f8",
            1_793_345_208_000,
        )
        .unwrap();
        assert_eq!(session.herdr_pane_id.as_deref(), Some("test:p1"));
        assert_eq!(session.observer_started_at_ms, 1_793_345_202_848);
        assert_eq!(session.sequence, 11);
        assert!(session.is_stale);
    }

    #[test]
    fn a_text_that_does_not_parse_is_an_error_not_a_crash() {
        assert!(parse_snapshot("{\"schemaVersion\": 1, \"coding", "s1", NOW).is_err());
        assert!(parse_snapshot("[]", "s1", NOW).is_err());
    }

    #[test]
    fn a_snapshot_of_another_version_or_coding_agent_or_session_is_refused() {
        let mut snapshot = good_snapshot("s1", NOW);
        snapshot["schemaVersion"] = json!(2);
        assert!(parse_snapshot(&snapshot.to_string(), "s1", NOW)
            .unwrap_err()
            .contains("version"));
        let mut snapshot = good_snapshot("s1", NOW);
        snapshot["codingAgent"] = json!("codex");
        assert!(parse_snapshot(&snapshot.to_string(), "s1", NOW).is_err());
        let snapshot = good_snapshot("s1", NOW);
        assert!(parse_snapshot(&snapshot.to_string(), "other", NOW)
            .unwrap_err()
            .contains("file name"));
    }

    #[test]
    fn an_old_snapshot_is_stale() {
        let session = parse_snapshot(&good_snapshot("s1", NOW - 31_000).to_string(), "s1", NOW).unwrap();
        assert!(session.is_stale);
        let session = parse_snapshot(&good_snapshot("s1", NOW - 29_000).to_string(), "s1", NOW).unwrap();
        assert!(session.is_stale == false);
    }

    #[test]
    fn a_snapshot_in_the_future_is_stale() {
        let session = parse_snapshot(&good_snapshot("s1", NOW + 60_000).to_string(), "s1", NOW).unwrap();
        assert!(session.is_stale);
        assert_eq!(session.observed_at_ms, NOW + 60_000);
    }

    #[test]
    fn a_snapshot_of_an_ended_session_is_stale_at_once() {
        let mut snapshot = good_snapshot("s1", NOW);
        snapshot["endedAtMs"] = json!(NOW);
        snapshot["endReason"] = json!("clear");
        assert!(parse_snapshot(&snapshot.to_string(), "s1", NOW).unwrap().is_stale);
    }

    #[test]
    fn a_summary_is_cut_at_500_characters_and_messages_keep_the_newest_200() {
        let mut snapshot = good_snapshot("s1", NOW);
        snapshot["pendingRequests"][0]["summary"] = json!("é".repeat(800));
        let messages: Vec<Value> = (0..250)
            .map(|index| json!({ "id": format!("m{index}"), "atMs": index, "fromId": "s1", "text": "x", "delivery": "queued" }))
            .collect();
        snapshot["messages"] = json!(messages);
        let session = parse_snapshot(&snapshot.to_string(), "s1", NOW).unwrap();
        assert_eq!(
            session.pending_requests[0].summary.as_ref().unwrap().chars().count(),
            500
        );
        assert_eq!(session.messages.len(), 200);
        assert_eq!(session.messages[0].id, "m50");
    }

    #[test]
    fn the_statuses_of_claude_code_map_to_the_statuses_of_the_contract() {
        assert_eq!(subagent_status("pending"), "running");
        assert_eq!(subagent_status("waiting"), "running");
        assert_eq!(subagent_status("completed"), "completed");
        assert_eq!(subagent_status("failed"), "failed");
        assert_eq!(subagent_status("killed"), "killed");
        assert_eq!(subagent_status("idle"), "unknown");
        assert_eq!(subagent_status("something new"), "unknown");
    }

    fn temporary_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("heidrun_code_dashboard_claude_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        folder
    }

    #[tokio::test]
    async fn a_folder_gives_each_good_file_and_an_error_for_each_bad_file() {
        let folder = temporary_folder("mixed");
        std::fs::write(folder.join("s1.json"), good_snapshot("s1", NOW).to_string()).unwrap();
        std::fs::write(folder.join("broken.json"), "{ not json").unwrap();
        std::fs::write(folder.join("notes.txt"), "ignored").unwrap();
        let observations = read_folder(&folder, NOW).await;
        assert_eq!(observations.sessions.len(), 1);
        assert_eq!(observations.errors.len(), 1);
        assert!(observations.errors[0].source.ends_with("broken.json"));
        use std::os::unix::fs::PermissionsExt;
        let mode = std::fs::metadata(folder.join("s1.json")).unwrap().permissions().mode();
        assert_eq!(mode & 0o777, 0o600);
        std::fs::remove_dir_all(&folder).unwrap();
    }

    #[tokio::test]
    async fn a_folder_reads_the_newest_200_files_only_and_says_so() {
        let folder = temporary_folder("bounded");
        for index in 0..205 {
            let id = format!("s{index:03}");
            std::fs::write(folder.join(format!("{id}.json")), good_snapshot(&id, NOW).to_string()).unwrap();
        }
        let observations = read_folder(&folder, NOW).await;
        assert_eq!(observations.sessions.len(), MAXIMUM_SNAPSHOT_FILES);
        assert_eq!(observations.errors.len(), 1);
        assert!(observations.errors[0].message.starts_with("5 older snapshot files"));
        std::fs::remove_dir_all(&folder).unwrap();
    }

    #[tokio::test]
    async fn a_missing_folder_gives_no_session_and_no_error() {
        let folder = std::env::temp_dir().join(format!("heidrun_code_dashboard_claude_missing_{}", std::process::id()));
        let observations = read_folder(&folder, NOW).await;
        assert!(observations.sessions.is_empty());
        assert!(observations.errors.is_empty());
    }

    #[test]
    fn the_private_folder_has_the_permissions_700() {
        use std::os::unix::fs::PermissionsExt;
        let folder = temporary_folder("private").join("observations");
        ensure_private_folder(&folder).unwrap();
        assert_eq!(std::fs::metadata(&folder).unwrap().permissions().mode() & 0o777, 0o700);
        std::fs::remove_dir_all(folder.parent().unwrap()).unwrap();
    }
}
