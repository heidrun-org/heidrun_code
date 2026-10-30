//! Reads the root chats of the Codex panes and their descendants on the shared Codex server, with read-only methods.
//! The root chats come from the `agent_session` of the Codex panes in the Herdr snapshot, never from a title or a folder.

use std::collections::HashSet;
use std::path::Path;

use serde_json::{json, Value};

use super::codex_connection::{CodexConnection, READ_ONLY_METHODS};
use super::contract::{
    CodexLastTurn, CodexLimits, CodexObservations, CodexThreadObservation, MessageObservation, ObservationError,
};

/// The most items of one chat that one collection reads to find the interactions with its subagents: the newest ones.
const MAXIMUM_ITEMS_PER_THREAD: u64 = 100;
/// The most descendants that one page of `thread/list` gives.
const PAGE_SIZE: usize = 100;

/// The root chat identifiers of the Codex panes of a Herdr snapshot (the answer of `session.snapshot`), each once, in
/// the order of the panes.
pub fn codex_root_thread_ids(snapshot: &Value) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut identifiers = Vec::new();
    for pane in snapshot
        .pointer("/snapshot/panes")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        let session = pane.get("agent_session");
        let session_agent = session.and_then(|session| session.get("agent")).and_then(Value::as_str);
        let pane_agent = pane.get("agent").and_then(Value::as_str);
        let is_codex = session_agent == Some("codex") || (session_agent.is_none() && pane_agent == Some("codex"));
        if is_codex == false {
            continue;
        }
        let Some(value) = session.and_then(|session| session.get("value")).and_then(Value::as_str) else {
            continue;
        };
        if value.is_empty() == false && seen.insert(value.to_string()) {
            identifiers.push(value.to_string());
        }
    }
    identifiers
}

/// Reads the given root chats and their descendants. A connection that fails gives the coverage `unavailable`; a root
/// that fails gives an error entry, and the other roots are still read.
pub async fn collect(
    socket_path: &Path,
    root_thread_ids: &[String],
    maximum_children_per_root: usize,
    now_ms: i64,
    mut errors: Vec<ObservationError>,
) -> CodexObservations {
    let source = socket_path.display().to_string();
    let mut connection = match CodexConnection::open(socket_path, READ_ONLY_METHODS).await {
        Ok(connection) => connection,
        Err(message) => {
            errors.push(ObservationError::new(source, message.clone()));
            return CodexObservations::unavailable(message, errors);
        }
    };
    let mut threads = Vec::new();
    let mut truncated_root_thread_ids = Vec::new();
    for root_thread_id in root_thread_ids {
        match collect_root(&mut connection, root_thread_id, maximum_children_per_root, now_ms).await {
            Ok((root_threads, is_truncated)) => {
                threads.extend(root_threads);
                if is_truncated {
                    truncated_root_thread_ids.push(root_thread_id.clone());
                }
            }
            Err(message) => errors.push(ObservationError::new(
                method_of(&message),
                format!("{root_thread_id}: {message}"),
            )),
        }
    }
    CodexObservations {
        coverage: "connected",
        unavailable_reason: None,
        threads,
        errors,
        limits: CodexLimits {
            maximum_children_per_root,
            truncated_root_thread_ids,
        },
    }
}

/// The method at the start of an error message `method: text`, or the name of the shared server.
fn method_of(message: &str) -> String {
    match message.split_once(':') {
        Some((method, _)) if method.starts_with("thread/") => method.to_string(),
        _ => "shared_codex_server".to_string(),
    }
}

