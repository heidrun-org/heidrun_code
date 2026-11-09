//! The observations that the Heidrun Code Dashboard collector sends to the web page, in the shape of the observation contract of issue 968.
//! Every field is written in camelCase. This file reads nothing: it holds the shape only.

use serde::Serialize;

/// The version of the shape. The web page refuses another version.
pub const SCHEMA_VERSION: u32 = 1;

/// The most descendants of one Codex root chat that one collection reads.
pub const MAXIMUM_CHILDREN_PER_ROOT: usize = 100;

/// One collection of every source.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HeidrunCodeDashboardObservations {
    pub schema_version: u32,
    pub observed_at_ms: i64,
    pub claude: ClaudeObservations,
    pub codex: CodexObservations,
}

impl HeidrunCodeDashboardObservations {
    /// The observations before the first collection: nothing is known yet, and Codex is not connected.
    pub fn empty(observed_at_ms: i64) -> Self {
        HeidrunCodeDashboardObservations {
            schema_version: SCHEMA_VERSION,
            observed_at_ms,
            claude: ClaudeObservations {
                sessions: Vec::new(),
                errors: Vec::new(),
            },
            codex: CodexObservations::unavailable("No collection has run yet".to_string(), Vec::new()),
        }
    }
}

/// The Claude Code sessions that the observer mod wrote.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeObservations {
    pub sessions: Vec<ClaudeSessionObservation>,
    pub errors: Vec<ObservationError>,
}

/// The Codex chats of the Codex panes of Herdr, read on the shared Codex server.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CodexObservations {
    /// `connected` or `unavailable`.
    pub coverage: &'static str,
    pub unavailable_reason: Option<String>,
    pub threads: Vec<CodexThreadObservation>,
    pub errors: Vec<ObservationError>,
    pub limits: CodexLimits,
}

impl CodexObservations {
    /// The observations when the shared Codex server cannot be read: no chat, and the reason.
    pub fn unavailable(reason: String, errors: Vec<ObservationError>) -> Self {
        CodexObservations {
            coverage: "unavailable",
            unavailable_reason: Some(reason),
            threads: Vec::new(),
            errors,
            limits: CodexLimits {
                maximum_children_per_root: MAXIMUM_CHILDREN_PER_ROOT,
                truncated_root_thread_ids: Vec::new(),
            },
        }
    }
}

/// The bounds of the Codex reading.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CodexLimits {
    pub maximum_children_per_root: usize,
    /// The root chats that have more descendants than the maximum.
    pub truncated_root_thread_ids: Vec<String>,
}

/// One error of a source: a file, a socket, or a method.
#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct ObservationError {
    pub source: String,
    pub message: String,
}

impl ObservationError {
    pub fn new(source: impl Into<String>, message: impl Into<String>) -> Self {
        ObservationError {
            source: source.into(),
            message: message.into(),
        }
    }
}

/// One Claude Code session, from one snapshot file of the observer mod.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSessionObservation {
    pub session_id: String,
    pub herdr_pane_id: Option<String>,
    pub herdr_socket_path: Option<String>,
    pub cwd: Option<String>,
    /// The time that the mod wrote, not the time of the collection.
    pub observed_at_ms: i64,
    pub sequence: i64,
    pub is_stale: bool,
    pub observer_started_at_ms: i64,
    pub subagents: Vec<ClaudeSubagentObservation>,
    pub pending_requests: Vec<PendingRequestObservation>,
    pub messages: Vec<MessageObservation>,
}

/// One subagent of a Claude Code session.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeSubagentObservation {
    pub id: String,
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub kind: Option<String>,
    /// `running`, `completed`, `failed`, `killed`, or `unknown`.
    pub native_status: &'static str,
    pub started_at_ms: Option<i64>,
    pub ended_at_ms: Option<i64>,
    pub initial_instructions: Option<String>,
}

/// One question or approval that waits for the developer.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct PendingRequestObservation {
    pub id: String,
    pub agent_id: Option<String>,
    /// `approval` or `question`.
    pub kind: &'static str,
    pub tool: Option<String>,
    pub summary: Option<String>,
    pub at_ms: i64,
}

/// One message between a coding agent, its subagents, and other sessions.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MessageObservation {
    pub id: String,
    pub at_ms: i64,
    pub from_id: String,
    pub to_id: Option<String>,
    pub text: Option<String>,
    /// `available` or `not_exposed`.
    pub content_availability: &'static str,
    /// `queued`, `received`, `failed`, or `unknown`.
    pub delivery: &'static str,
}

/// One Codex chat: a root chat of a pane, or one of its descendants.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CodexThreadObservation {
    pub thread_id: String,
    pub parent_thread_id: Option<String>,
    pub root_thread_id: String,
    pub nickname: Option<String>,
    pub role: Option<String>,
    /// `idle`, `active`, `notLoaded`, `systemError`, or `unknown`.
    pub native_status: &'static str,
    pub active_flags: Vec<String>,
    pub last_turn: Option<CodexLastTurn>,
    pub interactions: Vec<MessageObservation>,
    pub observed_at_ms: i64,
}

/// The last turn of a Codex chat.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CodexLastTurn {
    /// `completed`, `interrupted`, `failed`, `inProgress`, or `unknown`.
    pub status: &'static str,
    pub completed_at_ms: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn the_empty_observations_have_the_shape_of_the_contract() {
        let value = serde_json::to_value(HeidrunCodeDashboardObservations::empty(42)).unwrap();
        assert_eq!(
            value,
            json!({
                "schemaVersion": 1,
                "observedAtMs": 42,
                "claude": { "sessions": [], "errors": [] },
                "codex": {
                    "coverage": "unavailable",
                    "unavailableReason": "No collection has run yet",
                    "threads": [],
                    "errors": [],
                    "limits": { "maximumChildrenPerRoot": 100, "truncatedRootThreadIds": [] }
                }
            })
        );
    }

    #[test]
    fn a_subagent_writes_its_kind_as_type() {
        let subagent = ClaudeSubagentObservation {
            id: "a1".into(),
            description: None,
            kind: Some("Explore".into()),
            native_status: "running",
            started_at_ms: None,
            ended_at_ms: None,
            initial_instructions: None,
        };
        let value = serde_json::to_value(subagent).unwrap();
        assert_eq!(value["type"], json!("Explore"));
        assert_eq!(value["nativeStatus"], json!("running"));
        assert!(value.get("kind").is_none());
    }
}
