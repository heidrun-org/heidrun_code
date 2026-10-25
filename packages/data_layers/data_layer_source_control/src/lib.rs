//! The source control source of the data layer of Heidrun Code: reads every commit and every merge of a Git repository, and writes
//! the facts of each one in the table `commits` of a SQLite file.
//!
//! The library has seven parts:
//! - `refresh_source_control` is the refresh interface: it copies the new commits of a repository into the SQLite file.
//! - `find_commits` is the query interface: it reads the commits of a time range from the SQLite file only.
//! - `find_file_existence`, `find_existing_folders`, and `find_worktree_branches` give the state of the working copy now,
//!   with no history: which files and which worktree folders exist, and the branch of each worktree.
//! - `SourceControlDatabase` is the SQLite file. It writes the rows, reads them, and runs a read-only query.
//! - `GitReader` lists the commits of a repository and reads their facts, through a `GitRunner`. `GitCommandRunner` runs the
//!   command `git`.
//! - `synchronize` fills the table, in the mode initialize or update.
//! - `to_table` and `to_json` write the rows of a query as text.
//!
//! The calls are blocking. A caller in an async program runs them in a blocking task.

mod git;
mod model;
mod query;
mod refresh;
mod storage;
mod synchronization;
/// `~/.config/heidrun_code`, or the former folder `~/.config/heidrun` when it exists and the new folder does not.
fn default_data_folder(home: &std::path::Path) -> PathBuf {
    let current = home.join(".config").join("heidrun_code");
    let former = home.join(".config").join("heidrun");
    if current.is_dir() == false && former.is_dir() {
        return former;
    }
    current
}

#[cfg(test)]
mod test_samples;

pub use git::git_reader::{ignore_log, ignore_progress, GitReader};
pub use git::git_runner::{find_repository, parse_repository, GitCommandRunner, GitRunner};
pub use git::working_copy::{
    find_existing_folders, find_file_existence, find_worktree_branches, FileExistence, WorktreeBranch,
};
pub use model::schemas::{validate_commit_value, COMMIT_SCHEMA};
pub use model::types::{
    Commit, QueryRow, SourceControlProgress, SourceControlStage, SynchronizationMode, SynchronizationReport,
};
pub use query::find_commits;
pub use refresh::{refresh_source_control, refresh_source_control_with_progress};
pub use storage::database::SourceControlDatabase;
pub use storage::query_formatter::{to_json, to_table, NO_ROW_TEXT};
pub use synchronization::run as synchronize;

use std::path::PathBuf;

/// The name of this package in the log of the operations of the data layer, without the prefix `data_layer_`.
pub(crate) const OPERATION_PACKAGE: &str = "source_control";

/// The path of the SQLite file in `HEIDRUN_CODE_DIR`, or, when the variable is unset or empty, `~/.config/heidrun_code/data_layer.sqlite`. It is the same file as
/// the file of the other data layer packages, and each package writes its own tables in it.
pub fn default_database_path() -> PathBuf {
    std::env::var("HEIDRUN_CODE_DIR")
        .ok()
        .filter(|value| value.is_empty() == false)
        .or_else(|| std::env::var("HEIDRUN_DIR").ok().filter(|value| value.is_empty() == false))
        .map(PathBuf::from)
        .unwrap_or_else(|| default_data_folder(&dirs::home_dir().unwrap_or_default()))
        .join("data_layer.sqlite")
}
