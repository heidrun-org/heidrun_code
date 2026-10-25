//! The reading of the commits of a Git repository: the hashes of every commit that the branches, the remote branches, and the
//! tags reach, and the facts of each commit. It only talks to a `GitRunner`.

use crate::git::git_runner::GitRunner;
use crate::model::types::{Commit, SourceControlProgress, SourceControlStage};
use crate::OPERATION_PACKAGE;
use data_layer_operation_log::{record, OperationKind, OperationSpec, Summary};

/// The number of commits that one command `git log` reads.
const BATCH_SIZE: usize = 500;

/// The date format of the command `git log`: UTC, in the format ISO 8601. The runner puts the time zone of the command in UTC.
const DATE_ARGUMENT: &str = "--date=format-local:%Y-%m-%dT%H:%M:%SZ";

/// The text that the command `git log` writes for each commit. A record starts with the character 0x1E, and the ten fields
/// each end with the character NUL: hash, parents, author name, author email, author date, committer name, committer email,
/// committer date, subject, and body. The names and the emails follow the file `.mailmap`.
const FORMAT_ARGUMENT: &str = "--format=%x1e%H%x00%P%x00%aN%x00%aE%x00%ad%x00%cN%x00%cE%x00%cd%x00%s%x00%b%x00";

/// The character that starts the record of a commit.
const RECORD_SEPARATOR: char = '\u{1e}';

/// The character that ends a field of the record of a commit.
const FIELD_SEPARATOR: char = '\u{0}';

/// The number of fields of the record of a commit, before the lines of the option `--numstat`.
const FIELD_COUNT: usize = 10;

/// Ignores a line of progress. It is the log function when the developer does not ask for the progress.
pub fn ignore_log(_message: &str) {}

/// Ignores a report of progress. It is the progress function when the caller does not show the progress.
pub fn ignore_progress(_progress: &SourceControlProgress) {}

/// Reads the hashes and the facts of the commits of a repository.
pub struct GitReader<'a> {
    /// The runner that runs the command `git`.
    runner: &'a dyn GitRunner,
    /// The function that receives the lines of progress.
    log: &'a dyn Fn(&str),
    /// The function that receives the reports of progress of the stages.
    progress: &'a dyn Fn(&SourceControlProgress),
    /// The number of commits that one command `git log` reads.
    batch_size: usize,
}

impl<'a> GitReader<'a> {
    /// Creates a reader. `log` receives one line of progress for the list of hashes and for each batch of commits. Give
    /// `&ignore_log` for no progress.
    pub fn new(runner: &'a dyn GitRunner, log: &'a dyn Fn(&str)) -> Self {
        GitReader { runner, log, progress: &ignore_progress, batch_size: BATCH_SIZE }
    }

    /// Gives the reader the function that receives one report of progress at the start of each stage, after each batch of
    /// commits, and at the end of each stage.
    pub fn with_progress(mut self, progress: &'a dyn Fn(&SourceControlProgress)) -> Self {
        self.progress = progress;
        self
    }

    /// Sends one report of progress to the progress function of the reader.
    pub(crate) fn send_progress(
        &self,
        stage: SourceControlStage,
        done_count: usize,
        total_count: Option<usize>,
        is_finished: bool,
    ) {
        (self.progress)(&SourceControlProgress { stage, done_count, total_count, is_finished });
    }

