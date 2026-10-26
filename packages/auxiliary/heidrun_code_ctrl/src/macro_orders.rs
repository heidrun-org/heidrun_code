//! The four orders on the macros: list, add, update, and delete.

use crate::hard_coded_macros::hard_coded_macros;
use crate::ids::unused_id;
use crate::macro_types::{ListedMacro, Macro, MacroKind};
use crate::personal_macros::{read_personal_macros, write_personal_macros};
use crate::project_config_file::project_config_path;
use crate::project_macros::{change_project_macros, entry_id, entry_of_macro, label_from_text, read_project_macros};
use serde_json::{json, Value};
use std::path::PathBuf;

/// The two files that the orders read and change.
#[derive(Debug, Clone)]
pub struct MacroPlaces {
    /// The file of the personal macros.
    pub personal_file: PathBuf,
    /// The root of the project whose file `.heidrun/config.json` holds the project macros.
    pub project_root: PathBuf,
}

/// What the order `add` makes.
#[derive(Debug, Clone, Default)]
pub struct NewMacro {
    /// The id of the macro. `None` makes an id from the title and three random characters, as the window does.
    pub id: Option<String>,
    /// The title. `None` or an empty text takes the first characters of the text.
    pub label: Option<String>,
    /// The description. `None` is an empty description.
    pub description: Option<String>,
    /// The text of the macro. It cannot be empty.
    pub text: String,
}

/// What the order `update` changes. A field that is `None` stays as it is.
#[derive(Debug, Clone, Default)]
pub struct MacroChanges {
    /// The new title. An empty text takes the first characters of the text of the macro.
    pub label: Option<String>,
    /// The new description.
    pub description: Option<String>,
    /// The new text. It cannot be empty.
    pub text: Option<String>,
}

/// Lists every macro: the hard-coded macros, then the personal macros, then the project macros.
///
/// # Errors
/// The file of the personal macros or the file of the project cannot be read or is not valid.
pub fn list_macros(places: &MacroPlaces) -> Result<Vec<ListedMacro>, String> {
    let mut listed: Vec<ListedMacro> = hard_coded_macros()
        .into_iter()
        .map(|content| ListedMacro { content, kind: MacroKind::HardCoded, file: None })
        .collect();
    listed.extend(list_kind(places, MacroKind::Personal)?);
    listed.extend(list_kind(places, MacroKind::Project)?);
    Ok(listed)
}

/// Lists the macros of one kind.
fn list_kind(places: &MacroPlaces, kind: MacroKind) -> Result<Vec<ListedMacro>, String> {
    let (contents, file) = match kind {
        MacroKind::HardCoded => (hard_coded_macros(), None),
        MacroKind::Personal => (
            read_personal_macros(&places.personal_file)?.unwrap_or_default(),
            Some(places.personal_file.clone()),
        ),
        MacroKind::Project => (read_project_macros(&places.project_root)?, Some(project_config_path(&places.project_root))),
    };
    Ok(contents.into_iter().map(|content| ListedMacro { content, kind, file: file.clone() }).collect())
}

