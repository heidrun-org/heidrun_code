//! The hard-coded macros: the macros that are written in the source code of Heidrun Code.

use crate::macro_types::Macro;

/// The hard-coded macros, in the order of the macro menu. The window gives each one its title and its description in the
/// language in use, by its id. The texts are written to the coding agent, so they stay as they are.
pub fn hard_coded_macros() -> Vec<Macro> {
    let entries: [(&str, &str, &str, &str); 4] = [
        (
            "revue-mr",
            "Review the merge request",
            "Security, bugs, tests, summary",
            "Fais la revue de la MR de la branche {branche} : sécurité, bugs, tests. Résumé, points bloquants, suggestions.",
        ),
        (
            "note-reprise",
            "Handover note",
            "Commit, then write what is done and what remains",
            "Commite ce qui est prêt, puis écris la note de reprise : ce qui est fait, ce qui reste, les décisions prises.",
        ),
        (
            "ou-en-es-tu",
            "Where are you?",
            "Five lines on what is done and what remains",
            "Où en es-tu ? Résume en 5 lignes ce que tu as fait et ce qu'il reste.",
        ),
        (
            "explique-selection",
            "Explain the selection",
            "Explain the selected text",
            "Explique-moi ceci :\n\n```\n{selection}\n```",
        ),
    ];
    entries
        .into_iter()
        .map(|(id, label, description, text)| Macro {
            id: id.to_string(),
            label: label.to_string(),
            description: description.to_string(),
            text: text.to_string(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn there_are_four_macros_with_different_ids_and_a_text() {
        let macros = hard_coded_macros();
        assert_eq!(macros.len(), 4);
        let ids: HashSet<&str> = macros.iter().map(|content| content.id.as_str()).collect();
        assert_eq!(ids.len(), 4);
        assert!(macros.iter().all(|content| !content.text.is_empty() && !content.label.is_empty()));
    }

    #[test]
    fn the_ids_are_the_ids_that_the_storage_of_the_window_kept() {
        let ids: Vec<String> = hard_coded_macros().into_iter().map(|content| content.id).collect();
        assert_eq!(ids, ["revue-mr", "note-reprise", "ou-en-es-tu", "explique-selection"]);
    }
}