/// Reads one root chat and its descendants. Gives the chats and true when the descendants are more than the maximum.
async fn collect_root(
    connection: &mut CodexConnection,
    root_thread_id: &str,
    maximum_children: usize,
    now_ms: i64,
) -> Result<(Vec<CodexThreadObservation>, bool), String> {
    let root = connection
        .request("thread/read", json!({ "threadId": root_thread_id }))
        .await?;
    let root = root
        .get("thread")
        .cloned()
        .ok_or("thread/read: the answer has no thread")?;
    let mut children: Vec<Value> = Vec::new();
    let mut cursor: Option<String> = None;
    let mut is_truncated = false;
    while children.len() < maximum_children {
        let mut params = json!({
            "ancestorThreadId": root_thread_id,
            "sourceKinds": ["subAgentThreadSpawn", "subAgent"],
            "limit": PAGE_SIZE.min(maximum_children - children.len()),
        });
        if let Some(cursor) = &cursor {
            params["cursor"] = json!(cursor);
        }
        let page = connection.request("thread/list", params).await?;
        let data = page.get("data").and_then(Value::as_array).cloned().unwrap_or_default();
        let is_empty = data.is_empty();
        children.extend(data);
        cursor = page.get("nextCursor").and_then(Value::as_str).map(str::to_string);
        if cursor.is_none() || is_empty {
            break;
        }
    }
    if children.len() > maximum_children {
        children.truncate(maximum_children);
        is_truncated = true;
    } else if children.len() == maximum_children && cursor.is_some() {
        is_truncated = true;
    }
    let mut all = vec![root];
    all.extend(children);
    let identifiers: HashSet<String> = all.iter().filter_map(thread_id).collect();
    let parents: HashSet<String> = all
        .iter()
        .filter_map(|thread| thread.get("parentThreadId").and_then(Value::as_str).map(str::to_string))
        .collect();
    let mut observations = Vec::new();
    for thread in &all {
        let Some(identifier) = thread_id(thread) else { continue };
        let turns = connection
            .request(
                "thread/turns/list",
                json!({ "threadId": identifier, "limit": 1, "sortDirection": "desc" }),
            )
            .await?;
        let interactions = if parents.contains(&identifier) {
            let items = connection
                .request(
                    "thread/items/list",
                    json!({ "threadId": identifier, "limit": MAXIMUM_ITEMS_PER_THREAD, "sortDirection": "desc" }),
                )
                .await?;
            interactions_of(&identifier, &items, &identifiers)
        } else {
            Vec::new()
        };
        let mut observation = thread_observation(thread, root_thread_id, now_ms);
        observation.last_turn = last_turn(&turns);
        observation.interactions = interactions;
        observations.push(observation);
    }
    Ok((observations, is_truncated))
}

fn thread_id(thread: &Value) -> Option<String> {
    thread.get("id").and_then(Value::as_str).map(str::to_string)
}

/// One chat of the shared Codex server in the words of the contract, without its last turn and its interactions.
pub fn thread_observation(thread: &Value, root_thread_id: &str, now_ms: i64) -> CodexThreadObservation {
    let spawn = thread.pointer("/source/subAgent/thread_spawn");
    let from_spawn = |key: &str| {
        spawn
            .and_then(|spawn| spawn.get(key))
            .and_then(Value::as_str)
            .map(str::to_string)
    };
    let text = |key: &str| thread.get(key).and_then(Value::as_str).map(str::to_string);
    let status = thread.get("status");
    CodexThreadObservation {
        thread_id: text("id").unwrap_or_default(),
        parent_thread_id: text("parentThreadId").or_else(|| from_spawn("parent_thread_id")),
        root_thread_id: root_thread_id.to_string(),
        nickname: text("agentNickname").or_else(|| from_spawn("agent_nickname")),
        role: text("agentRole").or_else(|| from_spawn("agent_role")),
        native_status: thread_status(
            status
                .and_then(|status| status.get("type"))
                .and_then(Value::as_str)
                .unwrap_or(""),
        ),
        active_flags: status
            .and_then(|status| status.get("activeFlags"))
            .and_then(Value::as_array)
            .map(|flags| flags.iter().filter_map(Value::as_str).map(str::to_string).collect())
            .unwrap_or_default(),
        last_turn: None,
        interactions: Vec::new(),
        observed_at_ms: now_ms,
    }
}

/// The native status of a Codex chat in the words of the contract.
pub fn thread_status(native: &str) -> &'static str {
    match native {
        "idle" => "idle",
        "active" => "active",
        "notLoaded" => "notLoaded",
        "systemError" => "systemError",
        _ => "unknown",
    }
}

/// The status of a Codex turn in the words of the contract.
pub fn turn_status(native: &str) -> &'static str {
    match native {
        "completed" => "completed",
        "interrupted" => "interrupted",
        "failed" => "failed",
        "inProgress" => "inProgress",
        _ => "unknown",
    }
}

