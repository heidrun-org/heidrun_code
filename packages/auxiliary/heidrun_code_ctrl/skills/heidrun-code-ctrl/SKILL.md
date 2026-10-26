---
name: heidrun-code-ctrl
description: Control the Heidrun Code application from the command line heidrun_code_ctrl. Use it to list, add, update, or delete the macros of the developer, the reusable texts that Heidrun Code writes into a pane, the hard-coded macros of Heidrun Code included, and to list, add, update, or delete the launchers of a project, the command lines that Heidrun Code runs in their own tab. Use the voice_words group to list, add, update, or delete the entries of the word replacement list of the voice input, the texts that Heidrun Code writes instead of the texts that Whisper writes wrongly. Use the workspaces group to list, open, rename, focus, or close workspaces through Herdr. A running Heidrun Code shows each change in its window within about one second.
compatibility: macOS with Heidrun Code installed and heidrun_code_ctrl available on the shell path.
---

# heidrun_code_ctrl

`heidrun_code_ctrl` is the command line that controls the Heidrun Code application. The groups `macros`, `launchers`, and `voice_words` have the commands `list`, `add`, `update`, and `delete`. The group `workspaces` has `list`, `open`, `rename`, `focus`, and `close`.

- A macro is a reusable text that the developer writes into a pane with one click. The commands create, read, change, and remove macros. They do not write a macro into a pane.
- A launcher is one item of the Launchers sidebar section: a command line that Heidrun Code runs in its own tab when the developer clicks its button "Run". The commands create, read, change, and remove launchers. They do not run a launcher. A launcher is not a macro.
- A voice word is one entry of the word replacement list of the voice input: the text that Whisper writes wrongly, and the text that Heidrun Code writes instead. The commands create, read, change, and remove entries. They do not change the speech or the Whisper model. A voice word is not a macro.

The groups `macros`, `launchers`, and `voice_words` change files and work while Heidrun Code is closed. The group `workspaces` talks only to Herdr through the `herdr` executable. Start Heidrun Code first to see workspace changes in its window. No workspace command starts a server.

Before using a command, check that `heidrun_code_ctrl --help` works. The installed Heidrun Code application places `heidrun_code_ctrl` in `~/.local/bin` when the application starts. If the command is not found, ask the developer to install Heidrun Code and make `~/.local/bin` available on the shell path.

## The macros

### The three kinds of macro

| Kind | Where it is kept | What you can do |
| --- | --- | --- |
| `hard_coded` | In the source code of Heidrun Code. | List it only. `add`, `update`, and `delete` refuse it. |
| `personal` | The file `macros.json` in the folder of the variable `HEIDRUN_CODE_DIR`, or else in `~/.config/heidrun_code`. It belongs to the developer, for every project. | List, add, update, delete. |
| `project` | The key `prompts` of the file `.heidrun/config.json` of the project. The file is shared with the other developers of the project. | List, add, update, delete. |

A macro has the fields `id`, `label` (the title shown in the window), `description` (one short line under the title, it may be empty), and `text`. A text can hold the variables `{workspace}`, `{onglet}`, `{agent}`, `{branche}`, `{selection}`, and `{presse-papiers}`. Heidrun Code replaces them when the developer uses the macro, so write them as they are.

### The commands of the group macros

Give `--format json` when a program reads the output. The default format is Markdown.

1. **See the macros, and their ids.** Do this first: every other command needs an id.
   ```bash
   heidrun_code_ctrl macros list --format json
   ```
   The list has the hard-coded macros, then the personal macros, then the project macros. Each macro has the fields `id`, `label`, `description`, `text`, `kind`, and `file`. `--kind personal` lists one kind only. The command reads the project of the current folder, or of the folder of `--folder`.
2. **Add a macro.** The kind is `personal` unless `--kind project` is given. The command prints the new macro with its new id.
   ```bash
   heidrun_code_ctrl macros add --label "Run the tests" --text "Run the tests first." --format json
   ```
   Without `--label`, the title is the first 40 characters of the text. Without `--id`, the id is made from the title. A text on several lines, or a text with quotes, goes through the standard input with `--text -`. One new line at the end is removed.
   ```bash
   printf 'Review the branch.\nList the risks.' | heidrun_code_ctrl macros add --kind project --label Review --text - --format json
   ```
3. **Update a macro.** Give the id, and only the fields to change. The other fields stay as they are.
   ```bash
   heidrun_code_ctrl macros update <id> --text "Run the tests, then the linter." --format json
   ```
