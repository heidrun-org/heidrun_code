//! The tab "Work of one person" of the Statistics window, source "AI cost": the tokens and the estimated cost of the chat sessions
//! of Claude Code and of Codex, by hour.
//!
//! Two commands, never mixed:
//!
//! - `ai_cost_synchronize` copies the new tokens of the chat session files into the SQLite file of the data layer, and refreshes the
//!   prices of the models, with the package `data_layer_coding_agents`.
//! - `ai_cost_in_range` reads the SQLite file only. It opens no chat session file, runs no `git` command, and makes no network
//!   request.
//!
//! The grouping into hours, the join with the prices, and the cost are in the package.

use chrono::{DateTime, Utc};
use data_layer_coding_agents::{
    default_database_path, find_ai_cost, local_time_zone_name, refresh_ai_cost, AiCostAnswer, AiCostSynchronization,
};
use std::path::Path;

/// Called by the Statistics window to copy the new tokens of the chat session files of the workspaces in `folders` into the SQLite
/// file, and to refresh the prices of the models when they are a day old.
///
/// A workspace whose history was never imported is imported only when `is_import_allowed` is true.
#[tauri::command]
pub async fn ai_cost_synchronize(folders: Vec<String>, is_import_allowed: bool) -> Result<AiCostSynchronization, String> {
    // Off the main thread: reading the chat session files takes a moment.
    tauri::async_runtime::spawn_blocking(move || {
        synchronize(&folders, is_import_allowed, &default_database_path(), Utc::now().timestamp_millis())
    })
    .await
    .map_err(|error| error.to_string())?
}

/// Called by the Statistics window to read the tokens and the cost of the workspaces in `folders`, by coding agent and by hour of
/// the days of the time zone `time_zone` (an IANA name such as `Europe/Paris`; an empty text is the time zone of the computer),
/// for the time range from `since` to `until`, two texts in ISO 8601. It reads the SQLite file only.
#[tauri::command]
pub async fn ai_cost_in_range(
    folders: Vec<String>,
    since: String,
    until: String,
    time_zone: String,
) -> Result<AiCostAnswer, String> {
    tauri::async_runtime::spawn_blocking(move || read(&folders, &since, &until, &time_zone, &default_database_path()))
        .await
        .map_err(|error| error.to_string())?
}

/// The roots of the workspaces of `folders`, each root once, in the order of the folders.
fn roots_of(folders: &[String]) -> Vec<String> {
    let mut roots: Vec<String> = Vec::new();
    for folder in folders {
        let root = crate::project::find_root(Path::new(folder)).display().to_string();
        if roots.contains(&root) == false {
            roots.push(root);
        }
    }
    roots
}

/// The time of a text in ISO 8601, in milliseconds since 1 January 1970.
fn parse_time(text: &str) -> Result<i64, String> {
    DateTime::parse_from_rfc3339(text)
        .map(|time| time.timestamp_millis())
        .map_err(|_| format!("`{text}` is not a time in ISO 8601"))
}

/// Copies the new tokens of the workspaces of `folders` into the SQLite file at `database_path`. `now` is the time of now in
/// milliseconds since 1970.
fn synchronize(
    folders: &[String],
    is_import_allowed: bool,
    database_path: &Path,
    now: i64,
) -> Result<AiCostSynchronization, String> {
    // Two programs that write the SQLite file at the same time would fail with "database is locked". The command line
    // heidrun_data takes the same lock.
    let _guard = heidrun_data::lock_database(database_path)?;
    refresh_ai_cost(database_path, &roots_of(folders), is_import_allowed, now)
}

/// Reads the tokens and the cost of the workspaces of `folders` from the SQLite file at `database_path`.
fn read(folders: &[String], since: &str, until: &str, time_zone: &str, database_path: &Path) -> Result<AiCostAnswer, String> {
    let since = parse_time(since)?;
    let until = parse_time(until)?;
    let time_zone = if time_zone.is_empty() { local_time_zone_name() } else { time_zone.to_string() };
    find_ai_cost(database_path, &roots_of(folders), since, until, &time_zone)
}

#[cfg(test)]
mod tests {
    use super::*;
    use data_layer_coding_agents::claude_folder_name;
    use std::path::PathBuf;

    /// 14 October 2026, 12:00:00 in UTC, in milliseconds since 1 January 1970.
    const NOON: i64 = 1_791_979_200_000;

    /// A scratch folder with a fake folder of Claude Code, a fake folder of Codex, and a workspace folder that is a Git
    /// repository with a remote. The environment variables point to it while the value lives.
    struct Scratch {
        folder: PathBuf,
        _home_lock: std::sync::MutexGuard<'static, ()>,
    }

