//! The file `.env` of the developer: its variables go into the environment of the application, in Heidrun Code Development
//! only. The file `.env.example` at the root of the repository lists and explains every variable.

use std::path::PathBuf;

/// Loads the file `.env` of the current folder, or of the nearest parent folder, into the environment. A variable that
/// is already set keeps its value, so a variable of the shell wins over the file. Loads nothing for the installed application,
/// because the application of a user must never read a file of the folder that started it.
///
/// Returns the path of the loaded file, or `None` when nothing was loaded.
pub fn load(is_development: bool) -> Option<PathBuf> {
    if is_development == false {
        return None;
    }
    let loaded = keep_loaded_path(dotenvy::dotenv());
    if let Some(path) = &loaded {
        eprintln!("Heidrun Code: the variables of the file {} are loaded.", path.display());
    }
    loaded
}

/// The path of a loaded file. `None` when the file does not exist, which is normal. `None` too when the file exists but
/// cannot be read: the error goes to the error output, and the application starts without the file.
fn keep_loaded_path(result: Result<PathBuf, dotenvy::Error>) -> Option<PathBuf> {
    match result {
        Ok(path) => Some(path),
        Err(error) if error.not_found() => None,
        Err(error) => {
            eprintln!("Heidrun Code: the file .env cannot be read, so it is ignored: {error}");
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeSet;
    use std::path::Path;

    /// A new folder for one test, with the file `.env` inside, and the path of the file.
    fn write_file(name: &str, text: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("hd-env-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(".env");
        std::fs::write(&path, text).unwrap();
        path
    }

    /// Loads one file the way `load` does, without the search in the parent folders.
    fn load_file(path: &Path) -> Option<PathBuf> {
        keep_loaded_path(dotenvy::from_path(path).map(|_| path.to_path_buf()))
    }

    #[test]
    fn loads_the_variables_of_a_file_and_ignores_the_commented_lines() {
        let path = write_file(
            "loads",
            "# a comment\nHEIDRUN_CODE_TEST_ENVIRONMENT_FILE_LOADED=yes\n# HEIDRUN_CODE_TEST_ENVIRONMENT_FILE_COMMENTED=yes\n",
        );
        assert_eq!(load_file(&path), Some(path));
        assert_eq!(std::env::var("HEIDRUN_CODE_TEST_ENVIRONMENT_FILE_LOADED").as_deref(), Ok("yes"));
        assert!(std::env::var("HEIDRUN_CODE_TEST_ENVIRONMENT_FILE_COMMENTED").is_err());
    }

    #[test]
    fn keeps_the_value_of_a_variable_that_is_already_set() {
        let path = write_file("kept", "HEIDRUN_CODE_TEST_ENVIRONMENT_FILE_KEPT=from the file\n");
        std::env::set_var("HEIDRUN_CODE_TEST_ENVIRONMENT_FILE_KEPT", "from the shell");
        load_file(&path);
        assert_eq!(std::env::var("HEIDRUN_CODE_TEST_ENVIRONMENT_FILE_KEPT").as_deref(), Ok("from the shell"));
    }

    #[test]
    fn finds_nothing_in_a_missing_file() {
        let path = std::env::temp_dir().join(format!("hd-env-{}-missing", std::process::id())).join(".env");
        assert_eq!(load_file(&path), None);
    }

    #[test]
    fn ignores_a_file_that_cannot_be_read() {
        let path = write_file("broken", "HEIDRUN_CODE_TEST_ENVIRONMENT_FILE_BROKEN=\"never closed\n");
        assert_eq!(load_file(&path), None);
        assert!(std::env::var("HEIDRUN_CODE_TEST_ENVIRONMENT_FILE_BROKEN").is_err());
    }

    /// The variables that the tests read and the application does not.
    const READ_BY_TESTS_ONLY: [&str; 1] = ["HOME"];

    /// The variables of the system that the application reads and changes, and that a developer never sets in `.env`.
    const SYSTEM_VARIABLES: [&str; 1] = ["PATH"];

    /// The variables that the application gives to another program, and never reads: the Claude Code observer mod reads
    /// `HEIDRUN_CODE_DASHBOARD_OBSERVATION_DIR`, so a developer never sets it in `.env`.
    const GIVEN_TO_OTHER_PROGRAMS: [&str; 1] = ["HEIDRUN_CODE_DASHBOARD_OBSERVATION_DIR"];

    /// The path of the file `.env.example`, at the root of the repository.
    fn example_path() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../.env.example")
    }

    /// Every Rust file of the folder, and of its subfolders.
    fn rust_files(folder: &Path) -> Vec<PathBuf> {
        let mut files = Vec::new();
        for entry in std::fs::read_dir(folder).unwrap() {
            let path = entry.unwrap().path();
            if path.is_dir() {
                files.extend(rust_files(&path));
            } else if path.extension().is_some_and(|extension| extension == "rs") {
                files.push(path);
            }
        }
        files
    }

    /// The names of the environment variables that a source text reads: the name in `env::var("NAME")`,
    /// `var_os("NAME")`, and `non_empty_variable("NAME")`, and every text between quotes that starts with `HEIDRUN_CODE_`.
    fn read_variable_names(source: &str) -> BTreeSet<String> {
        let mut names = BTreeSet::new();
        let prefixes = [("env::var(\"", 10), ("var_os(\"", 8), ("non_empty_variable(\"", 20), ("\"HEIDRUN_CODE_", 1)];
        for (prefix, name_offset) in prefixes {
            for (position, _) in source.match_indices(prefix) {
                let name: String = source[position + name_offset..].chars().take_while(is_name_character).collect();
                if name.is_empty() == false {
                    names.insert(name);
                }
            }
        }
        names
    }

    /// The names of the variables that the file `.env.example` shows: a line `NAME=value`, with or without the `#`
    /// of a comment before it.
    fn example_variable_names(text: &str) -> BTreeSet<String> {
        text.lines()
            .map(|line| line.trim_start_matches('#').trim())
            .filter_map(|line| line.split_once('='))
            .map(|(name, _)| name.to_string())
            .filter(|name| name.is_empty() == false && name.chars().all(|character| is_name_character(&character)))
            .collect()
    }

    /// True for a character that the name of an environment variable can hold: a capital letter, a digit, or `_`.
    fn is_name_character(character: &char) -> bool {
        character.is_ascii_uppercase() || character.is_ascii_digit() || *character == '_'
    }

    #[test]
    fn the_file_env_example_lists_exactly_the_variables_that_the_sources_read() {
        let mut read = BTreeSet::new();
        let manifest_folder = Path::new(env!("CARGO_MANIFEST_DIR"));
        // The package `data_layer_coding_agents` reads the variables `CLAUDE_CONFIG_DIR` and `CODEX_HOME` for the application.
        // The package `mobile_server` reads the variables `HEIDRUN_CODE_DIR` and `HEIDRUN_CODE_NGROK` for the application.
        let source_folders = [
            manifest_folder.join("src"),
            manifest_folder.join("../../../submodules/heidrun_data/packages/data_layer_coding_agents/src"),
            manifest_folder.join("../../auxiliary/mobile_server/src"),
        ];
        for file in source_folders.iter().flat_map(|folder| rust_files(folder)) {
            if file.file_name().is_some_and(|name| name == "environment_file.rs") {
                continue;
            }
            read.extend(read_variable_names(&std::fs::read_to_string(&file).unwrap()));
        }
        for name in READ_BY_TESTS_ONLY.into_iter().chain(SYSTEM_VARIABLES).chain(GIVEN_TO_OTHER_PROGRAMS) {
            read.remove(name);
        }
        let listed = example_variable_names(&std::fs::read_to_string(example_path()).unwrap());
        let missing: Vec<&String> = read.difference(&listed).collect();
        let unused: Vec<&String> = listed.difference(&read).collect();
        assert!(missing.is_empty(), "variables that the sources read, and `.env.example` does not show: {missing:?}");
        assert!(unused.is_empty(), "variables that `.env.example` shows, and no source reads: {unused:?}");
    }

    #[test]
    fn the_file_env_example_sets_no_variable_until_the_developer_removes_a_comment_sign() {
        let entries: Vec<_> = dotenvy::from_path_iter(example_path()).unwrap().collect();
        assert!(entries.is_empty(), "every variable of `.env.example` must stay commented out: {entries:?}");
    }
}
