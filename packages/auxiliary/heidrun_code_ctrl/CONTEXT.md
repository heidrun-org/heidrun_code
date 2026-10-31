# Directory Context: `/packages/auxiliary/heidrun_code_ctrl`

## Purpose
A Rust library and the `heidrun_code_ctrl` command line that control Heidrun Code macros, launchers, voice words (list, add, update, delete on watched files), and workspaces, tabs, and panes (through the running Herdr), plus an Agent Plugin that distributes its skill.

## Key Exports & Entry Points
- `src/lib.rs`: the only public library interface: the macro, launcher, and voice word types, their files, their four orders, and the output formatting.
- `src/main.rs`: the executable; `src/command_line.rs` parses the arguments and holds the help. The groups `workspaces`, `tabs`, and `panes` are binary-only and share `src/herdr.rs` (the executable, the socket, the focus request, the JSON output).
- `plugin.json` and `skills/heidrun-code-ctrl/`: the Agent Plugin and its skill.
- `tests/`: executable tests with temporary data, a temporary project, a fake `herdr`, and a fake Herdr socket. Library tests sit beside the source.
- Command to run this folder: `pnpm --silent heidrun_code_ctrl --help`
- Command to test this folder: `pnpm --filter heidrun_code_ctrl test`

## Rules
- The three kinds of macro are `hard_coded` (only in `src/hard_coded_macros.rs`), `personal` (`HEIDRUN_CODE_DIR/macros.json`, or `~/.config/heidrun_code/macros.json`), and `project` (key `prompts` of `.heidrun/config.json`); the words are in [macros.md](../../../docs/agents_rules/glossary/macros.md).
- A change of `.heidrun/config.json` keeps the other keys, their order, and unknown fields. Workspace level launchers are its key `launchers`; the old key `actions` is read and replaced on write, and a file with both keys is an error.
- User level launchers are `HEIDRUN_CODE_DIR/launchers.json`; `desktop_tauri` reads and writes them, and the group `launchers` never changes them. A launcher of the kind Coding agent keeps its `agent`, and `launchers update` refuses `--command` for it.
- A new launcher's default name is the first 20 characters of its command line; its id is the name in lowercase with dashes, a dash, and four characters, as in `stores/project.ts` of `web_frontend`.
- The voice words are `HEIDRUN_CODE_DIR/voice_words.json` (`id`, `whisper_writes`, `heidrun_writes`); an order refuses an empty or repeated text that Whisper writes. The matching rules are in `voice_input`.
- The command line never overwrites an invalid file, and writes a neighboring file that it renames into place. An id is unique among all the kinds; a macro without an id in `prompts` has the id `projet-<index>`.
- Success goes to standard output with exit code 0; an error is one message on standard error with exit code 1. A workspace, tab, or pane error is always JSON.
- The Herdr groups choose the session from `--session`, else the inherited `HERDR_SOCKET_PATH` or `HERDR_SESSION`, else `heidrun`, keep every Herdr field, and never start a server. Every close refuses a coding agent without `--force`.
- `panes focus` uses the socket request `pane.focus`, because `herdr pane focus` only moves to a neighbor.
- A focus of the window publishes a new `heidrun_focus_request` on the workspace; a pane to select ends the same value with `;pane=<id>`, because Herdr keeps a token until it is replaced. `open` also publishes `heidrun_workspace_folder` once.
- The package knows nothing about Tauri and imports no other package of the repository; `desktop_tauri` imports it. `.cargo/config.toml` puts the compiled files in the target folder of `desktop_tauri`.
- The skill name is `heidrun-code-ctrl`; the copy in `.agents/skills/heidrun-code-ctrl/` matches this package's skill. A test compares its `SKILL.md` with the help and runs its examples.

## Background
- The package comes from [issue #602](https://github.com/heidrun-org/heidrun/issues/602), the launchers from [issue #649](https://github.com/heidrun-org/heidrun/issues/649), the Agent Plugin from [issue #679](https://github.com/heidrun-org/heidrun/issues/679), and the skill layout from [issue #564](https://github.com/heidrun-org/heidrun/issues/564).
- The workspaces come from [issue #657](https://github.com/heidrun-org/heidrun/issues/657), the voice words from [issue #836](https://github.com/heidrun-org/heidrun_code/issues/836), the user level launchers from [issue #853](https://github.com/heidrun-org/heidrun_code/issues/853), and the tabs and the panes from [issue #999](https://github.com/heidrun-org/heidrun_code/issues/999).
