//! The refresh interface of the package: the one call that copies the new issues and pull requests of a GitHub repository into
//! the SQLite file.
//!
//! A program that shows the issues and the pull requests calls this file to collect, and `query.rs` to read. The two never
//! mix: a read never sends a request to GitHub.

use crate::github::github_reader::{ignore_log, ignore_progress, GithubReader};
use crate::github::graphql_runner::{GhGraphqlRunner, GraphqlRunner};
use crate::model::types::{CodeHostingProgress, CodeHostingTable, SynchronizationMode, SynchronizationReport};
use crate::storage::database::CodeHostingDatabase;
use crate::synchronization::run;
use crate::OPERATION_PACKAGE;
use data_layer_operation_log::{record, OperationKind, OperationSpec, Summary};
use std::path::Path;

/// Copies the issues and the pull requests of `repository` that changed since the last read into the SQLite file at
/// `database_path`, with the command `gh`. The SQLite file and its tables are created when they do not exist. The caller holds
/// the lock of the SQLite file.
///
/// The mode is update, which reads only the items that changed since the largest date of change of each table. The mode is
/// initialize, which reads every item, when an earlier version of the package wrote a row without the colors of its labels, so
/// the read gives that row its colors once.
///
/// # Errors
/// An error when the command `gh` fails, for example without a network, or when the SQLite file cannot be opened or written.
pub fn refresh_code_hosting(database_path: &Path, repository: &str) -> Result<SynchronizationReport, String> {
    refresh_code_hosting_with_runner(&GhGraphqlRunner, database_path, repository)
}

/// Like `refresh_code_hosting`, and `progress` receives one report at the start of each stage, after each page, and at the
/// end of each stage. The Statistics window shows these reports while it waits.
///
/// # Errors
/// The same as `refresh_code_hosting`.
pub fn refresh_code_hosting_with_progress(
    database_path: &Path,
    repository: &str,
    progress: &dyn Fn(&CodeHostingProgress),
) -> Result<SynchronizationReport, String> {
    refresh_code_hosting_with_runner_and_progress(&GhGraphqlRunner, database_path, repository, progress)
}

/// Like `refresh_code_hosting`, with the runner that sends the queries. The tests give a fake runner.
///
/// # Errors
/// The same as `refresh_code_hosting`.
pub fn refresh_code_hosting_with_runner(
    runner: &dyn GraphqlRunner,
    database_path: &Path,
    repository: &str,
) -> Result<SynchronizationReport, String> {
    refresh_code_hosting_with_runner_and_progress(runner, database_path, repository, &ignore_progress)
}

/// Like `refresh_code_hosting_with_progress`, with the runner that sends the queries. The tests give a fake runner.
///
/// # Errors
/// The same as `refresh_code_hosting`.
pub fn refresh_code_hosting_with_runner_and_progress(
    runner: &dyn GraphqlRunner,
    database_path: &Path,
    repository: &str,
    progress: &dyn Fn(&CodeHostingProgress),
) -> Result<SynchronizationReport, String> {
    let spec = OperationSpec::new(OPERATION_PACKAGE, "refresh_code_hosting", OperationKind::Synchronization)
        .parameter("repository", repository)
        .database(database_path);
    record(spec, || refresh_code_hosting_inside(runner, database_path, repository, progress), |report| {
        Summary::count(report.issue_count + report.pull_request_count)
            .detail("mode", report.mode.name())
            .detail("issueCount", report.issue_count)
            .detail("pullRequestCount", report.pull_request_count)
    })
}

