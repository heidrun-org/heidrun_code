//! The list of the chats of the Past chats sidebar section.
//!
//! Two commands, never mixed:
//!
//! - `chats_synchronize` copies the chat session files of the workspace that changed into the SQLite file of the data layer, with
//!   the package `data_layer_coding_agents`, and asks for a refresh of the model prices in the background.
//! - `chats_list` reads the SQLite file only and gives the first chats of each coding agent, sorted. It opens no chat session file.
//!
//! The sort, the cut to the limit, the tokens, and the cost are in the package.

use chrono::Utc;
use data_layer_coding_agents::{
    default_database_path, find_chat_list, refresh_chat_sessions, refresh_public_model_prices_when_due, ChatList, SortKey,
    SortOrder, Sorting,
};
use serde::Serialize;
use std::path::Path;

/// What `chats_synchronize` did.
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct ChatsSynchronization {
    /// The root of the workspace whose chats were copied.
    pub root: String,
    /// The number of chat sessions that the synchronization wrote.
    pub chat_session_count: usize,
}

/// Called by the Past chats sidebar section to copy the chat session files of the workspace that holds `folder` into the SQLite
/// file. The first call for a workspace opens every file of it. The next calls open only the files that changed.
#[tauri::command]
pub async fn chats_synchronize(folder: String) -> Result<ChatsSynchronization, String> {
    // Off the main thread: the first read of the files of a coding agent takes a moment.
    tauri::async_runtime::spawn_blocking(move || synchronize(&folder, &default_database_path()))
        .await
        .map_err(|error| error.to_string())?
}

/// The first `limit` chats of Claude Code and of Codex that started in the root of the repository that holds `folder`, sorted by
/// `sort_key` from the end that `order` says. It reads the SQLite file only.
#[tauri::command]
pub async fn chats_list(folder: String, limit: usize, sort_key: SortKey, order: SortOrder) -> Result<ChatList, String> {
    let sorting = Sorting { key: sort_key, order };
    tauri::async_runtime::spawn_blocking(move || list(&folder, limit, sorting, &default_database_path()))
        .await
        .map_err(|error| error.to_string())?
}

/// Copies the chat sessions of the workspace that holds `folder` into the SQLite file at `database_path`.
fn synchronize(folder: &str, database_path: &Path) -> Result<ChatsSynchronization, String> {
    let root = crate::project::find_root(Path::new(folder)).display().to_string();
    let report = {
        // Two programs that write the SQLite file at the same time would fail with "database is locked". The command line
        // heidrun_data takes the same lock.
        let _guard = heidrun_data::lock_database(database_path)?;
        refresh_chat_sessions(database_path, &root)?
    };
    refresh_prices_in_background(database_path.to_path_buf());
    Ok(ChatsSynchronization { root, chat_session_count: report.chat_session_count })
}

/// Reads the chats of the workspace that holds `folder` from the SQLite file at `database_path`.
fn list(folder: &str, limit: usize, sorting: Sorting, database_path: &Path) -> Result<ChatList, String> {
    let root = crate::project::find_root(Path::new(folder)).display().to_string();
    find_chat_list(database_path, &root, limit, sorting)
}

