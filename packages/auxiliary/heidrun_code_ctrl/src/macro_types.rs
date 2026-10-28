//! The types of a macro: its content, and where it is kept.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// One macro: a reusable text that the developer writes into a pane. The fields are the fields that the storage of the
/// window kept before the personal macros moved to a file.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Macro {
    /// The identifier of the macro. It is the same for ever, and no two macros have the same one.
    pub id: String,
    /// The title of the macro, shown in the window.
    pub label: String,
    /// One short line shown under the title in the macro menu. It may be empty.
    #[serde(default)]
    pub description: String,
    /// The text that the macro writes into a pane.
    pub text: String,
}

/// Where a macro is kept.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MacroKind {
    /// Written in the source code of Heidrun Code. It cannot be added, changed, or deleted.
    HardCoded,
    /// Made by the developer, and kept in the file of the personal macros of this computer.
    Personal,
    /// Made by the developer, and kept in the key `prompts` of the file `.heidrun/config.json` of the project.
    Project,
}

impl MacroKind {
    /// The name of the kind in the options and in the output: `hard_coded`, `personal`, or `project`.
    pub fn name(self) -> &'static str {
        match self {
            MacroKind::HardCoded => "hard_coded",
            MacroKind::Personal => "personal",
            MacroKind::Project => "project",
        }
    }

    /// The kind that has this name, or `None`.
    pub fn from_name(name: &str) -> Option<MacroKind> {
        [MacroKind::HardCoded, MacroKind::Personal, MacroKind::Project].into_iter().find(|kind| kind.name() == name)
    }

    /// The words that name the kind in a sentence: "hard-coded", "personal", or "project".
    pub fn words(self) -> &'static str {
        match self {
            MacroKind::HardCoded => "hard-coded",
            MacroKind::Personal => "personal",
            MacroKind::Project => "project",
        }
    }
}

/// A macro with the kind and the file that hold it.
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct ListedMacro {
    /// The content of the macro.
    #[serde(flatten)]
    pub content: Macro,
    /// Where the macro is kept.
    #[serde(serialize_with = "serialize_kind")]
    pub kind: MacroKind,
    /// The file that holds the macro. `None` for a hard-coded macro.
    pub file: Option<PathBuf>,
}

/// Writes the kind as its name.
fn serialize_kind<S: serde::Serializer>(kind: &MacroKind, serializer: S) -> Result<S::Ok, S::Error> {
    serializer.serialize_str(kind.name())
}
