//! The images that the developer pasted or dropped in a chat of Claude Code, with the number of the text `[Image #N]` of each
//! one ([issue 790](https://github.com/heidrun-org/heidrun_code/issues/790)).
//!
//! The package `data_layer_coding_agents` reads the images from the chat session file at each call, because the images are not
//! copied into the SQLite file. This file opens no file itself.

use crate::application_log::data_layer_value;
use data_layer_coding_agents::{find_chat_images, ChatImageList};

/// Called by the Clipboard sidebar section with the chat session identifier of the pane (`hd_sid`). Gives the number of every
/// image of the chat, and the images whose number is above `after_number`, so that a new call sends only the new images.
#[tauri::command]
pub async fn chat_images_find(session_id: String, after_number: u32) -> Result<ChatImageList, String> {
    // Off the main thread: the chat session file of a long chat is large.
    tauri::async_runtime::spawn_blocking(move || {
        data_layer_value("coding_agents", "find_chat_images", || find_chat_images(&session_id, after_number))
    })
    .await
    .map_err(|error| error.to_string())
}