/// The last turn of a chat, from the answer of `thread/turns/list` with the newest turn first. Codex gives the time of
/// a turn in seconds.
pub fn last_turn(turns: &Value) -> Option<CodexLastTurn> {
    let turn = turns.get("data").and_then(Value::as_array)?.first()?;
    Some(CodexLastTurn {
        status: turn_status(turn.get("status").and_then(Value::as_str).unwrap_or("")),
        completed_at_ms: turn
            .get("completedAt")
            .and_then(Value::as_f64)
            .map(|seconds| (seconds * 1000.0) as i64),
    })
}

/// The interactions of a chat with its subagents, from the answer of `thread/items/list`. Codex gives no readable text
/// for them, so the text is always null.
pub fn interactions_of(thread_id: &str, items: &Value, known_thread_ids: &HashSet<String>) -> Vec<MessageObservation> {
    let mut interactions = Vec::new();
    for entry in items.get("data").and_then(Value::as_array).into_iter().flatten() {
        let Some(item) = entry.get("item") else { continue };
        if item.get("type").and_then(Value::as_str) != Some("subAgentActivity")
            || item.get("kind").and_then(Value::as_str) != Some("interacted")
        {
            continue;
        }
        let Some(recipient) = item.get("agentThreadId").and_then(Value::as_str) else {
            continue;
        };
        if known_thread_ids.contains(recipient) == false {
            continue;
        }
        let Some(identifier) = item.get("id").and_then(Value::as_str) else {
            continue;
        };
        let at_ms = ["completedAtMs", "startedAtMs"]
            .iter()
            .find_map(|key| item.get(*key).or_else(|| entry.get(*key)).and_then(Value::as_f64))
            .unwrap_or(0.0) as i64;
        interactions.push(MessageObservation {
            id: identifier.to_string(),
            at_ms,
            from_id: thread_id.to_string(),
            to_id: Some(recipient.to_string()),
            text: None,
            content_availability: "not_exposed",
            delivery: "unknown",
        });
    }
    interactions.sort_by_key(|interaction| interaction.at_ms);
    interactions
}

#[cfg(test)]
mod tests {
    use super::super::codex_connection::fake_server;
    use super::*;

    #[test]
    fn the_root_chats_come_from_the_agent_session_of_the_codex_panes_only() {
        let snapshot = json!({ "snapshot": { "panes": [
            { "pane_id": "p1", "agent": "codex", "agent_session": { "agent": "codex", "value": "root-1" } },
            { "pane_id": "p2", "agent": "claude", "agent_session": { "agent": "claude", "value": "claude-1" } },
            { "pane_id": "p3", "agent": "codex", "agent_session": null },
            { "pane_id": "p4", "agent": null, "agent_session": { "agent": "codex", "value": "root-2" } },
            { "pane_id": "p5", "agent": "codex", "agent_session": { "agent": "codex", "value": "root-1" } },
            { "pane_id": "p6", "agent": "codex", "agent_session": { "agent": "codex", "value": "" } }
        ] } });
        assert_eq!(codex_root_thread_ids(&snapshot), ["root-1", "root-2"]);
        assert!(codex_root_thread_ids(&json!({})).is_empty());
    }

    #[test]
    fn the_statuses_and_flags_of_codex_map_to_the_contract() {
        assert_eq!(thread_status("idle"), "idle");
        assert_eq!(thread_status("active"), "active");
        assert_eq!(thread_status("notLoaded"), "notLoaded");
        assert_eq!(thread_status("systemError"), "systemError");
        assert_eq!(thread_status("other"), "unknown");
        assert_eq!(turn_status("inProgress"), "inProgress");
        assert_eq!(turn_status("interrupted"), "interrupted");
        assert_eq!(turn_status(""), "unknown");
        let thread = json!({
            "id": "child",
            "parentThreadId": null,
            "status": { "type": "active", "activeFlags": ["waitingOnApproval"] },
            "agentNickname": null,
            "source": { "subAgent": { "thread_spawn": {
                "parent_thread_id": "root", "agent_nickname": "Pasteur", "agent_role": "worker"
            } } }
        });
        let observation = thread_observation(&thread, "root", 5);
        assert_eq!(observation.parent_thread_id.as_deref(), Some("root"));
        assert_eq!(observation.nickname.as_deref(), Some("Pasteur"));
        assert_eq!(observation.role.as_deref(), Some("worker"));
        assert_eq!(observation.native_status, "active");
        assert_eq!(observation.active_flags, ["waitingOnApproval"]);
        assert_eq!(observation.observed_at_ms, 5);
    }