/// The work of `refresh_code_hosting_with_runner`, between the start event and the completion event of its operation. It chooses
/// the mode: update, or initialize when a row has no label colors.
fn refresh_code_hosting_inside(
    runner: &dyn GraphqlRunner,
    database_path: &Path,
    repository: &str,
    progress: &dyn Fn(&CodeHostingProgress),
) -> Result<SynchronizationReport, String> {
    let mut database = CodeHostingDatabase::open(database_path)?;
    let mut missing_color_count = 0;
    for table in CodeHostingTable::ALL {
        missing_color_count += database.count_rows_without_label_colors(table, repository)?;
    }
    let mode = if missing_color_count > 0 { SynchronizationMode::Initialize } else { SynchronizationMode::Update };
    let reader = GithubReader::new(runner, &ignore_log).with_progress(progress);
    run(mode, repository, &mut database, &reader, &ignore_log)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_samples::{date, issue_node, pull_request_node, temp_folder, FakeGithub};
    use crate::model::types::CodeHostingStage;
    use rusqlite::Connection;
    use std::cell::RefCell;

    const REPOSITORY: &str = "heidrun-org/heidrun";

    fn fake_github() -> FakeGithub {
        FakeGithub::new(vec![issue_node(1, &date(2)), issue_node(2, &date(3))], vec![pull_request_node(5, &date(4))], 100)
    }

    #[test]
    fn creates_the_sqlite_file_and_copies_the_issues_and_the_pull_requests() {
        let database_path = temp_folder("refresh_copy").join("data_layer.sqlite");
        let report = refresh_code_hosting_with_runner(&fake_github(), &database_path, REPOSITORY).unwrap();
        assert_eq!((report.mode, report.issue_count, report.pull_request_count), (SynchronizationMode::Update, 2, 1));
    }

    #[test]
    fn a_refresh_is_one_operation_that_holds_the_synchronization_and_tells_its_mode_when_it_ends() {
        let database_path = temp_folder("refresh_events").join("data_layer.sqlite");
        let (_, events) = data_layer_operation_log::testing::capture(|| {
            refresh_code_hosting_with_runner(&fake_github(), &database_path, REPOSITORY).unwrap()
        });
        let tree = data_layer_operation_log::testing::tree(&events);
        assert_eq!(tree[0], "code_hosting.refresh_code_hosting");
        assert!(tree.contains(&"  code_hosting.synchronize".to_string()), "{tree:?}");
        assert!(tree.contains(&"  code_hosting.count_rows_without_label_colors".to_string()), "{tree:?}");
        let starts = data_layer_operation_log::testing::starts(&events);
        assert!(starts[0].parameters.get("mode").is_none(), "The mode is chosen while the operation runs");
        let complete = data_layer_operation_log::testing::completion_of(&events, &starts[0].operation_id).unwrap();
        assert_eq!(complete.details["mode"], "update");
        assert_eq!(complete.result_count, Some(3));
    }

    #[test]
    fn sends_the_start_the_pages_and_the_end_of_each_stage_with_a_total_only_for_a_read_from_the_beginning() {
        let database_path = temp_folder("refresh_progress").join("data_layer.sqlite");
        let fake_github = FakeGithub::new((1..=3).map(|day| issue_node(day, &date(day as u32))).collect(), vec![], 2);
        let reports = RefCell::new(Vec::new());
        let progress = |report: &CodeHostingProgress| {
            reports.borrow_mut().push((report.stage, report.done_count, report.total_count, report.is_finished))
        };
        refresh_code_hosting_with_runner_and_progress(&fake_github, &database_path, REPOSITORY, &progress).unwrap();
        assert_eq!(
            reports.take(),
            vec![
                (CodeHostingStage::ReadIssues, 0, None, false),
                (CodeHostingStage::ReadIssues, 2, Some(3), false),
                (CodeHostingStage::ReadIssues, 3, Some(3), false),
                (CodeHostingStage::ReadIssues, 3, Some(3), true),
                (CodeHostingStage::WriteIssues, 0, Some(3), false),
                (CodeHostingStage::WriteIssues, 3, Some(3), true),
                (CodeHostingStage::ReadPullRequests, 0, None, false),
                (CodeHostingStage::ReadPullRequests, 0, Some(0), false),
                (CodeHostingStage::ReadPullRequests, 0, Some(0), true),
                (CodeHostingStage::WritePullRequests, 0, Some(0), false),
                (CodeHostingStage::WritePullRequests, 0, Some(0), true),
            ]
        );
        fake_github.issue_nodes.borrow_mut().push(issue_node(4, &date(9)));
        refresh_code_hosting_with_runner_and_progress(&fake_github, &database_path, REPOSITORY, &progress).unwrap();
        let second = reports.take();
        assert_eq!(second[1], (CodeHostingStage::ReadIssues, 2, None, false), "A read from a date has no total: {second:?}");
    }

    #[test]
    fn reads_everything_again_once_when_a_row_has_no_label_colors_and_then_only_the_changes() {
        let database_path = temp_folder("refresh_colors").join("data_layer.sqlite");
        refresh_code_hosting_with_runner(&fake_github(), &database_path, REPOSITORY).unwrap();
        let connection = Connection::open(&database_path).unwrap();
        connection.execute("UPDATE issues SET data = json_remove(data, '$.labelColors') WHERE number = 1", []).unwrap();
        drop(connection);
        let second = refresh_code_hosting_with_runner(&fake_github(), &database_path, REPOSITORY).unwrap();
        assert_eq!((second.mode, second.issue_count), (SynchronizationMode::Initialize, 2));
        let third = refresh_code_hosting_with_runner(&fake_github(), &database_path, REPOSITORY).unwrap();
        assert_eq!(third.mode, SynchronizationMode::Update);
    }
}
