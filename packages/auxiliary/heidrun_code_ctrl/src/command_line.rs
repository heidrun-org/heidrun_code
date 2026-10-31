//! The arguments of the command line `heidrun_code_ctrl`, and the texts of its help.

use heidrun_code_ctrl::{Format, MacroKind};

/// The text of `heidrun_code_ctrl --help`.
pub const HELP: &str = r#"Usage: heidrun_code_ctrl <group> <command> [options]

Controls the Heidrun Code application. There are six groups of commands: macros, launchers,
voice_words, workspaces, tabs, and panes.

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
Workspaces, tabs, and panes talk to a running Herdr through its executable, and panes focus
through its socket. Start Heidrun Code first to see the changes in the window. No workspace,
tab, or pane command starts a Herdr server. A tab id looks like w1:t2, and a pane id like
w1:p3: copy them from tabs list and panes list of the same session.

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
  tabs list                   List the tabs and their Herdr fields.
  tabs create                 Create a tab in the workspace of --workspace, and select it.
  tabs rename <tab id>        Rename a tab using --label.
  tabs focus <tab id>         Select an existing tab in the window.
  tabs close <tab id>         Close a tab, stopping its processes.
  panes list                  List the panes and their Herdr fields.
  panes split <pane id>       Create a pane next to an existing pane, and select it.
  panes rename <pane id>      Rename a pane using --label.
  panes focus <pane id>       Select an existing pane, and its tab, in the window.
  panes close <pane id>       Close a pane, stopping its processes.
  panes send-text <pane id>   Write the text of --text in a pane, without pressing Enter.
  panes send-keys <pane id> <key>...
                              Press keys in a pane, for example enter, esc, or ctrl+c.
  panes wait-output <pane id> Wait until the output of a pane has the text of --match, or a
                              line that matches the pattern of --regex.
  panes read <pane id>        Read the output of a pane.

Options:
  --session <name>            Workspaces, tabs, and panes only. Choose the Herdr session.
                              Without this option, use inherited HERDR_SOCKET_PATH or
                              HERDR_SESSION, otherwise heidrun. Development in the main
                              checkout uses heidrun_development; a worktree uses
                              heidrun_<worktree>.
  --force                     Workspaces close, tabs close, and panes close only. Allow
                              closing a workspace, a tab, or a pane that contains a
                              coding agent. Closing stops its processes.
  --workspace <id>            Tabs and panes only. For list, only the tabs or the panes
                              of that workspace. Required for tabs create.
  --no-focus                  Tabs create and panes split only. Keep the current focus:
                              the new tab or pane is not selected.
  --direction <name>          Panes split only. right or down. (default: chosen by Herdr)
  --match <text>              Panes wait-output only. Wait for this literal text.
  --regex <pattern>           Panes wait-output only. Wait for a line that matches this
                              Rust regular expression. Give --match or --regex, not both.
  --timeout <milliseconds>    Panes wait-output only. Fail after this time. (default: wait
                              without end)
  --source <name>             Panes wait-output and read only. visible, recent, or
                              recent-unwrapped; read also accepts detection. (default:
                              recent)
  --lines <count>             Panes wait-output and read only. Only this number of lines
                              of the output.
  --kind <name>               Macros only. hard_coded, personal, or project. For list,
                              only the macros of that kind. For add, the kind to add:
                              personal or project. (default: personal) For update and
                              delete, the kind to search, when the id exists in two
                              kinds.
  --id <id>                   For add, the id of the macro, of the launcher, or of the
                              entry. (default: made from the title, the name, or the text
                              that Whisper writes, then a dash and three characters for a
                              macro or an entry, four for a launcher)
  --label <text>              For workspaces open and tabs create, an optional name; for
                              workspaces rename, tabs rename, and panes rename, required.
                              For add and update, the title of the macro or the name of
                              the launcher. An empty title becomes the first 40
                              characters of the text of the macro. An empty name becomes
                              the first 20 characters of the command line of the
                              launcher.
  --description <text>        For add and update, the line shown under the title of a
                              macro, or the description of a launcher. An empty
                              description of a launcher removes it.
  --text <text>               Macros and panes send-text only. For add and update, the
                              text of the macro. For panes send-text, required: the text
                              to write in the pane. With "-", the text is read from the
                              standard input, and one new line at its end is removed. It
                              cannot be empty.
  --command <text>            Launchers only. For add and update, the command line of
                              the launcher. With "-", the command line is read from the
                              standard input, and one new line at its end is removed. It
                              cannot be empty. A launcher of the kind Coding agent
                              refuses it on update, because its command line is made
                              from its field "agent".
  --cwd <path>                Required for workspaces open: the workspace folder.
                              For tabs create and panes split, the folder of the new
                              shell. The folder must exist.
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
             Workspace fields include workspace_id, label, and tokens. A tab list and
             a pane list are arrays of Herdr tab and pane objects. Tabs create gives
             {"tab": <tab>, "root_pane": <pane>}, and panes split gives the new pane.
             Rename and focus give one tab or pane object; close gives
             {"closed": <tab or pane>}. Panes send-text gives {"pane_id", "sent_text"},
             panes send-keys gives {"pane_id", "sent_keys"}, panes wait-output gives
             the Herdr result with "matched_line", and panes read gives
             {"pane_id", "text"}. A workspace, tab, or pane error is always JSON,
             including with Markdown output. Any other error is one JSON object on
             one line on the standard error output, with the field "error".