    #[test]
    fn the_last_turn_gives_its_time_in_milliseconds() {
        let turns = json!({ "data": [{ "status": "completed", "completedAt": 1793342980 }] });
        let turn = last_turn(&turns).unwrap();
        assert_eq!(turn.status, "completed");
        assert_eq!(turn.completed_at_ms, Some(1_793_342_980_000));
        assert_eq!(last_turn(&json!({ "data": [] })), None);
    }

    #[test]
    fn an_interaction_is_kept_only_for_a_known_subagent_and_never_has_text() {
        let known: HashSet<String> = ["root", "child"].map(String::from).into_iter().collect();
        let items = json!({ "data": [
            { "item": { "type": "subAgentActivity", "kind": "interacted", "id": "i2", "agentThreadId": "child", "completedAtMs": 20 } },
            { "item": { "type": "subAgentActivity", "kind": "interacted", "id": "i1", "agentThreadId": "child", "completedAtMs": 10 } },
            { "item": { "type": "subAgentActivity", "kind": "interacted", "id": "i3", "agentThreadId": "stranger" } },
            { "item": { "type": "subAgentActivity", "kind": "spawned", "id": "i4", "agentThreadId": "child" } },
            { "item": { "type": "agentMessage", "id": "i5", "text": "hello" } }
        ] });
        let interactions = interactions_of("root", &items, &known);
        assert_eq!(interactions.len(), 2);
        assert_eq!(interactions[0].id, "i1");
        assert_eq!(interactions[0].to_id.as_deref(), Some("child"));
        assert_eq!(interactions[0].text, None);
        assert_eq!(interactions[0].content_availability, "not_exposed");
    }

    #[tokio::test]
    async fn a_collection_reads_the_root_and_its_children_with_read_only_methods() {
        let (socket_path, requests) = fake_server::start("collect", |method, params| match method {
            "thread/read" => Ok(json!({ "thread": { "id": params["threadId"], "status": { "type": "idle" } } })),
            "thread/list" => Ok(json!({ "data": [
                { "id": "child", "parentThreadId": "root", "status": { "type": "active", "activeFlags": ["waitingOnUserInput"] } }
            ], "nextCursor": null })),
            "thread/turns/list" => Ok(json!({ "data": [{ "status": "inProgress", "completedAt": null }] })),
            "thread/items/list" => Ok(json!({ "data": [
                { "item": { "type": "subAgentActivity", "kind": "interacted", "id": "i1", "agentThreadId": "child", "completedAtMs": 3 } }
            ] })),
            _ => Err("unexpected".into()),
        });
        let observations = collect(&socket_path, &["root".to_string()], 100, 9, Vec::new()).await;
        assert_eq!(observations.coverage, "connected");
        assert!(observations.errors.is_empty(), "{:?}", observations.errors);
        assert_eq!(observations.threads.len(), 2);
        assert_eq!(observations.threads[0].thread_id, "root");
        assert_eq!(observations.threads[0].interactions.len(), 1);
        assert_eq!(observations.threads[1].active_flags, ["waitingOnUserInput"]);
        assert_eq!(observations.threads[1].root_thread_id, "root");
        assert_eq!(observations.threads[1].last_turn.as_ref().unwrap().status, "inProgress");
        let methods: HashSet<String> = requests
            .lock()
            .unwrap()
            .iter()
            .map(|(method, _)| method.clone())
            .collect();
        let allowed: HashSet<String> = [
            "initialize",
            "initialized",
            "thread/read",
            "thread/list",
            "thread/turns/list",
            "thread/items/list",
        ]
        .map(String::from)
        .into_iter()
        .collect();
        assert!(methods.is_subset(&allowed), "{methods:?}");
    }

