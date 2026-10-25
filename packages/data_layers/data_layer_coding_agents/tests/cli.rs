//! Tests of the executable `data_layer_coding_agents`, with fake folders of Claude Code and of Codex given by the variables
//! `CLAUDE_CONFIG_DIR` and `CODEX_HOME`, a fake home folder given by the variable `HOME` for the folder `~/.agents`, and a
//! real Git repository with the remote `origin` `fake-owner/fake-name`.

use data_layer_coding_agents::{
    ChatSessionTable, ChatSessionsDatabase, ConfigurationDatabase, ConfigurationKind, ModelPriceDatabase, TokenUsageDatabase,
};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, SystemTime};

/// A message of the developer, in a chat session file of Claude Code.
const TYPED: &str = r#"{"type":"user","cwd":"FOLDER","timestamp":"2026-10-11T10:00:00.000Z","message":{"role":"user","content":"Fix the issue 250"}}"#;

/// An answer of Claude Code with its tokens, in the minute 2026-10-11 10:00 UTC.
const ANSWER: &str = r#"{"type":"assistant","cwd":"FOLDER","timestamp":"2026-10-11T10:00:05.000Z","message":{"id":"msg_1","model":"claude-opus-5","role":"assistant","content":[{"type":"text","text":"Done"}],"usage":{"input_tokens":10,"cache_creation_input_tokens":20,"cache_read_input_tokens":300,"output_tokens":5}}}"#;

/// A folder with a Git repository, a fake folder of Claude Code, a fake folder of Codex, and the path of a database file.
struct Fixture {
    folder: PathBuf,
    repository: PathBuf,
    database_path: PathBuf,
}

/// The result of one run of the executable.
struct CliResult {
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
}

/// The name that Claude Code gives to the folder of its chat sessions of `folder`.
fn claude_folder_name(folder: &str) -> String {
    folder.chars().map(|c| if c.is_ascii_alphanumeric() { c } else { '-' }).collect()
}

/// Writes a file with its folders, and sets its modification date to `age_seconds` seconds before now.
fn write_file(path: &Path, text: &str, age_seconds: u64) {
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, text).unwrap();
    let modified = SystemTime::now() - Duration::from_secs(age_seconds);
    std::fs::File::options().write(true).open(path).unwrap().set_modified(modified).unwrap();
}

