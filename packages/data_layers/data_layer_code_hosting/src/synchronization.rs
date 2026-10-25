//! Fills the tables `issues` and `pull_requests` from GitHub, in the mode initialize or update.
//!
//! The date of the last read is not stored anywhere else: it is the largest value of the column `updatedAt` of each table, for
//! the repository. When a table has no row for the repository, the mode update reads everything, as the mode initialize does.

use crate::github::github_reader::GithubReader;
use crate::model::types::{CodeHostingStage, CodeHostingTable, SynchronizationMode, SynchronizationReport};
use crate::storage::database::CodeHostingDatabase;
use crate::OPERATION_PACKAGE;
use data_layer_operation_log::{record, OperationKind, OperationSpec, Summary};

/// Reads the issues and the pull requests of a repository, and writes them in the database. `log` receives one line of
/// progress for the date where each read starts and for each write. The progress function of `reader` receives the start, the
/// pages, and the end of the four stages.
///
/// # Errors
/// An error when the database cannot be read or written, when GitHub cannot be read, or when an item does not follow its
/// JSON schema.
pub fn run(
    mode: SynchronizationMode,
    repository: &str,
    database: &mut CodeHostingDatabase,
    reader: &GithubReader,
    log: &dyn Fn(&str),
) -> Result<SynchronizationReport, String> {
    let spec = OperationSpec::new(OPERATION_PACKAGE, "synchronize", OperationKind::Synchronization)
        .choice("mode", mode.name())
        .parameter("repository", repository)
        .database(database.database_path());
    record(spec, || run_inside(mode, repository, database, reader, log), |report| {
        Summary::count(report.issue_count + report.pull_request_count)
            .detail("issueCount", report.issue_count)
            .detail("pullRequestCount", report.pull_request_count)
    })
}

/// The work of `run`, between the start event and the completion event of its operation.
fn run_inside(
    mode: SynchronizationMode,
    repository: &str,
    database: &mut CodeHostingDatabase,
    reader: &GithubReader,
    log: &dyn Fn(&str),
) -> Result<SynchronizationReport, String> {
    let (issues_since, pull_requests_since) = match mode {
        SynchronizationMode::Initialize => (None, None),
        SynchronizationMode::Update => (
            database.find_last_updated_at(CodeHostingTable::Issues, repository)?,
            database.find_last_updated_at(CodeHostingTable::PullRequests, repository)?,
        ),
    };
    log(&format!("mode {}: issues are read {}", mode.name(), describe_since(issues_since.as_deref())));
    reader.send_progress(CodeHostingStage::ReadIssues, 0, None, false);
    let issues = reader.read_issues(repository, issues_since.as_deref())?;
    reader.send_progress(CodeHostingStage::ReadIssues, issues.len(), Some(issues.len()), true);
    reader.send_progress(CodeHostingStage::WriteIssues, 0, Some(issues.len()), false);
    database.upsert_issues(repository, &issues)?;
    reader.send_progress(CodeHostingStage::WriteIssues, issues.len(), Some(issues.len()), true);
    log(&format!("issues: written row count {}, file {}", issues.len(), database.database_path().display()));
    log(&format!("mode {}: pull requests are read {}", mode.name(), describe_since(pull_requests_since.as_deref())));
    reader.send_progress(CodeHostingStage::ReadPullRequests, 0, None, false);
    let pull_requests = reader.read_pull_requests(repository, pull_requests_since.as_deref())?;
    let pull_request_count = Some(pull_requests.len());
    reader.send_progress(CodeHostingStage::ReadPullRequests, pull_requests.len(), pull_request_count, true);
    reader.send_progress(CodeHostingStage::WritePullRequests, 0, pull_request_count, false);
    database.upsert_pull_requests(repository, &pull_requests)?;
    reader.send_progress(CodeHostingStage::WritePullRequests, pull_requests.len(), pull_request_count, true);
    log(&format!(
        "pull requests: written row count {}, file {}",
        pull_requests.len(),
        database.database_path().display()
    ));
    Ok(SynchronizationReport {
        mode,
        repository: repository.to_string(),
        issues_since,
        pull_requests_since,
        issue_count: issues.len(),
        pull_request_count: pull_requests.len(),
    })
}

