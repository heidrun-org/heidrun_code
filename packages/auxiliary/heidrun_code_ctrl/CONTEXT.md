# Directory Context: `/packages/auxiliary/heidrun_code_ctrl`

## Purpose
A Rust library and the `heidrun_code_ctrl` command line for controlling Heidrun Code macros, launchers, voice words, and workspaces, plus an Agent Plugin that distributes its skill. Macros, launchers, and voice words support list, add, update, and delete through watched files. Workspaces support list, open, rename, focus, and close through the running Herdr executable; no command talks directly to Heidrun Code or runs a launcher.

## Key Exports & Entry Points
- `src/lib.rs`: the only public library interface. It exports the macro, launcher, and voice word types, storage functions, list/add/update/delete operations, and output formatting.
- The binary-only workspace commands preserve all Herdr workspace fields, use explicit session selection or the inherited connection (otherwise `heidrun`), and never start a server. Close refuses a detected coding agent without `--force`.
- `src/main.rs`: the `heidrun_code_ctrl` executable. `src/command_line.rs` parses arguments and holds the help text.
- `plugin.json`: the Agent Plugin manifest. Its skill is in `skills/heidrun-code-ctrl/`, and a test compares its `SKILL.md` with the command help and runs its examples.
- `tests/`: executable tests with temporary data and a temporary project. Library tests sit beside the source.
- Command to run this folder: `pnpm --silent heidrun_code_ctrl --help`
- Command to test this folder: `pnpm --filter heidrun_code_ctrl test`

## Rules
- The three kinds of macro are `hard_coded`, `personal`, and `project`: the words are in the glossary, in [macros.md](../../../docs/agents_rules/glossary/macros.md).
- Hard-coded macros live only in `src/hard_coded_macros.rs`. The application reads them through `macros_hard_coded`; no command changes them.
- Personal macros live in `HEIDRUN_CODE_DIR/macros.json`, or `~/.config/heidrun_code/macros.json`. The desktop application uses this library to read and write them.
- Project macros live in the `prompts` key of `.heidrun/config.json`; changes keep the other keys, their order, and unknown macro fields.
- Workspace level launchers live in the `launchers` key of `.heidrun/config.json`; changes keep other keys, their order, and unknown launcher fields. The old `actions` key is read and replaced on write; a file with both keys is an error.
- User level launchers live in `HEIDRUN_CODE_DIR/launchers.json`, or `~/.config/heidrun_code/launchers.json`, as a JSON list; `desktop_tauri` uses `read_user_launchers` and `write_user_launchers`, and the group `launchers` never changes it.
- A launcher of the kind Coding agent keeps its `agent` field; `launchers update` refuses `--command` for it. `launchers add` makes only command line launchers, and `launchers delete` does not close a tab.
- A new launcher's default name is the first 20 characters of its command line on one line. Its id is the lowercase name with dashes, then a dash and four characters, as in `stores/project.ts` of `web_frontend`.
- The word replacement list of the voice input lives in `HEIDRUN_CODE_DIR/voice_words.json`, or `~/.config/heidrun_code/voice_words.json`: a JSON list of entries with the fields `id`, `whisper_writes`, and `heidrun_writes`. The group `voice_words` and `desktop_tauri` use the same four orders. An order refuses an empty text that Whisper writes, and a second entry with the same text (the case does not count); an empty text that Heidrun Code writes is allowed. The rules of the matching are in `voice_input`.
- The command line never overwrites an invalid file. A write uses a neighboring file and renames it into place.
- An id is unique among all the kinds. A macro without an id in the key `prompts` has the id `projet-<index>`, as in the window.
- Commands write success to standard output with exit code 0, or one error to standard error with exit code 1. Output formats are `markdown` and `json`; a separate renderer adds colors.
- The package knows nothing about Tauri and imports no other package of the repository. `desktop_tauri` imports this package. The file `.cargo/config.toml` puts the compiled files in the Cargo target folder of `desktop_tauri`.
- The Agent Plugin and the skill stay in this package. The skill name is `heidrun-code-ctrl`, while the command line keeps the name `heidrun_code_ctrl`.
- The repository copy in `.agents/skills/heidrun-code-ctrl/` matches this package's skill so that a coding agent working in the Heidrun Code repository sees the same instructions.

- Workspace creation publishes `heidrun_workspace_folder` for Heidrun Code to save once; open and focus publish a new `heidrun_focus_request` so repeated focus requests reach the window.

## Background
- The package comes from [issue #602](https://github.com/heidrun-org/heidrun/issues/602). The group `launchers` comes from [issue #649](https://github.com/heidrun-org/heidrun/issues/649).
- The `SKILL.md` follows the layout of [heidrun_data](../../../submodules/heidrun_data/packages/heidrun_data/CONTEXT.md), from [issue #564](https://github.com/heidrun-org/heidrun/issues/564).
- The Agent Plugin comes from [issue #679](https://github.com/heidrun-org/heidrun/issues/679).

- The workspace commands come from [issue #657](https://github.com/heidrun-org/heidrun/issues/657). The group `voice_words` comes from [issue #836](https://github.com/heidrun-org/heidrun_code/issues/836). The user level file comes from [issue #853](https://github.com/heidrun-org/heidrun_code/issues/853).