    #[tokio::test]
    async fn a_root_with_more_children_than_the_maximum_is_truncated() {
        let (socket_path, requests) = fake_server::start("bounded", |method, params| match method {
            "thread/read" => Ok(json!({ "thread": { "id": "root", "status": { "type": "idle" } } })),
            "thread/list" => {
                let limit = params["limit"].as_u64().unwrap();
                let data: Vec<Value> = (0..limit)
                    .map(|index| json!({ "id": format!("c{index}-{}", params["cursor"]), "parentThreadId": "root" }))
                    .collect();
                Ok(json!({ "data": data, "nextCursor": "more" }))
            }
            "thread/turns/list" | "thread/items/list" => Ok(json!({ "data": [] })),
            _ => Err("unexpected".into()),
        });
        let observations = collect(&socket_path, &["root".to_string()], 3, 0, Vec::new()).await;
        assert_eq!(observations.threads.len(), 4);
        assert_eq!(observations.limits.maximum_children_per_root, 3);
        assert_eq!(observations.limits.truncated_root_thread_ids, ["root"]);
        let lists = requests
            .lock()
            .unwrap()
            .iter()
            .filter(|(method, _)| method == "thread/list")
            .count();
        assert_eq!(lists, 1);
    }

    #[tokio::test]
    async fn a_root_that_fails_is_an_error_and_the_other_roots_are_still_read() {
        let (socket_path, _) = fake_server::start("failing", |method, params| {
            match (method, params["threadId"].as_str()) {
                ("thread/read", Some("missing")) => Err("thread not found".into()),
                ("thread/read", _) => {
                    Ok(json!({ "thread": { "id": params["threadId"], "status": { "type": "notLoaded" } } }))
                }
                ("thread/list", _) => Ok(json!({ "data": [], "nextCursor": null })),
                _ => Ok(json!({ "data": [] })),
            }
        });
        let roots = ["missing".to_string(), "root".to_string()];
        let observations = collect(&socket_path, &roots, 100, 0, Vec::new()).await;
        assert_eq!(observations.coverage, "connected");
        assert_eq!(observations.threads.len(), 1);
        assert_eq!(observations.threads[0].native_status, "notLoaded");
        assert_eq!(observations.errors.len(), 1);
        assert_eq!(observations.errors[0].source, "thread/read");
    }

    /// Runs by hand only, with `cargo test live_ -- --ignored`: it uses the real shared Codex server of the developer.
    /// It creates one small named chat and reads it back. It sends no prompt.
    #[tokio::test]
    #[ignore]
    async fn live_the_real_shared_codex_server_creates_a_named_chat_and_the_collector_reads_it() {
        use super::super::codex_chat_preparation::{prepare_chat, PREPARATION_TIMEOUT};
        let socket_path = super::super::codex_connection::shared_server_socket_path();
        let folder = std::env::temp_dir().join("heidrun_mire_live_test");
        std::fs::create_dir_all(&folder).unwrap();
        let cwd = folder.canonicalize().unwrap().display().to_string();
        let identifier = prepare_chat(&socket_path, &cwd, "Heidrun Mire live test", None, PREPARATION_TIMEOUT)
            .await
            .unwrap();
        println!("created chat {identifier} in {cwd}");
        let observations = collect(
            &socket_path,
            &[identifier.clone()],
            MAXIMUM_CHILDREN_PER_ROOT_FOR_TEST,
            0,
            Vec::new(),
        )
        .await;
        println!("{}", serde_json::to_string_pretty(&observations).unwrap());
        assert_eq!(observations.coverage, "connected");
        assert!(observations.errors.is_empty(), "{:?}", observations.errors);
        assert_eq!(observations.threads.len(), 1);
        assert_eq!(observations.threads[0].thread_id, identifier);
        assert!(["idle", "notLoaded"].contains(&observations.threads[0].native_status));
    }

    const MAXIMUM_CHILDREN_PER_ROOT_FOR_TEST: usize = super::super::contract::MAXIMUM_CHILDREN_PER_ROOT;

    #[tokio::test]
    async fn a_missing_server_gives_the_coverage_unavailable() {
        let path = std::env::temp_dir().join(format!("heidrun_mire_no_server_{}.sock", std::process::id()));
        let observations = collect(&path, &["root".to_string()], 100, 0, Vec::new()).await;
        assert_eq!(observations.coverage, "unavailable");
        assert!(observations.unavailable_reason.is_some());
        assert_eq!(observations.errors.len(), 1);
        assert!(observations.threads.is_empty());
    }
}
