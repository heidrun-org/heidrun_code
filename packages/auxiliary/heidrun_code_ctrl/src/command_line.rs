//! The arguments of the command line `heidrun_code_ctrl`, and the texts of its help.

use heidrun_code_ctrl::{Format, MacroKind};

/// The text of `heidrun_code_ctrl --help`.
pub const HELP: &str = r#"Usage: heidrun_code_ctrl <group> <command> [options]

Controls the Heidrun Code application. There are four groups of commands: macros, launchers,
voice_words, and workspaces.

The macros: a macro is a reusable text that the developer writes into a pane. There are
three kinds of macro:
  hard_coded   Written in the source code of Heidrun Code. It is listed, and it cannot be
               added, changed, or deleted.
  personal     Made by the developer, and kept in the file "macros.json" of the folder
               of the variable HEIDRUN_CODE_DIR, or else of "~/.config/heidrun_code".
  project      Made by the developer, and kept in the key "prompts" of the file
               ".heidrun/config.json" of the project.

The launchers: a launcher is one item of the Launchers sidebar section, a command line
that Heidrun Code runs in its own tab when the developer clicks its button "Run". The
launchers are kept in the key "launchers" of the file ".heidrun/config.json" of the
project. A launcher is not a macro, and the command line never runs a launcher.

The voice words: the word replacement list of the voice input. Each entry has two texts, the
text that Whisper writes and the text that Heidrun Code writes instead. After Whisper changes the
speech into text, Heidrun Code replaces each listed text by its replacement, before it writes the
text in the composition bar. An entry matches a whole word or a whole group of words only,
and ignores upper case and lower case. A space at the start or at the end of a text is part
of the text: the entry " at sign " with the replacement "@" changes "name at sign example"
into "name@example", and the entry "at sign" with no spaces gives "name @ example". When two
entries match at the same place, the longer entry wins. Heidrun Code applies the list again to
the new text, until no entry matches any more, so a replacement can match another entry. A
list that loops stops after 10 passes, or when the text grows too long. The entries are kept in the file
"voice_words.json" of the folder of the variable HEIDRUN_CODE_DIR, or else of "~/.config/heidrun_code".

Macros, launchers, and voice words change files watched by Heidrun Code and work while Heidrun Code is
closed.
Workspaces talk to a running Herdr through its executable. Start Heidrun Code first to see
workspace changes in the window. No workspace command starts a Herdr server.

Commands:
  macros list                 List every macro, the hard-coded macros included.
  macros add                  Add a macro.
  macros update <id>          Change the title, the description, or the text of a macro.
  macros delete <id>          Delete a macro.
  launchers list              List the launchers of the project.
  launchers add               Add a launcher.
  launchers update <id>       Change the name, the command line, the description, or the
                              folder of a launcher.
  launchers delete <id>       Delete a launcher.
  voice_words list            List the entries of the word replacement list.
  voice_words add             Add an entry.
  voice_words update <id>     Change the text that Whisper writes, or the text that Heidrun Code
                              writes instead, of an entry.
  voice_words delete <id>     Delete an entry.
  workspaces list             List the workspaces and their Herdr fields.
  workspaces open             Open and select a workspace from --cwd.
  workspaces rename <id>      Rename a workspace using --label.
  workspaces focus <id>       Select an existing workspace in the window.
  workspaces close <id>       Close a workspace, stopping its processes.

Options:
  --session <name>            Workspaces only. Choose the Herdr session. Without this
                              option, use inherited HERDR_SOCKET_PATH or HERDR_SESSION,
                              otherwise heidrun. Development in the main checkout uses
                              heidrun_development; a worktree uses heidrun_<worktree>.
  --force                     Workspaces close only. Allow closing a workspace that
                              contains a coding agent. Closing stops its processes.
  --kind <name>               Macros only. hard_coded, personal, or project. For list,
                              only the macros of that kind. For add, the kind to add:
                              personal or project. (default: personal) For update and
                              delete, the kind to search, when the id exists in two
                              kinds.
  --id <id>                   For add, the id of the macro, of the launcher, or of the
                              entry. (default: made from the title, the name, or the text
                              that Whisper writes, then a dash and three characters for a
                              macro or an entry, four for a launcher)
  --label <text>              For workspaces open, an optional name; for rename, required.
                              For add and update, the title of the macro or the name of
                              the launcher. An empty title becomes the first 40
                              characters of the text of the macro. An empty name becomes
                              the first 20 characters of the command line of the
                              launcher.
  --description <text>        For add and update, the line shown under the title of a
                              macro, or the description of a launcher. An empty
                              description of a launcher removes it.
  --text <text>               Macros only. For add and update, the text of the macro.
                              With "-", the text is read from the standard input, and
                              one new line at its end is removed. It cannot be empty.
  --command <text>            Launchers only. For add and update, the command line of
                              the launcher. With "-", the command line is read from the
                              standard input, and one new line at its end is removed. It
                              cannot be empty. A launcher of the kind Coding agent
                              refuses it on update, because its command line is made
                              from its field "agent".
  --cwd <path>                Required for workspaces open: the workspace folder.
                              For launchers add and update, the folder where the
                              command line runs, relative to the root of the project.
                              An empty folder removes it.
  --whisper-writes <text>     Voice words only. For add, required: the text that Whisper
                              writes. For update, the new text. It cannot be empty or only
                              spaces. A space at its start or at its end is part of it.
  --heidrun-writes <text>     Voice words only. For add, required: the text that Heidrun Code
                              writes instead. For update, the new text. It may be empty:
                              the entry then removes the text that Whisper writes. A space
                              at its start or at its end is part of it.
  --folder <path>             A folder of the project, for the project macros and for the
                              launchers. (default: the current folder)
  --format <name>             markdown or json. (default: markdown)
  --json                      The same as --format json.
  -h, --help                  Print this help.