/// Adds a macro of the kind `kind`, which is personal or project.
///
/// # Errors
/// The kind is hard-coded, the text is empty, the id is already taken by another macro of any kind, or a file cannot be
/// read, is not valid, or cannot be written.
pub fn add_macro(places: &MacroPlaces, kind: MacroKind, new: NewMacro) -> Result<ListedMacro, String> {
    if kind == MacroKind::HardCoded {
        return Err("A hard-coded macro cannot be added: it is written in the source code of Heidrun Code.".to_string());
    }
    if new.text.trim().is_empty() {
        return Err("The text of a macro cannot be empty.".to_string());
    }
    let taken: Vec<String> = list_macros(places)?.into_iter().map(|listed| listed.content.id).collect();
    let label = match new.label.as_deref().map(str::trim) {
        Some(label) if !label.is_empty() => label.to_string(),
        _ => label_from_text(&new.text),
    };
    let id = match new.id {
        Some(id) if taken.contains(&id) => return Err(format!("A macro with the id {id} already exists.")),
        Some(id) if id.trim().is_empty() => return Err("The id of a macro cannot be empty.".to_string()),
        Some(id) => id,
        None => unused_id(&slug(&label), 3, &taken),
    };
    let content = Macro { id, label, description: new.description.unwrap_or_default().trim().to_string(), text: new.text };
    match kind {
        MacroKind::Personal => {
            let mut macros = read_personal_macros(&places.personal_file)?.unwrap_or_default();
            macros.push(content.clone());
            write_personal_macros(&places.personal_file, &macros)?;
        }
        _ => {
            change_project_macros(&places.project_root, |mut entries| {
                entries.push(entry_of_macro(&content));
                Ok(entries)
            })?;
        }
    }
    let file = file_of(places, kind);
    Ok(ListedMacro { content, kind, file })
}

/// Changes the macro `id`. `kind` says which kind to search when the id exists in two kinds.
///
/// # Errors
/// No macro has the id, the id is in two kinds and no kind is given, the macro is hard-coded, no change is given, the new
/// text is empty, or a file cannot be read, is not valid, or cannot be written.
pub fn update_macro(places: &MacroPlaces, id: &str, kind: Option<MacroKind>, changes: MacroChanges) -> Result<ListedMacro, String> {
    if changes.label.is_none() && changes.description.is_none() && changes.text.is_none() {
        return Err("Give at least one of --label, --description, and --text.".to_string());
    }
    if changes.text.as_deref().is_some_and(|text| text.trim().is_empty()) {
        return Err("The text of a macro cannot be empty.".to_string());
    }
    let found = locate(places, id, kind, "changed")?;
    let apply = |content: &Macro| -> Macro {
        let text = changes.text.clone().unwrap_or_else(|| content.text.clone());
        let label = match changes.label.as_deref().map(str::trim) {
            Some(label) if !label.is_empty() => label.to_string(),
            Some(_) => label_from_text(&text),
            None => content.label.clone(),
        };
        let description = match &changes.description {
            Some(description) => description.trim().to_string(),
            None => content.description.clone(),
        };
        Macro { id: content.id.clone(), label, description, text }
    };
    let updated = apply(&found.content);
    match found.kind {
        MacroKind::Personal => {
            let macros: Vec<Macro> = read_personal_macros(&places.personal_file)?
                .unwrap_or_default()
                .into_iter()
                .map(|content| if content.id == id { updated.clone() } else { content })
                .collect();
            write_personal_macros(&places.personal_file, &macros)?;
        }
        _ => {
            change_project_macros(&places.project_root, |entries| {
                Ok(entries
                    .into_iter()
                    .enumerate()
                    .map(|(index, entry)| if entry_id(&entry, index) == id { merged_entry(entry, &updated) } else { entry })
                    .collect())
            })?;
        }
    }
    Ok(ListedMacro { content: updated, kind: found.kind, file: found.file })
}

/// Deletes the macro `id`. `kind` says which kind to search when the id exists in two kinds.
///
/// # Errors
/// No macro has the id, the id is in two kinds and no kind is given, the macro is hard-coded, or a file cannot be read, is
/// not valid, or cannot be written.
pub fn delete_macro(places: &MacroPlaces, id: &str, kind: Option<MacroKind>) -> Result<ListedMacro, String> {
    let found = locate(places, id, kind, "deleted")?;
    match found.kind {
        MacroKind::Personal => {
            let macros: Vec<Macro> =
                read_personal_macros(&places.personal_file)?.unwrap_or_default().into_iter().filter(|content| content.id != id).collect();
            write_personal_macros(&places.personal_file, &macros)?;
        }
        _ => {
            change_project_macros(&places.project_root, |entries| {
                Ok(entries.into_iter().enumerate().filter(|(index, entry)| entry_id(entry, *index) != id).map(|(_, entry)| entry).collect())
            })?;
        }
    }
    Ok(found)
}

