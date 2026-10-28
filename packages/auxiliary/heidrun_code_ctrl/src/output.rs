//! The output of the orders: Markdown for a person or a renderer such as glow, or JSON for a program. There is no format
//! with colors: the developer sends the Markdown to a renderer.

use crate::macro_orders::MacroPlaces;
use crate::macro_types::{ListedMacro, MacroKind};
use serde_json::{json, Value};

/// The format of the output.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum Format {
    /// Markdown text.
    #[default]
    Markdown,
    /// JSON text.
    Json,
}

impl Format {
    /// The format that has this name: `markdown` or `json`.
    pub fn from_name(name: &str) -> Option<Format> {
        match name {
            "markdown" => Some(Format::Markdown),
            "json" => Some(Format::Json),
            _ => None,
        }
    }
}

/// The text of the order `list`: the macros grouped by kind in Markdown, or the list of the macros in JSON. `only` is the
/// kind that the developer asked for: Markdown then has the section of that kind only.
pub fn list_text(listed: &[ListedMacro], places: &MacroPlaces, only: Option<MacroKind>, format: Format) -> String {
    match format {
        Format::Json => to_json_text(&Value::Array(listed.iter().map(macro_json).collect())),
        Format::Markdown => list_markdown(listed, places, only),
    }
}

/// The text of the order `add` or `update`: a sentence and the macro in Markdown, or the macro in JSON.
pub fn changed_text(verb: &str, listed: &ListedMacro, format: Format) -> String {
    match format {
        Format::Json => to_json_text(&macro_json(listed)),
        Format::Markdown => format!(
            "{verb} the {} macro `{}`.\n\n{}",
            listed.kind.words(),
            listed.content.id,
            macro_block(listed, 3, true)
        ),
    }
}

/// The text of the order `delete`: a sentence in Markdown, or the deleted macro in JSON.
pub fn deleted_text(listed: &ListedMacro, format: Format) -> String {
    match format {
        Format::Json => to_json_text(&json!({ "deleted": macro_json(listed) })),
        Format::Markdown => {
            format!("Deleted the {} macro `{}` ({}).\n", listed.kind.words(), listed.content.id, listed.content.label)
        }
    }
}

/// The text of an error: `Error: <message>` in Markdown, or one JSON object on one line with the field `error`.
pub fn error_text(message: &str, format: Format) -> String {
    match format {
        Format::Json => json!({ "error": message }).to_string(),
        Format::Markdown => format!("Error: {message}"),
    }
}

/// A macro as a JSON object: its fields, its kind, and its file.
fn macro_json(listed: &ListedMacro) -> Value {
    serde_json::to_value(listed).unwrap_or(Value::Null)
}

/// A JSON value on several lines, with a new line at the end.
pub(crate) fn to_json_text(value: &Value) -> String {
    let mut text = serde_json::to_string_pretty(value).unwrap_or_default();
    text.push('\n');
    text
}

/// The list in Markdown: a count for each kind, then one section for each kind.
fn list_markdown(listed: &[ListedMacro], places: &MacroPlaces, only: Option<MacroKind>) -> String {
    let all_kinds = [MacroKind::HardCoded, MacroKind::Personal, MacroKind::Project];
    let kinds: Vec<MacroKind> = all_kinds.into_iter().filter(|kind| only.is_none_or(|wanted| wanted == *kind)).collect();
    let of_kind = |kind: MacroKind| listed.iter().filter(move |item| item.kind == kind);
    let mut text = String::from("# Macros\n\n");
    for kind in &kinds {
        text.push_str(&format!("- {}: {}\n", kind.name(), of_kind(*kind).count()));
    }
    for kind in kinds {
        text.push_str(&format!("\n## {} macros\n\n", capitalized(kind.words())));
        match kind {
            MacroKind::HardCoded => text.push_str("Written in the source code of Heidrun Code. They cannot be changed.\n\n"),
            MacroKind::Personal => text.push_str(&format!("File: `{}`\n\n", places.personal_file.display())),
            MacroKind::Project => {
                text.push_str(&format!("File: `{}`\n\n", crate::project_config_file::project_config_path(&places.project_root).display()));
            }
        }
        if of_kind(kind).next().is_none() {
            text.push_str("None.\n");
        }
        let blocks: Vec<String> = of_kind(kind).map(|item| macro_block(item, 3, false)).collect();
        text.push_str(&blocks.join("\n"));
    }
    text
}

