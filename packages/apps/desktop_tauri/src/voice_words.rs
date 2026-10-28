//! The word replacement list of the voice input, the Tauri side: the commands of the Voice input section of the Settings window,
//! and the replacement in the text that Whisper gives.
//!
//! The format of the file and the four orders have one place, the package `heidrun_code_ctrl`, which the command line `heidrun_code_ctrl`
//! uses too. The web frontend reads the file again about every second while the Voice input section is open, so a change that
//! the command line makes shows in the window. The window changes the list with the orders of the package, and never writes the
//! whole list, so a change of the command line is never overwritten by an old list.

use heidrun_code_ctrl::{
    add_voice_word, delete_voice_word, list_voice_words, update_voice_word, voice_words_path, NewVoiceWord, VoiceWord,
    VoiceWordChanges,
};
use serde::Serialize;
use std::path::Path;
use voice_input::replace_words;

/// What the file of the word replacement list holds.
#[derive(Serialize, Debug, PartialEq)]
pub struct VoiceWordsFile {
    /// The entries of the file, in its order. Empty when the file does not exist or is not valid.
    pub words: Vec<VoiceWord>,
    /// Why the file cannot be read. The window then changes nothing, and the voice input uses no replacement.
    pub error: Option<String>,
}

/// Reads the file of the word replacement list at `path`.
fn read_file(path: &Path) -> VoiceWordsFile {
    match list_voice_words(path) {
        Ok(words) => VoiceWordsFile { words, error: None },
        Err(error) => VoiceWordsFile { words: Vec::new(), error: Some(error) },
    }
}

/// Replaces the listed texts in `text` with the list of the file at `path`. A file that cannot be read gives the text as it is
/// and one line in the terminal of the developer, because the speech must never be lost for a mistake in the list.
fn replace_with_file(text: &str, path: &Path) -> String {
    match list_voice_words(path) {
        Ok(words) => {
            let pairs: Vec<(String, String)> = words.into_iter().map(|word| (word.whisper_writes, word.heidrun_writes)).collect();
            replace_words(text, &pairs)
        }
        Err(error) => {
            eprintln!("voice input: the word replacement list is not used: {error}");
            text.to_string()
        }
    }
}

/// Replaces the listed texts in the text that Whisper gave, with the file `voice_words.json` of the folder of the data of
/// Heidrun Code.
pub fn replace_spoken_words(text: &str) -> String {
    replace_with_file(text, &voice_words_path())
}

/// The word replacement list: the content of the file `voice_words.json` of the folder of the data of Heidrun Code.
#[tauri::command]
pub fn voice_words_read() -> VoiceWordsFile {
    read_file(&voice_words_path())
}

/// Adds an entry at the end of the word replacement list, and gives it back with its id.
#[tauri::command]
pub fn voice_words_add(whisper_writes: String, heidrun_writes: String) -> Result<VoiceWord, String> {
    add_voice_word(&voice_words_path(), NewVoiceWord { id: None, whisper_writes, heidrun_writes })
}

/// Changes the entry `id`. A text that is `None` stays as it is.
#[tauri::command]
pub fn voice_words_update(id: String, whisper_writes: Option<String>, heidrun_writes: Option<String>) -> Result<VoiceWord, String> {
    update_voice_word(&voice_words_path(), &id, VoiceWordChanges { whisper_writes, heidrun_writes })
}

/// Deletes the entry `id`, and gives it back.
#[tauri::command]
pub fn voice_words_delete(id: String) -> Result<VoiceWord, String> {
    delete_voice_word(&voice_words_path(), &id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use heidrun_code_ctrl::write_voice_words;
    use std::path::PathBuf;

    fn test_file(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("heidrun_voice_words_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        folder.join("voice_words.json")
    }

    fn word(id: &str, whisper_writes: &str, heidrun_writes: &str) -> VoiceWord {
        VoiceWord { id: id.into(), whisper_writes: whisper_writes.into(), heidrun_writes: heidrun_writes.into() }
    }

    #[test]
    fn a_missing_file_gives_no_entry_and_no_error() {
        let file = read_file(&test_file("missing"));
        assert_eq!(file, VoiceWordsFile { words: Vec::new(), error: None });
    }

    #[test]
    fn a_file_that_is_not_valid_gives_an_error_and_no_entry() {
        let path = test_file("invalid");
        std::fs::write(&path, "not json").unwrap();
        let file = read_file(&path);
        assert!(file.words.is_empty() && file.error.is_some());
    }

    #[test]
    fn a_written_file_is_read_back_and_the_fields_keep_their_snake_case_names() {
        let path = test_file("round_trip");
        let words = vec![word("a", " at sign ", "@")];
        write_voice_words(&path, &words).unwrap();
        let file = read_file(&path);
        assert_eq!(file, VoiceWordsFile { words, error: None });
        let value = serde_json::to_value(&file).unwrap();
        assert_eq!(value["words"][0]["whisper_writes"], " at sign ");
        assert_eq!(value["words"][0]["heidrun_writes"], "@");
        assert!(value["error"].is_null());
    }

    #[test]
    fn the_text_of_whisper_is_replaced_with_the_list_of_the_file() {
        let path = test_file("replace");
        write_voice_words(&path, &[word("a", "jerome etienne", "Jérôme Étienne"), word("b", " at sign ", "@")]).unwrap();
        assert_eq!(replace_with_file("Jerome Etienne at sign example", &path), "Jérôme Étienne@example");
    }

    #[test]
    fn a_replacement_is_matched_again_by_the_other_entries_of_the_file() {
        let path = test_file("replace_chain");
        write_voice_words(&path, &[word("a", "hadron", "Heidrun"), word("b", "heidrun card", "Heidrun Code")]).unwrap();
        assert_eq!(replace_with_file("Open hadron card now", &path), "Open Heidrun Code now");
    }

    #[test]
    fn a_list_in_the_file_that_loops_gives_the_text_of_the_first_pass() {
        let path = test_file("replace_loop");
        write_voice_words(&path, &[word("a", "cat", "cat cat"), word("b", "dog", "cat")]).unwrap();
        assert_eq!(replace_with_file("dog", &path), "cat");
    }

    #[test]
    fn a_missing_file_leaves_the_text_as_it_is() {
        assert_eq!(replace_with_file("Hello world", &test_file("replace_missing")), "Hello world");
    }

    #[test]
    fn a_file_that_is_not_valid_leaves_the_text_as_it_is_and_the_file_unchanged() {
        let path = test_file("replace_invalid");
        std::fs::write(&path, "[ not json").unwrap();
        assert_eq!(replace_with_file("Hello world", &path), "Hello world");
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "[ not json");
    }

    #[test]
    fn the_orders_of_the_package_change_the_file_that_the_window_reads() {
        let path = test_file("orders");
        let added = add_voice_word(&path, NewVoiceWord { id: None, whisper_writes: "one".into(), heidrun_writes: "1".into() }).unwrap();
        assert_eq!(read_file(&path).words, vec![added.clone()]);
        let changes = VoiceWordChanges { whisper_writes: None, heidrun_writes: Some("uno".into()) };
        update_voice_word(&path, &added.id, changes).unwrap();
        assert_eq!(read_file(&path).words[0].heidrun_writes, "uno");
        delete_voice_word(&path, &added.id).unwrap();
        assert!(read_file(&path).words.is_empty());
    }
}