Output:
  markdown   Text for a person, or for a renderer: pipe it to glow to get colors.
  json       One JSON value: a list for list, and one item for add and update. A macro
             has the fields "id", "label", "description", "text", "kind", and "file"
             (null for a hard-coded macro). A launcher has the fields "id", "label",
             "command", "description", "cwd", and "agent" (null for a field that the
             launcher does not have). A voice word has the fields "id",
             "whisper_writes", and "heidrun_writes". A delete gives the object
             {"deleted": <item>}. A
             workspace list is an array of Herdr workspace objects. Open, rename,
             and focus give one workspace object; close gives {"closed": <workspace>}.
             Workspace fields include workspace_id, label, and tokens. A workspace
             error is always JSON, including with Markdown output. Any other
             error is one JSON object on one line on the standard error output, with
             the field "error".

Exit codes:
  0   The command worked.
  1   An error happened. The message is on the standard error output. No file changed.

Examples:
  $ heidrun_code_ctrl macros list
  $ heidrun_code_ctrl macros list --kind personal --format json
  $ heidrun_code_ctrl macros add --label "Run the tests" --text "Run the tests first."
  $ printf 'Review the branch.\nList the risks.' | heidrun_code_ctrl macros add --kind project --label Review --text -
  $ heidrun_code_ctrl macros update run-the-tests-x7q --text "Run the tests, then the linter."
  $ heidrun_code_ctrl macros delete run-the-tests-x7q
  $ heidrun_code_ctrl macros list | glow
  $ heidrun_code_ctrl launchers list --format json
  $ heidrun_code_ctrl launchers add --label "Run the tests" --command "pnpm test"
  $ printf 'cd web\npnpm test' | heidrun_code_ctrl launchers add --label "Web tests" --command -
  $ heidrun_code_ctrl launchers update run-the-tests-x7q2 --command "pnpm run test:unit" --cwd web
  $ heidrun_code_ctrl launchers delete run-the-tests-x7q2
  $ heidrun_code_ctrl voice_words list --format json
  $ heidrun_code_ctrl voice_words add --whisper-writes "jerome etienne" --heidrun-writes "Jérôme Étienne"
  $ heidrun_code_ctrl voice_words add --whisper-writes " at sign " --heidrun-writes "@"
  $ heidrun_code_ctrl voice_words update jerome-etienne-x7q --heidrun-writes "Jérôme Étienne"
  $ heidrun_code_ctrl voice_words delete jerome-etienne-x7q
  $ heidrun_code_ctrl workspaces list --session heidrun --json
  $ heidrun_code_ctrl workspaces open --cwd /absolute/project --label Project --json
  $ heidrun_code_ctrl workspaces rename w1 --label Renamed --json
  $ heidrun_code_ctrl workspaces focus w1 --json
  $ heidrun_code_ctrl workspaces close w1 --json
"#;

/// Where a text comes from: the text of a macro, or the command line of a launcher.
#[derive(Debug, PartialEq, Clone)]
pub enum TextInput {
    /// The text is in the argument.
    Given(String),
    /// The text is read from the standard input.
    StandardInput,
}

/// The options of every order.
#[derive(Debug, PartialEq, Default)]
pub struct CommonOptions {
    /// The format of the output.
    pub format: Format,
    /// A folder of the project, or `None` for the current folder.
    pub folder: Option<String>,
}

