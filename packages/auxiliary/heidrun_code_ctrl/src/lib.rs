//! `heidrun_code_ctrl`: the command line that controls the Heidrun Code application, for a coding agent.
//!
//! This library shares the macro, launcher, and voice word file operations with the desktop application.
//! The binary also controls workspaces through Herdr; those operations stay outside this library.
//! The macros, the launchers, and the word replacement list of the voice input each have four orders. The orders are list,
//! add, update, and delete. The library holds what the command line and the desktop application share, so that the format
//! of each file has one place: the hard-coded macros, the file of the personal macros, the keys `prompts` and `launchers`
//! of the file `.heidrun/config.json`, the file of the user level launchers, the file of the word replacement list, the
//! orders, and the output. The package knows nothing about Tauri.

mod hard_coded_macros;
mod ids;
mod launcher_orders;
mod launcher_output;
mod launcher_types;
mod macro_orders;
mod macro_types;
mod output;
mod personal_macros;
mod project_config_file;
mod project_launchers;
mod project_macros;
mod user_launchers;
mod voice_word_file;
mod voice_word_orders;
mod voice_word_output;

pub use hard_coded_macros::hard_coded_macros;
pub use launcher_orders::{
    add_launcher, delete_launcher, label_from_command, list_launchers, update_launcher, LauncherChanges, NewLauncher,
};
pub use launcher_output::{launcher_changed_text, launcher_deleted_text, launcher_list_text};
pub use launcher_types::Launcher;
pub use macro_orders::{add_macro, delete_macro, list_macros, update_macro, MacroChanges, MacroPlaces, NewMacro};
pub use macro_types::{ListedMacro, Macro, MacroKind};
pub use output::{changed_text, deleted_text, error_text, list_text, Format};
pub use personal_macros::{data_folder, personal_macros_path, read_personal_macros, write_personal_macros};
pub use project_config_file::{find_project_root, project_config_path};
pub use project_launchers::read_project_launchers;
pub use project_macros::read_project_macros;
pub use user_launchers::{read_user_launchers, user_launchers_path, write_user_launchers};
pub use voice_word_file::{read_voice_words, voice_words_path, write_voice_words, VoiceWord};
pub use voice_word_orders::{add_voice_word, delete_voice_word, list_voice_words, update_voice_word, NewVoiceWord, VoiceWordChanges};
pub use voice_word_output::{voice_word_changed_text, voice_word_deleted_text, voice_word_list_text};
