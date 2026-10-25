//! The data shapes that the files of the package share: the facts of an issue and of a pull request, the two tables, the two
//! modes of the synchronization, and the rows of a query.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::BTreeMap;

/// The state of an issue.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum IssueState {
    /// The issue is open.
    Open,
    /// The issue is closed.
    Closed,
}

/// The reason why an issue was closed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum IssueStateReason {
    /// The work of the issue is done.
    Completed,
    /// The work of the issue will not be done.
    NotPlanned,
    /// The issue was closed, and then opened again.
    Reopened,
    /// Another issue says the same thing.
    Duplicate,
}

/// The state of a pull request.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PullRequestState {
    /// The pull request is open.
    Open,
    /// The pull request is closed and not merged.
    Closed,
    /// The pull request is merged.
    Merged,
}

/// The facts of one issue, as the database stores them in the column `data` of the table `issues`. The file
/// `schemas/issue.schema.json` describes the same shape.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Issue {
    /// The number of the issue in its repository.
    pub number: i64,
    /// The title of the issue.
    pub title: String,
    /// The text of the issue. It is an empty string when the issue has no text.
    pub body: String,
    /// The state of the issue.
    pub state: IssueState,
    /// The reason why the issue was closed. It is `None` for an issue that was never closed.
    pub state_reason: Option<IssueStateReason>,
    /// The login of the author. It is `None` when the account of the author is deleted.
    pub author: Option<String>,
    /// The logins of the people that the issue is assigned to.
    pub assignees: Vec<String>,
    /// The names of the labels of the issue.
    pub labels: Vec<String>,
    /// The color of each label of the issue, as six hexadecimal digits without `#`, by the name of the label. A label that
    /// GitHub gives no color has no entry. A row that an earlier version wrote has no such field, and it reads as no entry.
    #[serde(default)]
    pub label_colors: BTreeMap<String, String>,
    /// The date of creation, in the format ISO 8601.
    pub created_at: String,
    /// The date of the last change, in the format ISO 8601.
    pub updated_at: String,
    /// The date of the close, in the format ISO 8601. It is `None` while the issue is open.
    pub closed_at: Option<String>,
    /// The number of comments of the issue.
    pub comment_count: i64,
}

/// The facts of one pull request, as the database stores them in the column `data` of the table `pull_requests`. The file
/// `schemas/pull_request.schema.json` describes the same shape.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PullRequest {
    /// The number of the pull request in its repository.
    pub number: i64,
    /// The title of the pull request.
    pub title: String,
    /// The text of the pull request. It is an empty string when the pull request has no text.
    pub body: String,
    /// The state of the pull request.
    pub state: PullRequestState,
    /// True while the pull request is a draft.
    pub is_draft: bool,
    /// The login of the author. It is `None` when the account of the author is deleted.
    pub author: Option<String>,
    /// The login of the person that merged the pull request. It is `None` when the pull request is not merged.
    pub merged_by: Option<String>,
    /// The names of the labels of the pull request.
    pub labels: Vec<String>,
    /// The color of each label of the pull request, as six hexadecimal digits without `#`, by the name of the label. A label
    /// that GitHub gives no color has no entry. A row that an earlier version wrote has no such field, and it reads as no entry.
    #[serde(default)]
    pub label_colors: BTreeMap<String, String>,
    /// The name of the branch that the pull request merges into.
    pub base_ref_name: String,
    /// The name of the branch that the pull request merges from.
    pub head_ref_name: String,
    /// The identifier of the merge commit. It is `None` when the pull request is not merged.
    pub merge_commit: Option<String>,
    /// The date of creation, in the format ISO 8601.
    pub created_at: String,
    /// The date of the last change, in the format ISO 8601.
    pub updated_at: String,
    /// The date of the close, in the format ISO 8601. It is `None` while the pull request is open.
    pub closed_at: Option<String>,
    /// The date of the merge, in the format ISO 8601. It is `None` when the pull request is not merged.
    pub merged_at: Option<String>,
    /// The number of added lines.
    pub additions: i64,
    /// The number of deleted lines.
    pub deletions: i64,
    /// The number of changed files.
    pub changed_files: i64,
    /// The number of commits of the pull request.
    pub commit_count: i64,
}

/// One of the two tables of the database.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CodeHostingTable {
    /// The table `issues`.
    Issues,
    /// The table `pull_requests`.
    PullRequests,
}

impl CodeHostingTable {
    /// The two tables.
    pub const ALL: [CodeHostingTable; 2] = [CodeHostingTable::Issues, CodeHostingTable::PullRequests];

    /// The name of the table in the SQLite file.
    pub fn name(self) -> &'static str {
        match self {
            CodeHostingTable::Issues => "issues",
            CodeHostingTable::PullRequests => "pull_requests",
        }
    }
}

/// The two modes of the synchronization.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SynchronizationMode {
    /// Reads everything since the beginning of the repository.
    Initialize,
    /// Reads only what changed since the last read.
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
pub enum CodeHostingStage {
    /// The reading of the issues from GitHub.
    ReadIssues,
    /// The writing of the issues in the SQLite file.
    WriteIssues,
    /// The reading of the pull requests from GitHub.
    ReadPullRequests,
    /// The writing of the pull requests in the SQLite file.
    WritePullRequests,
}

/// One report of the progress of a refresh: the stage, the number of items that the stage handled, and the number of items
/// that the stage handles in all.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CodeHostingProgress {
    /// The stage that the report describes.
    pub stage: CodeHostingStage,
    /// The number of items that the stage handled.
    pub done_count: usize,
    /// The number of items that the stage handles in all, or `None` when it is not known. A read that starts at a date does not
    /// know how many items changed after this date.
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
    /// The date of the last read of the issues. Items older than this date were not read. `None`: no limit.
    pub issues_since: Option<String>,
    /// The date of the last read of the pull requests. Items older than this date were not read. `None`: no limit.
    pub pull_requests_since: Option<String>,
    /// The number of issues that the synchronization wrote.
    pub issue_count: usize,
    /// The number of pull requests that the synchronization wrote.
    pub pull_request_count: usize,
}

/// One row of the answer to a query: the name of each column and its value, in the order of the columns.
pub type QueryRow = Map<String, Value>;