/// Writes in words the date where a read starts: `since the beginning` for `None`, otherwise `since` and the date.
pub fn describe_since(since: Option<&str>) -> String {
    match since {
        None => "since the beginning".to_string(),
        Some(date) => format!("since {date}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::github::github_reader::ignore_log;
    use crate::model::types::IssueState;
    use crate::test_samples::{date, issue, issue_node, pull_request_node, temp_folder, FakeGithub, FakeRequest};
    use serde_json::{json, Value};
    use std::cell::RefCell;

    const REPOSITORY: &str = "heidrun-org/heidrun";

    /// A fake GitHub with three issues (days 1 to 3) and two pull requests (days 4 and 5), two items for each page.
    fn fake_github() -> FakeGithub {
        FakeGithub::new(
            (1..=3).map(|day| issue_node(day, &date(day as u32))).collect(),
            (4..=5).map(|day| pull_request_node(day, &date(day as u32))).collect(),
            2,
        )
    }

    /// An empty database in a new folder.
    fn new_database(name: &str) -> CodeHostingDatabase {
        CodeHostingDatabase::open(&temp_folder(name).join("data_layer.sqlite")).unwrap()
    }

    #[test]
    fn initialize_reads_everything_since_the_beginning_and_writes_every_row() {
        let fake_github = fake_github();
        let mut database = new_database("initialize");
        let reader = GithubReader::new(&fake_github, &ignore_log);
        let report = run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        assert_eq!(
            report,
            SynchronizationReport {
                mode: SynchronizationMode::Initialize,
                repository: REPOSITORY.to_string(),
                issues_since: None,
                pull_requests_since: None,
                issue_count: 3,
                pull_request_count: 2,
            }
        );
        assert_eq!(database.count_rows(CodeHostingTable::Issues, REPOSITORY), Ok(3));
        assert_eq!(database.count_rows(CodeHostingTable::PullRequests, REPOSITORY), Ok(2));
        let mut expected = issue(2);
        expected.updated_at = date(2);
        assert_eq!(database.find_issue(REPOSITORY, 2), Ok(Some(expected)));
    }

    #[test]
    fn initialize_two_times_in_a_row_gives_the_same_rows_with_no_row_written_two_times() {
        let fake_github = fake_github();
        let mut database = new_database("initialize_twice");
        let reader = GithubReader::new(&fake_github, &ignore_log);
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        assert_eq!(database.count_rows(CodeHostingTable::Issues, REPOSITORY), Ok(3));
        assert_eq!(database.count_rows(CodeHostingTable::PullRequests, REPOSITORY), Ok(2));
    }

    #[test]
    fn update_on_an_empty_database_reads_everything_as_initialize_does() {
        let fake_github = fake_github();
        let mut database = new_database("update_empty");
        let reader = GithubReader::new(&fake_github, &ignore_log);
        let report = run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        assert_eq!(report.issues_since, None);
        assert_eq!(report.pull_requests_since, None);
        assert_eq!((report.issue_count, report.pull_request_count), (3, 2));
    }

    #[test]
    fn update_reads_from_the_date_of_the_last_read_and_writes_the_new_and_the_changed_rows() {
        let fake_github = fake_github();
        let mut database = new_database("update_changes");
        let reader = GithubReader::new(&fake_github, &ignore_log);
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        {
            let mut nodes = fake_github.issue_nodes.borrow_mut();
            let mut reopened = issue_node(1, &date(8));
            reopened["state"] = json!("OPEN");
            reopened["stateReason"] = Value::Null;
            reopened["closedAt"] = Value::Null;
            nodes[0] = reopened;
            nodes.push(issue_node(6, &date(9)));
        }
        fake_github.requests.borrow_mut().clear();
        let report = run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        assert_eq!(report.issues_since, Some(date(3)));
        assert_eq!(report.pull_requests_since, Some(date(5)));
        assert_eq!(report.issue_count, 3);
        assert_eq!(report.pull_request_count, 1);
        assert_eq!(database.count_rows(CodeHostingTable::Issues, REPOSITORY), Ok(4));
        assert_eq!(database.find_issue(REPOSITORY, 1).unwrap().unwrap().state, IssueState::Open);
        assert_eq!(database.find_issue(REPOSITORY, 6).unwrap().unwrap().number, 6);
        assert_eq!(database.find_last_updated_at(CodeHostingTable::Issues, REPOSITORY), Ok(Some(date(9))));
    }

    #[test]
    fn update_does_not_ask_for_the_pages_that_hold_only_items_that_are_already_read() {
        let fake_github = fake_github();
        let mut database = new_database("update_pages");
        let reader = GithubReader::new(&fake_github, &ignore_log);
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        fake_github.requests.borrow_mut().clear();
        run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        let asked: Vec<(String, Option<String>)> = fake_github
            .requests
            .borrow()
            .iter()
            .map(|request: &FakeRequest| (request.connection_name.clone(), request.cursor.clone()))
            .collect();
        assert_eq!(asked, [("issues".to_string(), None), ("pullRequests".to_string(), None)]);
    }

    #[test]
    fn update_two_times_in_a_row_with_no_change_on_github_leaves_the_database_as_it_is() {
        let fake_github = fake_github();
        let mut database = new_database("update_twice");
        let reader = GithubReader::new(&fake_github, &ignore_log);
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        assert_eq!(database.count_rows(CodeHostingTable::Issues, REPOSITORY), Ok(3));
        assert_eq!(database.count_rows(CodeHostingTable::PullRequests, REPOSITORY), Ok(2));
        assert_eq!(database.find_last_updated_at(CodeHostingTable::Issues, REPOSITORY), Ok(Some(date(3))));
    }

    #[test]
    fn update_of_one_repository_does_not_use_the_date_of_the_last_read_of_another_repository() {
        let fake_github = fake_github();
        let mut database = new_database("update_other_repository");
        let reader = GithubReader::new(&fake_github, &ignore_log);
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        let report =
            run(SynchronizationMode::Update, "heidrun-org/another", &mut database, &reader, &ignore_log).unwrap();
        assert_eq!(report.issues_since, None);
        assert_eq!(database.count_rows(CodeHostingTable::Issues, "heidrun-org/another"), Ok(3));
    }

    #[test]
    fn sends_the_lines_of_progress_of_the_date_where_each_read_starts_and_of_each_write() {
        let fake_github = fake_github();
        let mut database = new_database("progress");
        let reader = GithubReader::new(&fake_github, &ignore_log);
        let lines = RefCell::new(Vec::<String>::new());
        let log = |message: &str| lines.borrow_mut().push(message.to_string());
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &log).unwrap();
        run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &log).unwrap();
        let path = database.database_path().display().to_string();
        let lines = lines.borrow();
        assert!(lines.contains(&"mode initialize: issues are read since the beginning".to_string()));
        assert!(lines.contains(&format!("issues: written row count 3, file {path}")));
        assert!(lines.contains(&format!("mode update: issues are read since {}", date(3))));
        assert!(lines.contains(&format!("mode update: pull requests are read since {}", date(5))));
        assert!(lines.contains(&format!("pull requests: written row count 1, file {path}")));
    }

    #[test]
    fn a_synchronization_records_one_operation_with_the_collection_and_the_writes_inside_it() {
        let fake_github = fake_github();
        let mut database = new_database("data_layer_operation_log");
        let reader = GithubReader::new(&fake_github, &ignore_log);
        let (report, events) = data_layer_operation_log::testing::capture(|| {
            run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap()
        });
        assert_eq!((report.issue_count, report.pull_request_count), (3, 2));
        assert_eq!(
            data_layer_operation_log::testing::tree(&events),
            vec![
                "code_hosting.synchronize",
                "  code_hosting.read_issues",
                "  code_hosting.upsert_issues",
                "  code_hosting.read_pull_requests",
                "  code_hosting.upsert_pull_requests",
            ]
        );
        let starts = data_layer_operation_log::testing::starts(&events);
        assert_eq!(starts[0].parameters["mode"], "initialize");
        assert_eq!(starts[0].parameters["repository"], REPOSITORY);
        assert_eq!(starts[1].kind, data_layer_operation_log::OperationKind::Collection);
        assert_eq!(starts[2].kind, data_layer_operation_log::OperationKind::Write);
        let complete = data_layer_operation_log::testing::completion_of(&events, &starts[0].operation_id).unwrap();
        assert_eq!(complete.result_count, Some(5));
        assert_eq!(complete.details["issueCount"], 3);
        assert_eq!(complete.details["pullRequestCount"], 2);
    }

    #[test]
    fn the_mode_update_records_the_read_of_the_last_update_dates_as_queries_inside_the_operation() {
        let fake_github = fake_github();
        let mut database = new_database("operation_log_update");
        let reader = GithubReader::new(&fake_github, &ignore_log);
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &reader, &ignore_log).unwrap();
        let (_, events) = data_layer_operation_log::testing::capture(|| {
            run(SynchronizationMode::Update, REPOSITORY, &mut database, &reader, &ignore_log).unwrap()
        });
        let tree = data_layer_operation_log::testing::tree(&events);
        assert_eq!(tree[0], "code_hosting.synchronize");
        assert_eq!(tree.iter().filter(|line| line.as_str() == "  code_hosting.find_last_updated_at").count(), 2);
        let starts = data_layer_operation_log::testing::starts(&events);
        assert_eq!(starts[1].parameters["table"], "issues");
        assert_eq!(starts[0].pattern, "mode=update");
    }

    #[test]
    fn a_query_and_a_failed_query_are_recorded_and_the_error_is_given_back_unchanged() {
        let fake_github = fake_github();
        let path = temp_folder("operation_log_query").join("data_layer.sqlite");
        let mut database = CodeHostingDatabase::open(&path).unwrap();
        run(SynchronizationMode::Initialize, REPOSITORY, &mut database, &GithubReader::new(&fake_github, &ignore_log), &ignore_log)
            .unwrap();
        drop(database);
        let database = CodeHostingDatabase::open_read_only(&path).unwrap();
        let (rows, events) = data_layer_operation_log::testing::capture(|| database.query("SELECT number FROM issues ORDER BY number").unwrap());
        assert_eq!(rows.len(), 3);
        let starts = data_layer_operation_log::testing::starts(&events);
        assert_eq!(starts[0].pattern, "SELECT number FROM issues ORDER BY number");
        assert_eq!(data_layer_operation_log::testing::completion_of(&events, &starts[0].operation_id).unwrap().result_count, Some(3));

        let expected = database.query("SELEC nothing").unwrap_err();
        let (error, events) = data_layer_operation_log::testing::capture(|| database.query("SELEC nothing").unwrap_err());
        assert_eq!(error, expected);
        let starts = data_layer_operation_log::testing::starts(&events);
        let complete = data_layer_operation_log::testing::completion_of(&events, &starts[0].operation_id).unwrap();
        assert_eq!(complete.outcome, data_layer_operation_log::Outcome::Failure);
    }
}
