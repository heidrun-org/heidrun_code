//! The state of the files and of the worktrees that a chat names: which files still exist, which worktree folders still exist, and
//! the branch of each worktree. The checks run in the package `data_layer_source_control`, which owns the command `git`.

use crate::application_log::data_layer_value;
use data_layer_source_control::{find_existing_folders, find_file_existence, find_worktree_branches, FileExistence, WorktreeBranch};
use std::path::Path;

/// For each path below the root of the repository that holds `folder`, tells whether the file exists on the disk and on the
/// default branch of the remote. A path that is not below the root (absolute, with `..`, empty) does not exist.
#[tauri::command]
pub async fn chats_files_exist(folder: String, paths: Vec<String>) -> Result<Vec<FileExistence>, String> {
    // Off the main thread: it starts a Git process.
    tauri::async_runtime::spawn_blocking(move || {
        data_layer_value("source_control", "find_file_existence", || {
            find_file_existence(&crate::project::find_root(Path::new(&folder)), &paths)
        })
    })
    .await
    .map_err(|error| error.to_string())
}

/// The folders among `folders` that exist on the disk. A folder that is not an absolute path does not exist. The answer keeps
/// the order of the caller.
#[tauri::command]
pub fn chats_worktrees_exist(folders: Vec<String>) -> Vec<String> {
    data_layer_value("source_control", "find_existing_folders", || find_existing_folders(&folders))
}

/// For each folder among `folders` that exists, the current branch of the worktree. A folder that does not exist is left out, so
/// the caller knows that the worktree was removed. The answer keeps the order of the caller.
#[tauri::command]
pub fn chats_worktrees_branches(folders: Vec<String>) -> Vec<WorktreeBranch> {
    data_layer_value("source_control", "find_worktree_branches", || find_worktree_branches(&folders))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sends_a_file_existence_and_a_worktree_branch_with_the_names_of_the_fields_the_web_page_reads() {
        let existence = FileExistence { path: "a.ts".into(), on_disk: true, on_remote: false };
        assert_eq!(serde_json::to_value(existence).unwrap(), serde_json::json!({"path": "a.ts", "on_disk": true, "on_remote": false}));
        let branch = WorktreeBranch { folder: "/w".into(), branch: None };
        assert_eq!(serde_json::to_value(branch).unwrap(), serde_json::json!({"folder": "/w", "branch": null}));
    }

    #[test]
    fn a_folder_that_does_not_exist_is_not_in_the_answer() {
        assert_eq!(chats_worktrees_exist(vec!["/".to_string(), "/folder/that/does/not/exist".to_string(), "relative".to_string()]), vec!["/"]);
        assert!(chats_worktrees_branches(vec!["/folder/that/does/not/exist".to_string()]).is_empty());
    }
}
