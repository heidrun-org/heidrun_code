//! Fills the tables of the chat sessions from the files of Claude Code and of Codex, in the mode initialize or update.
//!
//! The date of the last read is not stored anywhere else: it is the largest value of the column `updatedAt` of the table
//! `chat_sessions`, for the repository and the folder. The mode update reads again only the chat session files that changed at
//! this date or later. When the table has no row for the folder, the mode update reads everything, as the mode initialize does.
//!
//! The tables of the configuration of the coding agent are small, so both modes read every memory file, subagent, and skill.
//! The mode initialize writes every row. The mode update writes only the rows that are new, that changed, or that are newly
//! marked as removed, so a second update without a change writes no row.
//!
//! The token usage of each minute has its own date of the last read, for each workspace, in the table
//! `token_usage_synchronizations`: the newest modification date of the files that the last read found. The mode update reads
//! again only the chat sessions whose files changed at this date or later, and the database writes only the rows that changed,
//! so a second synchronization without new files changes no row.

use crate::coding_agents::configuration_reader::{read_configuration, ConfigurationFolders};
use crate::coding_agents::scan_cache::ScanCache;
use crate::coding_agents::session_reader::{format_date, parse_date, read_chat_sessions};
use crate::coding_agents::token_usage_reader::{read_token_usage, TokenUsageFiles};
use crate::model::configuration_types::ConfigurationWriteCount;
use crate::model::token_usage_types::{TokenUsageReport, TokenUsageSynchronization};
use crate::model::types::{SynchronizationMode, SynchronizationReport};
use crate::storage::configuration_database::ConfigurationDatabase;
use crate::storage::database::ChatSessionsDatabase;
use crate::storage::token_usage_database::TokenUsageDatabase;
use std::path::Path;
use crate::OPERATION_PACKAGE;
use data_layer_operation_log::{record, OperationKind, OperationSpec, Summary};

/// Reads the chat sessions of a folder, and writes them in the database. `log` receives one line of progress for the date
/// where the read starts, for each coding agent, and for the write.
///
/// # Errors
/// An error when the database cannot be read or written, or when a chat session does not follow its JSON schema.
pub fn run(
    mode: SynchronizationMode,
    repository: &str,
    folder: &str,
    claude_projects: &Path,
    codex_home: &Path,
    database: &mut ChatSessionsDatabase,
    log: &dyn Fn(&str),
) -> Result<SynchronizationReport, String> {
    let spec = OperationSpec::new(OPERATION_PACKAGE, "synchronize", OperationKind::Synchronization)
        .choice("mode", mode.name())
        .parameter("repository", repository)
        .parameter("folder", folder)
        .parameter("claudeProjects", claude_projects.display().to_string())
        .parameter("codexHome", codex_home.display().to_string())
        .database(database.database_path());
    record(spec, || run_inside(mode, repository, folder, claude_projects, codex_home, database, log), |report| {
        Summary::count(report.chat_session_count)
    })
}

/// The work of `run`, between the start event and the completion event of its operation.
fn run_inside(
    mode: SynchronizationMode,
    repository: &str,
    folder: &str,
    claude_projects: &Path,
    codex_home: &Path,
    database: &mut ChatSessionsDatabase,
    log: &dyn Fn(&str),
) -> Result<SynchronizationReport, String> {
    let since = match mode {
        SynchronizationMode::Initialize => None,
        SynchronizationMode::Update => database.find_last_updated_at_in_folder(repository, folder)?,
    };
    log(&format!("mode {}: chat sessions are read {}", mode.name(), describe_since(since.as_deref())));
    let modified_since = since.as_deref().and_then(parse_date);
    let mut cache = ScanCache::in_memory();
    let records = read_chat_sessions(&mut cache, claude_projects, codex_home, folder, modified_since, log);
    database.upsert_chat_sessions(repository, &records)?;
    log(&format!("chat sessions: written row count {}, file {}", records.len(), database.database_path().display()));
    Ok(SynchronizationReport {
        mode,
        repository: repository.to_string(),
        since,
        chat_session_count: records.len(),
    })
}