/// One macro in Markdown: its title as a heading, its id, its kind, its description, and its text in a code block. The
/// code block uses more backquotes than the longest run of backquotes in the text, so a text with a code block is safe.
fn macro_block(listed: &ListedMacro, level: usize, has_file: bool) -> String {
    let mut text = format!("{} {}\n\n- id: `{}`\n- kind: {}\n", "#".repeat(level), listed.content.label, listed.content.id, listed.kind.name());
    if has_file {
        if let Some(file) = &listed.file {
            text.push_str(&format!("- file: `{}`\n", file.display()));
        }
    }
    if !listed.content.description.is_empty() {
        text.push_str(&format!("- description: {}\n", listed.content.description));
    }
    let fence = "`".repeat(longest_run_of_backquotes(&listed.content.text).max(2) + 1);
    text.push_str(&format!("\n{fence}text\n{}\n{fence}\n", listed.content.text));
    text
}

/// The number of backquotes in the longest run of backquotes of a text.
pub(crate) fn longest_run_of_backquotes(text: &str) -> usize {
    let mut longest = 0;
    let mut current = 0;
    for character in text.chars() {
        if character == '`' {
            current += 1;
            longest = longest.max(current);
        } else {
            current = 0;
        }
    }
    longest
}

/// A text with its first letter in upper case.
fn capitalized(text: &str) -> String {
    let mut characters = text.chars();
    match characters.next() {
        Some(first) => first.to_uppercase().collect::<String>() + characters.as_str(),
        None => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::macro_types::Macro;
    use std::path::PathBuf;

    fn places() -> MacroPlaces {
        MacroPlaces { personal_file: PathBuf::from("/data/macros.json"), project_root: PathBuf::from("/project") }
    }

    fn listed(kind: MacroKind, text: &str) -> ListedMacro {
        ListedMacro {
            content: Macro { id: "an-id".into(), label: "A title".into(), description: "A description".into(), text: text.into() },
            kind,
            file: if kind == MacroKind::HardCoded { None } else { Some(PathBuf::from("/data/macros.json")) },
        }
    }

    #[test]
    fn the_markdown_list_has_a_count_and_a_section_for_each_kind() {
        let text = list_text(&[listed(MacroKind::Personal, "Hello")], &places(), None, Format::Markdown);
        assert!(text.starts_with("# Macros\n\n- hard_coded: 0\n- personal: 1\n- project: 0\n"));
        for heading in ["## Hard-coded macros", "## Personal macros", "## Project macros"] {
            assert!(text.contains(heading), "{heading}");
        }
        assert!(text.contains("File: `/data/macros.json`"));
        assert!(text.contains("File: `/project/.heidrun/config.json`"));
        assert!(text.contains("### A title\n\n- id: `an-id`\n- kind: personal\n- description: A description\n\n```text\nHello\n```\n"));
        assert!(text.contains("None.\n"));
    }

    #[test]
    fn a_list_of_one_kind_has_the_section_and_the_count_of_that_kind_only() {
        let text = list_text(&[listed(MacroKind::Personal, "Hello")], &places(), Some(MacroKind::Personal), Format::Markdown);
        assert!(text.starts_with("# Macros\n\n- personal: 1\n"));
        assert!(text.contains("## Personal macros"));
        assert!(!text.contains("## Hard-coded macros") && !text.contains("## Project macros"));
    }

    #[test]
    fn the_code_block_is_longer_than_the_backquotes_of_the_text() {
        let text = list_text(&[listed(MacroKind::Personal, "Explain:\n\n```\n{selection}\n```")], &places(), None, Format::Markdown);
        assert!(text.contains("````text\nExplain:\n\n```\n{selection}\n```\n````\n"));
    }

    #[test]
    fn the_json_list_is_a_list_of_objects_with_the_fields_the_kind_and_the_file() {
        let text = list_text(&[listed(MacroKind::HardCoded, "Hello"), listed(MacroKind::Project, "World")], &places(), None, Format::Json);
        let value: Value = serde_json::from_str(&text).unwrap();
        assert_eq!(value[0]["kind"], "hard_coded");
        assert_eq!(value[0]["file"], Value::Null);
        assert_eq!(value[1]["kind"], "project");
        assert_eq!(value[1]["file"], "/data/macros.json");
        assert_eq!(value[1]["text"], "World");
        assert_eq!(value[1]["id"], "an-id");
    }

    #[test]
    fn an_error_is_text_in_markdown_and_one_line_of_json_in_json() {
        assert_eq!(error_text("Boom", Format::Markdown), "Error: Boom");
        assert_eq!(error_text("Boom", Format::Json), r#"{"error":"Boom"}"#);
    }

    #[test]
    fn a_changed_macro_and_a_deleted_macro_have_a_sentence_in_markdown_and_an_object_in_json() {
        let item = listed(MacroKind::Personal, "Hello");
        assert!(changed_text("Added", &item, Format::Markdown).starts_with("Added the personal macro `an-id`.\n\n### A title"));
        assert_eq!(deleted_text(&item, Format::Markdown), "Deleted the personal macro `an-id` (A title).\n");
        let value: Value = serde_json::from_str(&deleted_text(&item, Format::Json)).unwrap();
        assert_eq!(value["deleted"]["id"], "an-id");
    }
}