/// Asks the package for a refresh of the prices of the models, without waiting for the answer: the package fetches the price
/// list at most once an hour, and only when the latest version is a day old. A refresh that fails changes nothing, so Heidrun Code
/// never loses its prices.
fn refresh_prices_in_background(database_path: std::path::PathBuf) {
    tauri::async_runtime::spawn_blocking(move || {
        if let Ok(_guard) = heidrun_data::lock_database(&database_path) {
            let _ = refresh_public_model_prices_when_due(&database_path, Utc::now().timestamp_millis());
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use data_layer_coding_agents::claude_folder_name;
    use std::path::PathBuf;

    /// A scratch folder with a fake folder of Claude Code, a fake folder of Codex, and a workspace folder. The environment
    /// variables point to it while the value lives, and the folder is removed when the value is dropped.
    struct Scratch {
        folder: PathBuf,
        _home_lock: std::sync::MutexGuard<'static, ()>,
    }

    impl Scratch {
        fn new(name: &str) -> Self {
            let home_lock = crate::HOME_LOCK.lock().unwrap_or_else(|error| error.into_inner());
            let folder = std::env::temp_dir().join(format!("hd-past-chats-{name}-{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&folder);
            std::fs::create_dir_all(folder.join("workspace")).unwrap();
            let folder = folder.canonicalize().unwrap();
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

        fn write_chat(&self, name: &str, title: &str) {
            let project = self.folder.join("claude").join("projects").join(claude_folder_name(&self.workspace()));
            std::fs::create_dir_all(&project).unwrap();
            let text = format!(
                "{{\"type\":\"user\",\"cwd\":\"{}\",\"timestamp\":\"2026-10-11T10:00:00.000Z\",\"message\":{{\"role\":\"user\",\"content\":\"{title}\"}}}}\n",
                self.workspace()
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
    fn a_list_before_the_first_synchronization_is_empty_and_creates_nothing() {
        let scratch = Scratch::new("before");
        scratch.write_chat("a", "Fix the tab bar");
        let found = list(&scratch.workspace(), 10, Sorting::default(), &scratch.database()).unwrap();
        assert!(found.claude.chats.is_empty() && found.codex.chats.is_empty());
        assert!(!scratch.database().exists());
    }

    #[test]
    fn a_synchronization_then_a_list_gives_the_chats_even_when_the_chat_files_are_gone() {
        let scratch = Scratch::new("sources_gone");
        scratch.write_chat("a", "Fix the tab bar");
        scratch.write_chat("b", "Write the guide");
        let report = synchronize(&scratch.workspace(), &scratch.database()).unwrap();
        assert_eq!(report.chat_session_count, 2);
        std::fs::remove_dir_all(scratch.folder.join("claude")).unwrap();
        let found = list(&scratch.workspace(), 10, Sorting::default(), &scratch.database()).unwrap();
        let mut titles: Vec<&str> = found.claude.chats.iter().map(|chat| chat.title.as_str()).collect();
        titles.sort();
        assert_eq!(titles, vec!["Fix the tab bar", "Write the guide"]);
        assert_eq!(found.root, scratch.workspace());
    }

    #[test]
    fn the_next_synchronization_deletes_the_chat_whose_file_is_gone() {
        let scratch = Scratch::new("deleted");
        scratch.write_chat("a", "Stays");
        scratch.write_chat("b", "Goes");
        synchronize(&scratch.workspace(), &scratch.database()).unwrap();
        let project = scratch.folder.join("claude").join("projects").join(claude_folder_name(&scratch.workspace()));
        std::fs::remove_file(project.join("b.jsonl")).unwrap();
        synchronize(&scratch.workspace(), &scratch.database()).unwrap();
        let found = list(&scratch.workspace(), 10, Sorting::default(), &scratch.database()).unwrap();
        assert_eq!(found.claude.chats.iter().map(|chat| chat.title.as_str()).collect::<Vec<_>>(), vec!["Stays"]);
    }

    #[test]
    fn a_list_with_a_limit_tells_when_there_are_more_and_reads_the_next_page_without_a_synchronization() {
        let scratch = Scratch::new("pagination");
        for index in 0..3 {
            scratch.write_chat(&format!("c{index}"), &format!("Chat {index}"));
        }
        synchronize(&scratch.workspace(), &scratch.database()).unwrap();
        let first = list(&scratch.workspace(), 2, Sorting::default(), &scratch.database()).unwrap();
        assert_eq!((first.claude.chats.len(), first.claude.has_more), (2, true));
        let all = list(&scratch.workspace(), 3, Sorting::default(), &scratch.database()).unwrap();
        assert_eq!((all.claude.chats.len(), all.claude.has_more), (3, false));
    }

    #[test]
    fn sends_the_chat_to_the_web_page_with_the_names_of_the_fields_it_reads() {
        let scratch = Scratch::new("json");
        scratch.write_chat("a", "Fix the tab bar");
        synchronize(&scratch.workspace(), &scratch.database()).unwrap();
        let found = list(&scratch.workspace(), 10, Sorting::default(), &scratch.database()).unwrap();
        let json = serde_json::to_value(&found).unwrap();
        assert_eq!(json["claude"]["has_more"], false);
        assert_eq!(json["claude"]["chats"][0]["title"], "Fix the tab bar");
        assert_eq!(json["claude"]["chats"][0]["meta"]["user_messages"], 1);
        assert_eq!(json["claude"]["chats"][0]["meta"]["first_messages"][0], "Fix the tab bar");
        assert!(json["claude"]["chats"][0]["updated_at"].is_i64());
    }
}