impl Fixture {
    /// Makes the folders. The repository holds two chat sessions of Claude Code (`older` and `newer`).
    fn new(name: &str) -> Self {
        let folder = std::env::temp_dir().join(format!("data_layer_coding_agents_cli_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&folder);
        let repository = folder.join("repository").canonicalize_or_create();
        for arguments in [vec!["init", "-q"], vec!["remote", "add", "origin", "git@github.com:fake-owner/fake-name.git"]] {
            let status = Command::new("git").arg("-C").arg(&repository).args(arguments).status().unwrap();
            assert!(status.success());
        }
        let typed = TYPED.replace("FOLDER", &repository.display().to_string());
        let project = folder.join("claude").join("projects").join(claude_folder_name(&repository.display().to_string()));
        let price_list = r#"{"claude-opus-5": {"litellm_provider": "anthropic", "input_cost_per_token": 5e-06, "output_cost_per_token": 2.5e-05, "cache_read_input_token_cost": 5e-07, "cache_creation_input_token_cost": 6.25e-06}}"#;
        std::fs::write(folder.join("prices.json"), price_list).unwrap();
        let answer = ANSWER.replace("FOLDER", &repository.display().to_string());
        write_file(&project.join("older.jsonl"), &format!("{typed}\n"), 1000);
        write_file(&project.join("newer.jsonl"), &format!("{typed}\n{answer}\n"), 500);
        Fixture { database_path: folder.join("data_layer.sqlite"), repository, folder }
    }

    /// Runs the executable with the fake folders of the coding agents.
    fn run(&self, arguments: &[&str]) -> CliResult {
        let output = Command::new(env!("CARGO_BIN_EXE_data_layer_coding_agents"))
            .args(arguments)
            .env("HEIDRUN_CODE_OPERATION_LOG_FILE", "off")
            .env("CLAUDE_CONFIG_DIR", self.folder.join("claude"))
            .env("CODEX_HOME", self.folder.join("codex"))
            .env("HOME", self.folder.join("home"))
            .output()
            .unwrap();
        CliResult {
            stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
            stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
            exit_code: output.status.code(),
        }
    }

    /// The options that give the repository folder and the database file.
    fn options(&self) -> Vec<String> {
        vec![
            "--folder".to_string(),
            self.repository.display().to_string(),
            "--database".to_string(),
            self.database_path.display().to_string(),
            "--price-list".to_string(),
            self.folder.join("prices.json").display().to_string(),
        ]
    }

    /// Runs a command with the options of the fixture and some more arguments.
    fn run_with_options(&self, command: &str, more: &[&str]) -> CliResult {
        let options = self.options();
        let mut arguments: Vec<&str> = vec![command];
        arguments.extend(options.iter().map(String::as_str));
        arguments.extend_from_slice(more);
        self.run(&arguments)
    }
}

/// Makes a folder and gives its real path, so that the path equals the path that `git` and the program find.
trait CanonicalizeOrCreate {
    /// Creates the folder, and gives its canonical path.
    fn canonicalize_or_create(&self) -> PathBuf;
}

impl CanonicalizeOrCreate for PathBuf {
    fn canonicalize_or_create(&self) -> PathBuf {
        std::fs::create_dir_all(self).unwrap();
        self.canonicalize().unwrap()
    }
}

#[test]
fn prints_the_help_and_exits_with_the_code_0() {
    let result = Fixture::new("help").run(&["--help"]);
    assert_eq!(result.exit_code, Some(0));
    assert!(result.stdout.contains("Usage: data_layer_coding_agents"));
    assert!(result.stdout.contains("initialize") && result.stdout.contains("chat_session_issues"));
}

#[test]
fn initialize_writes_every_chat_session_and_prints_a_report_of_five_lines() {
    let fixture = Fixture::new("initialize");
    let result = fixture.run_with_options("initialize", &[]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    let lines: Vec<&str> = result.stdout.lines().collect();
    assert_eq!(lines.len(), 5, "{}", result.stdout);
    assert!(lines[0].starts_with("fake-owner/fake-name -> ") && lines[0].ends_with("(initialize)"), "{}", lines[0]);
    assert_eq!(lines[1], "chat sessions: 2 written, read since the beginning");
    assert_eq!(
        lines[3],
        "token usage: 2 chat sessions read since the beginning, rows inserted 1, updated 0, deleted 0, unchanged 0"
    );
    assert!(lines[4].starts_with("model prices: version 1 written, 1 models, from "), "{}", lines[4]);
    let database = ChatSessionsDatabase::open_read_only(&fixture.database_path).unwrap();
    assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, "fake-owner/fake-name"), Ok(2));
    let relations = database.find_relations("fake-owner/fake-name", "newer").unwrap();
    assert_eq!(relations.issues, vec![250]);
    assert_eq!(relations.folders, vec![fixture.repository.display().to_string()]);
    let usage = TokenUsageDatabase::open_read_only(&fixture.database_path).unwrap();
    assert_eq!(usage.count_rows("fake-owner/fake-name"), Ok(1));
    let prices = ModelPriceDatabase::open_read_only(&fixture.database_path).unwrap();
    assert_eq!(prices.load_latest_table().unwrap().prices.len(), 1);
}

#[test]
fn the_cost_view_prices_the_tokens_of_the_minute_and_a_second_run_changes_nothing() {
    let fixture = Fixture::new("cost");
    assert_eq!(fixture.run_with_options("initialize", &[]).exit_code, Some(0));
    let again = fixture.run_with_options("update", &["--refresh-prices"]);
    assert_eq!(again.exit_code, Some(0), "{}", again.stderr);
    assert!(again.stdout.contains("rows inserted 0, updated 0, deleted 0, unchanged 1"), "{}", again.stdout);
    assert!(again.stdout.contains("model prices: version 1 is still the price list of "), "{}", again.stdout);
    let query = fixture.run(&[
        "query",
        "--database",
        &fixture.database_path.display().to_string(),
        "--json",
        "SELECT minuteAt, model, freshInputTokens, costUsd FROM token_usage_with_cost",
    ]);
    assert_eq!(query.exit_code, Some(0), "{}", query.stderr);
    let rows: serde_json::Value = serde_json::from_str(&query.stdout).unwrap();
    assert_eq!(rows[0]["minuteAt"], "2026-10-11T10:00:00.000Z");
    assert_eq!(rows[0]["model"], "claude-opus-5");
    // (10 × 5 + 300 × 0.5 + 20 × 6.25 + 5 × 25) = 450, divided by 1 000 000
    let cost = rows[0]["costUsd"].as_f64().unwrap();
    assert!((cost - 0.00045).abs() < 1e-12, "{cost}");
}

#[test]
fn a_price_list_that_cannot_be_read_is_a_warning_and_the_prices_stay_in_use() {
    let fixture = Fixture::new("price_warning");
    assert_eq!(fixture.run_with_options("initialize", &[]).exit_code, Some(0));
    std::fs::remove_file(fixture.folder.join("prices.json")).unwrap();
    let result = fixture.run_with_options("update", &["--refresh-prices"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stderr.contains("Warning: the model prices are not refreshed"), "{}", result.stderr);
    assert!(result.stdout.contains("model prices: not refreshed"), "{}", result.stdout);
}

#[test]
fn initialize_and_update_write_the_memory_files_the_subagents_and_the_skills_and_mark_a_removed_file() {
    let fixture = Fixture::new("configuration");
    let project = fixture.folder.join("claude").join("projects").join(claude_folder_name(&fixture.repository.display().to_string()));
    let memory_file = project.join("memory").join("never-rebase.md");
    let memory_text = "---\nname: never-rebase\ndescription: Merge only\nmetadata:\n  type: feedback\n  originSessionId: newer\n---\nNever rebase.\n";
    write_file(&memory_file, memory_text, 100);
    write_file(&fixture.repository.join(".claude/agents/reviewer.md"), "---\nname: reviewer\n---\n", 100);
    write_file(&fixture.repository.join(".agents/skills/style/SKILL.md"), "---\nname: style\n---\n", 100);
    write_file(&fixture.folder.join("home/.agents/skills/find/SKILL.md"), "---\nname: find\n---\n", 100);
    let result = fixture.run_with_options("initialize", &[]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert_eq!(
        result.stdout.lines().nth(2),
        Some("configuration: memory_files 1 written, 0 removed, subagents 1 written, 0 removed, skills 2 written, 0 removed")
    );
    let result = fixture.run_with_options("update", &[]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert_eq!(
        result.stdout.lines().nth(2),
        Some("configuration: memory_files 0 written, 0 removed, subagents 0 written, 0 removed, skills 0 written, 0 removed")
    );
    std::fs::remove_file(&memory_file).unwrap();
    let result = fixture.run_with_options("update", &[]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains("memory_files 0 written, 1 removed,"), "{}", result.stdout);
    let database = ConfigurationDatabase::open(&fixture.database_path).unwrap();
    let item = database
        .find_item(ConfigurationKind::MemoryFile, "fake-owner/fake-name", &memory_file.display().to_string())
        .unwrap()
        .unwrap();
    assert_eq!((item.memory_type.as_deref(), item.origin_chat_session_id.as_deref()), (Some("feedback"), Some("newer")));
    assert!(item.removed_at.is_some());
}

#[test]
fn update_reads_again_only_the_newest_file_and_reports_the_date_of_the_last_read() {
    let fixture = Fixture::new("update");
    fixture.run_with_options("initialize", &[]);
    let result = fixture.run_with_options("update", &[]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.contains("chat sessions: 1 written, read since 2026-"), "{}", result.stdout);
    let database = ChatSessionsDatabase::open_read_only(&fixture.database_path).unwrap();
    assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, "fake-owner/fake-name"), Ok(2));
}

#[test]
fn the_option_repository_replaces_the_remote_origin() {
    let fixture = Fixture::new("repository_option");
    let result = fixture.run_with_options("initialize", &["--repository", "other-owner/other-name"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stdout.starts_with("other-owner/other-name -> "), "{}", result.stdout);
}

#[test]
fn the_option_verbose_prints_the_progress_on_the_standard_error_output_only() {
    let fixture = Fixture::new("verbose");
    let result = fixture.run_with_options("initialize", &["--verbose"]);
    assert_eq!(result.exit_code, Some(0), "{}", result.stderr);
    assert!(result.stderr.contains("repository: fake-owner/fake-name"), "{}", result.stderr);
    assert!(result.stderr.contains("claude code: 2 chat session files, 2 to read"), "{}", result.stderr);
    assert!(!result.stdout.contains("claude code"), "{}", result.stdout);
}

#[test]
fn query_prints_a_text_table_and_a_json_list() {
    let fixture = Fixture::new("query");
    fixture.run_with_options("initialize", &[]);
    let table = fixture.run(&["query", "--database", &fixture.database_path.display().to_string(), "SELECT id FROM chat_sessions ORDER BY id"]);
    assert_eq!(table.exit_code, Some(0), "{}", table.stderr);
    assert_eq!(table.stdout.trim_end(), "id\n-----\nnewer\nolder\nrow count: 2");
    let json = fixture.run(&[
        "query",
        "--json",
        "--database",
        &fixture.database_path.display().to_string(),
        "SELECT count(*) AS count FROM chat_session_issues",
    ]);
    assert_eq!(json.exit_code, Some(0), "{}", json.stderr);
    let rows: serde_json::Value = serde_json::from_str(&json.stdout).unwrap();
    assert_eq!(rows, serde_json::json!([{ "count": 2 }]));
}

#[test]
fn query_refuses_a_statement_that_writes_and_a_database_that_does_not_exist() {
    let fixture = Fixture::new("query_refused");
    let missing = fixture.run(&["query", "--database", &fixture.database_path.display().to_string(), "SELECT 1"]);
    assert_eq!(missing.exit_code, Some(1));
    assert!(missing.stderr.contains("does not exist"), "{}", missing.stderr);
    fixture.run_with_options("initialize", &[]);
    let write = fixture.run(&["query", "--database", &fixture.database_path.display().to_string(), "DELETE FROM chat_sessions"]);
    assert_eq!(write.exit_code, Some(1));
    assert!(write.stderr.starts_with("Error: "), "{}", write.stderr);
    let database = ChatSessionsDatabase::open_read_only(&fixture.database_path).unwrap();
    assert_eq!(database.count_rows(ChatSessionTable::ChatSessions, "fake-owner/fake-name"), Ok(2));
}

#[test]
fn exits_with_the_code_1_for_a_folder_without_remote_origin_and_for_an_unknown_command() {
    let fixture = Fixture::new("errors");
    let bare = fixture.folder.join("bare").canonicalize_or_create();
    Command::new("git").arg("-C").arg(&bare).args(["init", "-q"]).status().unwrap();
    let no_origin = fixture.run(&["initialize", "--folder", &bare.display().to_string(), "--database", &fixture.database_path.display().to_string()]);
    assert_eq!(no_origin.exit_code, Some(1));
    assert!(no_origin.stderr.contains("--repository"), "{}", no_origin.stderr);
    let unknown = fixture.run(&["fetch"]);
    assert_eq!(unknown.exit_code, Some(1));
    assert!(unknown.stderr.starts_with("Error: The command fetch is not known"), "{}", unknown.stderr);
}