4. **Delete a macro.**
   ```bash
   heidrun_code_ctrl macros delete <id> --format json
   ```

When an id exists in two kinds, `update` and `delete` stop and ask for `--kind personal` or `--kind project`.

## The launchers

The launchers of a project are the key `launchers` of the file `.heidrun/config.json` of the project. There is no personal file of launchers and no hard-coded launcher, so the commands have no `--kind`. A launcher has the fields `id`, `label` (the name shown in the window), `command` (the command line), `description` (a text on several lines), `cwd` (a folder relative to the root of the project), and `agent`. A field that the launcher does not have is `null` in the JSON output. The field `agent` is present only for a launcher of the kind Coding agent, which the developer makes in the window: its `command` is generated from its `agent`.

1. **See the launchers, and their ids.** Do this first: every other command needs an id. The command reads the project of the current folder, or of the folder of `--folder`.
   ```bash
   heidrun_code_ctrl launchers list --format json
   ```
2. **Add a launcher.** The command prints the new launcher with its new id.
   ```bash
   heidrun_code_ctrl launchers add --label "Run the tests" --command "pnpm test" --cwd web --format json
   ```
   Without `--label`, the name is the first 20 characters of the command line. Without `--id`, the id is made from the name, then a dash and four characters. `--description` and `--cwd` are optional. A command line on several lines, or with quotes, goes through the standard input with `--command -`. One new line at the end is removed.
   ```bash
   printf 'cd web\npnpm test' | heidrun_code_ctrl launchers add --label "Web tests" --command - --format json
   ```
3. **Update a launcher.** Give the id, and only the fields to change. The other fields stay as they are. An empty `--description` or an empty `--cwd` removes the field, and an empty `--label` takes the first 20 characters of the command line.
   ```bash
   heidrun_code_ctrl launchers update <id> --command "pnpm run test:unit" --format json
   ```
4. **Delete a launcher.** It does not close the tab where the launcher runs.
   ```bash
   heidrun_code_ctrl launchers delete <id> --format json
   ```

The command `launchers add` makes only a launcher with a command line, never a launcher of the kind Coding agent. The command `launchers update` keeps the field `agent` of a launcher of the kind Coding agent as it is, and refuses `--command` for it, because its command line is made from its `agent`: change its name, description, or folder, or ask the developer to change it in the window. A file written before the rename of "action" to "launcher" can hold the old key `actions`: the commands read it, and write the key `launchers` in its place.

## The voice words

The voice input changes the speech of the developer into text with Whisper. Whisper often writes a name of a person, a name of a product, or a technical word in the wrong way. The word replacement list fixes this: after Whisper gives the text, Heidrun Code replaces each listed text by its replacement, and then writes the text in the composition bar. An entry has the fields `id`, `whisper_writes` (the text that Whisper writes), and `heidrun_writes` (the text that Heidrun Code writes instead). The entries are the file `voice_words.json` in the folder of the variable `HEIDRUN_CODE_DIR`, or else in `~/.config/heidrun_code`. The file belongs to the developer, for every project, so the commands have no `--kind` and no `--folder`.

The rules of the matching:

- An entry matches a whole word or a whole group of words only. It never matches a part of a longer word.
- Upper case and lower case do not count.
- A space at the start or at the end of a text is part of the text, and the replacement can remove it. The entry `" at sign "` with the replacement `"@"` changes "name at sign example" into "name@example". The entry `"at sign"` with no spaces gives "name @ example".
- When two entries match at the same place, the longer entry wins.
- After a pass, Heidrun Code applies the list again to the new text, until no entry matches any more. So the entry "hadron" with the replacement "Heidrun", and the entry "heidrun card" with the replacement "Heidrun Code", change "hadron card" into "Heidrun Code". A list that loops (for example "a" to "b" and "b" to "a") stops after 10 passes, or when the text grows too long, and gives the text of the first pass.

1. **See the entries, and their ids.** Do this first: `update` and `delete` need an id.
   ```bash
   heidrun_code_ctrl voice_words list --format json
   ```
2. **Add an entry.** Both `--whisper-writes` and `--heidrun-writes` are required. The text that Whisper writes cannot be empty, and no other entry can have the same text (the case of the letters does not count). The text that Heidrun Code writes may be empty: the entry then removes the text that Whisper writes. Without `--id`, the id is made from the text that Whisper writes, then a dash and three characters. The command prints the new entry with its id.
   ```bash
   heidrun_code_ctrl voice_words add --whisper-writes "jerome etienne" --heidrun-writes "Jérôme Étienne" --format json
   ```
   Put the spaces inside the quotes to make them part of the text.
   ```bash
   heidrun_code_ctrl voice_words add --whisper-writes " at sign " --heidrun-writes "@" --format json
   ```