    /// Lists the hashes of every commit that the local branches, the remote branches, and the tags reach.
    ///
    /// # Errors
    /// An error when the command `git` fails, for example when the folder is not in a Git repository.
    pub fn list_hashes(&self) -> Result<Vec<String>, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "list_hashes", OperationKind::Collection);
        record(spec, || self.list_hashes_inside(), |hashes| Summary::count(hashes.len()))
    }

    /// The work of `list_hashes`, between the start event and the completion event of its operation.
    fn list_hashes_inside(&self) -> Result<Vec<String>, String> {
        let output = self.runner.run(&["rev-list", "--branches", "--remotes", "--tags"], None)?;
        let hashes: Vec<String> =
            output.lines().map(str::trim).filter(|line| !line.is_empty()).map(str::to_string).collect();
        (self.log)(&format!("git: {} commits are reachable from the branches, the remote branches, and the tags", hashes.len()));
        Ok(hashes)
    }

    /// Reads the facts of the commits that have these hashes, in the same order, one batch at a time.
    ///
    /// # Errors
    /// An error when the command `git` fails, or when its answer does not hold one record for each hash.
    pub fn read_commits(&self, hashes: &[String]) -> Result<Vec<Commit>, String> {
        let spec = OperationSpec::new(OPERATION_PACKAGE, "read_commits", OperationKind::Collection)
            .parameter("commitCount", hashes.len());
        record(spec, || self.read_commits_inside(hashes), |commits| Summary::count(commits.len()))
    }

    /// The work of `read_commits`, between the start event and the completion event of its operation.
    fn read_commits_inside(&self, hashes: &[String]) -> Result<Vec<Commit>, String> {
        let mut commits = Vec::with_capacity(hashes.len());
        let batch_count = hashes.len().div_ceil(self.batch_size);
        for (index, batch) in hashes.chunks(self.batch_size).enumerate() {
            let standard_input = format!("{}\n", batch.join("\n"));
            let output = self.runner.run(
                &[
                    "log",
                    "--no-walk=unsorted",
                    "--stdin",
                    "--root",
                    "--no-show-signature",
                    "--find-renames",
                    "--diff-merges=first-parent",
                    "--numstat",
                    DATE_ARGUMENT,
                    FORMAT_ARGUMENT,
                ],
                Some(&standard_input),
            )?;
            let batch_commits = parse_commits(&output)?;
            if batch_commits.len() != batch.len() {
                return Err(format!(
                    "The command git log gave {} commits for {} hashes.",
                    batch_commits.len(),
                    batch.len()
                ));
            }
            (self.log)(&format!("git: batch {} of {} read, commit count {}", index + 1, batch_count, batch_commits.len()));
            commits.extend(batch_commits);
            self.send_progress(SourceControlStage::ReadCommits, commits.len(), Some(hashes.len()), false);
        }
        Ok(commits)
    }
}

/// Turns the answer of the command `git log` into commits.
fn parse_commits(output: &str) -> Result<Vec<Commit>, String> {
    let mut records = output.split(RECORD_SEPARATOR);
    let text_before_first_record = records.next().unwrap_or_default();
    if !text_before_first_record.trim().is_empty() {
        return Err(format!("The command git log gave a text before the first commit: {}", text_before_first_record.trim()));
    }
    records.map(parse_commit).collect()
}

/// Turns one record of the command `git log` into a commit. The record holds the ten fields, then the lines of the option
/// `--numstat`.
fn parse_commit(record: &str) -> Result<Commit, String> {
    let fields: Vec<&str> = record.splitn(FIELD_COUNT + 1, FIELD_SEPARATOR).collect();
    if fields.len() != FIELD_COUNT + 1 {
        return Err(format!("The command git log gave a commit with {} fields, and {FIELD_COUNT} are expected.", fields.len() - 1));
    }
    let (files_changed, insertions, deletions) = parse_numstat(fields[FIELD_COUNT]);
    Ok(Commit {
        hash: fields[0].to_string(),
        parents: fields[1].split_whitespace().map(str::to_string).collect(),
        author_name: fields[2].to_string(),
        author_email: fields[3].to_string(),
        authored_at: fields[4].to_string(),
        committer_name: fields[5].to_string(),
        committer_email: fields[6].to_string(),
        committed_at: fields[7].to_string(),
        subject: fields[8].to_string(),
        body: fields[9].trim_end().to_string(),
        files_changed,
        insertions,
        deletions,
    })
}

