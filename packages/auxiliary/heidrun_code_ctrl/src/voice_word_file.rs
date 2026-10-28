//! The file of the word replacement list of the voice input: a JSON list of entries in the folder of the data of Heidrun Code.

use crate::personal_macros::{data_folder, write_file_aside};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// The name of the file of the word replacement list, in the folder of the data of Heidrun Code.
const VOICE_WORDS_FILE: &str = "voice_words.json";

/// One entry of the word replacement list: a text that Whisper writes wrongly, and the text that Heidrun Code writes instead.
/// The spaces at the ends of both texts are part of the texts.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct VoiceWord {
    /// The identifier of the entry. It is the same for ever, and no two entries have the same one.
    pub id: String,
    /// The text that Whisper writes. It cannot be empty.
    pub whisper_writes: String,
    /// The text that Heidrun Code writes instead. It may be empty: the entry then removes the text that Whisper writes.
    pub heidrun_writes: String,
}

/// The file of the word replacement list.
pub fn voice_words_path() -> PathBuf {
    data_folder().join(VOICE_WORDS_FILE)
}

/// Reads the word replacement list from the file `path`.
///
/// # Errors
/// The file cannot be read, is not a JSON list of entries, has two entries with the same id, or has an entry whose text that
/// Whisper writes is empty. The file is never changed in this case, so a file written by hand with a mistake is never lost.
///
/// # Returns
/// `None` when the file does not exist, else the entries in the order of the file.
pub fn read_voice_words(path: &Path) -> Result<Option<Vec<VoiceWord>>, String> {
    let text = match std::fs::read_to_string(path) {
        Ok(text) => text,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("The file {} cannot be read: {error}", path.display())),
    };
    let words: Vec<VoiceWord> = serde_json::from_str(&text).map_err(|error| {
        format!(
            "The file {} is not a list of entries with the fields id, whisper_writes, and heidrun_writes: {error}",
            path.display()
        )
    })?;
    for (index, word) in words.iter().enumerate() {
        if words[..index].iter().any(|before| before.id == word.id) {
            return Err(format!("The file {} has two entries with the id {}.", path.display(), word.id));
        }
        if word.whisper_writes.trim().is_empty() {
            return Err(format!("The file {} has the entry {} with no text that Whisper writes.", path.display(), word.id));
        }
    }
    Ok(Some(words))
}

/// Writes the word replacement list to the file `path`, as a JSON list on several lines. The folder is created when it does
/// not exist.
///
/// # Errors
/// The folder or the file cannot be written.
pub fn write_voice_words(path: &Path, words: &[VoiceWord]) -> Result<(), String> {
    let mut text = serde_json::to_string_pretty(words).map_err(|error| error.to_string())?;
    text.push('\n');
    write_file_aside(path, &text)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A new empty folder for one test.
    fn test_folder(name: &str) -> PathBuf {
        let folder = std::env::temp_dir().join(format!("heidrun_code_ctrl_voice_words_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        std::fs::create_dir_all(&folder).unwrap();
        folder
    }

    fn sample(id: &str, whisper_writes: &str) -> VoiceWord {
        VoiceWord { id: id.to_string(), whisper_writes: whisper_writes.to_string(), heidrun_writes: format!("Right {id}") }
    }

    #[test]
    fn a_missing_file_gives_none() {
        let folder = test_folder("missing");
        assert_eq!(read_voice_words(&folder.join("voice_words.json")), Ok(None));
    }

    #[test]
    fn the_file_is_voice_words_json_in_the_folder_of_the_data() {
        assert_eq!(voice_words_path(), data_folder().join("voice_words.json"));
    }

    #[test]
    fn a_written_file_is_read_back_the_same_with_the_spaces_at_the_ends_of_the_texts() {
        let folder = test_folder("round_trip");
        let path = folder.join("deeper").join("voice_words.json");
        let words = vec![sample("a", " at sign "), sample("b", "jerome")];
        write_voice_words(&path, &words).unwrap();
        assert_eq!(read_voice_words(&path), Ok(Some(words)));
        assert!(std::fs::read_to_string(&path).unwrap().ends_with("]\n"));
        assert!(!folder.join("deeper").join("voice_words.json.aside").exists());
    }

    #[test]
    fn a_file_that_is_not_a_list_of_entries_is_an_error_and_stays_as_it_is() {
        let folder = test_folder("not_valid");
        let path = folder.join("voice_words.json");
        std::fs::write(&path, r#"{"id":"x"}"#).unwrap();
        assert!(read_voice_words(&path).unwrap_err().contains("is not a list of entries"));
        assert_eq!(std::fs::read_to_string(&path).unwrap(), r#"{"id":"x"}"#);
    }

    #[test]
    fn an_entry_with_a_missing_field_is_an_error() {
        let folder = test_folder("missing_field");
        let path = folder.join("voice_words.json");
        std::fs::write(&path, r#"[{"id":"x","whisper_writes":"a"}]"#).unwrap();
        assert!(read_voice_words(&path).unwrap_err().contains("heidrun_writes"));
    }

    #[test]
    fn two_entries_with_the_same_id_are_an_error() {
        let folder = test_folder("same_id");
        let path = folder.join("voice_words.json");
        write_voice_words(&path, &[sample("a", "one"), sample("a", "two")]).unwrap();
        assert!(read_voice_words(&path).unwrap_err().contains("two entries with the id a"));
    }

    #[test]
    fn an_entry_with_only_spaces_for_the_text_that_whisper_writes_is_an_error() {
        let folder = test_folder("empty_text");
        let path = folder.join("voice_words.json");
        write_voice_words(&path, &[sample("a", "  ")]).unwrap();
        assert!(read_voice_words(&path).unwrap_err().contains("no text that Whisper writes"));
    }

    #[test]
    fn an_empty_file_that_is_not_json_is_an_error() {
        let folder = test_folder("not_json");
        let path = folder.join("voice_words.json");
        std::fs::write(&path, "").unwrap();
        assert!(read_voice_words(&path).is_err());
    }
}
