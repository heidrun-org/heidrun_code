//! Runs the mode initialize or the mode update of each source that is asked for, with the library of its data layer package.

use crate::database_lock::lock_database_and_report_wait;
use crate::output::QueryRow;
use crate::sources::Source;
use crate::OPERATION_PACKAGE;
use data_layer_operation_log::{Operation, OperationKind, OperationSpec, Summary};
use serde_json::{json, Value};
use std::path::PathBuf;

/// The mode of a synchronization, for every source.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SynchronizationMode {
    /// Read every source since the beginning.
    Initialize,
    /// Read only what is new in every source.
    Update,
}

impl SynchronizationMode {
    /// The name of the mode on the command line and in the output.
    pub fn name(self) -> &'static str {
        match self {
            SynchronizationMode::Initialize => "initialize",
            SynchronizationMode::Update => "update",
        }
    }
}

/// What the four sources need to be read. Each source takes only the fields that it uses.
#[derive(Debug, Clone)]
pub struct SynchronizationOptions {
    /// The absolute path of the SQLite file.
    pub database_path: PathBuf,
    /// The folder of the Git repository, or a folder inside it. For source control, code hosting, and coding agents.
    pub folder: PathBuf,
    /// The name of the repository in the format `owner/name`, or `None` for the one that each source finds from the folder.
    pub repository: Option<String>,
    /// The file of the user activity records. For user activity.
    pub user_activity_file: PathBuf,
    /// The folder of the configuration of Claude Code, for example `~/.claude`. For coding agents.
    pub claude_dir: PathBuf,
    /// The folder of Codex. For coding agents.
    pub codex_home: PathBuf,
    /// The folder `.agents` of the home folder, which several coding agents read. For coding agents.
    pub agents_home: PathBuf,
    /// The web address, or the path of the file, of the price list, or `None` for the public price list of LiteLLM. For coding
    /// agents.
    pub price_list: Option<String>,
    /// True to fetch the price list even when the latest version of the prices was checked less than a day ago. For coding
    /// agents.
    pub is_price_refresh_forced: bool,
}

/// The result of the synchronization of one source.
#[derive(Debug, Clone, PartialEq)]
pub struct SourceReport {
    /// The source.
    pub source: Source,
    /// The mode that ran.
    pub mode: SynchronizationMode,
    /// The repository that was read, or `None` for user activity, which has no repository.
    pub repository: Option<String>,
    /// The number of rows written in each table, in the order of the tables.
    pub written_rows: Vec<(String, usize)>,
    /// What went wrong without making the source fail, for example a price list that could not be fetched. Empty when all
    /// went well.
    pub warnings: Vec<String>,
}

impl SourceReport {
    /// The report as one row of the output: `source`, `mode`, `repository`, and `writtenRows`, an object with one count
    /// for each table, and `warnings` when there is one.
    pub fn to_row(&self) -> QueryRow {
        let written_rows: serde_json::Map<String, Value> =
            self.written_rows.iter().map(|(table, count)| (table.clone(), Value::from(*count))).collect();
        let row = json!({
            "source": self.source.name(),
            "mode": self.mode.name(),
            "repository": self.repository,
            "writtenRows": written_rows,
        });
        match row {
            Value::Object(mut row) => {
                if !self.warnings.is_empty() {
                    row.insert("warnings".to_string(), json!(self.warnings));
                }
                row
            }
            _ => unreachable!("The report is an object"),
        }
    }

    /// The report as one line for a person, for example `code_hosting: owner/name (update): issues 2 written, ...`. A warning
    /// ends the line.
    pub fn to_line(&self) -> String {
        let counts: Vec<String> =
            self.written_rows.iter().map(|(table, count)| format!("{table} {count} written")).collect();
        let warnings: String = self.warnings.iter().map(|warning| format!(" (warning: {warning})")).collect();
        match &self.repository {
            Some(repository) => {
                format!("{}: {repository} ({}): {}{warnings}", self.source.name(), self.mode.name(), counts.join(", "))
            }
            None => format!("{} ({}): {}{warnings}", self.source.name(), self.mode.name(), counts.join(", ")),
        }
    }
}