Exit codes:
  0   The command worked.
  1   An error happened. The message is on the standard error output. No file changed.
      For panes wait-output, the text did not come before the end of --timeout.

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
  $ heidrun_code_ctrl tabs list --workspace w1 --json
  $ heidrun_code_ctrl tabs create --workspace w1 --label Tests --json
  $ heidrun_code_ctrl tabs focus w1:t2 --json
  $ heidrun_code_ctrl panes split w1:p1 --direction right --json
  $ heidrun_code_ctrl panes focus w1:p2 --json
  $ heidrun_code_ctrl panes send-text w1:p2 --text "pnpm test" --json
  $ heidrun_code_ctrl panes send-keys w1:p2 enter --json
  $ heidrun_code_ctrl panes wait-output w1:p2 --match passed --timeout 60000 --json
  $ heidrun_code_ctrl panes read w1:p2 --lines 20 --json
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
    /// A tab command that talks to the running Herdr session.
    Tab {
        /// The options of every order.
        common: CommonOptions,
        /// The Herdr session of `--session`, or `None` for the inherited connection.
        session: Option<String>,
        /// The tab action.
        command: TabCommand,
    },
    /// A pane command that talks to the running Herdr session.
    Pane {
        /// The options of every order.
        common: CommonOptions,
        /// The Herdr session of `--session`, or `None` for the inherited connection.
        session: Option<String>,
        /// The pane action.
        command: PaneCommand,
    },
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

/// The tab actions exposed by the executable.
#[derive(Debug, PartialEq)]
pub enum TabCommand {
    /// List the tabs, of one workspace or of every workspace.
    List { workspace: Option<String> },
    /// Create a tab in a workspace, and select it unless `focus` is false.
    Create { workspace: String, label: Option<String>, cwd: Option<String>, focus: bool },
    /// Rename a tab.
    Rename { id: String, label: String },
    /// Select a tab in the window.
    Focus { id: String },
    /// Close a tab, and refuse a tab with a coding agent unless `force` is true.
    Close { id: String, force: bool },
}

/// What `panes wait-output` waits for.
#[derive(Debug, PartialEq)]
pub enum OutputPattern {
    /// A literal text.
    Match(String),
    /// A Rust regular expression.
    Regex(String),
}

/// The part of the output that `panes wait-output` and `panes read` look at.
#[derive(Debug, PartialEq, Default)]
pub struct OutputOptions {
    /// The terminal snapshot source of Herdr, or `None` for the default of Herdr.
    pub source: Option<String>,
    /// The number of lines, or `None` for every line of the source.
    pub lines: Option<u64>,
}