/// Counts the files, the added lines, and the deleted lines in the lines of the option `--numstat`. A line has the added
/// lines, the deleted lines, and the path, with a tab between them. A binary file has a dash for each count, and counts 0.
fn parse_numstat(text: &str) -> (i64, i64, i64) {
    let mut files_changed = 0;
    let mut insertions = 0;
    let mut deletions = 0;
    for line in text.lines() {
        let mut parts = line.splitn(3, '\t');
        let (Some(added), Some(deleted), Some(_path)) = (parts.next(), parts.next(), parts.next()) else {
            continue;
        };
        files_changed += 1;
        insertions += added.parse::<i64>().unwrap_or(0);
        deletions += deleted.parse::<i64>().unwrap_or(0);
    }
    (files_changed, insertions, deletions)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::git::git_runner::GitCommandRunner;
    use crate::test_samples::{date, temp_folder, TestRepository};
    use std::cell::RefCell;

    /// A runner that gives the same text or the same error each time.
    struct FakeRunner {
        /// The text that the runner gives, or the error.
        answer: Result<String, String>,
    }

    impl GitRunner for FakeRunner {
        fn run(&self, _arguments: &[&str], _standard_input: Option<&str>) -> Result<String, String> {
            self.answer.clone()
        }
    }

    /// The record of a commit, as the command `git log` writes it.
    fn record(hash: &str, parents: &str, subject: &str, body: &str, numstat: &str) -> String {
        format!(
            "\u{1e}{hash}\0{parents}\0Ada Author\0ada@example.com\0{}\0Cora Committer\0cora@example.com\0{}\0{subject}\0{body}\0\n\n{numstat}",
            date(1),
            date(2)
        )
    }

    #[test]
    fn lists_the_four_hashes_of_a_repository_with_a_branch_and_a_merge() {
        let (repository, hashes) = TestRepository::with_four_commits("list_hashes");
        let runner = GitCommandRunner::new(&repository.folder);
        let mut listed = GitReader::new(&runner, &ignore_log).list_hashes().unwrap();
        let mut expected = hashes.clone();
        listed.sort();
        expected.sort();
        assert_eq!(listed, expected);
    }

    #[test]
    fn lists_no_hash_for_a_repository_with_no_commit() {
        let repository = TestRepository::new("list_no_hash");
        let runner = GitCommandRunner::new(&repository.folder);
        assert_eq!(GitReader::new(&runner, &ignore_log).list_hashes(), Ok(vec![]));
    }

    #[test]
    fn reads_the_facts_of_the_first_commit_with_the_dates_in_utc() {
        let (repository, hashes) = TestRepository::with_four_commits("first_commit");
        let runner = GitCommandRunner::new(&repository.folder);
        let commits = GitReader::new(&runner, &ignore_log).read_commits(&hashes[..1]).unwrap();
        assert_eq!(commits.len(), 1);
        let first_commit = &commits[0];
        assert_eq!(first_commit.hash, hashes[0]);
        assert_eq!(first_commit.parents, Vec::<String>::new());
        assert_eq!(first_commit.author_name, "Ada Author");
        assert_eq!(first_commit.author_email, "ada@example.com");
        assert_eq!(first_commit.committer_name, "Cora Committer");
        assert_eq!(first_commit.committer_email, "cora@example.com");
        assert_eq!(first_commit.authored_at, "2026-10-01T08:00:00Z");
        assert_eq!(first_commit.committed_at, "2026-10-01T08:00:00Z");
        assert_eq!(first_commit.subject, "First commit");
        assert_eq!(first_commit.body, "The body of the first commit.\n\nIt has two paragraphs.");
        assert_eq!((first_commit.files_changed, first_commit.insertions, first_commit.deletions), (1, 1, 0));
        assert!(!first_commit.is_merge());
    }

    #[test]
    fn reads_the_parent_of_a_commit_and_an_empty_body_for_a_message_of_one_line() {
        let (repository, hashes) = TestRepository::with_four_commits("parent");
        let runner = GitCommandRunner::new(&repository.folder);
        let commits = GitReader::new(&runner, &ignore_log).read_commits(&hashes[2..3]).unwrap();
        assert_eq!(commits[0].parents, [hashes[0].clone()]);
        assert_eq!(commits[0].subject, "Change a.txt on main");
        assert_eq!(commits[0].body, "");
        assert_eq!((commits[0].files_changed, commits[0].insertions, commits[0].deletions), (1, 1, 0));
    }

    #[test]
    fn reads_a_merge_with_its_two_parents_and_the_files_that_it_brings_in_compared_with_the_first_parent() {
        let (repository, hashes) = TestRepository::with_four_commits("merge");
        let runner = GitCommandRunner::new(&repository.folder);
        let commits = GitReader::new(&runner, &ignore_log).read_commits(&hashes[3..4]).unwrap();
        let merge = &commits[0];
        assert_eq!(merge.parents, [hashes[2].clone(), hashes[1].clone()]);
        assert!(merge.is_merge());
        assert_eq!((merge.files_changed, merge.insertions, merge.deletions), (1, 2, 0));
    }

    #[test]
    fn gives_the_commits_in_the_order_of_the_hashes_and_reads_them_in_batches() {
        let (repository, hashes) = TestRepository::with_four_commits("batches");
        let runner = GitCommandRunner::new(&repository.folder);
        let lines = RefCell::new(Vec::<String>::new());
        let log = |message: &str| lines.borrow_mut().push(message.to_string());
        let mut reader = GitReader::new(&runner, &log);
        reader.batch_size = 3;
        let reversed_hashes: Vec<String> = hashes.iter().rev().cloned().collect();
        let commits = reader.read_commits(&reversed_hashes).unwrap();
        assert_eq!(commits.iter().map(|commit| commit.hash.clone()).collect::<Vec<_>>(), reversed_hashes);
        assert_eq!(*lines.borrow(), ["git: batch 1 of 2 read, commit count 3", "git: batch 2 of 2 read, commit count 1"]);
    }

    #[test]
    fn reads_nothing_and_runs_no_command_for_an_empty_list_of_hashes() {
        let runner = FakeRunner { answer: Err("the runner must not run".into()) };
        assert_eq!(GitReader::new(&runner, &ignore_log).read_commits(&[]), Ok(vec![]));
    }

    #[test]
    fn sends_the_progress_of_the_list_of_hashes() {
        let (repository, _) = TestRepository::with_four_commits("progress");
        let runner = GitCommandRunner::new(&repository.folder);
        let lines = RefCell::new(Vec::<String>::new());
        let log = |message: &str| lines.borrow_mut().push(message.to_string());
        GitReader::new(&runner, &log).list_hashes().unwrap();
        assert_eq!(
            *lines.borrow(),
            ["git: 4 commits are reachable from the branches, the remote branches, and the tags"]
        );
    }

    #[test]
    fn says_so_when_the_folder_is_not_in_a_git_repository() {
        let folder = temp_folder("not_a_repository");
        let runner = GitCommandRunner::new(&folder);
        assert!(GitReader::new(&runner, &ignore_log).list_hashes().unwrap_err().contains("not a git repository"));
    }

    #[test]
    fn gives_the_error_of_the_runner() {
        let runner = FakeRunner { answer: Err("The command git failed: boom".into()) };
        let reader = GitReader::new(&runner, &ignore_log);
        assert_eq!(reader.list_hashes(), Err("The command git failed: boom".into()));
        assert_eq!(reader.read_commits(&["a".repeat(40)]), Err("The command git failed: boom".into()));
    }

    #[test]
    fn refuses_an_answer_with_a_wrong_number_of_commits() {
        let runner = FakeRunner { answer: Ok(record(&"a".repeat(40), "", "Subject", "", "1\t0\ta.txt\n")) };
        let reader = GitReader::new(&runner, &ignore_log);
        let error = reader.read_commits(&["a".repeat(40), "b".repeat(40)]).unwrap_err();
        assert_eq!(error, "The command git log gave 1 commits for 2 hashes.");
    }

    #[test]
    fn refuses_an_answer_with_a_text_before_the_first_commit_and_a_commit_with_too_few_fields() {
        assert!(parse_commits("a warning\n").unwrap_err().contains("before the first commit"));
        assert!(parse_commits("\u{1e}abc\0def\0").unwrap_err().contains("fields"));
    }

    #[test]
    fn counts_a_binary_file_as_a_file_with_no_line_and_a_renamed_file_as_one_file() {
        let text = "\n3\t1\tsrc/a.rs\n-\t-\timage.png\n0\t0\told.txt => new.txt\n\n";
        assert_eq!(parse_numstat(text), (3, 3, 1));
        assert_eq!(parse_numstat("\n\n"), (0, 0, 0));
    }

    #[test]
    fn reads_the_record_of_a_root_commit_that_has_no_parent_and_no_file() {
        let commits = parse_commits(&record(&"a".repeat(40), "", "Empty root", "", "")).unwrap();
        assert_eq!(commits[0].parents, Vec::<String>::new());
        assert_eq!((commits[0].files_changed, commits[0].insertions, commits[0].deletions), (0, 0, 0));
    }

    #[test]
    fn keeps_the_new_lines_and_the_tabs_of_a_body() {
        let commits = parse_commits(&record(&"a".repeat(40), "", "Subject", "line one\n\n\tline two\n\n", "")).unwrap();
        assert_eq!(commits[0].body, "line one\n\n\tline two");
    }
}