/// The macro `id` of a kind that can be changed.
fn locate(places: &MacroPlaces, id: &str, kind: Option<MacroKind>, action: &str) -> Result<ListedMacro, String> {
    let mut candidates: Vec<ListedMacro> = list_macros(places)?
        .into_iter()
        .filter(|listed| listed.content.id == id && kind.is_none_or(|wanted| wanted == listed.kind))
        .collect();
    match candidates.len() {
        0 => Err(match kind {
            Some(kind) => format!("No {} macro has the id {id}. Run `heidrun_code_ctrl macros list` to see the ids.", kind.words()),
            None => format!("No macro has the id {id}. Run `heidrun_code_ctrl macros list` to see the ids."),
        }),
        1 => {
            let found = candidates.remove(0);
            if found.kind == MacroKind::HardCoded {
                return Err(format!("The macro {id} is hard-coded in Heidrun Code and cannot be {action}."));
            }
            Ok(found)
        }
        _ => {
            let names: Vec<&str> = candidates.iter().map(|listed| listed.kind.name()).collect();
            Err(format!("The id {id} exists in several kinds of macro ({}). Give --kind to choose one.", names.join(", ")))
        }
    }
}

/// The file that holds the macros of a kind, or `None` for the hard-coded macros.
fn file_of(places: &MacroPlaces, kind: MacroKind) -> Option<PathBuf> {
    match kind {
        MacroKind::HardCoded => None,
        MacroKind::Personal => Some(places.personal_file.clone()),
        MacroKind::Project => Some(project_config_path(&places.project_root)),
    }
}

/// An entry of the key `prompts` with the new values of a macro. The other fields of the entry stay as they are.
fn merged_entry(entry: Value, updated: &Macro) -> Value {
    let mut fields = match entry {
        Value::Object(fields) => fields,
        _ => serde_json::Map::new(),
    };
    fields.insert("id".to_string(), json!(updated.id));
    fields.insert("label".to_string(), json!(updated.label));
    fields.insert("description".to_string(), json!(updated.description));
    fields.insert("text".to_string(), json!(updated.text));
    Value::Object(fields)
}

