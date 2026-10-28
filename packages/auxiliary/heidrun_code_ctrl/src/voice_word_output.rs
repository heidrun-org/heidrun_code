//! The output of the orders on the word replacement list: Markdown for a person or a renderer such as glow, or JSON for a
//! program.

use crate::output::{to_json_text, Format};
use crate::voice_word_file::VoiceWord;
use serde_json::{json, Value};
use std::path::Path;

/// The text of the order `list`: the file and the entries in Markdown, or the list of the entries in JSON.
pub fn voice_word_list_text(words: &[VoiceWord], file: &Path, format: Format) -> String {
    match format {
        Format::Json => to_json_text(&Value::Array(words.iter().map(voice_word_json).collect())),
        Format::Markdown => {
            let mut text = format!("# Voice words\n\nFile: `{}`\n\n{}\n\n", file.display(), TEXTS_NOTE);
            if words.is_empty() {
                text.push_str("None.\n");
            }
            let blocks: Vec<String> = words.iter().map(voice_word_block).collect();
            text.push_str(&blocks.join("\n"));
            text
        }
    }
}

/// The text of the order `add` or `update`: a sentence and the entry in Markdown, or the entry in JSON.
pub fn voice_word_changed_text(verb: &str, word: &VoiceWord, file: &Path, format: Format) -> String {
    match format {
        Format::Json => to_json_text(&voice_word_json(word)),
        Format::Markdown => format!("{verb} the entry `{}` in the file `{}`.\n\n{}", word.id, file.display(), voice_word_block(word)),
    }
}

/// The text of the order `delete`: a sentence in Markdown, or the deleted entry in JSON.
pub fn voice_word_deleted_text(word: &VoiceWord, format: Format) -> String {
    match format {
        Format::Json => to_json_text(&json!({ "deleted": voice_word_json(word) })),
        Format::Markdown => format!("Deleted the entry `{}` ({}).\n", word.id, quoted(&word.whisper_writes)),
    }
}

/// The sentence that tells why the texts are between double quotes.
const TEXTS_NOTE: &str = "Each text is between double quotes, so that a space at its start or at its end is visible.";

/// An entry as a JSON object with the fields `id`, `whisper_writes`, and `heidrun_writes`.
fn voice_word_json(word: &VoiceWord) -> Value {
    serde_json::to_value(word).unwrap_or(Value::Null)
}

/// One entry in Markdown: its id as a heading, then the two texts.
fn voice_word_block(word: &VoiceWord) -> String {
    format!(
        "## {}\n\n- Whisper writes: {}\n- Heidrun Code writes instead: {}\n",
        word.id,
        quoted(&word.whisper_writes),
        quoted(&word.heidrun_writes)
    )
}

/// A text between double quotes. A quote, a backslash, and a new line inside the text are escaped as in JSON.
fn quoted(text: &str) -> String {
    serde_json::to_string(text).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn word(whisper_writes: &str, heidrun_writes: &str) -> VoiceWord {
        VoiceWord { id: "an-id".to_string(), whisper_writes: whisper_writes.to_string(), heidrun_writes: heidrun_writes.to_string() }
    }

    fn file() -> PathBuf {
        PathBuf::from("/data/voice_words.json")
    }

    #[test]
    fn the_markdown_list_has_the_file_and_one_block_for_each_entry_with_visible_spaces() {
        let text = voice_word_list_text(&[word(" at sign ", "@")], &file(), Format::Markdown);
        assert!(text.starts_with("# Voice words\n\nFile: `/data/voice_words.json`\n\n"));
        assert!(text.contains("## an-id\n\n- Whisper writes: \" at sign \"\n- Heidrun Code writes instead: \"@\"\n"));
        assert!(!text.contains("None."));
    }

    #[test]
    fn an_empty_markdown_list_says_none() {
        assert!(voice_word_list_text(&[], &file(), Format::Markdown).ends_with("None.\n"));
    }

    #[test]
    fn the_json_list_is_a_list_of_objects_with_three_fields() {
        let value: Value = serde_json::from_str(&voice_word_list_text(&[word(" at sign ", "@")], &file(), Format::Json)).unwrap();
        assert_eq!(value[0], json!({ "id": "an-id", "whisper_writes": " at sign ", "heidrun_writes": "@" }));
    }

    #[test]
    fn a_changed_entry_and_a_deleted_entry_have_a_sentence_in_markdown_and_an_object_in_json() {
        let item = word("one", "1");
        assert!(voice_word_changed_text("Added", &item, &file(), Format::Markdown)
            .starts_with("Added the entry `an-id` in the file `/data/voice_words.json`.\n\n## an-id"));
        assert_eq!(voice_word_deleted_text(&item, Format::Markdown), "Deleted the entry `an-id` (\"one\").\n");
        let value: Value = serde_json::from_str(&voice_word_deleted_text(&item, Format::Json)).unwrap();
        assert_eq!(value["deleted"]["whisper_writes"], "one");
        let changed: Value = serde_json::from_str(&voice_word_changed_text("Updated", &item, &file(), Format::Json)).unwrap();
        assert_eq!(changed["heidrun_writes"], "1");
    }

    #[test]
    fn a_quote_and_a_new_line_in_a_text_are_escaped() {
        let text = voice_word_list_text(&[word("say \"hi\"", "a\nb")], &file(), Format::Markdown);
        assert!(text.contains("- Whisper writes: \"say \\\"hi\\\"\"\n"));
        assert!(text.contains("- Heidrun Code writes instead: \"a\\nb\"\n"));
    }
}