/// What the arguments ask for.
#[derive(Debug, PartialEq)]
pub enum Parsed {
    /// A command that talks to the running Herdr session.
    Workspace { common: CommonOptions, session: Option<String>, command: WorkspaceCommand },
    /// Print the help.
    Help,
    /// List the macros.
    List {
        /// The options of every order.
        common: CommonOptions,
        /// The kind to list, or `None` for every kind.
        kind: Option<MacroKind>,
    },
    /// Add a macro.
    Add {
        /// The options of every order.
        common: CommonOptions,
        /// The kind to add.
        kind: MacroKind,
        /// The id, or `None` to make one.
        id: Option<String>,
        /// The title.
        label: Option<String>,
        /// The description.
        description: Option<String>,
        /// The text.
        text: TextInput,
    },
    /// Change a macro.
    Update {
        /// The options of every order.
        common: CommonOptions,
        /// The id of the macro.
        id: String,
        /// The kind to search, or `None` to search every kind.
        kind: Option<MacroKind>,
        /// The new title.
        label: Option<String>,
        /// The new description.
        description: Option<String>,
        /// The new text.
        text: Option<TextInput>,
    },
    /// Delete a macro.
    Delete {
        /// The options of every order.
        common: CommonOptions,
        /// The id of the macro.
        id: String,
        /// The kind to search, or `None` to search every kind.
        kind: Option<MacroKind>,
    },
    /// List the launchers.
    LauncherList {
        /// The options of every order.
        common: CommonOptions,
    },
    /// Add a launcher.
    LauncherAdd {
        /// The options of every order.
        common: CommonOptions,
        /// The id, or `None` to make one.
        id: Option<String>,
        /// The name.
        label: Option<String>,
        /// The command line.
        command: TextInput,
        /// The description.
        description: Option<String>,
        /// The folder, relative to the root of the project.
        cwd: Option<String>,
    },
    /// Change a launcher.
    LauncherUpdate {
        /// The options of every order.
        common: CommonOptions,
        /// The id of the launcher.
        id: String,
        /// The new name.
        label: Option<String>,
        /// The new command line.
        command: Option<TextInput>,
        /// The new description.
        description: Option<String>,
        /// The new folder.
        cwd: Option<String>,
    },
    /// Delete a launcher.
    LauncherDelete {
        /// The options of every order.
        common: CommonOptions,
        /// The id of the launcher.
        id: String,
    },
    /// List the entries of the word replacement list.
    VoiceWordList {
        /// The options of every order.
        common: CommonOptions,
    },
    /// Add an entry to the word replacement list.
    VoiceWordAdd {
        /// The options of every order.
        common: CommonOptions,
        /// The id, or `None` to make one.
        id: Option<String>,
        /// The text that Whisper writes.
        whisper_writes: String,
        /// The text that Heidrun Code writes instead.
        heidrun_writes: String,
    },
    /// Change an entry of the word replacement list.
    VoiceWordUpdate {
        /// The options of every order.
        common: CommonOptions,
        /// The id of the entry.
        id: String,
        /// The new text that Whisper writes.
        whisper_writes: Option<String>,
        /// The new text that Heidrun Code writes instead.
        heidrun_writes: Option<String>,
    },
    /// Delete an entry of the word replacement list.
    VoiceWordDelete {
        /// The options of every order.
        common: CommonOptions,
        /// The id of the entry.
        id: String,
    },
}

/// The workspace actions exposed by the executable.
#[derive(Debug, PartialEq)]
pub enum WorkspaceCommand {
    List,
    Open { cwd: String, label: Option<String> },
    Rename { id: String, label: String },
    Focus { id: String },
    Close { id: String, force: bool },
}

/// The options that the arguments hold, before the order is known.
#[derive(Default)]
struct RawOptions {
    session: Option<String>,
    force: bool,
    format: Option<Format>,
    folder: Option<String>,
    kind: Option<MacroKind>,
    id: Option<String>,
    label: Option<String>,
    description: Option<String>,
    text: Option<TextInput>,
    command: Option<TextInput>,
    cwd: Option<String>,
    whisper_writes: Option<String>,
    heidrun_writes: Option<String>,
    /// The names of the options that were given, to refuse the ones an order does not accept.
    given: Vec<&'static str>,
}

/// Identifies the group even when options precede it, so workspace errors always use JSON.
pub fn is_workspace_command(arguments: &[String]) -> bool {
    let mut rest = arguments.iter();
    while let Some(argument) = rest.next() {
        if !argument.starts_with('-') {
            return argument == "workspaces";
        }
        if !argument.contains('=')
            && matches!(
                argument.as_str(),
                "--session"
                    | "--format"
                    | "--folder"
                    | "--kind"
                    | "--id"
                    | "--label"
                    | "--description"
                    | "--text"
                    | "--command"
                    | "--cwd"
                    | "--whisper-writes"
                    | "--heidrun-writes"
            )
        {
            rest.next();
        }
    }
    false
}

/// The format that the arguments ask for, read without the other checks, so that an error of the arguments is written in
/// that format too. `None` when no valid format is given.
pub fn find_format(arguments: &[String]) -> Option<Format> {
    let mut format = None;
    let mut rest = arguments.iter();
    while let Some(argument) = rest.next() {
        if argument == "--json" {
            format = Some(Format::Json);
        } else if argument == "--format" {
            format = rest.next().and_then(|name| Format::from_name(name)).or(format);
        } else if let Some(name) = argument.strip_prefix("--format=") {
            format = Format::from_name(name).or(format);
        }
    }
    format
}