/// The pane actions exposed by the executable.
#[derive(Debug, PartialEq)]
pub enum PaneCommand {
    /// List the panes, of one workspace or of every workspace.
    List { workspace: Option<String> },
    /// Create a pane next to a pane, and select it unless `focus` is false.
    Split { id: String, direction: Option<String>, cwd: Option<String>, focus: bool },
    /// Rename a pane.
    Rename { id: String, label: String },
    /// Select a pane, and its tab, in the window.
    Focus { id: String },
    /// Close a pane, and refuse a pane with a coding agent unless `force` is true.
    Close { id: String, force: bool },
    /// Write a text in a pane, without pressing Enter.
    SendText { id: String, text: TextInput },
    /// Press keys in a pane.
    SendKeys { id: String, keys: Vec<String> },
    /// Wait until the output of a pane matches, or until the timeout in milliseconds.
    WaitOutput { id: String, pattern: OutputPattern, timeout: Option<u64>, output: OutputOptions },
    /// Read the output of a pane.
    Read { id: String, output: OutputOptions },
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
    workspace: Option<String>,
    is_no_focus: bool,
    direction: Option<String>,
    match_text: Option<String>,
    regex: Option<String>,
    timeout: Option<String>,
    source: Option<String>,
    lines: Option<String>,
    /// The names of the options that were given, to refuse the ones an order does not accept.
    given: Vec<&'static str>,
}

/// Identifies the group even when options precede it, so the errors of the groups that talk to Herdr (workspaces, tabs,
/// and panes) always use JSON.
pub fn is_herdr_command(arguments: &[String]) -> bool {
    let mut rest = arguments.iter();
    while let Some(argument) = rest.next() {
        if !argument.starts_with('-') {
            return matches!(argument.as_str(), "workspaces" | "tabs" | "panes");
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
                    | "--workspace"
                    | "--direction"
                    | "--match"
                    | "--regex"
                    | "--timeout"
                    | "--source"
                    | "--lines"
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
            "--workspace" => {
                options.workspace = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--workspace");
            }
            "--no-focus" => {
                if inline.is_some() {
                    return Err("The option --no-focus takes no value.".into());
                }
                options.is_no_focus = true;
                options.given.push("--no-focus");
            }
            "--direction" => {
                options.direction = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--direction");
            }
            "--match" => {
                options.match_text = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--match");
            }
            "--regex" => {
                options.regex = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--regex");
            }
            "--timeout" => {
                options.timeout = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--timeout");
            }
            "--source" => {
                options.source = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--source");
            }
            "--lines" => {
                options.lines = Some(value_of(&name, inline, &mut rest)?);
                options.given.push("--lines");
            }
            _ => return Err(format!("The option {name} is not known. Run `heidrun_code_ctrl --help`.")),
        }
    }
    if is_help {
        return Ok(Parsed::Help);
    }
    let Some(group) = positionals.first() else {
        return Err(
            "A command is needed: macros, launchers, voice_words, workspaces, tabs, or panes. Run `heidrun_code_ctrl --help`."
                .to_string(),
        );
    };
    let Some(command) = positionals.get(1) else {
        return match group.as_str() {
            "workspaces" => {
                Err("The command workspaces needs one of list, open, rename, focus, or close. Run `heidrun_code_ctrl --help`.".into())
            }
            "tabs" => {
                Err("The command tabs needs one of list, create, rename, focus, or close. Run `heidrun_code_ctrl --help`.".into())
            }
            "panes" => Err(format!("The command panes needs one of {PANE_COMMANDS}. Run `heidrun_code_ctrl --help`.")),
            "macros" | "launchers" | "voice_words" => {
                Err(format!("The command {group} needs one of list, add, update, or delete. Run `heidrun_code_ctrl --help`."))
            }
            _ => Err(unknown_group(group)),
        };
    };
    match group.as_str() {
        "macros" => parse_macros(command, options, &positionals),
        "launchers" => parse_launchers(command, options, &positionals),
        "voice_words" => parse_voice_words(command, options, &positionals),
        "workspaces" => parse_workspaces(command, options, &positionals),
        "tabs" => parse_tabs(command, options, &positionals),
        "panes" => parse_panes(command, options, &positionals),
        _ => Err(unknown_group(group)),
    }
}

/// The commands of the group `panes`, for the errors.
const PANE_COMMANDS: &str = "list, split, rename, focus, close, send-text, send-keys, wait-output, or read";