/// Runs the mode on each source, one after the other, in the fixed order of `Source::ALL`. Each source takes the lock of
/// the SQLite file while it writes, so it waits for the desktop application. A source that fails does not stop the others.
/// `log` receives the lines of progress of every source.
pub fn synchronize(
    mode: SynchronizationMode,
    sources: &[Source],
    options: &SynchronizationOptions,
    log: &dyn Fn(&str),
) -> Vec<(Source, Result<SourceReport, String>)> {
    let source_names: Vec<&str> = Source::in_fixed_order(sources).into_iter().map(Source::name).collect();
    let spec = OperationSpec::new(OPERATION_PACKAGE, "synchronize", OperationKind::Synchronization)
        .choice("mode", mode.name())
        .parameter("sources", source_names)
        .parameter("folder", options.folder.display().to_string())
        .parameter("repository", options.repository.clone())
        .parameter("userActivityFile", options.user_activity_file.display().to_string())
        .parameter("claudeDir", options.claude_dir.display().to_string())
        .parameter("codexHome", options.codex_home.display().to_string())
        .parameter("agentsHome", options.agents_home.display().to_string())
        .parameter("priceList", options.price_list.clone())
        .choice("isPriceRefreshForced", options.is_price_refresh_forced)
        .database(&options.database_path);
    let operation = Operation::start(spec);
    let results = synchronize_inside(mode, sources, options, log);
    let failed: Vec<&String> = results.iter().filter_map(|(_, result)| result.as_ref().err()).collect();
    let summary = Summary::count(results.len() - failed.len()).detail("failedSourceCount", failed.len());
    match failed.first() {
        Some(message) => operation.fail_with(message, summary),
        None => operation.succeed(summary),
    }
    results
}

/// The work of `synchronize`, between the start event and the completion event of its operation.
fn synchronize_inside(
    mode: SynchronizationMode,
    sources: &[Source],
    options: &SynchronizationOptions,
    log: &dyn Fn(&str),
) -> Vec<(Source, Result<SourceReport, String>)> {
    Source::in_fixed_order(sources)
        .into_iter()
        .map(|source| {
            log(&format!("source {}: mode {}", source.name(), mode.name()));
            let result = lock_database_and_report_wait(&options.database_path, log)
                .and_then(|_guard| synchronize_source(mode, source, options, log));
            (source, result)
        })
        .collect()
}

/// Runs the mode on one source.
fn synchronize_source(
    mode: SynchronizationMode,
    source: Source,
    options: &SynchronizationOptions,
    log: &dyn Fn(&str),
) -> Result<SourceReport, String> {
    match source {
        Source::SourceControl => synchronize_source_control(mode, options, log),
        Source::CodeHosting => synchronize_code_hosting(mode, options, log),
        Source::CodingAgents => synchronize_coding_agents(mode, options, log),
        Source::UserActivity => synchronize_user_activity(mode, options, log),
    }
}

/// Reads the commits, with `data_layer_source_control`.
fn synchronize_source_control(
    mode: SynchronizationMode,
    options: &SynchronizationOptions,
    log: &dyn Fn(&str),
) -> Result<SourceReport, String> {
    use data_layer_source_control as layer;
    let repository = match &options.repository {
        Some(repository) => repository.clone(),
        None => layer::find_repository(&options.folder)?,
    };
    let layer_mode = match mode {
        SynchronizationMode::Initialize => layer::SynchronizationMode::Initialize,
        SynchronizationMode::Update => layer::SynchronizationMode::Update,
    };
    let mut database = layer::SourceControlDatabase::open(&options.database_path)?;
    let runner = layer::GitCommandRunner::new(&options.folder);
    let reader = layer::GitReader::new(&runner, log);
    let report = layer::synchronize(layer_mode, &repository, &mut database, &reader, log)?;
    Ok(SourceReport {
        source: Source::SourceControl,
        mode,
        repository: Some(report.repository),
        written_rows: vec![("commits".to_string(), report.commit_count)],
        warnings: Vec::new(),
    })
}

