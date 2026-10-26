//! The four orders on the word replacement list: list, add, update, and delete.

use crate::ids::unused_id;
use crate::macro_orders::slug;
use crate::voice_word_file::{read_voice_words, write_voice_words, VoiceWord};
use std::path::Path;

/// What the order `add` makes.
#[derive(Debug, Clone, Default)]
pub struct NewVoiceWord {
    /// The id of the entry. `None` makes an id from the text that Whisper writes and three random characters.
    pub id: Option<String>,
    /// The text that Whisper writes. It cannot be empty. The spaces at its ends are part of the text.
    pub whisper_writes: String,
    /// The text that Heidrun Code writes instead. It may be empty.
    pub heidrun_writes: String,
}

/// What the order `update` changes. A field that is `None` stays as it is.
#[derive(Debug, Clone, Default)]
pub struct VoiceWordChanges {
    /// The new text that Whisper writes. It cannot be empty.
    pub whisper_writes: Option<String>,
    /// The new text that Heidrun Code writes instead. It may be empty.
    pub heidrun_writes: Option<String>,
}

/// Lists the entries of the word replacement list, in the order of the file.
///
/// # Errors
/// The file cannot be read or is not valid.
pub fn list_voice_words(path: &Path) -> Result<Vec<VoiceWord>, String> {
    Ok(read_voice_words(path)?.unwrap_or_default())
}

/// Adds an entry at the end of the list.
///
/// # Errors
/// The text that Whisper writes is empty or has only spaces, another entry has the same text that Whisper writes (the case
/// of the letters does not count), the id is empty or already taken, or the file cannot be read, is not valid, or cannot be
/// written.
pub fn add_voice_word(path: &Path, new: NewVoiceWord) -> Result<VoiceWord, String> {
    check_whisper_writes(&new.whisper_writes)?;
    let mut words = list_voice_words(path)?;
    check_not_a_copy(&words, &new.whisper_writes, None)?;
    let taken: Vec<String> = words.iter().map(|word| word.id.clone()).collect();
    let id = match new.id {
        Some(id) if id.trim().is_empty() => return Err("The id of an entry cannot be empty.".to_string()),
        Some(id) if taken.contains(&id) => return Err(format!("An entry with the id {id} already exists.")),
        Some(id) => id,
        None => unused_id(&id_base_of(&new.whisper_writes), 3, &taken),
    };
    let word = VoiceWord { id, whisper_writes: new.whisper_writes, heidrun_writes: new.heidrun_writes };
    words.push(word.clone());
    write_voice_words(path, &words)?;
    Ok(word)
}

/// Changes the entry `id`.
///
/// # Errors
/// No change is given, no entry has the id, the new text that Whisper writes is empty or has only spaces, another entry has
/// the same text that Whisper writes, or the file cannot be read, is not valid, or cannot be written.
pub fn update_voice_word(path: &Path, id: &str, changes: VoiceWordChanges) -> Result<VoiceWord, String> {
    if changes.whisper_writes.is_none() && changes.heidrun_writes.is_none() {
        return Err("Give at least one of --whisper-writes and --heidrun-writes.".to_string());
    }
    if let Some(whisper_writes) = &changes.whisper_writes {
        check_whisper_writes(whisper_writes)?;
    }
    let mut words = list_voice_words(path)?;
    let index = index_of(&words, id)?;
    if let Some(whisper_writes) = &changes.whisper_writes {
        check_not_a_copy(&words, whisper_writes, Some(id))?;
    }
    if let Some(whisper_writes) = changes.whisper_writes {
        words[index].whisper_writes = whisper_writes;
    }
    if let Some(heidrun_writes) = changes.heidrun_writes {
        words[index].heidrun_writes = heidrun_writes;
    }
    write_voice_words(path, &words)?;
    Ok(words[index].clone())
}

/// Deletes the entry `id`.
///
/// # Errors
/// No entry has the id, or the file cannot be read, is not valid, or cannot be written.
pub fn delete_voice_word(path: &Path, id: &str) -> Result<VoiceWord, String> {
    let mut words = list_voice_words(path)?;
    let index = index_of(&words, id)?;
    let deleted = words.remove(index);
    write_voice_words(path, &words)?;
    Ok(deleted)
}

