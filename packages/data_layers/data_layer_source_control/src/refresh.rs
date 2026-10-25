//! The refresh interface of the package: the one call that copies the new commits of a Git repository into the SQLite file.
//!
//! A program that shows the commits calls this file to collect, and `query.rs` to read. The two never mix: a read of the
//! commits never runs the command `git`.

use crate::git::git_reader::{ignore_log, ignore_progress, GitReader};
use crate::git::git_runner::GitCommandRunner;
use crate::model::types::{SourceControlProgress, SynchronizationMode, SynchronizationReport};
use crate::storage::database::SourceControlDatabase;
use crate::synchronization::run;
use crate::OPERATION_PACKAGE;
use data_layer_operation_log::{record, OperationKind, OperationSpec, Summary};
use std::path::Path;

/// Copies the commits of the Git repository of `folder` that the SQLite file at `database_path` does not hold yet, with the
/// mode update. `repository` is the name `owner/name` that the rows get. The SQLite file and its table are created when they do
/// not exist. The caller holds the lock of the SQLite file.
///
/// # Errors
/// An error when the command `git` cannot run in `folder`, or when the SQLite file cannot be opened or written.
pub fn refresh_source_control(
    database_path: &Path,
    folder: &Path,
    repository: &str,
) -> Result<SynchronizationReport, String> {
    refresh_source_control_with_progress(database_path, folder, repository, &ignore_progress)
}

/// Like `refresh_source_control`, and `progress` receives one report at the start of each stage, after each batch of commits,
/// and at the end of each stage. The Statistics window shows these reports while it waits.
///
/// # Errors
/// The same as `refresh_source_control`.
pub fn refresh_source_control_with_progress(
    database_path: &Path,
    folder: &Path,
    repository: &str,
    progress: &dyn Fn(&SourceControlProgress),
) -> Result<SynchronizationReport, String> {
    let spec = OperationSpec::new(OPERATION_PACKAGE, "refresh_source_control", OperationKind::Synchronization)
        .choice("mode", SynchronizationMode::Update.name())
        .parameter("repository", repository)
        .parameter("folder", folder.display().to_string())
        .database(database_path);
    record(spec, || refresh_source_control_inside(database_path, folder, repository, progress), |report| {
        Summary::count(report.commit_count).detail("knownCommitCount", report.known_commit_count)
    })
}

/// The work of `refresh_source_control`, between the start event and the completion event of its operation.
fn refresh_source_control_inside(
    database_path: &Path,
    folder: &Path,
    repository: &str,
    progress: &dyn Fn(&SourceControlProgress),
) -> Result<SynchronizationReport, String> {
    let mut database = SourceControlDatabase::open(database_path)?;
    let runner = GitCommandRunner::new(folder);
    let reader = GitReader::new(&runner, &ignore_log).with_progress(progress);
    run(SynchronizationMode::Update, repository, &mut database, &reader, &ignore_log)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::types::SourceControlStage;
    use crate::test_samples::{temp_folder, TestRepository};
    use std::cell::RefCell;

    #[test]
    fn copies_the_commits_of_a_repository_and_only_the_new_ones_the_second_time() {
        let (repository, _) = TestRepository::with_four_commits("refresh_commits");
        let database_path = temp_folder("refresh_commits_database").join("data_layer.sqlite");
        let first = refresh_source_control(&database_path, &repository.folder, "heidrun-org/heidrun").unwrap();
        assert_eq!(first.commit_count, 4);
        let second = refresh_source_control(&database_path, &repository.folder, "heidrun-org/heidrun").unwrap();
        assert_eq!(second.commit_count, 0);
        repository.commit_file("c.txt", "c", "A fifth commit", 5);
        let third = refresh_source_control(&database_path, &repository.folder, "heidrun-org/heidrun").unwrap();
        assert_eq!(third.commit_count, 1);
    }

    #[test]
    fn a_refresh_is_one_operation_that_holds_the_synchronization_with_its_collection_and_writes() {
        let (repository, _) = TestRepository::with_four_commits("refresh_events");
        let database_path = temp_folder("refresh_events_database").join("data_layer.sqlite");
        let (_, events) = data_layer_operation_log::testing::capture(|| {
            refresh_source_control(&database_path, &repository.folder, "heidrun-org/heidrun").unwrap()
        });
        let tree = data_layer_operation_log::testing::tree(&events);
        assert_eq!(tree[0], "source_control.refresh_source_control");
        assert_eq!(tree[1], "  source_control.synchronize");
        assert!(tree.contains(&"    source_control.read_commits".to_string()), "{tree:?}");
        let starts = data_layer_operation_log::testing::starts(&events);
        assert_eq!(starts[0].parameters["mode"], "update");
        assert_eq!(starts[0].parameters["repository"], "heidrun-org/heidrun");
        let complete = data_layer_operation_log::testing::completion_of(&events, &starts[0].operation_id).unwrap();
        assert_eq!(complete.result_count, Some(4));
    }

    #[test]
    fn sends_the_start_the_batches_and_the_end_of_each_stage_in_order() {
        let (repository, _) = TestRepository::with_four_commits("refresh_progress");
        let database_path = temp_folder("refresh_progress_database").join("data_layer.sqlite");
        let reports = RefCell::new(Vec::new());
        let progress = |report: &SourceControlProgress| reports.borrow_mut().push(*report);
        refresh_source_control_with_progress(&database_path, &repository.folder, "heidrun-org/heidrun", &progress).unwrap();
        let reports: Vec<_> = reports
            .into_inner()
            .into_iter()
            .map(|report| (report.stage, report.done_count, report.total_count, report.is_finished))
            .collect();
        assert_eq!(
            reports,
            vec![
                (SourceControlStage::ReadCommits, 0, None, false),
                (SourceControlStage::ReadCommits, 0, Some(4), false),
                (SourceControlStage::ReadCommits, 4, Some(4), false),
                (SourceControlStage::ReadCommits, 4, Some(4), true),
                (SourceControlStage::WriteCommits, 0, Some(4), false),
                (SourceControlStage::WriteCommits, 4, Some(4), true),
            ]
        );
    }

    #[test]
    fn fails_with_a_message_for_a_folder_that_is_not_in_a_repository() {
        let folder = temp_folder("refresh_no_repository");
        let error = refresh_source_control(&folder.join("data_layer.sqlite"), &folder, "a/b").unwrap_err();
        assert!(error.contains("git"));
    }
}