/// The title in lower case, with the accents removed, and each run of signs that are not letters or digits turned into one
/// dash. An empty result is `macro`.
pub(crate) fn slug(label: &str) -> String {
    let mut slug = String::new();
    for character in label.to_lowercase().chars() {
        let plain = match character {
            'à' | 'â' | 'ä' | 'á' | 'ã' | 'å' => "a",
            'ç' => "c",
            'é' | 'è' | 'ê' | 'ë' => "e",
            'î' | 'ï' | 'í' | 'ì' => "i",
            'ñ' => "n",
            'ô' | 'ö' | 'ó' | 'ò' | 'õ' => "o",
            'ù' | 'û' | 'ü' | 'ú' => "u",
            'ÿ' | 'ý' => "y",
            'œ' => "oe",
            'æ' => "ae",
            other if other.is_ascii_alphanumeric() => {
                slug.push(other);
                continue;
            }
            _ => "-",
        };
        for plain_character in plain.chars() {
            if plain_character == '-' && (slug.is_empty() || slug.ends_with('-')) {
                continue;
            }
            slug.push(plain_character);
        }
    }
    let slug = slug.trim_end_matches('-').to_string();
    if slug.is_empty() {
        "macro".to_string()
    } else {
        slug
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// New empty files for one test: the personal file is in a folder, and the project has the folder `.heidrun`.
    fn places(name: &str) -> MacroPlaces {
        let base = std::env::temp_dir().join(format!("heidrun_code_ctrl_orders_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        std::fs::create_dir_all(base.join("project").join(".heidrun")).unwrap();
        MacroPlaces { personal_file: base.join("data").join("macros.json"), project_root: base.join("project") }
    }

    fn new_macro(label: &str, text: &str) -> NewMacro {
        NewMacro { label: Some(label.to_string()), text: text.to_string(), ..NewMacro::default() }
    }

    #[test]
    fn the_list_has_the_four_hard_coded_macros_first_when_nothing_else_exists() {
        let listed = list_macros(&places("list_empty")).unwrap();
        assert_eq!(listed.len(), 4);
        assert!(listed.iter().all(|item| item.kind == MacroKind::HardCoded && item.file.is_none()));
    }

    #[test]
    fn an_added_personal_macro_is_listed_after_the_hard_coded_macros_with_its_file() {
        let places = places("add_personal");
        let added = add_macro(&places, MacroKind::Personal, new_macro("Run the tests", "Run the tests first.")).unwrap();
        assert!(added.content.id.starts_with("run-the-tests-"));
        let listed = list_macros(&places).unwrap();
        assert_eq!(listed.len(), 5);
        assert_eq!(listed[4].content, added.content);
        assert_eq!(listed[4].file.as_deref(), Some(places.personal_file.as_path()));
    }

    #[test]
    fn an_added_project_macro_is_written_in_the_key_prompts_of_the_project_file() {
        let places = places("add_project");
        let added = add_macro(&places, MacroKind::Project, new_macro("Review", "Review the branch.")).unwrap();
        let text = std::fs::read_to_string(project_config_path(&places.project_root)).unwrap();
        assert!(text.contains("\"prompts\""));
        assert!(text.contains(&added.content.id));
        assert_eq!(list_macros(&places).unwrap().last().unwrap().kind, MacroKind::Project);
    }

    #[test]
    fn a_macro_without_a_title_takes_the_first_forty_characters_of_its_text() {
        let places = places("label_from_text");
        let text = "Explain what this function does and why it is written this way";
        let added = add_macro(&places, MacroKind::Personal, NewMacro { text: text.to_string(), ..NewMacro::default() }).unwrap();
        assert_eq!(added.content.label, text.chars().take(40).collect::<String>());
    }

    #[test]
    fn a_hard_coded_macro_cannot_be_added() {
        let places = places("add_hard_coded");
        let error = add_macro(&places, MacroKind::HardCoded, new_macro("A", "B")).unwrap_err();
        assert!(error.contains("hard-coded"));
    }

    #[test]
    fn an_empty_text_is_refused_for_add_and_for_update() {
        let places = places("empty_text");
        assert!(add_macro(&places, MacroKind::Personal, new_macro("A", "  ")).is_err());
        let added = add_macro(&places, MacroKind::Personal, new_macro("A", "B")).unwrap();
        let changes = MacroChanges { text: Some(String::new()), ..MacroChanges::default() };
        assert!(update_macro(&places, &added.content.id, None, changes).is_err());
    }

    #[test]
    fn an_id_that_exists_in_any_kind_is_refused() {
        let places = places("same_id");
        let new = NewMacro { id: Some("revue-mr".to_string()), ..new_macro("A", "B") };
        assert!(add_macro(&places, MacroKind::Personal, new).unwrap_err().contains("already exists"));
    }

    #[test]
    fn an_update_changes_only_the_fields_that_are_given() {
        let places = places("update_fields");
        let added = add_macro(&places, MacroKind::Personal, NewMacro { description: Some("Old".to_string()), ..new_macro("Title", "Text") }).unwrap();
        let changes = MacroChanges { text: Some("New text".to_string()), ..MacroChanges::default() };
        let updated = update_macro(&places, &added.content.id, None, changes).unwrap();
        assert_eq!(updated.content.label, "Title");
        assert_eq!(updated.content.description, "Old");
        assert_eq!(updated.content.text, "New text");
        assert_eq!(read_personal_macros(&places.personal_file).unwrap().unwrap()[0], updated.content);
    }

    #[test]
    fn an_update_of_a_project_macro_keeps_the_other_fields_of_its_entry() {
        let places = places("update_project");
        std::fs::write(
            project_config_path(&places.project_root),
            r#"{"version":1,"launchers":[],"prompts":[{"id":"p","label":"P","text":"Old","extra":true}]}"#,
        )
        .unwrap();
        let changes = MacroChanges { text: Some("New".to_string()), ..MacroChanges::default() };
        update_macro(&places, "p", None, changes).unwrap();
        let config: Value = serde_json::from_str(&std::fs::read_to_string(project_config_path(&places.project_root)).unwrap()).unwrap();
        assert_eq!(config["prompts"][0]["text"], "New");
        assert_eq!(config["prompts"][0]["extra"], true);
    }

    #[test]
    fn an_update_with_nothing_to_change_is_an_error() {
        let places = places("update_nothing");
        let added = add_macro(&places, MacroKind::Personal, new_macro("A", "B")).unwrap();
        assert!(update_macro(&places, &added.content.id, None, MacroChanges::default()).is_err());
    }

    #[test]
    fn an_update_and_a_delete_refuse_a_hard_coded_macro_and_change_no_file() {
        let places = places("hard_coded_refused");
        let changes = MacroChanges { text: Some("X".to_string()), ..MacroChanges::default() };
        assert!(update_macro(&places, "revue-mr", None, changes).unwrap_err().contains("hard-coded in Heidrun Code and cannot be changed"));
        assert!(delete_macro(&places, "revue-mr", None).unwrap_err().contains("hard-coded in Heidrun Code and cannot be deleted"));
        assert!(!places.personal_file.exists());
    }

    #[test]
    fn a_delete_removes_the_macro_from_its_file_and_keeps_the_others() {
        let places = places("delete");
        let first = add_macro(&places, MacroKind::Personal, new_macro("First", "1")).unwrap();
        let second = add_macro(&places, MacroKind::Personal, new_macro("Second", "2")).unwrap();
        delete_macro(&places, &first.content.id, None).unwrap();
        let left = read_personal_macros(&places.personal_file).unwrap().unwrap();
        assert_eq!(left, vec![second.content]);
    }

    #[test]
    fn a_delete_of_an_unknown_id_says_how_to_find_the_ids() {
        let places = places("delete_unknown");
        assert!(delete_macro(&places, "nothing", None).unwrap_err().contains("macros list"));
    }

    #[test]
    fn an_id_in_two_kinds_needs_the_option_kind() {
        let places = places("two_kinds");
        write_personal_macros(&places.personal_file, &[Macro { id: "same".into(), label: "S".into(), description: String::new(), text: "T".into() }]).unwrap();
        std::fs::write(project_config_path(&places.project_root), r#"{"version":1,"launchers":[],"prompts":[{"id":"same","text":"P"}]}"#).unwrap();
        assert!(delete_macro(&places, "same", None).unwrap_err().contains("--kind"));
        delete_macro(&places, "same", Some(MacroKind::Project)).unwrap();
        assert_eq!(read_personal_macros(&places.personal_file).unwrap().unwrap().len(), 1);
    }

    #[test]
    fn an_entry_without_an_id_is_changed_and_deleted_by_the_id_projet_and_its_index() {
        let places = places("projet_id");
        std::fs::write(project_config_path(&places.project_root), r#"{"version":1,"launchers":[],"prompts":[{"text":"One"},{"text":"Two"}]}"#).unwrap();
        let changes = MacroChanges { label: Some("Second".to_string()), ..MacroChanges::default() };
        update_macro(&places, "projet-1", None, changes).unwrap();
        delete_macro(&places, "projet-0", None).unwrap();
        let left = read_project_macros(&places.project_root).unwrap();
        assert_eq!(left.len(), 1);
        assert_eq!(left[0].label, "Second");
    }

    #[test]
    fn the_id_is_made_from_the_title_without_accents_and_signs() {
        assert_eq!(slug("Revue de la MR !"), "revue-de-la-mr");
        assert_eq!(slug("Où en es-tu ?"), "ou-en-es-tu");
        assert_eq!(slug("???"), "macro");
    }
}
