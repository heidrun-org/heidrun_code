//! The code hosting source of the data layer of Heidrun Code: reads every issue and every pull request of a GitHub repository, and
//! writes the facts of each one in two tables of a SQLite file.
//!
//! The library has six parts:
//! - `refresh_code_hosting` is the refresh interface: it copies the issues and the pull requests that changed into the SQLite
//!   file.
//! - `find_issues_opened_between`, `find_pull_requests_opened_between`, `find_issues_by_numbers`, and
//!   `find_pull_requests_by_numbers` are the query interface: they read the SQLite file only.
//! - `CodeHostingDatabase` is the SQLite file. It writes the rows, reads them, and runs a read-only query.
//! - `GithubReader` reads the pages of issues and of pull requests, through a `GraphqlRunner`. `GhGraphqlRunner` sends the
//!   queries with the command `gh`.
//! - `synchronize` fills the two tables, in the mode initialize or update.
//! - `to_table` and `to_json` write the rows of a query as text.
//!
//! The calls are blocking. A caller in an async program runs them in a blocking task.

mod github;
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

pub use github::github_reader::{ignore_log, ignore_progress, GithubReader, ISSUES_QUERY, PULL_REQUESTS_QUERY};
pub use github::graphql_runner::{find_repository, GhGraphqlRunner, GraphqlRunner};
pub use model::schemas::{validate_issue_value, validate_pull_request_value, ISSUE_SCHEMA, PULL_REQUEST_SCHEMA};
pub use model::types::{
    CodeHostingProgress, CodeHostingStage, CodeHostingTable, Issue, IssueState, IssueStateReason, PullRequest, PullRequestState, QueryRow, SynchronizationMode,
    SynchronizationReport,
};
pub use query::{
    find_issues_by_numbers, find_issues_opened_between, find_pull_requests_by_numbers, find_pull_requests_opened_between,
};
pub use refresh::{
    refresh_code_hosting, refresh_code_hosting_with_progress, refresh_code_hosting_with_runner,
    refresh_code_hosting_with_runner_and_progress,
};
pub use storage::database::CodeHostingDatabase;
pub use storage::query_formatter::{to_json, to_table, NO_ROW_TEXT};
pub use synchronization::{describe_since, run as synchronize};

use std::path::PathBuf;

/// The name of this package in the log of the operations of the data layer, without the prefix `data_layer_`.
pub(crate) const OPERATION_PACKAGE: &str = "code_hosting";

/// The path of the SQLite file in `HEIDRUN_CODE_DIR`, or, when the variable is unset or empty, `~/.config/heidrun_code/data_layer.sqlite`.
pub fn default_database_path() -> PathBuf {
    std::env::var("HEIDRUN_CODE_DIR")
        .ok()
        .filter(|value| value.is_empty() == false)
        .or_else(|| std::env::var("HEIDRUN_DIR").ok().filter(|value| value.is_empty() == false))
        .map(PathBuf::from)
        .unwrap_or_else(|| default_data_folder(&dirs::home_dir().unwrap_or_default()))
        .join("data_layer.sqlite")
}