3. **Update an entry.** Give the id, and only the text to change. The other text stays as it is.
   ```bash
   heidrun_code_ctrl voice_words update <id> --heidrun-writes "Jérôme Étienne" --format json
   ```
4. **Delete an entry.**
   ```bash
   heidrun_code_ctrl voice_words delete <id> --format json
   ```

## The workspaces

Choose the right session before changing a workspace. `--session` overrides the inherited connection. Without `--session`, the commands use `HERDR_SOCKET_PATH` or `HERDR_SESSION` when set, otherwise the installed session `heidrun`. Main-checkout development uses `heidrun_development`; a temporary worktree uses `heidrun_` followed by the cleaned worktree name (at most its last 32 characters). Session names and workspace ids belong together. An id from another session does not identify the same workspace.

These commands require `herdr` on the shell path and a running Herdr session. They do not talk directly to Heidrun Code. Use the following examples with the session of the intended Heidrun Code window:

1. **List workspaces and copy an id.** JSON output is an array of workspace objects with all fields supplied by Herdr, including `workspace_id`, `label`, `active_tab_id`, and optional `tokens`.
   ```bash
   heidrun_code_ctrl workspaces list --session <session> --json
   ```
2. **Open a workspace.** `--cwd` is required. Relative folders are resolved from the current folder; `~` and `~/` are accepted. The folder must exist. `--label` is optional and defaults to the folder name. The workspace is selected and starts with the shell that Herdr creates. The command does not start a coding agent. JSON output is the opened workspace, including its id.
   ```bash
   heidrun_code_ctrl workspaces open --session <session> --cwd <folder> --label Project --json
   ```
3. **Rename a workspace.** `--label` is required and cannot be empty.
   ```bash
   heidrun_code_ctrl workspaces rename <id> --session <session> --label Renamed --json
   ```
4. **Focus a workspace.** This selects the existing workspace in the running window, including when Herdr already considers that workspace focused.
   ```bash
   heidrun_code_ctrl workspaces focus <id> --session <session> --json
   ```
5. **Close a workspace.** Closing stops every process in the workspace. A workspace containing a coding agent is refused unless `--force` is supplied. Inspect the workspace before using `--force`. JSON output is an object with the field `closed`, containing the closed workspace.
   ```bash
   heidrun_code_ctrl workspaces close <id> --session <session> --json
   ```

`open` publishes the fixed creation folder in the Herdr token `heidrun_workspace_folder`. Running Heidrun Code saves that folder once. `open` and `focus` publish a distinct `heidrun_focus_request` token so the window receives a selection request even when Herdr's focus is unchanged. These tokens do not move a saved workspace folder. Keep Heidrun Code running when opening a workspace so the folder is saved before Herdr metadata expires. If opening succeeds but publishing metadata fails, the error names the workspace id; inspect `workspaces list` instead of opening another workspace.

The format options are `--format markdown|json` and `--json`, as for the other groups. Workspace errors are always one JSON object on standard error with exit code 1. Success uses standard output and exit code 0. No `add` or `delete` command exists for workspaces.

## Errors

A command that fails exits with the code 1, prints one JSON object on one line on the standard error output, with the field `error`, and changes no file. The errors that you can fix:

- The macro is hard-coded: choose another macro, or add a personal macro with the text that you want.
- No macro has the id: run `macros list` again and copy the id.
- Herdr is not running: start the intended Heidrun Code window and check the session.
- No workspace has the id: run `workspaces list` in the same session and copy the id.
- No launcher has the id: run `launchers list` again and copy the id.
- The text is empty: a macro always has a text. The command line is empty: a launcher always has a command line.
- The launcher is of the kind Coding agent and `--command` is given: leave `--command` out.
- No entry has the id: run `voice_words list` again and copy the id.
- The text that Whisper writes is empty, or another entry already has it: give another text, or update the other entry.
- A file is not valid: the message gives its path and the mistake. `heidrun_code_ctrl` never overwrites such a file, so the developer can repair it.

## For a person

The default Markdown output is for a person, or for a renderer. `heidrun_code_ctrl macros list | glow`, `heidrun_code_ctrl launchers list | glow`, and `heidrun_code_ctrl voice_words list | glow` show it with colors. There is no format with colors in `heidrun_code_ctrl`.