/// The value of the option `name`: the text after the sign `=`, or else the next argument.
fn value_of<'a>(name: &str, inline: Option<String>, rest: &mut impl Iterator<Item = &'a String>) -> Result<String, String> {
    match inline {
        Some(value) => Ok(value),
        None => rest.next().cloned().ok_or_else(|| format!("The option {name} needs a value.")),
    }
}

/// The source of a text: the standard input for the value "-", else the value itself.
fn text_input_of(value: String) -> TextInput {
    if value == "-" {
        TextInput::StandardInput
    } else {
        TextInput::Given(value)
    }
}

/// The kind that a name gives, or an error that lists the three names.
fn kind_of(name: &str) -> Result<MacroKind, String> {
    MacroKind::from_name(name).ok_or_else(|| format!("The kind {name} is not known: use hard_coded, personal, or project."))
}

/// Reads the arguments of the command line, without the name of the program.
///
/// # Errors
/// An unknown group, command, kind, option, or format, an option without a value, an option that the command does not
/// accept, a missing id, text, or command line, or a wrong number of arguments.
pub fn parse(arguments: &[String]) -> Result<Parsed, String> {
    let mut options = RawOptions::default();
    let mut positionals: Vec<String> = Vec::new();
    let mut is_help = false;
    let mut rest = arguments.iter();
    while let Some(argument) = rest.next() {
        if !argument.starts_with('-') || argument == "-" {
            positionals.push(argument.clone());
            continue;
        }
        let (name, inline) = match argument.split_once('=') {
            Some((name, value)) => (name.to_string(), Some(value.to_string())),
            None => (argument.clone(), None),
        };
        match name.as_str() {
            "-h" | "--help" => is_help = true,
            "--json" => {
                options.format = Some(Format::Json);
                options.given.push("--json");
            }
            "--format" => {
                let value = value_of(&name, inline, &mut rest)?;
                options.format =
                    Some(Format::from_name(&value).ok_or_else(|| format!("The format {value} is not known: use markdown or json."))?);
                options.given.push("--format");
            }
            "--folder" => {
                options.folder = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--folder");
            }
            "--kind" => {
                options.kind = Some(kind_of(&value_of(&name, inline, &mut rest)?)?);
                options.given.push("--kind");
            }
            "--id" => {
                options.id = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--id");
            }
            "--label" => {
                options.label = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--label");
            }
            "--description" => {
                options.description = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--description");
            }
            "--text" => {
                options.text = Some(text_input_of(value_of(&name, inline, &mut rest)?));
                options.given.push("--text");
            }
            "--command" => {
                options.command = Some(text_input_of(value_of(&name, inline, &mut rest)?));
                options.given.push("--command");
            }
            "--session" => {
                options.session = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--session");
            }
            "--force" => {
                if inline.is_some() {
                    return Err("The option --force takes no value.".into());
                }
                options.force = true;
                options.given.push("--force");
            }
            "--cwd" => {
                options.cwd = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--cwd");
            }
            "--whisper-writes" => {
                options.whisper_writes = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--whisper-writes");
            }
            "--heidrun-writes" => {
                options.heidrun_writes = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--heidrun-writes");
            }
            _ => return Err(format!("The option {name} is not known. Run `heidrun_code_ctrl --help`.")),
        }
    }
    if is_help {
        return Ok(Parsed::Help);
    }
    let Some(group) = positionals.first() else {
        return Err("A command is needed: macros, launchers, voice_words, or workspaces. Run `heidrun_code_ctrl --help`.".to_string());
    };
    let Some(command) = positionals.get(1) else {
        return match group.as_str() {
            "workspaces" => {
                Err("The command workspaces needs one of list, open, rename, focus, or close. Run `heidrun_code_ctrl --help`.".into())
            }
            "macros" | "launchers" | "voice_words" => {
                Err(format!("The command {group} needs one of list, add, update, or delete. Run `heidrun_code_ctrl --help`."))
            }
            _ => Err(format!(
                "The command {group} is not known: use macros, launchers, voice_words, or workspaces. Run `heidrun_code_ctrl --help`."
            )),
        };
    };
    match group.as_str() {
        "macros" => parse_macros(command, options, &positionals),
        "launchers" => parse_launchers(command, options, &positionals),
        "voice_words" => parse_voice_words(command, options, &positionals),
        "workspaces" => parse_workspaces(command, options, &positionals),
        _ => Err(format!(
            "The command {group} is not known: use macros, launchers, voice_words, or workspaces. Run `heidrun_code_ctrl --help`."
        )),
    }
}

