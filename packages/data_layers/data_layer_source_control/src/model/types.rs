//! The data shapes that the files of the package share: the facts of a commit, the two modes of the synchronization, and the
//! rows of a query.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

/// The facts of one commit, as the database stores them in the column `data` of the table `commits`. The file
/// `schemas/commit.schema.json` describes the same shape. A merge is a commit with more than one parent.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Commit {
    /// The hash of the commit.
    pub hash: String,
    /// The hashes of the parent commits. The list is empty for the first commit, and has two or more hashes for a merge.
    pub parents: Vec<String>,
    /// The name of the author, after the file `.mailmap` is applied.
    pub author_name: String,
    /// The email of the author, after the file `.mailmap` is applied.
    pub author_email: String,
    /// The date when the author wrote the commit, in UTC, in the format ISO 8601.
    pub authored_at: String,
    /// The name of the committer, after the file `.mailmap` is applied.
    pub committer_name: String,
    /// The email of the committer, after the file `.mailmap` is applied.
    pub committer_email: String,
    /// The date when the committer made the commit, in UTC, in the format ISO 8601.
    pub committed_at: String,
    /// The first line of the message.
    pub subject: String,
    /// The rest of the message, without the empty lines at the end. It is an empty string when the message has one line.
    pub body: String,
    /// The number of files that the commit changes. For a merge: the files that the merge brings in, compared with the
    /// first parent.
    pub files_changed: i64,
    /// The number of added lines. A binary file counts 0.
    pub insertions: i64,
    /// The number of deleted lines. A binary file counts 0.
    pub deletions: i64,
}

impl Commit {
    /// True when the commit has more than one parent.
    pub fn is_merge(&self) -> bool {
        self.parents.len() > 1
    }
}

/// The two modes of the synchronization.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SynchronizationMode {
    /// Reads every commit since the beginning of the repository.
    Initialize,
    /// Reads only the commits that the database does not hold yet.
    Update,
}

impl SynchronizationMode {
    /// The name of the mode, as the command line writes it.
    pub fn name(self) -> &'static str {
        match self {
            SynchronizationMode::Initialize => "initialize",
            SynchronizationMode::Update => "update",
        }
    }
}

/// The stages of a refresh, in the order where they run.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SourceControlStage {
    /// The reading of the new commits with the command `git`.
    ReadCommits,
    /// The writing of the new commits in the SQLite file.
    WriteCommits,
}

/// One report of the progress of a refresh: the stage, the number of commits that the stage handled, and the number of commits
/// that the stage handles in all.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SourceControlProgress {
    /// The stage that the report describes.
    pub stage: SourceControlStage,
    /// The number of commits that the stage handled.
    pub done_count: usize,
    /// The number of commits that the stage handles in all, or `None` when it is not known yet.
    pub total_count: Option<usize>,
    /// True when the stage is done.
    pub is_finished: bool,
}

/// What one synchronization did.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SynchronizationReport {
    /// The mode of the synchronization.
    pub mode: SynchronizationMode,
    /// The repository that was read, in the format `owner/name`.
    pub repository: String,
    /// The number of commits that the synchronization wrote.
    pub commit_count: usize,
    /// The number of commits that the synchronization did not read, because the database already held them. It is 0 for
    /// the mode initialize, which reads every commit.
    pub known_commit_count: usize,
}

/// One row of the answer to a query: the name of each column and its value, in the order of the columns.
pub type QueryRow = Map<String, Value>;