/// The error of an unknown group.
fn unknown_group(group: &str) -> String {
    format!(
        "The command {group} is not known: use macros, launchers, voice_words, workspaces, tabs, or panes. Run `heidrun_code_ctrl --help`."
    )
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

/// Refuses, for a command of the group `tabs` or `panes`, an option that the command does not accept, an empty session, and
/// a wrong number of positional arguments. `ids` is the number of positional arguments after the command, and `more` allows
/// more of them, for the keys of `panes send-keys`. Gives these positional arguments; the first one is checked as an id.
fn check_herdr_arguments<'a>(
    group: &str,
    command: &str,
    accepted: &[&str],
    ids: usize,
    more: bool,
    options: &RawOptions,
    positionals: &'a [String],
) -> Result<&'a [String], String> {
    if let Some(option) = options.given.iter().find(|name| !["--json", "--format", "--session"].contains(name) && !accepted.contains(name)) {
        return Err(format!("The command {group} {command} does not accept the option {option}."));
    }
    let what = if group == "tabs" { "tab" } else { "pane" };
    let count = positionals.len() - 2;
    if count < ids || (count > ids && !more) {
        return Err(match (ids, more) {
            (0, _) => format!("The command {group} {command} needs no positional argument."),
            (_, true) => format!("The command {group} {command} needs one {what} id and at least one key."),
            _ => format!("The command {group} {command} needs exactly one {what} id."),
        });
    }
    if options.session.as_ref().is_some_and(|session| session.trim().is_empty()) {
        return Err("The option --session cannot be empty.".into());
    }
    if let Some(id) = positionals.get(2).filter(|_| ids > 0) {
        if id.is_empty() || id.starts_with('-') {
            return Err(format!("The {what} id cannot be empty or start with a dash."));
        }
    }
    if options.workspace.as_ref().is_some_and(|workspace| workspace.trim().is_empty() || workspace.starts_with('-')) {
        return Err("The workspace id of --workspace cannot be empty or start with a dash.".into());
    }
    Ok(&positionals[2..])
}

/// The label of a rename: required, and not only spaces.
fn required_label(group: &str, label: Option<String>) -> Result<String, String> {
    label.filter(|label| !label.trim().is_empty()).ok_or_else(|| format!("The command {group} rename needs --label with a name."))
}

/// A folder of `--cwd` that is not only spaces, or `None`.
fn optional_cwd(group: &str, command: &str, cwd: Option<String>) -> Result<Option<String>, String> {
    match cwd {
        Some(cwd) if cwd.trim().is_empty() => Err(format!("The option --cwd of {group} {command} needs a folder.")),
        other => Ok(other),
    }
}

/// A whole number of `--timeout` or `--lines`, greater than zero.
fn positive_number(name: &str, value: Option<String>) -> Result<Option<u64>, String> {
    value
        .map(|text| text.parse::<u64>().ok().filter(|number| *number > 0).ok_or_else(|| format!("The option {name} needs a whole number greater than 0.")))
        .transpose()
}

/// The options `--source` and `--lines` of `panes wait-output` and `panes read`. `sources` are the sources that Herdr
/// accepts for the command.
fn output_options(command: &str, sources: &[&str], options: &mut RawOptions) -> Result<OutputOptions, String> {
    let source = options.source.take();
    if let Some(source) = &source {
        if !sources.contains(&source.as_str()) {
            return Err(format!("The source {source} of panes {command} is not known: use {}.", sources.join(", ")));
        }
    }
    Ok(OutputOptions { source, lines: positive_number("--lines", options.lines.take())? })
}

/// Reads the command of the group `tabs`.
fn parse_tabs(command: &str, options: RawOptions, positionals: &[String]) -> Result<Parsed, String> {
    let (accepted, ids): (&[&str], usize) = match command {
        "list" => (&["--workspace"], 0),
        "create" => (&["--workspace", "--label", "--cwd", "--no-focus"], 0),
        "rename" => (&["--label"], 1),
        "focus" => (&[], 1),
        "close" => (&["--force"], 1),
        _ => return Err(format!("The command tabs {command} is not known: use list, create, rename, focus, or close.")),
    };
    let rest = check_herdr_arguments("tabs", command, accepted, ids, false, &options, positionals)?;
    let id = rest.first().cloned().unwrap_or_default();
    let command = match command {
        "list" => TabCommand::List { workspace: options.workspace },
        "create" => TabCommand::Create {
            workspace: options.workspace.ok_or("The command tabs create needs --workspace with a workspace id.")?,
            label: options.label,
            cwd: optional_cwd("tabs", command, options.cwd)?,
            focus: !options.is_no_focus,
        },
        "rename" => TabCommand::Rename { id, label: required_label("tabs", options.label)? },
        "focus" => TabCommand::Focus { id },
        _ => TabCommand::Close { id, force: options.force },
    };
    Ok(Parsed::Tab {
        common: CommonOptions { format: options.format.unwrap_or_default(), folder: None },
        session: options.session,
        command,
    })
}