/// Reads the memory files, the subagents, and the skills of the repository, and writes them in the database. A row whose
/// file the read does not find any more is marked as removed at the date of now. `log` receives one line of progress for
/// each table.
///
/// - The mode initialize writes every row that the read found.
/// - The mode update writes only the new rows, the rows whose data changed, and the rows newly marked as removed.
///
/// # Errors
/// An error when the database cannot be written, or when an item does not follow its JSON schema.
pub fn run_configuration(
    mode: SynchronizationMode,
    repository: &str,
    folders: &ConfigurationFolders,
    database: &mut ConfigurationDatabase,
    log: &dyn Fn(&str),
) -> Result<Vec<ConfigurationWriteCount>, String> {
    let spec = OperationSpec::new(OPERATION_PACKAGE, "synchronize_configuration", OperationKind::Synchronization)
        .choice("mode", mode.name())
        .parameter("repository", repository)
        .parameter("root", folders.root.display().to_string())
        .database(database.database_path());
    record(spec, || run_configuration_inside(mode, repository, folders, database, log), |counts| {
        Summary::count(counts.iter().map(|count| count.written_count).sum())
            .detail("removedCount", counts.iter().map(|count| count.removed_count).sum::<usize>())
    })
}

/// The work of `run_configuration`, between the start event and the completion event of its operation.
fn run_configuration_inside(
    mode: SynchronizationMode,
    repository: &str,
    folders: &ConfigurationFolders,
    database: &mut ConfigurationDatabase,
    log: &dyn Fn(&str),
) -> Result<Vec<ConfigurationWriteCount>, String> {
    let milliseconds = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default();
    let now = format_date(milliseconds).ok_or("The date of now cannot be written.")?;
    let mut counts = Vec::new();
    for read in read_configuration(folders) {
        let count = database.write_configuration(mode, repository, &read, &now)?;
        log(&format!(
            "{}: mode {}, written row count {}, marked as removed {}",
            read.kind.table_name(),
            mode.name(),
            count.written_count,
            count.removed_count
        ));
        counts.push(count);
    }
    Ok(counts)
}

/// Reads the tokens of each minute of the chat sessions that started in `folder` or below it, and writes them in the database.
/// `now` is the time of now in milliseconds since 1970. The cache of `files` keeps the scan of each file: a caller that runs
/// often gives a cache that it keeps, so a file that did not change is not read again. `log` receives one line of progress for
/// the date where the read starts, for each coding agent, and for the write.
///
/// - The mode initialize reads every chat session of the workspace.
/// - The mode update reads again the chat sessions whose files changed since the last read of the workspace, and every chat
///   session when the workspace was never read.
///
/// # Errors
/// An error when the database cannot be read or written.
pub fn run_token_usage(
    mode: SynchronizationMode,
    repository: &str,
    folder: &str,
    files: &mut TokenUsageFiles,
    database: &mut TokenUsageDatabase,
    now: i64,
    log: &dyn Fn(&str),
) -> Result<TokenUsageReport, String> {
    let spec = OperationSpec::new(OPERATION_PACKAGE, "synchronize_token_usage", OperationKind::Synchronization)
        .choice("mode", mode.name())
        .parameter("repository", repository)
        .parameter("folder", folder)
        .parameter("now", now)
        .state("scanCacheEntries", files.cache.scan_count())
        .database(database.database_path());
    record(spec, || run_token_usage_inside(mode, repository, folder, files, database, now, log), |report| {
        Summary::count(report.chat_count)
            .detail("rowsInserted", report.row_count.inserted_count)
            .detail("rowsUpdated", report.row_count.updated_count)
            .detail("rowsDeleted", report.row_count.deleted_count)
            .detail("rowsUnchanged", report.row_count.unchanged_count)
    })
}