/// The position of the entry `id`.
fn index_of(words: &[VoiceWord], id: &str) -> Result<usize, String> {
    words
        .iter()
        .position(|word| word.id == id)
        .ok_or_else(|| format!("No entry has the id {id}. Run `heidrun_code_ctrl voice_words list` to see the ids."))
}

/// The text that Whisper writes is not empty and not only spaces.
fn check_whisper_writes(whisper_writes: &str) -> Result<(), String> {
    if whisper_writes.trim().is_empty() {
        return Err("The text that Whisper writes cannot be empty.".to_string());
    }
    Ok(())
}

/// No other entry than `own_id` has the same text that Whisper writes, in lower case: it would never be used.
fn check_not_a_copy(words: &[VoiceWord], whisper_writes: &str, own_id: Option<&str>) -> Result<(), String> {
    let lower = whisper_writes.to_lowercase();
    match words.iter().find(|word| Some(word.id.as_str()) != own_id && word.whisper_writes.to_lowercase() == lower) {
        Some(other) => Err(format!(
            "The entry {} already has the text that Whisper writes {:?}. Update it, or give another text.",
            other.id, whisper_writes
        )),
        None => Ok(()),
    }
}

/// The start of an id: the text that Whisper writes as a slug, or `word` when it has no letter and no digit.
fn id_base_of(whisper_writes: &str) -> String {
    if whisper_writes.chars().any(char::is_alphanumeric) {
        slug(whisper_writes)
    } else {
        "word".to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    /// The file of one test, in a new empty folder.
    fn file_of(name: &str) -> PathBuf {
        let base = std::env::temp_dir().join(format!("heidrun_code_ctrl_voice_orders_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        std::fs::create_dir_all(&base).unwrap();
        base.join("data").join("voice_words.json")
    }

    fn new_word(whisper_writes: &str, heidrun_writes: &str) -> NewVoiceWord {
        NewVoiceWord { id: None, whisper_writes: whisper_writes.to_string(), heidrun_writes: heidrun_writes.to_string() }
    }

    #[test]
    fn the_list_is_empty_when_the_file_does_not_exist() {
        assert_eq!(list_voice_words(&file_of("list_empty")), Ok(Vec::new()));
    }

    #[test]
    fn an_added_entry_is_listed_with_an_id_made_from_the_text_that_whisper_writes() {
        let path = file_of("add");
        let added = add_voice_word(&path, new_word("Jerome Etienne", "Jérôme Étienne")).unwrap();
        assert!(added.id.starts_with("jerome-etienne-"));
        assert_eq!(list_voice_words(&path).unwrap(), vec![added]);
    }

    #[test]
    fn the_spaces_at_the_ends_of_the_texts_are_kept() {
        let path = file_of("spaces");
        let added = add_voice_word(&path, new_word(" at sign ", "@")).unwrap();
        assert_eq!(added.whisper_writes, " at sign ");
        assert_eq!(list_voice_words(&path).unwrap()[0].whisper_writes, " at sign ");
        assert!(added.id.starts_with("at-sign-"));
    }

    #[test]
    fn an_entry_with_no_letter_and_no_digit_gets_an_id_that_starts_with_word() {
        let added = add_voice_word(&file_of("sign_id"), new_word("@", "at")).unwrap();
        assert!(added.id.starts_with("word-"));
    }

    #[test]
    fn a_given_id_is_used_and_an_id_that_is_taken_or_empty_is_refused() {
        let path = file_of("given_id");
        let first = NewVoiceWord { id: Some("mine".to_string()), ..new_word("one", "1") };
        assert_eq!(add_voice_word(&path, first).unwrap().id, "mine");
        let second = NewVoiceWord { id: Some("mine".to_string()), ..new_word("two", "2") };
        assert!(add_voice_word(&path, second).unwrap_err().contains("id mine already exists"));
        let third = NewVoiceWord { id: Some(" ".to_string()), ..new_word("three", "3") };
        assert!(add_voice_word(&path, third).unwrap_err().contains("cannot be empty"));
        assert_eq!(list_voice_words(&path).unwrap().len(), 1);
    }

    #[test]
    fn an_empty_text_that_whisper_writes_is_refused_and_an_empty_replacement_is_allowed() {
        let path = file_of("empty");
        assert_eq!(add_voice_word(&path, new_word("", "x")), Err("The text that Whisper writes cannot be empty.".to_string()));
        assert!(add_voice_word(&path, new_word("   ", "x")).is_err());
        assert!(!path.exists());
        assert_eq!(add_voice_word(&path, new_word("um", "")).unwrap().heidrun_writes, "");
    }

    #[test]
    fn a_second_entry_with_the_same_text_that_whisper_writes_is_refused_whatever_the_case() {
        let path = file_of("copy");
        add_voice_word(&path, new_word("Jerome", "Jérôme")).unwrap();
        let error = add_voice_word(&path, new_word("JEROME", "Other")).unwrap_err();
        assert!(error.contains("already has the text that Whisper writes"), "{error}");
        assert_eq!(add_voice_word(&path, new_word("jerome ", "Other")).map(|word| word.heidrun_writes), Ok("Other".to_string()));
    }

    #[test]
    fn an_update_changes_only_the_given_fields_and_keeps_the_place_and_the_id() {
        let path = file_of("update");
        let first = add_voice_word(&path, new_word("one", "1")).unwrap();
        let second = add_voice_word(&path, new_word("two", "2")).unwrap();
        let changes = VoiceWordChanges { whisper_writes: None, heidrun_writes: Some("deux".to_string()) };
        let updated = update_voice_word(&path, &first.id, changes).unwrap();
        assert_eq!(updated, VoiceWord { heidrun_writes: "deux".to_string(), ..first.clone() });
        assert_eq!(list_voice_words(&path).unwrap(), vec![updated, second]);
        let changes = VoiceWordChanges { whisper_writes: Some("uno".to_string()), heidrun_writes: None };
        assert_eq!(update_voice_word(&path, &first.id, changes).unwrap().heidrun_writes, "deux");
    }

    #[test]
    fn an_update_can_keep_the_text_of_the_entry_but_cannot_take_the_text_of_another() {
        let path = file_of("update_copy");
        let first = add_voice_word(&path, new_word("one", "1")).unwrap();
        add_voice_word(&path, new_word("two", "2")).unwrap();
        let same = VoiceWordChanges { whisper_writes: Some("ONE".to_string()), heidrun_writes: None };
        assert_eq!(update_voice_word(&path, &first.id, same).unwrap().whisper_writes, "ONE");
        let other = VoiceWordChanges { whisper_writes: Some("Two".to_string()), heidrun_writes: None };
        assert!(update_voice_word(&path, &first.id, other).unwrap_err().contains("already has the text"));
        let empty = VoiceWordChanges { whisper_writes: Some(" ".to_string()), heidrun_writes: None };
        assert!(update_voice_word(&path, &first.id, empty).is_err());
    }

    #[test]
    fn an_update_needs_a_change_and_a_known_id() {
        let path = file_of("update_errors");
        let first = add_voice_word(&path, new_word("one", "1")).unwrap();
        assert!(update_voice_word(&path, &first.id, VoiceWordChanges::default()).unwrap_err().contains("Give at least one"));
        let changes = VoiceWordChanges { heidrun_writes: Some("x".to_string()), ..VoiceWordChanges::default() };
        assert!(update_voice_word(&path, "nope", changes).unwrap_err().contains("No entry has the id nope"));
    }

    #[test]
    fn a_delete_removes_the_entry_and_gives_it_back() {
        let path = file_of("delete");
        let first = add_voice_word(&path, new_word("one", "1")).unwrap();
        let second = add_voice_word(&path, new_word("two", "2")).unwrap();
        assert_eq!(delete_voice_word(&path, &first.id), Ok(first.clone()));
        assert_eq!(list_voice_words(&path).unwrap(), vec![second]);
        assert!(delete_voice_word(&path, &first.id).unwrap_err().contains("No entry has the id"));
    }

    #[test]
    fn a_file_that_is_not_valid_stops_every_order_and_stays_as_it_is() {
        let path = file_of("invalid");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, "not json").unwrap();
        assert!(list_voice_words(&path).is_err());
        assert!(add_voice_word(&path, new_word("a", "b")).is_err());
        assert!(delete_voice_word(&path, "a").is_err());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "not json");
    }
}