/// Reads the command of the group `panes`.
fn parse_panes(command: &str, mut options: RawOptions, positionals: &[String]) -> Result<Parsed, String> {
    let (accepted, ids): (&[&str], usize) = match command {
        "list" => (&["--workspace"], 0),
        "split" => (&["--direction", "--cwd", "--no-focus"], 1),
        "rename" => (&["--label"], 1),
        "focus" => (&[], 1),
        "send-keys" => (&[], 2),
        "close" => (&["--force"], 1),
        "send-text" => (&["--text"], 1),
        "wait-output" => (&["--match", "--regex", "--timeout", "--source", "--lines"], 1),
        "read" => (&["--source", "--lines"], 1),
        _ => return Err(format!("The command panes {command} is not known: use {PANE_COMMANDS}.")),
    };
    let rest = check_herdr_arguments("panes", command, accepted, ids, command == "send-keys", &options, positionals)?;
    let id = rest.first().cloned().unwrap_or_default();
    let pane_command = match command {
        "list" => PaneCommand::List { workspace: options.workspace.take() },
        "split" => {
            let direction = options.direction.take();
            if let Some(direction) = &direction {
                if direction != "right" && direction != "down" {
                    return Err(format!("The direction {direction} is not known: use right or down."));
                }
            }
            PaneCommand::Split { id, direction, cwd: optional_cwd("panes", command, options.cwd.take())?, focus: !options.is_no_focus }
        }
        "rename" => PaneCommand::Rename { id, label: required_label("panes", options.label.take())? },
        "focus" => PaneCommand::Focus { id },
        "close" => PaneCommand::Close { id, force: options.force },
        "send-text" => PaneCommand::SendText {
            id,
            text: options.text.take().ok_or("The command panes send-text needs the option --text.")?,
        },
        "send-keys" => PaneCommand::SendKeys { id, keys: rest[1..].to_vec() },
        "wait-output" => {
            let pattern = match (options.match_text.take(), options.regex.take()) {
                (Some(text), None) if !text.is_empty() => OutputPattern::Match(text),
                (None, Some(pattern)) if !pattern.is_empty() => OutputPattern::Regex(pattern),
                (Some(_), Some(_)) => return Err("The command panes wait-output needs --match or --regex, not both.".into()),
                _ => return Err("The command panes wait-output needs --match with a text or --regex with a pattern.".into()),
            };
            let timeout = positive_number("--timeout", options.timeout.take())?;
            let output = output_options(command, &["visible", "recent", "recent-unwrapped"], &mut options)?;
            PaneCommand::WaitOutput { id, pattern, timeout, output }
        }
        _ => PaneCommand::Read { id, output: output_options(command, &["visible", "recent", "recent-unwrapped", "detection"], &mut options)? },
    };
    Ok(Parsed::Pane {
        common: CommonOptions { format: options.format.unwrap_or_default(), folder: None },
        session: options.session,
        command: pane_command,
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
        assert!(parse(&arguments(&["windows"])).unwrap_err().contains("use macros, launchers, voice_words, workspaces, tabs, or panes"));
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
        assert!(parse(&arguments(&["windows", "list"])).unwrap_err().contains("use macros, launchers, voice_words, workspaces, tabs, or panes"));
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
        assert!(!is_herdr_command(&words));
        assert!(!is_herdr_command(&arguments(&["--match", "panes", "macros", "list"])));
        assert!(is_herdr_command(&arguments(&["--session", "s", "tabs", "list"])));
        assert!(is_herdr_command(&arguments(&["panes", "read", "w1:p1"])));
    }

    /// The command of a parsed tab command.
    fn tab_command(words: &[&str]) -> TabCommand {
        match parse(&arguments(words)) {
            Ok(Parsed::Tab { command, .. }) => command,
            other => panic!("{other:?}"),
        }
    }

    /// The command of a parsed pane command.
    fn pane_command(words: &[&str]) -> PaneCommand {
        match parse(&arguments(words)) {
            Ok(Parsed::Pane { command, .. }) => command,
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn the_tab_commands_take_their_options_and_focus_a_new_tab_by_default() {
        assert_eq!(tab_command(&["tabs", "list"]), TabCommand::List { workspace: None });
        assert_eq!(tab_command(&["tabs", "list", "--workspace", "w1"]), TabCommand::List { workspace: Some("w1".into()) });
        assert_eq!(
            tab_command(&["tabs", "create", "--workspace", "w1", "--label", "Tests", "--cwd", "/tmp"]),
            TabCommand::Create { workspace: "w1".into(), label: Some("Tests".into()), cwd: Some("/tmp".into()), focus: true }
        );
        assert_eq!(
            tab_command(&["tabs", "create", "--workspace", "w1", "--no-focus"]),
            TabCommand::Create { workspace: "w1".into(), label: None, cwd: None, focus: false }
        );
        assert_eq!(
            tab_command(&["tabs", "rename", "w1:t2", "--label", "Two"]),
            TabCommand::Rename { id: "w1:t2".into(), label: "Two".into() }
        );
        assert_eq!(tab_command(&["tabs", "focus", "w1:t2"]), TabCommand::Focus { id: "w1:t2".into() });
        assert_eq!(tab_command(&["tabs", "close", "w1:t2", "--force"]), TabCommand::Close { id: "w1:t2".into(), force: true });
        let parsed = parse(&arguments(&["tabs", "list", "--session", "chosen", "--json"])).unwrap();
        assert!(matches!(parsed, Parsed::Tab { session: Some(ref session), common: CommonOptions { format: Format::Json, .. }, .. } if session == "chosen"));
    }

    #[test]
    fn the_tab_commands_refuse_a_wrong_option_a_missing_value_or_a_wrong_id() {
        for (words, expected) in [
            (vec!["tabs"], "needs one of list, create, rename, focus, or close"),
            (vec!["tabs", "open"], "use list, create, rename, focus, or close"),
            (vec!["tabs", "create"], "needs --workspace"),
            (vec!["tabs", "create", "--workspace", ""], "cannot be empty"),
            (vec!["tabs", "rename", "w1:t1"], "needs --label"),
            (vec!["tabs", "focus"], "needs exactly one tab id"),
            (vec!["tabs", "focus", "w1:t1", "w1:t2"], "needs exactly one tab id"),
            (vec!["tabs", "list", "w1"], "needs no positional argument"),
            (vec!["tabs", "focus", "w1:t1", "--force"], "does not accept the option --force"),
            (vec!["tabs", "list", "--text", "x"], "does not accept the option --text"),
            (vec!["tabs", "close", "w1:t1", "--no-focus"], "does not accept the option --no-focus"),
            (vec!["tabs", "list", "--session", " "], "--session cannot be empty"),
            (vec!["tabs", "create", "--workspace", "w1", "--cwd", ""], "needs a folder"),
            (vec!["tabs", "create", "--workspace", "w1", "--no-focus=yes"], "takes no value"),
        ] {
            assert!(parse(&arguments(&words)).unwrap_err().contains(expected), "{words:?}: {:?}", parse(&arguments(&words)));
        }
    }

    #[test]
    fn the_pane_commands_take_their_options() {
        assert_eq!(pane_command(&["panes", "list", "--workspace", "w1"]), PaneCommand::List { workspace: Some("w1".into()) });
        assert_eq!(
            pane_command(&["panes", "split", "w1:p1", "--direction", "down", "--no-focus"]),
            PaneCommand::Split { id: "w1:p1".into(), direction: Some("down".into()), cwd: None, focus: false }
        );
        assert_eq!(
            pane_command(&["panes", "split", "w1:p1"]),
            PaneCommand::Split { id: "w1:p1".into(), direction: None, cwd: None, focus: true }
        );
        assert_eq!(
            pane_command(&["panes", "rename", "w1:p1", "--label", "Logs"]),
            PaneCommand::Rename { id: "w1:p1".into(), label: "Logs".into() }
        );
        assert_eq!(pane_command(&["panes", "focus", "w1:p1"]), PaneCommand::Focus { id: "w1:p1".into() });
        assert_eq!(pane_command(&["panes", "close", "w1:p1"]), PaneCommand::Close { id: "w1:p1".into(), force: false });
        assert_eq!(
            pane_command(&["panes", "send-text", "w1:p1", "--text", "-x hello"]),
            PaneCommand::SendText { id: "w1:p1".into(), text: TextInput::Given("-x hello".into()) }
        );
        assert_eq!(
            pane_command(&["panes", "send-text", "w1:p1", "--text", "-"]),
            PaneCommand::SendText { id: "w1:p1".into(), text: TextInput::StandardInput }
        );
        assert_eq!(
            pane_command(&["panes", "send-keys", "w1:p1", "ctrl+c", "enter"]),
            PaneCommand::SendKeys { id: "w1:p1".into(), keys: vec!["ctrl+c".into(), "enter".into()] }
        );
        assert_eq!(
            pane_command(&["panes", "wait-output", "w1:p1", "--regex", "pass(ed)?", "--timeout", "500", "--source", "visible", "--lines", "5"]),
            PaneCommand::WaitOutput {
                id: "w1:p1".into(),
                pattern: OutputPattern::Regex("pass(ed)?".into()),
                timeout: Some(500),
                output: OutputOptions { source: Some("visible".into()), lines: Some(5) },
            }
        );
        assert_eq!(
            pane_command(&["panes", "read", "w1:p1", "--source", "detection"]),
            PaneCommand::Read { id: "w1:p1".into(), output: OutputOptions { source: Some("detection".into()), lines: None } }
        );
    }

    #[test]
    fn the_pane_commands_refuse_a_wrong_option_a_missing_value_or_a_wrong_id() {
        for (words, expected) in [
            (vec!["panes"], "needs one of list, split, rename"),
            (vec!["panes", "create"], "use list, split, rename"),
            (vec!["panes", "split"], "needs exactly one pane id"),
            (vec!["panes", "split", "w1:p1", "--direction", "left"], "use right or down"),
            (vec!["panes", "rename", "w1:p1", "--label", " "], "needs --label"),
            (vec!["panes", "send-text", "w1:p1"], "needs the option --text"),
            (vec!["panes", "send-keys", "w1:p1"], "needs one pane id and at least one key"),
            (vec!["panes", "wait-output", "w1:p1"], "needs --match with a text or --regex"),
            (vec!["panes", "wait-output", "w1:p1", "--match", "a", "--regex", "b"], "not both"),
            (vec!["panes", "wait-output", "w1:p1", "--match", "a", "--timeout", "0"], "greater than 0"),
            (vec!["panes", "wait-output", "w1:p1", "--match", "a", "--source", "detection"], "use visible, recent, recent-unwrapped."),
            (vec!["panes", "read", "w1:p1", "--lines", "many"], "greater than 0"),
            (vec!["panes", "read", "w1:p1", "--match", "a"], "does not accept the option --match"),
            (vec!["panes", "focus", "w1:p1", "--workspace", "w1"], "does not accept the option --workspace"),
            (vec!["panes", "list", "--direction", "right"], "does not accept the option --direction"),
            (vec!["macros", "list", "--workspace", "w1"], "does not accept the option --workspace"),
            (vec!["workspaces", "list", "--no-focus"], "does not accept the option --no-focus"),
        ] {
            assert!(parse(&arguments(&words)).unwrap_err().contains(expected), "{words:?}: {:?}", parse(&arguments(&words)));
        }
    }

    #[test]
    fn the_format_is_found_even_when_the_arguments_are_wrong() {
        assert_eq!(find_format(&arguments(&["macros", "oops", "--format", "json"])), Some(Format::Json));
        assert_eq!(find_format(&arguments(&["macros", "--json"])), Some(Format::Json));
        assert_eq!(find_format(&arguments(&["macros"])), None);
    }
}
