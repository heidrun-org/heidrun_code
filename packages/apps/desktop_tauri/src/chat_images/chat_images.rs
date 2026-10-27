//! The images that the developer pasted or dropped in a chat of Claude Code or of Codex, with the number of the text
//! `[Image #N]` of each one ([issue 790](https://github.com/heidrun-org/heidrun_code/issues/790),
//! [issue 924](https://github.com/heidrun-org/heidrun_code/issues/924)).
//!
//! The package `data_layer_coding_agents` reads the images from the chat session file at each call, because the images are not
//! copied into the SQLite file. This file opens no file itself.

use crate::application_log::data_layer_value;
use data_layer_coding_agents::{find_chat_images, find_codex_chat_id, ChatImageList};

/// Called by the Clipboard sidebar section with the chat session identifier of the pane: `hd_sid` for Claude Code, the
/// identifier that `chat_images_find_codex_chat` gives for Codex. Gives the key of every image of the chat, and the images whose key is above
/// `after_key`, so that a new call sends only the new images.
#[tauri::command]
pub async fn chat_images_find(session_id: String, after_key: u32) -> Result<ChatImageList, String> {
    // Off the main thread: the chat session file of a long chat is large.
    tauri::async_runtime::spawn_blocking(move || {
        data_layer_value("coding_agents", "find_chat_images", || find_chat_images(&session_id, after_key))
    })
    .await
    .map_err(|error| error.to_string())
}

/// Called by the Clipboard sidebar section for a Codex pane: the identifier of the chat of Codex that the pane shows, from
/// the title of its terminal and the folder where Codex runs. `None` when no chat matches.
#[tauri::command]
pub async fn chat_images_find_codex_chat(terminal_title: String, folder: String) -> Result<Option<String>, String> {
    // Off the main thread: the index of Codex and the first line of each chat with the same title are read.
    tauri::async_runtime::spawn_blocking(move || {
        data_layer_value("coding_agents", "find_codex_chat_id", || find_codex_chat_id(&terminal_title, &folder))
    })
    .await
    .map_err(|error| error.to_string())
}