/// Refuses an option that the command does not accept, and a wrong number of positional arguments: the group, the command,
/// and for `update` and `delete` the id.
fn check_arguments(group: &str, command: &str, accepted: &[&str], options: &RawOptions, positionals: &[String]) -> Result<(), String> {
    if let Some(refused) = options.given.iter().find(|name| !accepted.contains(name)) {
        return Err(format!("The command {group} {command} does not accept the option {refused}."));
    }
    let wanted_positionals = if command == "update" || command == "delete" { 3 } else { 2 };
    if positionals.len() != wanted_positionals {
        return Err(match wanted_positionals {
            3 if positionals.len() < 3 => {
                let what = if group == "voice_words" { "an entry".to_string() } else { format!("a {}", group.trim_end_matches('s')) };
                format!("The command {group} {command} needs the id of {what}.")
            }
            _ => format!("The command {group} {command} has too many arguments: {}.", positionals[wanted_positionals..].join(" ")),
        });
    }
    Ok(())
}

/// Reads the command of the group `macros`.
fn parse_macros(command: &str, options: RawOptions, positionals: &[String]) -> Result<Parsed, String> {
    let accepted: &[&str] = match command {
        "list" => &["--json", "--format", "--folder", "--kind"],
        "add" => &["--json", "--format", "--folder", "--kind", "--id", "--label", "--description", "--text"],
        "update" => &["--json", "--format", "--folder", "--kind", "--label", "--description", "--text"],
        "delete" => &["--json", "--format", "--folder", "--kind"],
        other => return Err(format!("The command macros {other} is not known: use list, add, update, or delete.")),
    };
    check_arguments("macros", command, accepted, &options, positionals)?;
    let common = CommonOptions { format: options.format.unwrap_or_default(), folder: options.folder.clone() };
    match command {
        "list" => Ok(Parsed::List { common, kind: options.kind }),
        "add" => Ok(Parsed::Add {
            common,
            kind: options.kind.unwrap_or(MacroKind::Personal),
            id: options.id,
            label: options.label,
            description: options.description,
            text: options.text.ok_or_else(|| "The command macros add needs the option --text.".to_string())?,
        }),
        "update" => Ok(Parsed::Update {
            common,
            id: positionals[2].clone(),
            kind: options.kind,
            label: options.label,
            description: options.description,
            text: options.text,
        }),
        _ => Ok(Parsed::Delete { common, id: positionals[2].clone(), kind: options.kind }),
    }
}

/// Reads the command of the group `launchers`.
fn parse_launchers(command: &str, options: RawOptions, positionals: &[String]) -> Result<Parsed, String> {
    let accepted: &[&str] = match command {
        "list" => &["--json", "--format", "--folder"],
        "add" => &["--json", "--format", "--folder", "--id", "--label", "--command", "--description", "--cwd"],
        "update" => &["--json", "--format", "--folder", "--label", "--command", "--description", "--cwd"],
        "delete" => &["--json", "--format", "--folder"],
        other => return Err(format!("The command launchers {other} is not known: use list, add, update, or delete.")),
    };
    check_arguments("launchers", command, accepted, &options, positionals)?;
    let common = CommonOptions { format: options.format.unwrap_or_default(), folder: options.folder.clone() };
    match command {
        "list" => Ok(Parsed::LauncherList { common }),
        "add" => Ok(Parsed::LauncherAdd {
            common,
            id: options.id,
            label: options.label,
            command: options.command.ok_or_else(|| "The command launchers add needs the option --command.".to_string())?,
            description: options.description,
            cwd: options.cwd,
        }),
        "update" => Ok(Parsed::LauncherUpdate {
            common,
            id: positionals[2].clone(),
            label: options.label,
            command: options.command,
            description: options.description,
            cwd: options.cwd,
        }),
        _ => Ok(Parsed::LauncherDelete { common, id: positionals[2].clone() }),
    }
}

/// Reads the command of the group `voice_words`.
fn parse_voice_words(command: &str, options: RawOptions, positionals: &[String]) -> Result<Parsed, String> {
    let accepted: &[&str] = match command {
        "list" | "delete" => &["--json", "--format"],
        "add" => &["--json", "--format", "--id", "--whisper-writes", "--heidrun-writes"],
        "update" => &["--json", "--format", "--whisper-writes", "--heidrun-writes"],
        other => return Err(format!("The command voice_words {other} is not known: use list, add, update, or delete.")),
    };
    check_arguments("voice_words", command, accepted, &options, positionals)?;
    let common = CommonOptions { format: options.format.unwrap_or_default(), folder: None };
    match command {
        "list" => Ok(Parsed::VoiceWordList { common }),
        "add" => Ok(Parsed::VoiceWordAdd {
            common,
            id: options.id,
            whisper_writes: options
                .whisper_writes
                .ok_or_else(|| "The command voice_words add needs the option --whisper-writes.".to_string())?,
            heidrun_writes: options
                .heidrun_writes
                .ok_or_else(|| "The command voice_words add needs the option --heidrun-writes.".to_string())?,
        }),
        "update" => Ok(Parsed::VoiceWordUpdate {
            common,
            id: positionals[2].clone(),
            whisper_writes: options.whisper_writes,
            heidrun_writes: options.heidrun_writes,
        }),
        _ => Ok(Parsed::VoiceWordDelete { common, id: positionals[2].clone() }),
    }
}

