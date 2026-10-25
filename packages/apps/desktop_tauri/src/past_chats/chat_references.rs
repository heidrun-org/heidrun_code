//! What the code hosting service says about the issues and the pull requests that a chat mentions: the title, the state, the
//! description, the labels, the author, the date, and the branches.
//!
//! Two commands, never mixed:
//!
//! - `chat_references_synchronize` copies the issues and the pull requests that changed into the SQLite file of the data layer,
//!   with the package `data_layer_code_hosting`.
//! - `chat_references_find` reads the SQLite file only and gives the stored rows of the numbers asked.
//!
//! The package reads GitHub only. A repository on GitLab keeps its own path: see `docs/agents_rules/data_layer_access.md`.

use data_layer_code_hosting::{
    default_database_path, find_issues_by_numbers, find_pull_requests_by_numbers, refresh_code_hosting, Issue, PullRequest,
};
use serde::Serialize;
use std::path::Path;

/// What `chat_references_synchronize` did.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChatReferencesSynchronization {
    /// The repository, in the format `owner/name`.
    pub repository: String,
    /// The message of the error when GitHub could not be read, or `None`. The rows are then the ones that an earlier read wrote,
    /// and they can be out of date.
    pub code_hosting_error: Option<String>,
}

/// The stored rows of some issues and some pull requests.
#[derive(Serialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ChatReferenceRows {
    /// The issues that the SQLite file holds, among the numbers asked, in the order of their numbers.
    pub issues: Vec<Issue>,
    /// The pull requests that the SQLite file holds, among the numbers asked, in the order of their numbers.
    pub pull_requests: Vec<PullRequest>,
}

/// Called by the Past chats sidebar section to copy the issues and the pull requests of the GitHub repository of `folder` that
/// changed into the SQLite file.
#[tauri::command]
pub async fn chat_references_synchronize(folder: String) -> Result<ChatReferencesSynchronization, String> {
    tauri::async_runtime::spawn_blocking(move || {
        synchronize(Path::new(&folder), &default_database_path(), &refresh_code_hosting_for_chats)
    })
    .await
    .map_err(|error| error.to_string())?
}

/// Called by the Past chats sidebar section to read the issues and the pull requests of `repository` whose numbers are asked. It
/// reads the SQLite file only.
#[tauri::command]
pub async fn chat_references_find(
    repository: String,
    issues: Vec<i64>,
    pull_requests: Vec<i64>,
) -> Result<ChatReferenceRows, String> {
    tauri::async_runtime::spawn_blocking(move || find(&default_database_path(), &repository, &issues, &pull_requests))
        .await
        .map_err(|error| error.to_string())?
}

/// The refresh of the code hosting rows. A function with this shape is what `synchronize` calls, so a test gives another.
type RefreshFn = dyn Fn(&Path, &str) -> Result<(), String>;

fn refresh_code_hosting_for_chats(database_path: &Path, repository: &str) -> Result<(), String> {
    refresh_code_hosting(database_path, repository).map(|_| ())
}

/// Finds the repository of `folder`, then refreshes its rows with `refresh`. A failure of GitHub does not fail the call: the
/// stored rows are still read, and the message is in the answer.
fn synchronize(folder: &Path, database_path: &Path, refresh: &RefreshFn) -> Result<ChatReferencesSynchronization, String> {
    let repository = data_layer_source_control::find_repository(folder)?;
    // Two commands that write the SQLite file at the same time would fail with "database is locked". The command line
    // heidrun_data takes the same lock.
    let _guard = heidrun_data::lock_database(database_path)?;
    let code_hosting_error = refresh(database_path, &repository).err();
    Ok(ChatReferencesSynchronization { repository, code_hosting_error })
}

/// Reads the rows of the numbers asked from the SQLite file at `database_path`.
fn find(database_path: &Path, repository: &str, issues: &[i64], pull_requests: &[i64]) -> Result<ChatReferenceRows, String> {
    Ok(ChatReferenceRows {
        issues: find_issues_by_numbers(database_path, repository, issues)?,
        pull_requests: find_pull_requests_by_numbers(database_path, repository, pull_requests)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use data_layer_code_hosting::CodeHostingDatabase;

    const REPOSITORY: &str = "heidrun-org/heidrun";

    fn temporary_database(name: &str) -> std::path::PathBuf {
        let folder = std::env::temp_dir().join(format!("hd-chat-references-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        folder.join("data_layer.sqlite")
    }

    #[test]
    fn reads_the_stored_issues_and_pull_requests_of_the_numbers_asked_and_nothing_else() {
        let database_path = temporary_database("find");
        let issue_json = serde_json::json!({
            "number": 7, "title": "An issue", "body": "", "state": "OPEN", "stateReason": null, "author": "ada",
            "assignees": [], "labels": ["bug"], "labelColors": {"bug": "d73a4a"},
            "createdAt": "2026-10-01T10:00:00Z", "updatedAt": "2026-10-02T10:00:00Z", "closedAt": null, "commentCount": 0
        });
        let issue: Issue = serde_json::from_value(issue_json).unwrap();
        CodeHostingDatabase::open(&database_path).unwrap().upsert_issues(REPOSITORY, &[issue]).unwrap();
        let rows = find(&database_path, REPOSITORY, &[7, 8], &[1]).unwrap();
        assert_eq!(rows.issues.len(), 1);
        assert!(rows.pull_requests.is_empty());
        let json = serde_json::to_value(&rows).unwrap();
        assert_eq!(json["issues"][0]["labelColors"]["bug"], "d73a4a");
        assert_eq!(json["issues"][0]["title"], "An issue");
    }

    #[test]
    fn reads_nothing_before_the_first_synchronization() {
        let database_path = temporary_database("empty");
        let rows = find(&database_path, REPOSITORY, &[1], &[2]).unwrap();
        assert!(rows.issues.is_empty() && rows.pull_requests.is_empty());
        assert!(!database_path.exists());
    }

    #[test]
    fn a_failure_of_github_is_in_the_answer_and_does_not_fail_the_call() {
        let folder = std::env::temp_dir().join(format!("hd-chat-references-repository-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        for arguments in [vec!["init", "-q"], vec!["remote", "add", "origin", "git@github.com:heidrun-org/heidrun.git"]] {
            assert!(std::process::Command::new("git").arg("-C").arg(&folder).args(arguments).status().unwrap().success());
        }
        let database_path = temporary_database("failure");
        let failing: &RefreshFn = &|_, _| Err("no network".to_string());
        let answer = synchronize(&folder, &database_path, failing).unwrap();
        assert_eq!(answer.repository, REPOSITORY);
        assert_eq!(answer.code_hosting_error.as_deref(), Some("no network"));
        let _ = std::fs::remove_dir_all(&folder);
    }

    #[test]
    fn a_folder_that_is_not_in_a_repository_is_an_error() {
        let folder = std::env::temp_dir().join(format!("hd-chat-references-none-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        let none: &RefreshFn = &|_, _| Ok(());
        assert!(synchronize(&folder, &temporary_database("none"), none).is_err());
        let _ = std::fs::remove_dir_all(&folder);
    }
}
