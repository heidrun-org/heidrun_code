//! Clustered dynamic topics: the translation table kept on the disk, and the call to a coding agent that fills it.
//!
//! The translation table maps each raw dynamic topic to the name of a cluster. It is kept in `topic_clusters.json`, in
//! the folder of the data of Heidrun Code. The web frontend decides which raw dynamic topics are new, writes the prompt, and
//! checks the answer. This file does only the two things that the web frontend cannot do: it reads and writes the file,
//! and it runs `codex` or `claude` on this computer.
//!
//! The call is the function `ask` of the package `coding_agent_cli`, which holds the rules of the two commands. The call
//! goes through the login shell, so the commands that the developer installed are found, and Heidrun Code never reads or stores
//! the login.

use coding_agent_cli::{ask, AgentShell};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

/// The name of the file of the translation table, in the folder of the data of Heidrun Code.
const TABLE_FILE: &str = "topic_clusters.json";

/// The version of the content of the file. A file with another version is thrown away: the table starts empty.
const TABLE_VERSION: u32 = 1;

/// How long the call waits for the answer, in seconds.
const ANSWER_TIMEOUT: u64 = 180;

/// What the file of the translation table holds.
#[derive(Serialize, Deserialize, Debug, Default)]
struct TableContent {
    version: u32,
    /// The cluster of each raw dynamic topic, written in lower case.
    rows: BTreeMap<String, String>,
}

/// The answer of a coding agent.
#[derive(Serialize, Debug, PartialEq)]
pub struct CodingAgentAnswer {
    /// The coding agent that answered: `codex` or `claude`.
    pub agent: String,
    /// What the coding agent printed, without the spaces and the line breaks at its start and at its end.
    pub text: String,
}

/// The file of the translation table.
fn table_path() -> PathBuf {
    crate::app_data::data_dir().join(TABLE_FILE)
}

/// The folder where the coding agent runs.
fn agent_folder() -> PathBuf {
    crate::app_data::data_dir().join("topic_clusters_agent")
}

/// Reads the rows of the file `path`. A missing file, a file that is not valid, and a file with another version give no
/// row.
fn read_rows(path: &Path) -> BTreeMap<String, String> {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|text| serde_json::from_str::<TableContent>(&text).ok())
        .filter(|content| content.version == TABLE_VERSION)
        .map(|content| content.rows)
        .unwrap_or_default()
}

/// Writes `rows` to the file `path`. The file is written aside then renamed: a crash never leaves half a file.
fn write_rows(path: &Path, rows: &BTreeMap<String, String>) -> Result<(), String> {
    let content = TableContent { version: TABLE_VERSION, rows: rows.clone() };
    let text = serde_json::to_string(&content).map_err(|error| error.to_string())?;
    if let Some(folder) = path.parent() {
        std::fs::create_dir_all(folder).map_err(|error| error.to_string())?;
    }
    let temporary = path.with_extension("json.tmp");
    std::fs::write(&temporary, text).map_err(|error| error.to_string())?;
    std::fs::rename(&temporary, path).map_err(|error| error.to_string())
}

/// The translation table: the cluster of each raw dynamic topic.
#[tauri::command]
pub fn topic_clusters_read() -> BTreeMap<String, String> {
    read_rows(&table_path())
}

/// Replaces the translation table by `rows`.
#[tauri::command]
pub fn topic_clusters_write(rows: BTreeMap<String, String>) -> Result<(), String> {
    write_rows(&table_path(), &rows)
}

/// Sends `prompt` to `codex` when it is installed, and to `claude` otherwise. The error `no_coding_agent` says that
/// neither is installed.
#[tauri::command]
pub async fn coding_agent_ask(prompt: String) -> Result<CodingAgentAnswer, String> {
    let answer = ask(&AgentShell::login(), None, &prompt, Some(&agent_folder()), Some(ANSWER_TIMEOUT)).await?;
    Ok(CodingAgentAnswer { agent: answer.agent, text: answer.text })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_the_table_and_reads_it_again() {
        let folder = std::env::temp_dir().join(format!("heidrun_topic_clusters_table_{}", std::process::id()));
        let path = folder.join(TABLE_FILE);
        let rows = BTreeMap::from([("side bar".to_string(), "sidebar".to_string()), ("tab".to_string(), "tab".to_string())]);
        write_rows(&path, &rows).unwrap();
        assert_eq!(read_rows(&path), rows);
        write_rows(&path, &BTreeMap::new()).unwrap();
        assert!(read_rows(&path).is_empty());
        let _ = std::fs::remove_dir_all(folder);
    }

    #[test]
    fn starts_with_no_row_when_the_file_is_missing_is_not_valid_or_has_another_version() {
        let folder = std::env::temp_dir().join(format!("heidrun_topic_clusters_bad_{}", std::process::id()));
        std::fs::create_dir_all(&folder).unwrap();
        let path = folder.join(TABLE_FILE);
        assert!(read_rows(&path).is_empty());
        std::fs::write(&path, "not json").unwrap();
        assert!(read_rows(&path).is_empty());
        std::fs::write(&path, "{\"version\":99,\"rows\":{\"a\":\"b\"}}").unwrap();
        assert!(read_rows(&path).is_empty());
        let _ = std::fs::remove_dir_all(folder);
    }
}