/// The work of `run_token_usage`, between the start event and the completion event of its operation.
fn run_token_usage_inside(
    mode: SynchronizationMode,
    repository: &str,
    folder: &str,
    files: &mut TokenUsageFiles,
    database: &mut TokenUsageDatabase,
    now: i64,
    log: &dyn Fn(&str),
) -> Result<TokenUsageReport, String> {
    let previous = database.find_synchronization(repository, folder)?;
    let since = match mode {
        SynchronizationMode::Initialize => None,
        SynchronizationMode::Update => previous.as_ref().and_then(|previous| previous.read_up_to.clone()),
    };
    log(&format!("mode {}: token usage is read {}", mode.name(), describe_since(since.as_deref())));
    let usages = read_token_usage(files, folder, since.as_deref().and_then(parse_date), log);
    let newest = usages.iter().map(|usage| usage.updated_at.clone()).max_by_key(|date| parse_date(date));
    let read_up_to = [previous.and_then(|previous| previous.read_up_to), newest].into_iter().flatten().max_by_key(|date| parse_date(date));
    let synchronization = TokenUsageSynchronization {
        repository: repository.to_string(),
        folder: folder.to_string(),
        synchronized_at: format_date(now).ok_or("The date of now cannot be written.")?,
        read_up_to,
        mode: mode.name().to_string(),
    };
    let row_count = database.write_token_usage(repository, &usages, &synchronization)?;
    log(&format!(
        "token usage: chat sessions {}, rows inserted {}, updated {}, deleted {}, unchanged {}, file {}",
        usages.len(),
        row_count.inserted_count,
        row_count.updated_count,
        row_count.deleted_count,
        row_count.unchanged_count,
        database.database_path().display()
    ));
    Ok(TokenUsageReport {
        mode,
        repository: repository.to_string(),
        folder: folder.to_string(),
        since,
        chat_count: usages.len(),
        row_count,
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
    use crate::coding_agents::session_files::claude_folder_name;
    use crate::model::types::ChatSessionTable;
    use crate::test_samples::{codex_file, codex_message, ignore_log, temp_folder, write_file};

    const REPOSITORY: &str = "heidrun-org/heidrun";
    const TYPED: &str = r#"{"type":"user","cwd":"/work/app","timestamp":"2026-10-11T10:00:00.000Z","message":{"role":"user","content":"Fix the issue 250"}}"#;

    /// Writes a chat session file of Claude Code for `/work/app`.
    fn claude_file(directory: &Path, name: &str, age_seconds: u64) {
        let project = directory.join("projects").join(claude_folder_name("/work/app"));
        write_file(&project.join(format!("{name}.jsonl")), &format!("{TYPED}\n"), age_seconds);
    }

    /// A folder with two chat sessions of Claude Code and one of Codex, and an empty database.
    fn fixture(name: &str) -> (PathBuf, ChatSessionsDatabase) {
        let directory = temp_folder(name);
        claude_file(&directory, "older", 1000);
        claude_file(&directory, "newer", 500);
        codex_file(&directory, "2026/10/10", "01a12c31-175b-7513-b12c-bba764f46420", "/work/app", &[&codex_message("Hi")], 800);
        let database = ChatSessionsDatabase::open(&directory.join("data_layer.sqlite")).unwrap();
        (directory, database)
    }

    fn synchronize(mode: SynchronizationMode, directory: &Path, database: &mut ChatSessionsDatabase) -> SynchronizationReport {
        run(mode, REPOSITORY, "/work/app", &directory.join("projects"), directory, database, &ignore_log).unwrap()
    }

    use std::path::PathBuf;

    #[test]
    fn initialize_reads_everything_since_the_beginning_and_writes_every_row() {
        let (directory, mut database) = fixture("initialize");
        let report = synchronize(SynchronizationMode::Initialize, &directory, &mut database);
        assert_eq!(
            report,
            SynchronizationReport {
                mode: SynchronizationMode::Initialize,
                repository: REPOSITORY.to_string(),
                since: None,
                chat_session_count: 3,
            }
        );
        assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, REPOSITORY), Ok(3));
        assert_eq!(database.count_rows(ChatSessionTable::Issues, REPOSITORY), Ok(2));
        assert_eq!(database.find_relations(REPOSITORY, "newer").unwrap().issues, vec![250]);
    }

    #[test]
    fn initialize_two_times_in_a_row_gives_the_same_rows_with_no_row_written_two_times() {
        let (directory, mut database) = fixture("initialize_twice");
        synchronize(SynchronizationMode::Initialize, &directory, &mut database);
        let report = synchronize(SynchronizationMode::Initialize, &directory, &mut database);
        assert_eq!(report.chat_session_count, 3);
        assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, REPOSITORY), Ok(3));
        assert_eq!(database.count_rows(ChatSessionTable::Issues, REPOSITORY), Ok(2));
    }

    #[test]
    fn update_on_an_empty_database_reads_everything() {
        let (directory, mut database) = fixture("update_empty");
        let report = synchronize(SynchronizationMode::Update, &directory, &mut database);
        assert_eq!((report.since, report.chat_session_count), (None, 3));
    }

    #[test]
    fn update_reads_again_only_the_files_that_changed_since_the_last_read() {
        let (directory, mut database) = fixture("update_changes");
        synchronize(SynchronizationMode::Initialize, &directory, &mut database);
        let last = database.find_last_updated_at(REPOSITORY).unwrap().unwrap();
        let report = synchronize(SynchronizationMode::Update, &directory, &mut database);
        assert_eq!((report.since.as_deref(), report.chat_session_count), (Some(last.as_str()), 1));
        let changed = format!("{TYPED}\n{}\n", r#"{"type":"user","message":{"role":"user","content":"Merge pull request 249"}}"#);
        let project = directory.join("projects").join(claude_folder_name("/work/app"));
        write_file(&project.join("older.jsonl"), &changed, 1);
        let report = synchronize(SynchronizationMode::Update, &directory, &mut database);
        // The file that gave the date of the last read is read again, with the file that changed.
        assert_eq!(report.chat_session_count, 2);
        assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, REPOSITORY), Ok(3));
        assert_eq!(database.find_relations(REPOSITORY, "older").unwrap().pull_requests, vec![249]);
        assert_eq!(database.find_chat_session(REPOSITORY, "older").unwrap().unwrap().user_message_count, 2);
    }

    #[test]
    fn writes_nothing_for_a_folder_without_chat_sessions() {
        let directory = temp_folder("no_session");
        let mut database = ChatSessionsDatabase::open(&directory.join("data_layer.sqlite")).unwrap();
        let report = synchronize(SynchronizationMode::Initialize, &directory, &mut database);
        assert_eq!(report.chat_session_count, 0);
        assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, REPOSITORY), Ok(0));
    }

    #[test]
    fn writes_the_configuration_and_marks_a_removed_skill_on_the_next_run() {
        use crate::model::configuration_types::ConfigurationKind;
        let directory = temp_folder("configuration_run");
        let folders = ConfigurationFolders {
            root: directory.join("app"),
            main_root: directory.join("app"),
            claude_dir: directory.join("claude"),
            codex_home: directory.join("codex"),
            agents_home: directory.join("agents"),
        };
        let skill_file = folders.root.join(".claude/skills/a/SKILL.md");
        write_file(&skill_file, "---\nname: a\n---\n", 10);
        write_file(&folders.claude_dir.join("agents/b.md"), "---\nname: b\n---\n", 10);
        let mut database = ConfigurationDatabase::open(&directory.join("data_layer.sqlite")).unwrap();
        let counts = run_configuration(SynchronizationMode::Initialize, REPOSITORY, &folders, &mut database, &ignore_log).unwrap();
        let written: Vec<(usize, usize)> = counts.iter().map(|count| (count.written_count, count.removed_count)).collect();
        assert_eq!(written, [(0, 0), (1, 0), (1, 0)]);
        std::fs::remove_file(&skill_file).unwrap();
        let counts = run_configuration(SynchronizationMode::Update, REPOSITORY, &folders, &mut database, &ignore_log).unwrap();
        assert_eq!((counts[2].written_count, counts[2].removed_count), (0, 1));
        let skill_id = folders.root.join(".claude/skills/a").display().to_string();
        let skill = database.find_item(ConfigurationKind::Skill, REPOSITORY, &skill_id).unwrap().unwrap();
        assert!(skill.removed_at.is_some());
    }

    #[test]
    fn a_second_update_of_the_configuration_without_a_change_writes_no_row_and_initialize_writes_every_row() {
        let directory = temp_folder("configuration_unchanged_run");
        let folders = ConfigurationFolders {
            root: directory.join("app"),
            main_root: directory.join("app"),
            claude_dir: directory.join("claude"),
            codex_home: directory.join("codex"),
            agents_home: directory.join("agents"),
        };
        write_file(&folders.root.join(".claude/skills/a/SKILL.md"), "---\nname: a\n---\n", 10);
        write_file(&folders.claude_dir.join("agents/b.md"), "---\nname: b\n---\n", 10);
        let mut database = ConfigurationDatabase::open(&directory.join("data_layer.sqlite")).unwrap();
        let written_counts = |mode: SynchronizationMode, database: &mut ConfigurationDatabase| -> Vec<(usize, usize)> {
            let counts = run_configuration(mode, REPOSITORY, &folders, database, &ignore_log).unwrap();
            counts.iter().map(|count| (count.written_count, count.removed_count)).collect()
        };
        assert_eq!(written_counts(SynchronizationMode::Update, &mut database), [(0, 0), (1, 0), (1, 0)]);
        assert_eq!(written_counts(SynchronizationMode::Update, &mut database), [(0, 0), (0, 0), (0, 0)]);
        assert_eq!(written_counts(SynchronizationMode::Initialize, &mut database), [(0, 0), (1, 0), (1, 0)]);
        write_file(&folders.claude_dir.join("agents/b.md"), "---\nname: b\ndescription: Changed\n---\n", 5);
        assert_eq!(written_counts(SynchronizationMode::Update, &mut database), [(0, 0), (1, 0), (0, 0)]);
    }

    const ANSWER: &str = r#"{"type":"assistant","cwd":"/work/app","timestamp":"2026-10-11T10:00:05.000Z","message":{"id":"msg_1","model":"claude-opus-5","role":"assistant","content":[{"type":"text","text":"Done"}],"usage":{"input_tokens":10,"cache_creation_input_tokens":20,"cache_read_input_tokens":300,"output_tokens":5}}}"#;
    const NOW: i64 = 1_791_712_800_000;

    fn synchronize_usage(mode: SynchronizationMode, directory: &Path, database: &mut TokenUsageDatabase) -> TokenUsageReport {
        let mut cache = ScanCache::in_memory();
        let claude_projects = directory.join("projects");
        let mut files = TokenUsageFiles { cache: &mut cache, claude_projects: &claude_projects, codex_home: directory };
        run_token_usage(mode, REPOSITORY, "/work/app", &mut files, database, NOW, &ignore_log).unwrap()
    }

    fn usage_fixture(name: &str) -> (PathBuf, TokenUsageDatabase) {
        let directory = temp_folder(name);
        let project = directory.join("projects").join(claude_folder_name("/work/app"));
        write_file(&project.join("older.jsonl"), &format!("{TYPED}\n{ANSWER}\n"), 1000);
        write_file(&project.join("newer.jsonl"), &format!("{TYPED}\n{ANSWER}\n"), 500);
        let database = TokenUsageDatabase::open(&directory.join("data_layer.sqlite")).unwrap();
        (directory, database)
    }

    #[test]
    fn token_usage_initialize_writes_the_rows_and_the_synchronization_of_the_workspace() {
        let (directory, mut database) = usage_fixture("usage_initialize");
        let report = synchronize_usage(SynchronizationMode::Initialize, &directory, &mut database);
        assert_eq!((report.chat_count, report.since.clone(), report.row_count.inserted_count), (2, None, 2));
        assert_eq!(database.count_rows(REPOSITORY), Ok(2));
        let synchronization = database.find_synchronization(REPOSITORY, "/work/app").unwrap().unwrap();
        assert_eq!((synchronization.synchronized_at.as_str(), synchronization.mode.as_str()), ("2026-10-11T10:00:00.000Z", "initialize"));
        assert!(synchronization.read_up_to.is_some());
    }

    #[test]
    fn token_usage_synchronized_two_times_leaves_the_rows_unchanged() {
        let (directory, mut database) = usage_fixture("usage_twice");
        synchronize_usage(SynchronizationMode::Initialize, &directory, &mut database);
        let report = synchronize_usage(SynchronizationMode::Initialize, &directory, &mut database);
        assert_eq!((report.row_count.written_count(), report.row_count.deleted_count, report.row_count.unchanged_count), (0, 0, 2));
        let report = synchronize_usage(SynchronizationMode::Update, &directory, &mut database);
        assert_eq!((report.chat_count, report.row_count.written_count(), report.row_count.deleted_count), (1, 0, 0));
        assert_eq!(database.count_rows(REPOSITORY), Ok(2));
    }

    #[test]
    fn token_usage_update_reads_a_chat_session_that_grew_and_writes_only_the_new_rows() {
        let (directory, mut database) = usage_fixture("usage_grows");
        synchronize_usage(SynchronizationMode::Initialize, &directory, &mut database);
        let second = ANSWER.replace("msg_1", "msg_2").replace("10:00:05", "10:07:05");
        let project = directory.join("projects").join(claude_folder_name("/work/app"));
        write_file(&project.join("older.jsonl"), &format!("{TYPED}\n{ANSWER}\n{second}\n"), 1);
        let report = synchronize_usage(SynchronizationMode::Update, &directory, &mut database);
        assert_eq!((report.row_count.inserted_count, report.row_count.updated_count, report.row_count.deleted_count), (1, 0, 0));
        assert_eq!(database.count_rows(REPOSITORY), Ok(3));
    }

    #[test]
    fn token_usage_update_on_a_workspace_that_was_never_read_reads_everything() {
        let (directory, mut database) = usage_fixture("usage_update_empty");
        let report = synchronize_usage(SynchronizationMode::Update, &directory, &mut database);
        assert_eq!((report.since, report.chat_count), (None, 2));
    }

    #[test]
    fn writes_in_words_the_date_where_a_read_starts() {
        assert_eq!(describe_since(None), "since the beginning");
        assert_eq!(describe_since(Some("2026-10-11T10:00:00.000Z")), "since 2026-10-11T10:00:00.000Z");
    }

    #[test]
    fn a_chat_session_synchronization_records_one_operation_with_the_collection_and_the_write_inside_it() {
        let (directory, mut database) = fixture("data_layer_operation_log");
        let (report, events) = data_layer_operation_log::testing::capture(|| synchronize(SynchronizationMode::Initialize, &directory, &mut database));
        assert_eq!(report.chat_session_count, 3);
        let tree = data_layer_operation_log::testing::tree(&events);
        assert_eq!(tree[0], "coding_agents.synchronize");
        for inside in [
            "  coding_agents.read_chat_session_files",
            "    coding_agents.find_claude_session_files",
            "    coding_agents.find_codex_session_files",
            "  coding_agents.upsert_chat_sessions",
        ] {
            assert!(tree.contains(&inside.to_string()), "{inside} is not in {tree:?}");
        }
        let starts = data_layer_operation_log::testing::starts(&events);
        assert_eq!(starts[0].parameters["mode"], "initialize");
        assert_eq!(starts[0].parameters["folder"], "/work/app");
        let complete = data_layer_operation_log::testing::completion_of(&events, &starts[0].operation_id).unwrap();
        assert_eq!(complete.result_count, Some(3));
    }

    #[test]
    fn a_token_usage_synchronization_records_the_read_the_write_and_the_rows_that_the_write_changed() {
        let (directory, mut database) = usage_fixture("operation_log_usage");
        let (report, events) =
            data_layer_operation_log::testing::capture(|| synchronize_usage(SynchronizationMode::Initialize, &directory, &mut database));
        assert_eq!(report.chat_count, 2);
        let tree = data_layer_operation_log::testing::tree(&events);
        assert_eq!(tree[0], "coding_agents.synchronize_token_usage");
        assert!(tree.contains(&"  coding_agents.read_token_usage".to_string()), "{tree:?}");
        assert!(tree.contains(&"  coding_agents.write_token_usage".to_string()), "{tree:?}");
        let starts = data_layer_operation_log::testing::starts(&events);
        assert_eq!(starts[0].state["scanCacheEntries"], 0);
        let complete = data_layer_operation_log::testing::completion_of(&events, &starts[0].operation_id).unwrap();
        assert_eq!(complete.result_count, Some(2));
        assert_eq!(complete.details["rowsInserted"], 2);
        assert_eq!(complete.details["rowsUnchanged"], 0);
    }

    #[test]
    fn a_configuration_synchronization_records_the_read_and_one_write_for_each_kind() {
        let directory = temp_folder("operation_log_configuration");
        let folders = ConfigurationFolders {
            root: directory.join("root"),
            main_root: directory.join("root"),
            claude_dir: directory.join("claude"),
            codex_home: directory.join("codex"),
            agents_home: directory.join("agents"),
        };
        write_file(&folders.root.join(".claude/skills/a/SKILL.md"), "---\nname: a\n---\n", 10);
        let mut database = ConfigurationDatabase::open(&directory.join("data_layer.sqlite")).unwrap();
        let (_, events) = data_layer_operation_log::testing::capture(|| run_configuration(SynchronizationMode::Initialize, REPOSITORY, &folders, &mut database, &ignore_log).unwrap());
        let tree = data_layer_operation_log::testing::tree(&events);
        assert_eq!(tree[0], "coding_agents.synchronize_configuration");
        assert_eq!(tree[1], "  coding_agents.read_configuration");
        assert_eq!(tree.iter().filter(|line| line.as_str() == "  coding_agents.write_configuration").count(), 3);
    }
}