/// Reads workspace arguments without accepting the file options of other groups.
fn parse_workspaces(command: &str, options: RawOptions, positionals: &[String]) -> Result<Parsed, String> {
    let mut accepted = vec!["--json", "--format", "--session"];
    match command {
        "list" | "focus" => {}
        "open" => accepted.extend(["--cwd", "--label"]),
        "rename" => accepted.push("--label"),
        "close" => accepted.push("--force"),
        _ => return Err(format!("The command workspaces {command} is not known: use list, open, rename, focus, or close.")),
    }
    if let Some(option) = options.given.iter().find(|name| !accepted.contains(name)) {
        return Err(format!("The command workspaces {command} does not accept the option {option}."));
    }
    let needs_id = matches!(command, "rename" | "focus" | "close");
    let count = if needs_id { 3 } else { 2 };
    if positionals.len() != count {
        return Err(format!(
            "The command workspaces {command} needs {}.",
            if needs_id { "exactly one workspace id" } else { "no positional argument" }
        ));
    }
    if options.session.as_ref().is_some_and(|session| session.trim().is_empty()) {
        return Err("The option --session cannot be empty.".into());
    }
    let id = positionals.get(2).cloned().unwrap_or_default();
    if needs_id && (id.is_empty() || id.starts_with('-')) {
        return Err("The workspace id cannot be empty or start with a dash.".into());
    }
    let command = match command {
        "list" => WorkspaceCommand::List,
        "open" => WorkspaceCommand::Open {
            cwd: options.cwd.filter(|cwd| !cwd.trim().is_empty()).ok_or("The command workspaces open needs --cwd with a folder.")?,
            label: options.label,
        },
        "rename" => WorkspaceCommand::Rename {
            id,
            label: options
                .label
                .filter(|label| !label.trim().is_empty())
                .ok_or("The command workspaces rename needs --label with a name.")?,
        },
        "focus" => WorkspaceCommand::Focus { id },
        _ => WorkspaceCommand::Close { id, force: options.force },
    };
    Ok(Parsed::Workspace {
        common: CommonOptions { format: options.format.unwrap_or_default(), folder: None },
        session: options.session,
        command,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn arguments(words: &[&str]) -> Vec<String> {
        words.iter().map(|word| word.to_string()).collect()
    }

    #[test]
    fn the_help_is_asked_with_a_short_or_a_long_option() {
        assert_eq!(parse(&arguments(&["--help"])), Ok(Parsed::Help));
        assert_eq!(parse(&arguments(&["macros", "list", "-h"])), Ok(Parsed::Help));
    }

    #[test]
    fn a_list_has_no_kind_and_the_format_markdown_by_default() {
        assert_eq!(
            parse(&arguments(&["macros", "list"])),
            Ok(Parsed::List { common: CommonOptions { format: Format::Markdown, folder: None }, kind: None })
        );
    }

    #[test]
    fn the_options_take_a_value_after_a_space_or_after_a_sign_equal() {
        let parsed = parse(&arguments(&["macros", "list", "--kind=project", "--format", "json", "--folder", "/tmp/x"])).unwrap();
        assert_eq!(
            parsed,
            Parsed::List { common: CommonOptions { format: Format::Json, folder: Some("/tmp/x".into()) }, kind: Some(MacroKind::Project) }
        );
    }

    #[test]
    fn an_add_is_personal_by_default_and_needs_a_text() {
        let parsed = parse(&arguments(&["macros", "add", "--text", "Hello"])).unwrap();
        assert!(matches!(parsed, Parsed::Add { kind: MacroKind::Personal, text: TextInput::Given(ref text), .. } if text == "Hello"));
        assert_eq!(
            parse(&arguments(&["macros", "add", "--label", "A"])),
            Err("The command macros add needs the option --text.".to_string())
        );
    }

    #[test]
    fn a_text_of_one_dash_is_read_from_the_standard_input() {
        let parsed = parse(&arguments(&["macros", "add", "--text", "-"])).unwrap();
        assert!(matches!(parsed, Parsed::Add { text: TextInput::StandardInput, .. }));
    }

    #[test]
    fn an_update_and_a_delete_need_one_id() {
        assert!(matches!(parse(&arguments(&["macros", "update", "a", "--text", "B"])), Ok(Parsed::Update { ref id, .. }) if id == "a"));
        assert!(matches!(parse(&arguments(&["macros", "delete", "a"])), Ok(Parsed::Delete { ref id, .. }) if id == "a"));
        assert_eq!(parse(&arguments(&["macros", "delete"])), Err("The command macros delete needs the id of a macro.".to_string()));
        assert!(parse(&arguments(&["macros", "delete", "a", "b"])).unwrap_err().contains("too many arguments: b"));
    }

    #[test]
    fn an_option_that_the_command_does_not_accept_is_an_error() {
        assert_eq!(
            parse(&arguments(&["macros", "list", "--text", "x"])),
            Err("The command macros list does not accept the option --text.".to_string())
        );
        assert!(parse(&arguments(&["macros", "delete", "a", "--label", "x"])).is_err());
        assert!(parse(&arguments(&["macros", "update", "a", "--id", "x"])).is_err());
    }

    #[test]
    fn an_unknown_command_kind_format_or_option_is_an_error_that_says_the_choices() {
        assert!(parse(&arguments(&["panes"])).unwrap_err().contains("use macros, launchers, voice_words, or workspaces"));
        assert!(parse(&arguments(&["macros", "run"])).unwrap_err().contains("list, add, update, or delete"));
        assert!(parse(&arguments(&["macros", "list", "--kind", "x"])).unwrap_err().contains("hard_coded, personal, or project"));
        assert!(parse(&arguments(&["macros", "list", "--format", "table"])).unwrap_err().contains("markdown or json"));
        assert!(parse(&arguments(&["macros", "list", "--color"])).unwrap_err().contains("--color"));
        assert!(parse(&arguments(&["macros", "list", "--kind"])).unwrap_err().contains("needs a value"));
        assert!(parse(&arguments(&[])).unwrap_err().contains("A command is needed"));
    }

    #[test]
    fn a_launcher_list_has_the_format_markdown_by_default_and_no_kind() {
        assert_eq!(
            parse(&arguments(&["launchers", "list"])),
            Ok(Parsed::LauncherList { common: CommonOptions { format: Format::Markdown, folder: None } })
        );
        assert!(parse(&arguments(&["launchers", "list", "--kind", "project"])).unwrap_err().contains("does not accept the option --kind"));
    }

    #[test]
    fn a_launcher_add_needs_a_command_line_and_takes_the_other_fields() {
        let parsed = parse(&arguments(&[
            "launchers",
            "add",
            "--id",
            "a",
            "--label",
            "A",
            "--command",
            "pnpm test",
            "--description",
            "D",
            "--cwd=web",
            "--json",
        ]))
        .unwrap();
        assert_eq!(
            parsed,
            Parsed::LauncherAdd {
                common: CommonOptions { format: Format::Json, folder: None },
                id: Some("a".into()),
                label: Some("A".into()),
                command: TextInput::Given("pnpm test".into()),
                description: Some("D".into()),
                cwd: Some("web".into()),
            }
        );
        assert_eq!(
            parse(&arguments(&["launchers", "add", "--label", "A"])),
            Err("The command launchers add needs the option --command.".to_string())
        );
        let from_input = parse(&arguments(&["launchers", "add", "--command", "-"])).unwrap();
        assert!(matches!(from_input, Parsed::LauncherAdd { command: TextInput::StandardInput, .. }));
    }

    #[test]
    fn a_launcher_update_and_delete_need_one_id() {
        let update = parse(&arguments(&["launchers", "update", "a", "--command", "ls", "--cwd", ""])).unwrap();
        assert!(
            matches!(update, Parsed::LauncherUpdate { ref id, command: Some(TextInput::Given(_)), cwd: Some(ref cwd), .. } if id == "a" && cwd.is_empty())
        );
        assert!(matches!(parse(&arguments(&["launchers", "delete", "a"])), Ok(Parsed::LauncherDelete { ref id, .. }) if id == "a"));
        assert_eq!(
            parse(&arguments(&["launchers", "delete"])),
            Err("The command launchers delete needs the id of a launcher.".to_string())
        );
        assert!(parse(&arguments(&["launchers", "update", "a", "b"])).unwrap_err().contains("too many arguments: b"));
    }

    #[test]
    fn the_options_of_the_other_group_are_refused() {
        assert!(parse(&arguments(&["launchers", "add", "--text", "x"])).unwrap_err().contains("does not accept the option --text"));
        assert!(parse(&arguments(&["launchers", "update", "a", "--id", "b"])).unwrap_err().contains("--id"));
        assert!(parse(&arguments(&["macros", "add", "--command", "x", "--text", "y"]))
            .unwrap_err()
            .contains("does not accept the option --command"));
        assert!(parse(&arguments(&["macros", "list", "--cwd", "web"])).unwrap_err().contains("--cwd"));
    }

    #[test]
    fn an_unknown_launcher_command_is_an_error_that_says_the_choices() {
        assert!(parse(&arguments(&["launchers", "run"])).unwrap_err().contains("list, add, update, or delete"));
        assert!(parse(&arguments(&["launchers"])).unwrap_err().contains("needs one of list, add, update, or delete"));
        assert!(parse(&arguments(&["panes", "list"])).unwrap_err().contains("use macros, launchers, voice_words, or workspaces"));
        assert!(parse(&arguments(&["launchers", "list", "--format", "table"])).unwrap_err().contains("markdown or json"));
    }

    #[test]
    fn a_voice_word_list_has_the_format_markdown_by_default_and_accepts_no_other_option() {
        assert_eq!(
            parse(&arguments(&["voice_words", "list"])),
            Ok(Parsed::VoiceWordList { common: CommonOptions { format: Format::Markdown, folder: None } })
        );
        assert!(parse(&arguments(&["voice_words", "list", "--folder", "x"])).unwrap_err().contains("does not accept the option --folder"));
        assert!(parse(&arguments(&["voice_words", "list", "--kind", "personal"])).unwrap_err().contains("--kind"));
    }

    #[test]
    fn a_voice_word_add_needs_both_texts_and_keeps_the_spaces_and_an_empty_replacement() {
        let parsed = parse(&arguments(&[
            "voice_words",
            "add",
            "--id",
            "a",
            "--whisper-writes",
            " at sign ",
            "--heidrun-writes=",
            "--json",
        ]))
        .unwrap();
        assert_eq!(
            parsed,
            Parsed::VoiceWordAdd {
                common: CommonOptions { format: Format::Json, folder: None },
                id: Some("a".into()),
                whisper_writes: " at sign ".into(),
                heidrun_writes: String::new(),
            }
        );
        assert_eq!(
            parse(&arguments(&["voice_words", "add", "--heidrun-writes", "x"])),
            Err("The command voice_words add needs the option --whisper-writes.".to_string())
        );
        assert_eq!(
            parse(&arguments(&["voice_words", "add", "--whisper-writes", "x"])),
            Err("The command voice_words add needs the option --heidrun-writes.".to_string())
        );
    }

    #[test]
    fn a_voice_word_update_and_delete_need_one_id() {
        let update = parse(&arguments(&["voice_words", "update", "a", "--heidrun-writes", "-"])).unwrap();
        assert!(matches!(
            update,
            Parsed::VoiceWordUpdate { ref id, whisper_writes: None, heidrun_writes: Some(ref text), .. } if id == "a" && text == "-"
        ));
        assert!(matches!(parse(&arguments(&["voice_words", "delete", "a"])), Ok(Parsed::VoiceWordDelete { ref id, .. }) if id == "a"));
        assert_eq!(
            parse(&arguments(&["voice_words", "delete"])),
            Err("The command voice_words delete needs the id of an entry.".to_string())
        );
        assert!(parse(&arguments(&["voice_words", "update", "a", "b"])).unwrap_err().contains("too many arguments: b"));
        assert!(parse(&arguments(&["voice_words", "update", "a", "--id", "b"])).unwrap_err().contains("--id"));
    }

    #[test]
    fn the_options_of_the_voice_words_are_refused_by_the_other_groups_and_the_other_way_round() {
        assert!(parse(&arguments(&["macros", "add", "--text", "x", "--whisper-writes", "y"]))
            .unwrap_err()
            .contains("does not accept the option --whisper-writes"));
        assert!(parse(&arguments(&["launchers", "list", "--heidrun-writes", "y"])).unwrap_err().contains("--heidrun-writes"));
        assert!(parse(&arguments(&["voice_words", "add", "--text", "x"])).unwrap_err().contains("does not accept the option --text"));
        assert!(parse(&arguments(&["workspaces", "list", "--whisper-writes", "x"])).unwrap_err().contains("--whisper-writes"));
    }

    #[test]
    fn an_unknown_voice_word_command_is_an_error_that_says_the_choices() {
        assert!(parse(&arguments(&["voice_words", "run"])).unwrap_err().contains("list, add, update, or delete"));
        assert!(parse(&arguments(&["voice_words"])).unwrap_err().contains("needs one of list, add, update, or delete"));
    }

    #[test]
    fn the_value_of_a_voice_word_option_is_not_taken_for_the_group_of_a_workspace_command() {
        let words = arguments(&["--whisper-writes", "workspaces", "voice_words", "list"]);
        assert!(!is_workspace_command(&words));
    }

    #[test]
    fn the_format_is_found_even_when_the_arguments_are_wrong() {
        assert_eq!(find_format(&arguments(&["macros", "oops", "--format", "json"])), Some(Format::Json));
        assert_eq!(find_format(&arguments(&["macros", "--json"])), Some(Format::Json));
        assert_eq!(find_format(&arguments(&["macros"])), None);
    }
}