/// Reads the issues and the pull requests, with `data_layer_code_hosting`.
fn synchronize_code_hosting(
    mode: SynchronizationMode,
    options: &SynchronizationOptions,
    log: &dyn Fn(&str),
) -> Result<SourceReport, String> {
    use data_layer_code_hosting as layer;
    let repository = match &options.repository {
        Some(repository) => repository.clone(),
        None => layer::find_repository(&options.folder)?,
    };
    let layer_mode = match mode {
        SynchronizationMode::Initialize => layer::SynchronizationMode::Initialize,
        SynchronizationMode::Update => layer::SynchronizationMode::Update,
    };
    let mut database = layer::CodeHostingDatabase::open(&options.database_path)?;
    let runner = layer::GhGraphqlRunner;
    let reader = layer::GithubReader::new(&runner, log);
    let report = layer::synchronize(layer_mode, &repository, &mut database, &reader, log)?;
    Ok(SourceReport {
        source: Source::CodeHosting,
        mode,
        repository: Some(report.repository),
        written_rows: vec![
            ("issues".to_string(), report.issue_count),
            ("pull_requests".to_string(), report.pull_request_count),
        ],
        warnings: Vec::new(),
    })
}

/// Reads the chat sessions of Claude Code and of Codex, the configuration of the coding agent, the tokens of each minute, and
/// the model prices, with `data_layer_coding_agents`. A price list that cannot be fetched is a warning, and not a failure: the
/// tokens are written, and their cost is calculated with the latest prices that the file holds.
fn synchronize_coding_agents(
    mode: SynchronizationMode,
    options: &SynchronizationOptions,
    log: &dyn Fn(&str),
) -> Result<SourceReport, String> {
    use data_layer_coding_agents as layer;
    if !options.folder.is_dir() {
        return Err(format!("The folder {} does not exist.", options.folder.display()));
    }
    let root = layer::find_root(&options.folder);
    let repository = match &options.repository {
        Some(repository) => repository.clone(),
        None => layer::find_repository(&root)?,
    };
    let layer_mode = match mode {
        SynchronizationMode::Initialize => layer::SynchronizationMode::Initialize,
        SynchronizationMode::Update => layer::SynchronizationMode::Update,
    };
    let mut database = layer::ChatSessionsDatabase::open(&options.database_path)?;
    let report = layer::synchronize(
        layer_mode,
        &repository,
        &root.display().to_string(),
        &options.claude_dir.join("projects"),
        &options.codex_home,
        &mut database,
        log,
    )?;
    let root_text = root.display().to_string();
    let folders = layer::ConfigurationFolders {
        main_root: layer::find_main_root(&root),
        root,
        claude_dir: options.claude_dir.clone(),
        codex_home: options.codex_home.clone(),
        agents_home: options.agents_home.clone(),
    };
    let mut configuration_database = layer::ConfigurationDatabase::open(&options.database_path)?;
    let counts = layer::synchronize_configuration(layer_mode, &repository, &folders, &mut configuration_database, log)?;
    let mut written_rows = vec![("chat_sessions".to_string(), report.chat_session_count)];
    written_rows.extend(counts.iter().map(|count| (count.kind.table_name().to_string(), count.written_count)));
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default();
    let mut usage_database = layer::TokenUsageDatabase::open(&options.database_path)?;
    let claude_projects = options.claude_dir.join("projects");
    let mut cache = layer::ScanCache::in_memory();
    let mut files =
        layer::TokenUsageFiles { cache: &mut cache, claude_projects: &claude_projects, codex_home: &options.codex_home };
    let usage_report =
        layer::synchronize_token_usage(layer_mode, &repository, &root_text, &mut files, &mut usage_database, now, log)?;
    written_rows.push(("token_usage_minutes".to_string(), usage_report.row_count.written_count()));
    let (price_rows, warnings) = refresh_prices(options, now, log);
    written_rows.extend(price_rows);
    Ok(SourceReport { source: Source::CodingAgents, mode, repository: Some(report.repository), written_rows, warnings })
}

