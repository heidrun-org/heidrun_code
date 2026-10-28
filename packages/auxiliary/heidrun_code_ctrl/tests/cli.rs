//! Tests of the executable `heidrun_code_ctrl`, with a temporary folder of the data of Heidrun Code (the variable `HEIDRUN_CODE_DIR`) and a
//! temporary project that has the folder `.heidrun`. The tests never touch the real files of the developer.

use serde_json::Value;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// The temporary folders of one test, and the way to run the executable in them.
struct Fixture {
    /// The folder of the variable `HEIDRUN_CODE_DIR`.
    data_folder: PathBuf,
    /// The project: it has the folder `.heidrun`.
    project: PathBuf,
}

/// What an execution gave.
struct Run {
    stdout: String,
    stderr: String,
    exit_code: i32,
}

impl Run {
    /// The standard output as JSON.
    fn json(&self) -> Value {
        serde_json::from_str(&self.stdout).unwrap_or_else(|error| panic!("{error}: {}", self.stdout))
    }
}

impl Fixture {
    fn new(name: &str) -> Fixture {
        let base = std::env::temp_dir().join(format!("heidrun_code_ctrl_cli_{name}_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        let data_folder = base.join("data");
        let project = base.join("project");
        std::fs::create_dir_all(&data_folder).unwrap();
        std::fs::create_dir_all(project.join(".heidrun")).unwrap();
        Fixture { data_folder, project }
    }

    fn personal_file(&self) -> PathBuf {
        self.data_folder.join("macros.json")
    }

    fn project_file(&self) -> PathBuf {
        self.project.join(".heidrun").join("config.json")
    }

    fn voice_words_file(&self) -> PathBuf {
        self.data_folder.join("voice_words.json")
    }

    /// Runs the executable in the project folder, with the text as its standard input.
    fn run_with_input(&self, arguments: &[&str], input: &str) -> Run {
        let mut child = Command::new(env!("CARGO_BIN_EXE_heidrun_code_ctrl"))
            .args(arguments)
            .current_dir(&self.project)
            .env("HEIDRUN_CODE_DIR", &self.data_folder)
            .env("PATH", format!("{}:{}", self.project.display(), std::env::var("PATH").unwrap()))
            .env_remove("HERDR_SESSION")
            .env_remove("HERDR_SOCKET_PATH")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        child.stdin.take().unwrap().write_all(input.as_bytes()).unwrap();
        let output = child.wait_with_output().unwrap();
        Run {
            stdout: String::from_utf8(output.stdout).unwrap(),
            stderr: String::from_utf8(output.stderr).unwrap(),
            exit_code: output.status.code().unwrap(),
        }
    }

    fn run(&self, arguments: &[&str]) -> Run {
        self.run_with_input(arguments, "")
    }
}

#[test]
fn the_list_has_the_four_hard_coded_macros_when_the_developer_made_none() {
    let fixture = Fixture::new("list_empty");
    let run = fixture.run(&["macros", "list", "--format", "json"]);
    assert_eq!(run.exit_code, 0, "{}", run.stderr);
    let list = run.json();
    assert_eq!(list.as_array().unwrap().len(), 4);
    assert!(list.as_array().unwrap().iter().all(|item| item["kind"] == "hard_coded" && item["file"].is_null()));
}

#[test]
fn the_default_format_is_markdown_even_when_the_output_is_not_a_terminal() {
    let fixture = Fixture::new("markdown");
    let run = fixture.run(&["macros", "list"]);
    assert!(run.stdout.starts_with("# Macros\n"));
    assert!(run.stdout.contains("### Review the merge request"));
}

#[test]
fn a_personal_macro_is_added_listed_updated_and_deleted_and_the_file_follows_each_step() {
    let fixture = Fixture::new("personal_life");
    let added = fixture.run(&["macros", "add", "--label", "Run the tests", "--text", "Run the tests first.", "--json"]);
    assert_eq!(added.exit_code, 0, "{}", added.stderr);
    let id = added.json()["id"].as_str().unwrap().to_string();
    assert!(id.starts_with("run-the-tests-"));
    let file: Value = serde_json::from_str(&std::fs::read_to_string(fixture.personal_file()).unwrap()).unwrap();
    assert_eq!(file[0]["text"], "Run the tests first.");

    let listed = fixture.run(&["macros", "list", "--kind", "personal", "--json"]).json();
    assert_eq!(listed.as_array().unwrap().len(), 1);
    assert_eq!(listed[0]["id"], id.as_str());

    let updated =
        fixture.run(&["macros", "update", &id, "--text", "Run the tests, then the linter.", "--description", "Two steps", "--json"]);
    assert_eq!(updated.exit_code, 0, "{}", updated.stderr);
    assert_eq!(updated.json()["label"], "Run the tests");
    let file: Value = serde_json::from_str(&std::fs::read_to_string(fixture.personal_file()).unwrap()).unwrap();
    assert_eq!(file[0]["text"], "Run the tests, then the linter.");
    assert_eq!(file[0]["description"], "Two steps");

    let deleted = fixture.run(&["macros", "delete", &id, "--json"]);
    assert_eq!(deleted.exit_code, 0, "{}", deleted.stderr);
    assert_eq!(deleted.json()["deleted"]["id"], id.as_str());
    let file: Value = serde_json::from_str(&std::fs::read_to_string(fixture.personal_file()).unwrap()).unwrap();
    assert_eq!(file, serde_json::json!([]));
}

#[test]
fn a_project_macro_goes_in_the_key_prompts_of_the_project_file_and_the_other_keys_stay() {
    let fixture = Fixture::new("project_life");
    std::fs::write(fixture.project_file(), r#"{"version":1,"launchers":[{"id":"l","label":"L","command":"ls"}]}"#).unwrap();
    let added = fixture.run(&["macros", "add", "--kind", "project", "--label", "Review", "--text", "Review the branch.", "--json"]);
    assert_eq!(added.exit_code, 0, "{}", added.stderr);
    assert_eq!(added.json()["kind"], "project");
    let config: Value = serde_json::from_str(&std::fs::read_to_string(fixture.project_file()).unwrap()).unwrap();
    assert_eq!(config["launchers"][0]["command"], "ls");
    assert_eq!(config["prompts"][0]["label"], "Review");
    assert!(!fixture.personal_file().exists());
}

#[test]
fn the_project_is_found_from_a_folder_inside_it() {
    let fixture = Fixture::new("project_folder");
    std::fs::write(fixture.project_file(), r#"{"version":1,"launchers":[],"prompts":[{"id":"p","text":"In the project"}]}"#).unwrap();
    let inside = fixture.project.join("src").join("deeper");
    std::fs::create_dir_all(&inside).unwrap();
    let listed = fixture.run(&["macros", "list", "--kind", "project", "--folder", inside.to_str().unwrap(), "--json"]).json();
    assert_eq!(listed[0]["id"], "p");
}

#[test]
fn a_text_on_several_lines_comes_from_the_standard_input_without_its_last_new_line() {
    let fixture = Fixture::new("standard_input");
    let run = fixture.run_with_input(&["macros", "add", "--label", "Lines", "--text", "-", "--json"], "One.\nTwo \"quoted\".\n");
    assert_eq!(run.exit_code, 0, "{}", run.stderr);
    assert_eq!(run.json()["text"], "One.\nTwo \"quoted\".");
}

#[test]
fn a_hard_coded_macro_is_refused_by_update_and_delete_with_the_exit_code_1_and_no_file() {
    let fixture = Fixture::new("hard_coded");
    for arguments in [vec!["macros", "update", "revue-mr", "--text", "X"], vec!["macros", "delete", "revue-mr"]] {
        let run = fixture.run(&arguments);
        assert_eq!(run.exit_code, 1);
        assert_eq!(run.stdout, "");
        assert!(run.stderr.starts_with("Error: The macro revue-mr is hard-coded in Heidrun Code and cannot be"), "{}", run.stderr);
    }
    assert!(!fixture.personal_file().exists());
    let add = fixture.run(&["macros", "add", "--kind", "hard_coded", "--text", "X"]);
    assert_eq!(add.exit_code, 1);
}

#[test]
fn an_error_is_one_json_object_on_one_line_on_the_standard_error_output_with_the_format_json() {
    let fixture = Fixture::new("error_json");
    let run = fixture.run(&["macros", "delete", "nothing", "--json"]);
    assert_eq!(run.exit_code, 1);
    assert_eq!(run.stdout, "");
    let error: Value = serde_json::from_str(run.stderr.trim_end()).unwrap();
    assert!(error["error"].as_str().unwrap().contains("macros list"));
    assert_eq!(run.stderr.trim_end().lines().count(), 1);
    let usage = fixture.run(&["macros", "oops", "--format", "json"]);
    assert!(serde_json::from_str::<Value>(usage.stderr.trim_end()).unwrap()["error"].is_string());
}

#[test]
fn a_file_that_is_not_valid_is_an_error_and_is_never_overwritten() {
    let fixture = Fixture::new("not_valid");
    std::fs::write(fixture.personal_file(), "[ not json").unwrap();
    let run = fixture.run(&["macros", "add", "--label", "A", "--text", "B"]);
    assert_eq!(run.exit_code, 1);
    assert!(run.stderr.contains("is not a list of macros"));
    assert_eq!(std::fs::read_to_string(fixture.personal_file()).unwrap(), "[ not json");
}

#[test]
fn the_help_is_on_the_standard_output_with_the_exit_code_0() {
    let fixture = Fixture::new("help");
    for arguments in [vec!["--help"], vec!["macros", "list", "-h"], vec!["launchers", "update", "-h"]] {
        let run = fixture.run(&arguments);
        assert_eq!(run.exit_code, 0);
        assert!(run.stdout.starts_with("Usage: heidrun_code_ctrl <group> <command> [options]"));
    }
}

#[test]
fn the_colors_come_from_a_renderer_so_the_output_has_no_escape_character() {
    let fixture = Fixture::new("no_color");
    assert!(!fixture.run(&["macros", "list"]).stdout.contains('\u{1b}'));
}

// ---- The launchers --------------------------------------------------------------------------------------------------

impl Fixture {
    /// The file `.heidrun/config.json` of the project, as JSON.
    fn project_json(&self) -> Value {
        serde_json::from_str(&std::fs::read_to_string(self.project_file()).unwrap()).unwrap()
    }
}

#[test]
fn a_project_with_no_file_lists_no_launcher_and_the_markdown_says_none() {
    let fixture = Fixture::new("launchers_empty");
    let run = fixture.run(&["launchers", "list", "--format", "json"]);
    assert_eq!(run.exit_code, 0, "{}", run.stderr);
    assert_eq!(run.json(), serde_json::json!([]));
    let markdown = fixture.run(&["launchers", "list"]);
    assert!(markdown.stdout.starts_with("# Launchers\n\nFile: `"));
    assert!(markdown.stdout.ends_with("config.json`\n\nNone.\n"));
    assert!(!fixture.project_file().exists());
}

#[test]
fn a_launcher_is_added_listed_updated_and_deleted_and_the_file_follows_each_step() {
    let fixture = Fixture::new("launchers_life");
    let added = fixture.run(&["launchers", "add", "--label", "Run the tests", "--command", "pnpm test", "--json"]);
    assert_eq!(added.exit_code, 0, "{}", added.stderr);
    let id = added.json()["id"].as_str().unwrap().to_string();
    assert!(id.starts_with("run-the-tests-") && id.len() == "run-the-tests-".len() + 4, "{id}");
    assert_eq!(fixture.project_json()["launchers"][0], serde_json::json!({ "id": id, "label": "Run the tests", "command": "pnpm test" }));
    assert!(!fixture.personal_file().exists());

    let listed = fixture.run(&["launchers", "list", "--json"]).json();
    assert_eq!(listed.as_array().unwrap().len(), 1);
    assert_eq!(listed[0]["id"], id.as_str());
    assert_eq!(listed[0]["description"], Value::Null);

    let updated =
        fixture.run(&["launchers", "update", &id, "--command", "pnpm run test:unit", "--cwd", "web", "--description", "Fast", "--json"]);
    assert_eq!(updated.exit_code, 0, "{}", updated.stderr);
    assert_eq!(updated.json()["label"], "Run the tests");
    assert_eq!(
        fixture.project_json()["launchers"][0],
        serde_json::json!({ "id": id, "label": "Run the tests", "command": "pnpm run test:unit", "description": "Fast", "cwd": "web" })
    );

    let cleared = fixture.run(&["launchers", "update", &id, "--cwd", "", "--description", "", "--json"]);
    assert_eq!(cleared.exit_code, 0, "{}", cleared.stderr);
    assert_eq!(
        fixture.project_json()["launchers"][0],
        serde_json::json!({ "id": id, "label": "Run the tests", "command": "pnpm run test:unit" })
    );

    let deleted = fixture.run(&["launchers", "delete", &id, "--json"]);
    assert_eq!(deleted.exit_code, 0, "{}", deleted.stderr);
    assert_eq!(deleted.json()["deleted"]["id"], id.as_str());
    assert_eq!(fixture.project_json()["launchers"], serde_json::json!([]));
}

#[test]
fn a_launcher_without_a_name_or_an_id_gets_the_name_and_the_id_that_the_window_makes() {
    let fixture = Fixture::new("launchers_defaults");
    let added = fixture.run(&["launchers", "add", "--command", "pnpm --filter web_frontend test", "--json"]).json();
    assert_eq!(added["label"], "pnpm --filter web_fr");
    assert!(added["id"].as_str().unwrap().starts_with("pnpm-filter-web-fr-"));
    let named = fixture.run(&["launchers", "add", "--id", "mine", "--label", "Mine", "--command", "ls", "--json"]).json();
    assert_eq!(named["id"], "mine");
    let taken = fixture.run(&["launchers", "add", "--id", "mine", "--command", "pwd"]);
    assert_eq!(taken.exit_code, 1);
    assert!(taken.stderr.contains("already exists"));
    assert_eq!(fixture.project_json()["launchers"].as_array().unwrap().len(), 2);
}

#[test]
fn a_command_line_on_several_lines_comes_from_the_standard_input_without_its_last_new_line() {
    let fixture = Fixture::new("launchers_standard_input");
    let run = fixture.run_with_input(&["launchers", "add", "--label", "Lines", "--command", "-", "--json"], "cd web\necho \"quoted\"\n");
    assert_eq!(run.exit_code, 0, "{}", run.stderr);
    assert_eq!(run.json()["command"], "cd web\necho \"quoted\"");
    let id = run.json()["id"].as_str().unwrap().to_string();
    let updated = fixture.run_with_input(&["launchers", "update", &id, "--command", "-", "--json"], "pwd\n");
    assert_eq!(updated.json()["command"], "pwd");
}

#[test]
fn the_launcher_commands_keep_every_other_key_in_its_order_and_every_other_field() {
    let fixture = Fixture::new("launchers_keep");
    std::fs::write(
        fixture.project_file(),
        r#"{"version":1,"guards":{"block":["rm"]},"launchers":[{"id":"a","label":"A","command":"ls","extra":true}],"prompts":[{"id":"p","text":"T"}]}"#,
    )
    .unwrap();
    let added = fixture.run(&["launchers", "add", "--id", "b", "--command", "pwd"]);
    assert_eq!(added.exit_code, 0, "{}", added.stderr);
    let updated = fixture.run(&["launchers", "update", "a", "--label", "Renamed"]);
    assert_eq!(updated.exit_code, 0, "{}", updated.stderr);
    let config = fixture.project_json();
    let keys: Vec<&String> = config.as_object().unwrap().keys().collect();
    assert_eq!(keys, ["version", "guards", "launchers", "prompts"]);
    assert_eq!(config["guards"]["block"][0], "rm");
    assert_eq!(config["prompts"][0]["id"], "p");
    assert_eq!(config["launchers"][0], serde_json::json!({ "id": "a", "label": "Renamed", "command": "ls", "extra": true }));
    assert_eq!(config["launchers"][1]["id"], "b");
}

#[test]
fn the_macro_commands_keep_the_launchers_of_the_project() {
    let fixture = Fixture::new("launchers_after_macros");
    fixture.run(&["launchers", "add", "--id", "a", "--command", "ls"]);
    let added = fixture.run(&["macros", "add", "--kind", "project", "--label", "Review", "--text", "Review it."]);
    assert_eq!(added.exit_code, 0, "{}", added.stderr);
    let config = fixture.project_json();
    assert_eq!(config["launchers"][0]["id"], "a");
    assert_eq!(config["prompts"][0]["label"], "Review");
}

#[test]
fn the_old_key_actions_is_listed_and_a_change_writes_the_key_launchers_in_its_place() {
    let fixture = Fixture::new("launchers_legacy");
    std::fs::write(fixture.project_file(), r#"{"version":1,"actions":[{"id":"a","label":"A","command":"ls"}],"prompts":[]}"#).unwrap();
    let listed = fixture.run(&["launchers", "list", "--json"]).json();
    assert_eq!(listed[0]["id"], "a");
    assert!(std::fs::read_to_string(fixture.project_file()).unwrap().contains("\"actions\""));
    let run = fixture.run(&["launchers", "add", "--id", "b", "--command", "pwd"]);
    assert_eq!(run.exit_code, 0, "{}", run.stderr);
    let config = fixture.project_json();
    let keys: Vec<&String> = config.as_object().unwrap().keys().collect();
    assert_eq!(keys, ["version", "launchers", "prompts"]);
    assert_eq!(config["launchers"].as_array().unwrap().len(), 2);
}

#[test]
fn a_launcher_of_the_kind_coding_agent_is_listed_with_its_agent_and_stays_intact_after_an_update() {
    let fixture = Fixture::new("launchers_agent");
    let agent = r#"{"name":"claude","model":"opus","effort":"high","prompt":"Fix it"}"#;
    std::fs::write(
        fixture.project_file(),
        format!(r#"{{"version":1,"launchers":[{{"id":"a","label":"Fixer","command":"claude --model opus 'Fix it'","agent":{agent}}}]}}"#),
    )
    .unwrap();
    let listed = fixture.run(&["launchers", "list", "--json"]).json();
    assert_eq!(listed[0]["agent"]["model"], "opus");
    let markdown = fixture.run(&["launchers", "list"]).stdout;
    assert!(markdown.contains("- agent: claude, model opus, effort high\n"), "{markdown}");

    let updated = fixture.run(&["launchers", "update", "a", "--label", "Fixer 2", "--cwd", "web", "--description", "Fixes it", "--json"]);
    assert_eq!(updated.exit_code, 0, "{}", updated.stderr);
    let entry = &fixture.project_json()["launchers"][0];
    assert_eq!(entry["agent"], serde_json::from_str::<Value>(agent).unwrap());
    assert_eq!(entry["command"], "claude --model opus 'Fix it'");
    assert_eq!(entry["label"], "Fixer 2");

    let before = std::fs::read_to_string(fixture.project_file()).unwrap();
    let refused = fixture.run(&["launchers", "update", "a", "--command", "ls"]);
    assert_eq!(refused.exit_code, 1);
    assert!(refused.stderr.contains("kind Coding agent"), "{}", refused.stderr);
    assert_eq!(std::fs::read_to_string(fixture.project_file()).unwrap(), before);
}

#[test]
fn a_launcher_file_that_is_not_valid_is_an_error_and_is_never_overwritten() {
    let fixture = Fixture::new("launchers_not_valid");
    for text in [
        "{ not json",
        r#"{"version":1,"launchers":"ls"}"#,
        r#"{"version":1,"launchers":[{"id":"a","label":"A"}]}"#,
        r#"{"version":1,"launchers":[],"actions":[]}"#,
    ] {
        std::fs::write(fixture.project_file(), text).unwrap();
        for arguments in [vec!["launchers", "add", "--command", "ls"], vec!["launchers", "list"], vec!["launchers", "delete", "a"]] {
            let run = fixture.run(&arguments);
            assert_eq!(run.exit_code, 1, "{text}: {arguments:?}");
            assert_eq!(run.stdout, "");
            assert!(run.stderr.starts_with("Error: The file "), "{}", run.stderr);
        }
        assert_eq!(std::fs::read_to_string(fixture.project_file()).unwrap(), text);
    }
}

#[test]
fn the_launcher_errors_are_one_json_object_on_one_line_and_change_no_file() {
    let fixture = Fixture::new("launchers_errors");
    for arguments in [
        vec!["launchers", "delete", "nothing", "--json"],
        vec!["launchers", "update", "nothing", "--label", "A", "--json"],
        vec!["launchers", "add", "--command", "  ", "--json"],
        vec!["launchers", "add", "--json"],
        vec!["launchers", "update", "a", "--json"],
        vec!["launchers", "run", "--json"],
    ] {
        let run = fixture.run(&arguments);
        assert_eq!(run.exit_code, 1, "{arguments:?}");
        assert_eq!(run.stdout, "");
        assert_eq!(run.stderr.trim_end().lines().count(), 1);
        assert!(serde_json::from_str::<Value>(run.stderr.trim_end()).unwrap()["error"].is_string());
    }
    assert!(!fixture.project_file().exists());
    let unknown = fixture.run(&["launchers", "delete", "nothing"]);
    assert!(unknown.stderr.contains("launchers list"));
}

#[test]
fn the_launcher_commands_refuse_the_options_of_the_macros() {
    let fixture = Fixture::new("launchers_options");
    for arguments in [vec!["launchers", "list", "--kind", "project"], vec!["launchers", "add", "--text", "x", "--command", "ls"]] {
        let run = fixture.run(&arguments);
        assert_eq!(run.exit_code, 1);
        assert!(run.stderr.contains("does not accept the option"), "{}", run.stderr);
    }
    assert_eq!(fixture.run(&["macros", "list", "--command", "ls"]).exit_code, 1);
}

#[test]
fn the_launchers_are_found_from_a_folder_inside_the_project() {
    let fixture = Fixture::new("launchers_folder");
    std::fs::write(fixture.project_file(), r#"{"version":1,"launchers":[{"id":"a","label":"A","command":"ls"}]}"#).unwrap();
    let inside = fixture.project.join("src").join("deeper");
    std::fs::create_dir_all(&inside).unwrap();
    let listed = fixture.run(&["launchers", "list", "--folder", inside.to_str().unwrap(), "--json"]).json();
    assert_eq!(listed[0]["id"], "a");
}

#[test]
fn the_markdown_of_a_launcher_has_its_name_its_id_and_its_command_line_in_a_code_block() {
    let fixture = Fixture::new("launchers_markdown");
    let added = fixture.run(&["launchers", "add", "--id", "t", "--label", "Tests", "--command", "pnpm test", "--cwd", "web"]);
    assert!(added.stdout.starts_with("Added the launcher `t` in the file `"), "{}", added.stdout);
    assert!(added.stdout.contains("## Tests\n\n- id: `t`\n- folder: `web`\n\n```bash\npnpm test\n```\n"));
    assert!(!added.stdout.contains('\u{1b}'));
    let deleted = fixture.run(&["launchers", "delete", "t"]);
    assert_eq!(deleted.stdout, "Deleted the launcher `t` (Tests).\n");
}

// ---- The voice words ------------------------------------------------------------------------------------------------

#[test]
fn the_voice_word_list_is_empty_when_the_file_does_not_exist_and_the_markdown_says_none() {
    let fixture = Fixture::new("voice_words_empty");
    let listed = fixture.run(&["voice_words", "list", "--json"]);
    assert_eq!(listed.exit_code, 0, "{}", listed.stderr);
    assert_eq!(listed.json().as_array().unwrap().len(), 0);
    let markdown = fixture.run(&["voice_words", "list"]);
    assert!(markdown.stdout.starts_with("# Voice words\n\nFile: `"), "{}", markdown.stdout);
    assert!(markdown.stdout.ends_with("None.\n"));
    assert!(!fixture.voice_words_file().exists());
}

#[test]
fn a_voice_word_is_added_listed_updated_and_deleted_and_the_file_follows_each_step() {
    let fixture = Fixture::new("voice_words_life");
    let added = fixture.run(&["voice_words", "add", "--whisper-writes", "jerome etienne", "--heidrun-writes", "Jérôme Étienne", "--json"]);
    assert_eq!(added.exit_code, 0, "{}", added.stderr);
    let word = added.json();
    let id = word["id"].as_str().unwrap().to_string();
    assert!(id.starts_with("jerome-etienne-"), "{id}");
    assert_eq!(word["whisper_writes"], "jerome etienne");
    assert_eq!(word["heidrun_writes"], "Jérôme Étienne");
    let file: Value = serde_json::from_str(&std::fs::read_to_string(fixture.voice_words_file()).unwrap()).unwrap();
    assert_eq!(file, serde_json::json!([word]));

    let updated = fixture.run(&["voice_words", "update", &id, "--heidrun-writes", "Jérôme", "--json"]);
    assert_eq!(updated.exit_code, 0, "{}", updated.stderr);
    assert_eq!(updated.json()["whisper_writes"], "jerome etienne");
    assert_eq!(updated.json()["heidrun_writes"], "Jérôme");

    let listed = fixture.run(&["voice_words", "list", "--json"]).json();
    assert_eq!(listed.as_array().unwrap().len(), 1);
    assert_eq!(listed[0]["heidrun_writes"], "Jérôme");

    let deleted = fixture.run(&["voice_words", "delete", &id, "--json"]);
    assert_eq!(deleted.exit_code, 0, "{}", deleted.stderr);
    assert_eq!(deleted.json()["deleted"]["id"], id.as_str());
    assert_eq!(fixture.run(&["voice_words", "list", "--json"]).json().as_array().unwrap().len(), 0);
}

#[test]
fn the_spaces_at_the_ends_of_a_text_and_an_empty_replacement_reach_the_file() {
    let fixture = Fixture::new("voice_words_spaces");
    let added = fixture.run(&["voice_words", "add", "--id", "at", "--whisper-writes", " at sign ", "--heidrun-writes", "@", "--json"]);
    assert_eq!(added.exit_code, 0, "{}", added.stderr);
    assert_eq!(added.json()["whisper_writes"], " at sign ");
    let removed = fixture.run(&["voice_words", "add", "--id", "um", "--whisper-writes", " um", "--heidrun-writes", "", "--json"]);
    assert_eq!(removed.exit_code, 0, "{}", removed.stderr);
    let file: Value = serde_json::from_str(&std::fs::read_to_string(fixture.voice_words_file()).unwrap()).unwrap();
    assert_eq!(file[0]["whisper_writes"], " at sign ");
    assert_eq!(file[1]["heidrun_writes"], "");
}

#[test]
fn the_markdown_of_a_voice_word_shows_both_texts_between_double_quotes() {
    let fixture = Fixture::new("voice_words_markdown");
    let added = fixture.run(&["voice_words", "add", "--id", "at", "--whisper-writes", " at sign ", "--heidrun-writes", "@"]);
    assert!(added.stdout.starts_with("Added the entry `at` in the file `"), "{}", added.stdout);
    assert!(added.stdout.contains("## at\n\n- Whisper writes: \" at sign \"\n- Heidrun Code writes instead: \"@\"\n"));
    assert!(!added.stdout.contains('\u{1b}'));
    let deleted = fixture.run(&["voice_words", "delete", "at"]);
    assert_eq!(deleted.stdout, "Deleted the entry `at` (\" at sign \").\n");
}

#[test]
fn the_voice_word_errors_are_one_json_object_on_one_line_and_change_no_file() {
    let fixture = Fixture::new("voice_words_errors");
    for arguments in [
        vec!["voice_words", "add", "--whisper-writes", "  ", "--heidrun-writes", "x", "--json"],
        vec!["voice_words", "add", "--whisper-writes", "x", "--json"],
        vec!["voice_words", "update", "nothing", "--heidrun-writes", "x", "--json"],
        vec!["voice_words", "delete", "nothing", "--json"],
        vec!["voice_words", "update", "nothing", "--json"],
    ] {
        let run = fixture.run(&arguments);
        assert_eq!(run.exit_code, 1, "{arguments:?}");
        assert_eq!(run.stdout, "");
        assert_eq!(run.stderr.trim_end().lines().count(), 1);
        assert!(serde_json::from_str::<Value>(run.stderr.trim_end()).unwrap()["error"].is_string());
    }
    assert!(!fixture.voice_words_file().exists());
}

#[test]
fn a_second_voice_word_with_the_same_text_that_whisper_writes_is_refused() {
    let fixture = Fixture::new("voice_words_copy");
    fixture.run(&["voice_words", "add", "--id", "a", "--whisper-writes", "Jerome", "--heidrun-writes", "Jérôme"]);
    let run = fixture.run(&["voice_words", "add", "--id", "b", "--whisper-writes", "JEROME", "--heidrun-writes", "Other", "--json"]);
    assert_eq!(run.exit_code, 1);
    assert!(run.stderr.contains("The entry a already has the text that Whisper writes"), "{}", run.stderr);
    assert_eq!(fixture.run(&["voice_words", "list", "--json"]).json().as_array().unwrap().len(), 1);
}

#[test]
fn a_voice_word_file_that_is_not_valid_is_an_error_and_is_never_overwritten() {
    let fixture = Fixture::new("voice_words_not_valid");
    std::fs::write(fixture.voice_words_file(), "[ not json").unwrap();
    for arguments in [
        vec!["voice_words", "list"],
        vec!["voice_words", "add", "--whisper-writes", "a", "--heidrun-writes", "b"],
        vec!["voice_words", "delete", "a"],
    ] {
        let run = fixture.run(&arguments);
        assert_eq!(run.exit_code, 1, "{arguments:?}");
        assert!(run.stderr.contains("is not a list of entries"), "{}", run.stderr);
    }
    assert_eq!(std::fs::read_to_string(fixture.voice_words_file()).unwrap(), "[ not json");
}

#[test]
fn the_voice_word_commands_refuse_the_options_of_the_other_groups_and_change_no_other_file() {
    let fixture = Fixture::new("voice_words_options");
    for arguments in [
        vec!["voice_words", "add", "--text", "x", "--whisper-writes", "a", "--heidrun-writes", "b"],
        vec!["voice_words", "list", "--kind", "personal"],
        vec!["voice_words", "list", "--folder", "x"],
        vec!["macros", "list", "--whisper-writes", "a"],
        vec!["launchers", "list", "--heidrun-writes", "a"],
    ] {
        let run = fixture.run(&arguments);
        assert_eq!(run.exit_code, 1, "{arguments:?}");
        assert!(run.stderr.contains("does not accept the option"), "{}", run.stderr);
    }
    fixture.run(&["voice_words", "add", "--whisper-writes", "a", "--heidrun-writes", "b"]);
    assert!(!fixture.personal_file().exists());
    assert!(!fixture.project_file().exists());
}

#[test]
fn the_voice_words_are_found_from_any_folder_because_the_file_belongs_to_the_developer() {
    let fixture = Fixture::new("voice_words_folder");
    fixture.run(&["voice_words", "add", "--id", "a", "--whisper-writes", "one", "--heidrun-writes", "1"]);
    let outside = fixture.data_folder.parent().unwrap().join("outside");
    std::fs::create_dir_all(&outside).unwrap();
    let mut command = std::process::Command::new(env!("CARGO_BIN_EXE_heidrun_code_ctrl"));
    let output = command
        .args(["voice_words", "list", "--json"])
        .current_dir(&outside)
        .env("HEIDRUN_CODE_DIR", &fixture.data_folder)
        .output()
        .unwrap();
    let listed: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(listed[0]["id"], "a");
}

// ---- The SKILL.md ---------------------------------------------------------------------------------------------------

/// The text of the `SKILL.md` of the package, in the folder `skills/heidrun-code-ctrl`.
fn skill_text() -> String {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("skills").join("heidrun-code-ctrl").join("SKILL.md");
    std::fs::read_to_string(path).unwrap()
}

/// The words of a text: the runs of letters, digits, underscores, and dashes.
fn words(text: &str) -> Vec<String> {
    text.split(|c: char| !(c.is_ascii_alphanumeric() || c == '_' || c == '-')).map(str::to_string).collect()
}

#[test]
fn the_skill_names_no_command_no_kind_and_no_option_that_the_help_does_not_have() {
    let fixture = Fixture::new("skill_help");
    let help = fixture.run(&["--help"]).stdout;
    let help_words = words(&help);
    let skill = skill_text();
    for line in skill.lines().filter(|line| !line.starts_with("description:")) {
        for group in ["macros", "launchers", "voice_words"] {
            let prefix = format!("heidrun_code_ctrl {group} ");
            let mut rest = line;
            while let Some(at) = rest.find(&prefix) {
                rest = &rest[at + prefix.len()..];
                let command = words(rest).into_iter().next().unwrap_or_default();
                assert!(["list", "add", "update", "delete"].contains(&command.as_str()), "{command}: {line}");
            }
        }
        for word in words(line).into_iter().filter(|word| word.starts_with("--") && word.trim_matches('-').len() > 0) {
            assert!(help_words.contains(&word), "The help has no option {word}");
        }
    }
    for group in ["macros", "launchers", "voice_words"] {
        for command in ["list", "add", "update", "delete"] {
            assert!(skill.contains(&format!("heidrun_code_ctrl {group} {command}")), "{group} {command}");
            assert!(help.contains(&format!("{group} {command}")), "{group} {command}");
        }
    }
    for command in ["list", "open", "rename", "focus", "close"] {
        assert!(skill.contains(&format!("heidrun_code_ctrl workspaces {command}")));
        assert!(help.contains(&format!("workspaces {command}")));
    }
    for kind in ["hard_coded", "personal", "project"] {
        assert!(skill.contains(&format!("`{kind}`")) && help.contains(kind), "{kind}");
    }
}

#[test]
fn the_skill_names_the_fields_of_a_listed_macro_and_of_a_listed_launcher_and_every_variable_of_a_text() {
    let fixture = Fixture::new("skill_fields");
    let listed = fixture.run(&["macros", "list", "--json"]).json();
    let skill = skill_text();
    for field in listed[0].as_object().unwrap().keys() {
        assert!(skill.contains(&format!("`{field}`")), "{field}");
    }
    for variable in ["{workspace}", "{onglet}", "{agent}", "{branche}", "{selection}", "{presse-papiers}"] {
        assert!(skill.contains(variable), "{variable}");
    }
    fixture.run(&["launchers", "add", "--command", "ls"]);
    let launchers = fixture.run(&["launchers", "list", "--json"]).json();
    for field in launchers[0].as_object().unwrap().keys() {
        assert!(skill.contains(&format!("`{field}`")), "{field}");
    }
    fixture.run(&["voice_words", "add", "--whisper-writes", "a", "--heidrun-writes", "b"]);
    let voice_words = fixture.run(&["voice_words", "list", "--json"]).json();
    for field in voice_words[0].as_object().unwrap().keys() {
        assert!(skill.contains(&format!("`{field}`")), "{field}");
    }
}

#[test]
fn the_commands_of_the_skill_run_on_a_project_and_give_a_macro_or_a_launcher_back() {
    let fixture = Fixture::new("skill_commands");
    fixture.install_herdr();
    let skill = skill_text();
    let mut ran = 0;
    for block in skill.split("```bash").skip(1) {
        let block = block.split("```").next().unwrap().trim();
        let block = if block.starts_with("heidrun_code_ctrl workspaces ") {
            block.replace("<session>", "example").replace("<folder>", fixture.project.to_str().unwrap()).replace("<id>", "w1")
        } else {
            block.to_string()
        };
        if block.contains('<') {
            continue;
        }
        let (input, command) = match block.strip_prefix("printf '") {
            Some(rest) => {
                let (text, command) = rest.split_once("' | ").unwrap();
                (text.replace("\\n", "\n"), command)
            }
            None => (String::new(), block.as_str()),
        };
        let arguments = shell_words(command.strip_prefix("heidrun_code_ctrl ").unwrap());
        let arguments: Vec<&str> = arguments.iter().map(String::as_str).collect();
        let run = fixture.run_with_input(&arguments, &input);
        assert_eq!(run.exit_code, 0, "{command}: {}", run.stderr);
        assert!(run.json().is_array() || run.json().is_object());
        ran += 1;
    }
    assert_eq!(ran, 14);
}

/// Splits a command line into its arguments: the words, with a quoted part kept whole and its quotes removed.
fn shell_words(command: &str) -> Vec<String> {
    let mut words = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;
    let mut has_word = false;
    for character in command.chars() {
        match (quote, character) {
            (Some(open), c) if c == open => quote = None,
            (Some(_), c) => current.push(c),
            (None, '"') | (None, '\'') => {
                quote = Some(character);
                has_word = true;
            }
            (None, c) if c.is_whitespace() => {
                if has_word {
                    words.push(std::mem::take(&mut current));
                    has_word = false;
                }
            }
            (None, c) => {
                current.push(c);
                has_word = true;
            }
        }
    }
    if has_word {
        words.push(current);
    }
    words
}

// ---- Workspaces: a fake executable keeps these tests away from real sessions -----------------------------------------

impl Fixture {
    fn install_herdr(&self) {
        use std::os::unix::fs::PermissionsExt;
        let script = self.project.join("herdr");
        std::fs::write(
            &script,
            r#"#!/usr/bin/env python3
import json, os, pathlib, sys
root = pathlib.Path(__file__).parent
args = sys.argv[1:]
(root / 'herdr_environment.json').write_text(json.dumps({name: os.environ.get(name) for name in ['HERDR_SESSION', 'HERDR_SOCKET_PATH']}))
with (root / 'herdr_calls.jsonl').open('a') as log:
    log.write(json.dumps(args) + '\n')
mode = (root / 'mode').read_text() if (root / 'mode').exists() else ''
if mode == 'stopped':
    print(json.dumps({'error': {'message': 'no herdr server is running'}}), file=sys.stderr)
    sys.exit(1)
if mode == 'malformed':
    print('not JSON')
    sys.exit(0)
if args[:1] == ['--session']:
    args = args[2:]
state_file = root / 'herdr_state.json'
state = json.loads(state_file.read_text()) if state_file.exists() else {}
group, command = args[:2]
if group == 'pane':
    panes = [{'agent': 'codex'}] if mode == 'agent' else [{}]
    print(json.dumps({'result': {'panes': panes}}))
    sys.exit(0)
if command == 'create':
    state['w1'] = {'workspace_id': 'w1', 'label': args[args.index('--label') + 1], 'extra_field': True}
    result = {'workspace': state['w1']}
elif command == 'list':
    result = {'workspaces': list(state.values())}
else:
    identifier = args[2]
    if identifier not in state:
        print(json.dumps({'error': {'message': 'workspace not found'}}), file=sys.stderr)
        sys.exit(1)
    workspace = state[identifier]
    if command == 'rename':
        workspace['label'] = args[3]
    if command == 'focus':
        workspace['focused'] = True
    if command == 'report-metadata':
        if mode == 'metadata_failure':
            print(json.dumps({'error': {'message': 'metadata unavailable'}}), file=sys.stderr)
            sys.exit(1)
        for index, arg in enumerate(args):
            if arg == '--token':
                key, value = args[index + 1].split('=', 1)
                workspace.setdefault('tokens', {})[key] = value
    result = {'workspace': workspace}
    if command == 'close':
        del state[identifier]
        result = {'type': 'ok'}
state_file.write_text(json.dumps(state))
if command != 'report-metadata':
    print(json.dumps({'result': result}))
"#,
        )
        .unwrap();
        std::fs::set_permissions(script, std::fs::Permissions::from_mode(0o755)).unwrap();
    }

    fn workspace_run(&self, arguments: &[&str], session: Option<&str>) -> Run {
        let mut command = Command::new(env!("CARGO_BIN_EXE_heidrun_code_ctrl"));
        command
            .args(arguments)
            .current_dir(&self.project)
            .env("PATH", format!("{}:{}", self.project.display(), std::env::var("PATH").unwrap()))
            .env_remove("HERDR_SESSION")
            .env_remove("HERDR_SOCKET_PATH");
        if let Some(session) = session {
            command.env("HERDR_SESSION", session);
        }
        let output = command.output().unwrap();
        Run {
            stdout: String::from_utf8(output.stdout).unwrap(),
            stderr: String::from_utf8(output.stderr).unwrap(),
            exit_code: output.status.code().unwrap(),
        }
    }

    fn herdr_calls(&self) -> Vec<Value> {
        std::fs::read_to_string(self.project.join("herdr_calls.jsonl"))
            .unwrap_or_default()
            .lines()
            .map(|line| serde_json::from_str(line).unwrap())
            .collect()
    }

    fn workspace_open(&self) -> Run {
        self.workspace_run(&["workspaces", "open", "--cwd", self.project.to_str().unwrap(), "--label", "Example workspace", "--json"], None)
    }
}

#[test]
fn workspaces_preserve_herdr_fields_and_open_rename_focus_and_close() {
    let fixture = Fixture::new("workspaces_life");
    fixture.install_herdr();
    assert_eq!(fixture.workspace_run(&["workspaces", "list", "--json"], None).json(), serde_json::json!([]));
    let opened = fixture.workspace_open();
    assert_eq!(opened.exit_code, 0, "{}", opened.stderr);
    assert_eq!(opened.json()["workspace_id"], "w1");
    assert_eq!(opened.json()["extra_field"], true);
    assert_eq!(opened.json()["tokens"]["heidrun_workspace_folder"], std::fs::canonicalize(&fixture.project).unwrap().to_str().unwrap());
    let list = fixture.workspace_run(&["workspaces", "list", "--json"], None).json();
    assert_eq!(list[0]["label"], "Example workspace");
    let renamed = fixture.workspace_run(&["workspaces", "rename", "w1", "--label", "Renamed", "--json"], None);
    assert_eq!(renamed.json()["label"], "Renamed");
    let focus = fixture.workspace_run(&["workspaces", "focus", "w1", "--json"], None);
    assert_eq!(focus.exit_code, 0, "{}", focus.stderr);
    assert_eq!(focus.json()["focused"], true);
    assert_ne!(focus.json()["tokens"]["heidrun_focus_request"], opened.json()["tokens"]["heidrun_focus_request"]);
    let closed = fixture.workspace_run(&["workspaces", "close", "w1", "--json"], None);
    assert_eq!(closed.exit_code, 0, "{}", closed.stderr);
    assert_eq!(closed.json()["closed"]["workspace_id"], "w1");
    assert_eq!(fixture.workspace_run(&["workspaces", "list", "--json"], None).json(), serde_json::json!([]));
    assert!(!fixture.project_file().exists());
}

#[test]
fn workspace_session_selection_uses_the_explicit_session_then_the_inherited_connection_then_heidrun() {
    let fixture = Fixture::new("workspaces_sessions");
    fixture.install_herdr();
    fixture.workspace_run(&["workspaces", "list", "--session", "chosen", "--json"], Some("inherited"));
    fixture.workspace_run(&["workspaces", "list", "--json"], Some("inherited"));
    fixture.workspace_run(&["workspaces", "list", "--json"], None);
    let calls = fixture.herdr_calls();
    assert_eq!(calls[0], serde_json::json!(["--session", "chosen", "workspace", "list"]));
    assert_eq!(calls[1], serde_json::json!(["workspace", "list"]));
    assert_eq!(calls[2], serde_json::json!(["--session", "heidrun", "workspace", "list"]));
}

#[test]
fn workspace_close_refuses_a_coding_agent_until_force_is_given() {
    let fixture = Fixture::new("workspaces_force");
    fixture.install_herdr();
    fixture.workspace_open();
    std::fs::write(fixture.project.join("mode"), "agent").unwrap();
    let refused = fixture.workspace_run(&["workspaces", "close", "w1"], None);
    assert_eq!(refused.exit_code, 1);
    assert!(serde_json::from_str::<Value>(&refused.stderr).unwrap()["error"].as_str().unwrap().contains("--force"));
    assert!(fixture.herdr_calls().iter().all(|call| !call.as_array().unwrap().iter().any(|argument| argument == "close")));
    let forced = fixture.workspace_run(&["workspaces", "close", "w1", "--force", "--json"], None);
    assert_eq!(forced.exit_code, 0, "{}", forced.stderr);
    assert_eq!(forced.json()["closed"]["workspace_id"], "w1");
}

#[test]
fn workspace_failures_are_one_json_error_even_for_markdown_and_do_not_start_a_server() {
    let fixture = Fixture::new("workspaces_errors");
    fixture.install_herdr();
    for mode in ["stopped", "malformed", ""] {
        std::fs::write(fixture.project.join("mode"), mode).unwrap();
        let arguments = if mode.is_empty() { vec!["workspaces", "focus", "missing"] } else { vec!["workspaces", "list"] };
        let run = fixture.workspace_run(&arguments, None);
        assert_eq!(run.exit_code, 1, "{mode}");
        assert_eq!(run.stdout, "");
        assert_eq!(run.stderr.trim_end().lines().count(), 1);
        assert!(serde_json::from_str::<Value>(&run.stderr).unwrap()["error"].is_string());
    }
    assert!(fixture.herdr_calls().iter().all(|call| !call.to_string().contains("server")));
}

#[test]
fn workspace_arguments_refuse_duplicates_wrong_options_missing_values_and_invalid_folders_before_calling_herdr() {
    let fixture = Fixture::new("workspaces_arguments");
    fixture.install_herdr();
    for arguments in [
        vec!["workspaces", "add"],
        vec!["workspaces", "delete", "w1"],
        vec!["workspaces", "open"],
        vec!["workspaces", "rename", "w1"],
        vec!["workspaces", "focus"],
        vec!["workspaces", "close", "w1", "w2"],
        vec!["workspaces", "list", "--folder", "/tmp"],
        vec!["workspaces", "list", "--force"],
        vec!["workspaces", "list", "--session", ""],
        vec!["workspaces", "open", "--cwd", "/this/folder/does/not/exist"],
        vec!["workspaces", "focus", "w1", "--force=false"],
        vec!["--session", "chosen", "workspaces", "focus"],
    ] {
        let run = fixture.workspace_run(&arguments, None);
        assert_eq!(run.exit_code, 1, "{arguments:?}");
        assert_eq!(run.stdout, "");
        assert!(serde_json::from_str::<Value>(&run.stderr).unwrap()["error"].is_string());
    }
    assert!(fixture.herdr_calls().is_empty());
    assert_eq!(fixture.workspace_run(&["macros", "list", "--session", "chosen"], None).exit_code, 1);
}

#[test]
fn workspace_markdown_preserves_all_fields_and_empty_lists_and_metadata_failure_names_the_opened_workspace() {
    let fixture = Fixture::new("workspaces_markdown");
    fixture.install_herdr();
    let empty = fixture.workspace_run(&["workspaces", "list"], None);
    assert!(empty.stdout.starts_with("# Workspaces\n\n```json\n[]\n```"));
    fixture.workspace_open();
    let markdown = fixture.workspace_run(&["workspaces", "list", "--format", "markdown"], None);
    assert_eq!(markdown.exit_code, 0);
    assert!(markdown.stdout.contains("extra_field"));
    std::fs::write(fixture.project.join("mode"), "metadata_failure").unwrap();
    let failed = fixture.workspace_open();
    assert_eq!(failed.exit_code, 1);
    let error: Value = serde_json::from_str(&failed.stderr).unwrap();
    assert!(error["error"].as_str().unwrap().contains("Workspace w1 was opened"));
    assert!(error["error"].as_str().unwrap().contains("Do not retry open"));
}

#[test]
fn an_explicit_workspace_session_overrides_both_inherited_connection_variables() {
    let fixture = Fixture::new("workspaces_socket_override");
    fixture.install_herdr();
    let output = Command::new(env!("CARGO_BIN_EXE_heidrun_code_ctrl"))
        .args(["--session", "chosen", "workspaces", "list", "--json"])
        .env("PATH", format!("{}:{}", fixture.project.display(), std::env::var("PATH").unwrap()))
        .env("HERDR_SESSION", "unrelated")
        .env("HERDR_SOCKET_PATH", "/unrelated/socket")
        .output()
        .unwrap();
    assert!(output.status.success());
    let environment: Value =
        serde_json::from_str(&std::fs::read_to_string(fixture.project.join("herdr_environment.json")).unwrap()).unwrap();
    assert!(environment["HERDR_SESSION"].is_null());
    assert!(environment["HERDR_SOCKET_PATH"].is_null());
    assert_eq!(fixture.herdr_calls()[0], serde_json::json!(["--session", "chosen", "workspace", "list"]));
}

#[test]
fn a_missing_herdr_executable_is_a_json_error_and_never_a_panic() {
    let fixture = Fixture::new("workspaces_missing_binary");
    let output =
        Command::new(env!("CARGO_BIN_EXE_heidrun_code_ctrl")).args(["workspaces", "list"]).env("PATH", &fixture.project).output().unwrap();
    assert_eq!(output.status.code(), Some(1));
    assert!(output.stdout.is_empty());
    let error: Value = serde_json::from_slice(&output.stderr).unwrap();
    assert!(error["error"].as_str().unwrap().contains("Cannot run Herdr"));
}
