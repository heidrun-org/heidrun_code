//! The command line `data_layer_coding_agents`: the commands initialize, update, and query.

mod command_line;

use command_line::{parse, Parsed, QueryRequest, SynchronizationRequest, HELP};
use data_layer_coding_agents::{
    agents_home, claude_dir, codex_home, default_database_path, describe_since, find_main_root, find_repository, find_root, ignore_log,
    price_list_source_of, synchronize, synchronize_configuration, synchronize_token_usage, to_json, to_table, ChatSessionsDatabase,
    ConfigurationDatabase, ConfigurationFolders, ModelPriceDatabase, PriceRefresh, ScanCache, TokenUsageDatabase, TokenUsageFiles,
    PRICE_LIST_ADDRESS,
};
use std::path::{Path, PathBuf};
use std::process::ExitCode;

/// The absolute path of the SQLite file: the path of the option `--database`, or else the default path.
fn database_path(option: &Option<String>) -> Result<PathBuf, String> {
    let path = option.as_ref().map(PathBuf::from).unwrap_or_else(default_database_path);
    std::path::absolute(&path).map_err(|error| format!("The path {} cannot be made absolute: {error}", path.display()))
}

/// The root of the repository that holds the folder of the option `--folder`, or else the current folder.
fn repository_root(option: &Option<String>) -> Result<PathBuf, String> {
    let folder = match option {
        Some(folder) => PathBuf::from(folder),
        None => std::env::current_dir().map_err(|error| error.to_string())?,
    };
    let folder = std::path::absolute(&folder)
        .map_err(|error| format!("The path {} cannot be made absolute: {error}", folder.display()))?;
    if !Path::new(&folder).is_dir() {
        return Err(format!("The folder {} does not exist.", folder.display()));
    }
    Ok(find_root(&folder))
}

/// Runs the mode initialize or the mode update, and prints a report of three lines on the standard output.
fn run_synchronization(request: &SynchronizationRequest) -> Result<(), String> {
    let root = repository_root(&request.folder)?;
    let repository = match &request.repository {
        Some(repository) => repository.clone(),
        None => find_repository(&root)?,
    };
    let database_path = database_path(&request.database)?;
    let print_progress = |message: &str| eprintln!("{message}");
    let log: &dyn Fn(&str) = if request.verbose { &print_progress } else { &ignore_log };
    log(&format!("repository: {repository}"));
    log(&format!("folder: {}", root.display()));
    log(&format!("database: {}", database_path.display()));
    let mut database = ChatSessionsDatabase::open(&database_path)?;
    let report = synchronize(
        request.mode,
        &repository,
        &root.display().to_string(),
        &claude_dir().join("projects"),
        &codex_home(),
        &mut database,
        log,
    )?;
    println!("{} -> {} ({})", report.repository, database_path.display(), report.mode.name());
    println!("chat sessions: {} written, read {}", report.chat_session_count, describe_since(report.since.as_deref()));
    let root_text = root.display().to_string();
    let folders = ConfigurationFolders {
        main_root: find_main_root(&root),
        root,
        claude_dir: claude_dir(),
        codex_home: codex_home(),
        agents_home: agents_home(),
    };
    let mut database = ConfigurationDatabase::open(&database_path)?;
    let counts = synchronize_configuration(request.mode, &repository, &folders, &mut database, log)?;
    let parts: Vec<String> = counts
        .iter()
        .map(|count| format!("{} {} written, {} removed", count.kind.table_name(), count.written_count, count.removed_count))
        .collect();
    println!("configuration: {}", parts.join(", "));
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default();
    let mut usage_database = TokenUsageDatabase::open(&database_path)?;
    let claude_projects = claude_dir().join("projects");
    let codex = codex_home();
    let mut cache = ScanCache::in_memory();
    let mut files = TokenUsageFiles { cache: &mut cache, claude_projects: &claude_projects, codex_home: &codex };
    let usage = synchronize_token_usage(request.mode, &repository, &root_text, &mut files, &mut usage_database, now, log)?;
    println!(
        "token usage: {} chat sessions read since {}, rows inserted {}, updated {}, deleted {}, unchanged {}",
        usage.chat_count,
        describe_since(usage.since.as_deref()).trim_start_matches("since "),
        usage.row_count.inserted_count,
        usage.row_count.updated_count,
        usage.row_count.deleted_count,
        usage.row_count.unchanged_count
    );
    println!("model prices: {}", refresh_prices(request, &database_path, now));
    Ok(())
}

/// Fetches the price list when the latest version is a day old or when the request forces it, and says what happened in one
/// sentence. A price list that cannot be fetched is a warning on the standard error output: the latest known prices stay in use.
fn refresh_prices(request: &SynchronizationRequest, database_path: &Path, now: i64) -> String {
    let source = price_list_source_of(request.price_list.as_deref().unwrap_or(PRICE_LIST_ADDRESS));
    let result = ModelPriceDatabase::open(database_path)
        .and_then(|mut database| database.refresh(source.as_ref(), now, request.is_price_refresh_forced));
    match result {
        Ok(PriceRefresh::NewVersion { version, model_count }) => {
            format!("version {version} written, {model_count} models, from {}", source.address())
        }
        Ok(PriceRefresh::Unchanged { version }) => format!("version {version} is still the price list of {}", source.address()),
        Ok(PriceRefresh::Fresh { version }) => format!("version {version} was checked less than a day ago"),
        Err(message) => {
            eprintln!("Warning: the model prices are not refreshed, and the latest known prices stay in use: {message}");
            "not refreshed".to_string()
        }
    }
}

/// Runs one read-only SQL statement, and prints the rows on the standard output.
fn run_query(request: &QueryRequest) -> Result<(), String> {
    let database = ChatSessionsDatabase::open_read_only(&database_path(&request.database)?)?;
    let rows = database.query(&request.sql)?;
    println!("{}", if request.json { to_json(&rows) } else { to_table(&rows) });
    Ok(())
}

/// Runs the command line.
fn run(arguments: &[String]) -> Result<(), String> {
    match parse(arguments)? {
        Parsed::Help => {
            print!("{HELP}");
            Ok(())
        }
        Parsed::Synchronize(request) => run_synchronization(&request),
        Parsed::Query(request) => run_query(&request),
    }
}

/// Exits with the code 1 and the message on the standard error output when an error happens.
fn main() -> ExitCode {
    let arguments: Vec<String> = std::env::args().skip(1).collect();
    match run(&arguments) {
        Ok(()) => ExitCode::SUCCESS,
        Err(message) => {
            eprintln!("Error: {message}");
            ExitCode::from(1)
        }
    }
}