    impl Scratch {
        fn new(name: &str) -> Self {
            let home_lock = crate::HOME_LOCK.lock().unwrap_or_else(|error| error.into_inner());
            let folder = std::env::temp_dir().join(format!("hd-ai-cost-{name}-{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&folder);
            std::fs::create_dir_all(folder.join("workspace")).unwrap();
            let folder = folder.canonicalize().unwrap();
            for arguments in [vec!["init", "-q"], vec!["remote", "add", "origin", "git@github.com:heidrun-org/heidrun.git"]] {
                let status = std::process::Command::new("git").arg("-C").arg(folder.join("workspace")).args(arguments).status().unwrap();
                assert!(status.success());
            }
            std::env::set_var("CLAUDE_CONFIG_DIR", folder.join("claude"));
            std::env::set_var("CODEX_HOME", folder.join("codex"));
            Scratch { folder, _home_lock: home_lock }
        }

        fn workspace(&self) -> String {
            self.folder.join("workspace").display().to_string()
        }

        fn database(&self) -> PathBuf {
            self.folder.join("data_layer.sqlite")
        }

        fn write_chat(&self, name: &str) {
            let project = self.folder.join("claude").join("projects").join(claude_folder_name(&self.workspace()));
            std::fs::create_dir_all(&project).unwrap();
            let text = format!(
                "{{\"type\":\"user\",\"cwd\":\"{folder}\",\"timestamp\":\"2026-10-11T10:00:00.000Z\",\"message\":{{\"role\":\"user\",\"content\":\"{name}\"}}}}\n\
                 {{\"type\":\"assistant\",\"cwd\":\"{folder}\",\"timestamp\":\"2026-10-14T11:10:00.000Z\",\"message\":{{\"id\":\"{name}-0\",\"model\":\"claude-opus-5\",\"role\":\"assistant\",\"content\":[],\"usage\":{{\"input_tokens\":1000,\"cache_creation_input_tokens\":0,\"cache_read_input_tokens\":0,\"output_tokens\":500}}}}}}\n",
                folder = self.workspace()
            );
            std::fs::write(project.join(format!("{name}.jsonl")), text).unwrap();
        }
    }

    impl Drop for Scratch {
        fn drop(&mut self) {
            std::env::remove_var("CLAUDE_CONFIG_DIR");
            std::env::remove_var("CODEX_HOME");
            let _ = std::fs::remove_dir_all(&self.folder);
        }
    }

    #[test]
    fn a_synchronization_then_a_read_gives_the_tokens_even_when_the_chat_files_are_gone() {
        let scratch = Scratch::new("sources_gone");
        scratch.write_chat("a");
        let folders = vec![scratch.workspace()];
        let state = synchronize(&folders, true, &scratch.database(), NOON).unwrap();
        assert_eq!(state.workspaces[0].error, None);
        std::fs::remove_dir_all(scratch.folder.join("claude")).unwrap();
        let answer = read(&folders, "2026-10-14T00:00:00Z", "2026-10-15T00:00:00Z", "UTC", &scratch.database()).unwrap();
        let tokens: u64 = answer.hours.iter().map(|hour| hour.tokens).sum();
        assert_eq!(tokens, 1500);
        assert!(answer.workspaces[0].synchronized_at.is_some());
    }

    #[test]
    fn a_workspace_that_was_never_imported_is_not_imported_when_the_import_is_not_allowed() {
        let scratch = Scratch::new("not_allowed");
        scratch.write_chat("a");
        let folders = vec![scratch.workspace()];
        synchronize(&folders, false, &scratch.database(), NOON).unwrap();
        let answer = read(&folders, "2026-10-14T00:00:00Z", "2026-10-15T00:00:00Z", "UTC", &scratch.database()).unwrap();
        assert!(answer.hours.is_empty());
        assert_eq!(answer.workspaces[0].synchronized_at, None);
    }

    #[test]
    fn a_read_before_the_first_synchronization_creates_nothing_and_reports_the_workspace_as_never_imported() {
        let scratch = Scratch::new("before");
        let folders = vec![scratch.workspace()];
        let answer = read(&folders, "2026-10-14T00:00:00Z", "2026-10-15T00:00:00Z", "UTC", &scratch.database()).unwrap();
        assert!(answer.hours.is_empty());
        assert_eq!(answer.workspaces[0].synchronized_at, None);
        assert!(!scratch.database().exists());
    }

    #[test]
    fn a_read_refuses_a_time_that_is_not_a_time_and_a_time_zone_that_does_not_exist() {
        let scratch = Scratch::new("bad_input");
        let folders = vec![scratch.workspace()];
        assert!(read(&folders, "yesterday", "2026-10-15T00:00:00Z", "UTC", &scratch.database()).is_err());
        assert!(read(&folders, "2026-10-14T00:00:00Z", "2026-10-15T00:00:00Z", "Nowhere/City", &scratch.database()).is_err());
    }

    #[test]
    fn two_folders_of_one_workspace_count_once() {
        let scratch = Scratch::new("one_root");
        let sub = scratch.folder.join("workspace").join("sub");
        std::fs::create_dir_all(&sub).unwrap();
        let folders = vec![scratch.workspace(), sub.display().to_string()];
        assert_eq!(roots_of(&folders).len(), 1);
    }
}