/// Fetches the price list when the latest version of the prices is a day old, or when the options force it, and keeps it. Gives
/// the number of rows written in `model_price_versions` and in `model_prices`, and the warnings. A price list that cannot be
/// fetched or kept gives a warning, and the prices that the file holds stay as they are.
fn refresh_prices(options: &SynchronizationOptions, now: i64, log: &dyn Fn(&str)) -> (Vec<(String, usize)>, Vec<String>) {
    use data_layer_coding_agents as layer;
    let no_rows = vec![("model_price_versions".to_string(), 0), ("model_prices".to_string(), 0)];
    let source = layer::price_list_source_of(options.price_list.as_deref().unwrap_or(layer::PRICE_LIST_ADDRESS));
    let result = layer::ModelPriceDatabase::open(&options.database_path)
        .and_then(|mut database| database.refresh(source.as_ref(), now, options.is_price_refresh_forced));
    match result {
        Ok(layer::PriceRefresh::NewVersion { version, model_count }) => {
            log(&format!("model prices: new version {version} with {model_count} models from {}", source.address()));
            (vec![("model_price_versions".to_string(), 1), ("model_prices".to_string(), model_count)], Vec::new())
        }
        Ok(layer::PriceRefresh::Unchanged { version }) => {
            log(&format!("model prices: version {version} is still the price list of {}", source.address()));
            (no_rows, Vec::new())
        }
        Ok(layer::PriceRefresh::Fresh { version }) => {
            log(&format!("model prices: version {version} was checked less than a day ago"));
            (no_rows, Vec::new())
        }
        Err(message) => {
            log(&format!("model prices: not refreshed: {message}"));
            (no_rows, vec![format!("The model prices are not refreshed, and the latest known prices stay in use: {message}")])
        }
    }
}

/// Reads the user activity records, with `data_layer_user_activity`.
fn synchronize_user_activity(
    mode: SynchronizationMode,
    options: &SynchronizationOptions,
    log: &dyn Fn(&str),
) -> Result<SourceReport, String> {
    use data_layer_user_activity as layer;
    let layer_mode = match mode {
        SynchronizationMode::Initialize => layer::SynchronizationMode::Initialize,
        SynchronizationMode::Update => layer::SynchronizationMode::Update,
    };
    let mut database = layer::UserActivityDatabase::open(&options.database_path)?;
    let reader = layer::UserActivityFileReader::new(&options.user_activity_file);
    let report = layer::synchronize(layer_mode, &reader, &mut database, log)?;
    Ok(SourceReport {
        source: Source::UserActivity,
        mode,
        repository: None,
        written_rows: vec![("user_activity_records".to_string(), report.record_count)],
        warnings: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A report of code hosting with two tables.
    fn code_hosting_report() -> SourceReport {
        SourceReport {
            source: Source::CodeHosting,
            mode: SynchronizationMode::Update,
            repository: Some("owner/name".to_string()),
            written_rows: vec![("issues".to_string(), 2), ("pull_requests".to_string(), 1)],
            warnings: Vec::new(),
        }
    }

    #[test]
    fn writes_a_report_as_one_row_with_one_count_for_each_table() {
        assert_eq!(
            Value::Object(code_hosting_report().to_row()),
            json!({
                "source": "code_hosting",
                "mode": "update",
                "repository": "owner/name",
                "writtenRows": { "issues": 2, "pull_requests": 1 },
            })
        );
    }

    #[test]
    fn writes_the_warnings_of_a_report_in_its_row_and_at_the_end_of_its_line_and_nowhere_else() {
        let mut report = code_hosting_report();
        assert!(!report.to_row().contains_key("warnings"));
        report.warnings = vec!["The prices are old".to_string()];
        assert_eq!(Value::Object(report.to_row())["warnings"], json!(["The prices are old"]));
        assert!(report.to_line().ends_with("pull_requests 1 written (warning: The prices are old)"));
    }

    #[test]
    fn writes_a_report_as_one_line_with_or_without_a_repository() {
        assert_eq!(code_hosting_report().to_line(), "code_hosting: owner/name (update): issues 2 written, pull_requests 1 written");
        let report = SourceReport {
            source: Source::UserActivity,
            mode: SynchronizationMode::Initialize,
            repository: None,
            written_rows: vec![("user_activity_records".to_string(), 3)],
            warnings: Vec::new(),
        };
        assert_eq!(report.to_line(), "user_activity (initialize): user_activity_records 3 written");
    }
}
