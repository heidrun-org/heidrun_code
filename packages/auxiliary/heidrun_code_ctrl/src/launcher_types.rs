//! The type of a launcher: one item of the Launchers sidebar section.

use serde::Serialize;
use serde_json::Value;

/// One launcher: a command line that the Launchers sidebar section runs in its own tab. The fields are the fields of an
/// item of the key `launchers` of the file `.heidrun/config.json`, as the Zod schema of the web frontend names them. A
/// field that the item does not have is `None`, and the JSON output writes it as `null`.
#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Launcher {
    /// The identifier of the launcher. It is the same for ever, and no two launchers have the same one.
    pub id: String,
    /// The name of the launcher, shown in the window.
    pub label: String,
    /// The command line that the launcher runs. For a launcher of the kind Coding agent, it is the generated command line.
    pub command: String,
    /// A text on several lines that describes the launcher.
    pub description: Option<String>,
    /// The folder where the command line runs, relative to the root of the project.
    pub cwd: Option<String>,
    /// Present only for a launcher of the kind Coding agent: an object with the fields `name`, `model`, `effort`, and
    /// `prompt`. The command line never changes this object.
    pub agent: Option<Value>,
}
