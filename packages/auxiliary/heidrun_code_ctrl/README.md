# heidrun_code_ctrl

`heidrun_code_ctrl` is the command line that controls the Heidrun Code application. A coding agent reads its [SKILL.md](skills/heidrun-code-ctrl/SKILL.md) and uses the commands, in the same way as the developer uses the window. The [Agent Plugin](plugin.json) packages the current macro, launcher, voice word, and workspace commands for use in other repositories.

## Install the Agent Plugin

The repository's [Agent Plugin catalog](../../../.agents/plugins/marketplace.json) points to this package. In Codex, add the Heidrun Code repository as a marketplace, then install the Agent Plugin:

```bash
codex plugin marketplace add heidrun-org/heidrun_code --ref dev_jerome
codex plugin add heidrun-code-control@heidrun
```

The skill requires the `heidrun_code_ctrl` command. The installed Heidrun Code application places the command in `~/.local/bin` when it starts. Make sure that folder is on the shell path before using the skill.

To install only the skill through the skills CLI, use its direct GitHub folder address. The [repository skill copy](../../../.agents/skills/heidrun-code-ctrl/SKILL.md) lets the skills CLI find the skill from the repository root and must stay in sync with the package skill. The direct address selects the package source on the `dev_jerome` branch:

```bash
npx skills add https://github.com/heidrun-org/heidrun_code/tree/dev_jerome/packages/auxiliary/heidrun_code_ctrl/skills/heidrun-code-ctrl
```

The skills.sh listing is based on installs made through the skills CLI. Its public listing may appear after people install the skill; the direct address works without waiting for a listing.

## Commands

The groups `macros`, `launchers`, and `voice_words` each have list, add, update, and delete. The group `workspaces` has list, open, rename, focus, and close.

The group `macros`: a macro is a reusable text that the developer writes into a pane. The commands never write a macro into a pane.

```bash
pnpm --silent heidrun_code_ctrl macros list
pnpm --silent heidrun_code_ctrl macros add --label "Run the tests" --text "Run the tests first."
pnpm --silent heidrun_code_ctrl macros update <id> --text "Run the tests, then the linter."
pnpm --silent heidrun_code_ctrl macros delete <id>
```

The group `launchers`: a launcher is one item of the Launchers sidebar section, a command line that Heidrun Code runs in its own tab. The commands never run a launcher.

```bash
pnpm --silent heidrun_code_ctrl launchers list
pnpm --silent heidrun_code_ctrl launchers add --label "Run the tests" --command "pnpm test"
pnpm --silent heidrun_code_ctrl launchers update <id> --command "pnpm run test:unit" --cwd web
pnpm --silent heidrun_code_ctrl launchers delete <id>
```

The group `voice_words`: the word replacement list of the voice input. Each entry has two texts, the text that Whisper writes and the text that Heidrun Code writes instead. After Whisper changes the speech into text, Heidrun Code replaces each listed text by its replacement. A space at the start or at the end of a text is part of the text.

```bash
pnpm --silent heidrun_code_ctrl voice_words list
pnpm --silent heidrun_code_ctrl voice_words add --whisper-writes "jerome etienne" --heidrun-writes "Jérôme Étienne"
pnpm --silent heidrun_code_ctrl voice_words add --whisper-writes " at sign " --heidrun-writes "@"
pnpm --silent heidrun_code_ctrl voice_words update <id> --heidrun-writes "Jérôme Étienne"
pnpm --silent heidrun_code_ctrl voice_words delete <id>
```

The group `workspaces` controls the workspaces of a running Herdr session. Keep the intended Heidrun Code window open. These examples run from the repository root and target installed Heidrun Code's session, `heidrun`:

```bash
pnpm --silent heidrun_code_ctrl workspaces list --session heidrun --json
pnpm --silent heidrun_code_ctrl workspaces open --session heidrun --cwd "$PWD" --label "Workspace test" --json
```

Copy the `workspace_id` printed by `open`, assign that value below, then rename, select, and close that workspace:

```bash
workspace_id="paste-the-workspace-id-here"
pnpm --silent heidrun_code_ctrl workspaces rename "$workspace_id" --session heidrun --label "Renamed workspace"
pnpm --silent heidrun_code_ctrl workspaces focus "$workspace_id" --session heidrun
pnpm --silent heidrun_code_ctrl workspaces close "$workspace_id" --session heidrun
```

Closing stops the workspace's processes. A workspace containing a coding agent requires `--force` to close. `open` requires an existing folder through `--cwd`; the optional `--label` defaults to the folder name. `rename` requires `--label`.

Use `--session heidrun_development` for development in the main checkout. A temporary worktree has its own session: `heidrun_` followed by the cleaned worktree name, limited to its last 32 characters. An explicit `--session` overrides inherited connection variables. Without `--session`, the commands use `HERDR_SOCKET_PATH` or `HERDR_SESSION` when set, otherwise `heidrun`. They never start a Herdr server or talk directly to Heidrun Code. There are no workspace commands named `add` or `delete`.

The output is Markdown, or JSON with `--format json`. For colors, send the Markdown to [glow](https://github.com/charmbracelet/glow): `pnpm --silent heidrun_code_ctrl macros list | glow`.

The macro, launcher, and voice word commands change files that the running Heidrun Code watches:

- The personal macros are in the file `macros.json` in the folder of the variable `HEIDRUN_CODE_DIR`, else in `~/.config/heidrun_code`.
- The project macros are in the key `prompts` of the file `.heidrun/config.json` of the project.
- The hard-coded macros are in the source code of Heidrun Code. They are listed, and they cannot be changed.
- The launchers are in the key `launchers` of the file `.heidrun/config.json` of the project. A launcher of the kind Coding agent is listed and its field `agent` stays as it is, but the command line cannot add one.
- The voice words are in the file `voice_words.json` in the folder of the variable `HEIDRUN_CODE_DIR`, else in `~/.config/heidrun_code`.

Workspace commands instead talk to Herdr through its executable. `open` publishes the original workspace folder for running Heidrun Code to save, and `focus` selects the requested workspace in the window. Keep Heidrun Code running when opening a workspace so the folder is saved before Herdr metadata expires. Workspace errors are always one JSON object on standard error with exit code 1.

Run `pnpm --silent heidrun_code_ctrl --help` for every option. Run `pnpm --filter heidrun_code_ctrl test` to test the package. The rules of the package are in [CONTEXT.md](CONTEXT.md).
