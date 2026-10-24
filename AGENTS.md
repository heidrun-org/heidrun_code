# Heidrun Code

<!-- identity:start -->
<!-- Generated from data/identity.json: pnpm docs:identity -->

Keep your agents working. Know which one needs you.

<!-- identity:end -->

This file gives the rules for working on this repository. The file `README.md` describes the application itself.

## Names of the project

The whole project is called Heidrun Organization. It has two applications: Heidrun Code, the application for coding agents that this repository holds, and Heidrun Notebook, the application for project management and note taking. The identifiers are `heidrun_code` and `heidrun_notebook`.

- In a new text, write "Heidrun Code" for the application. Never write "HeidrunCode".
- The glossary file [heidrun_names.md](docs/agents_rules/glossary/heidrun_names.md) gives the names, and the names that change in later steps ([issue 837](https://github.com/heidrun-org/heidrun_code/issues/837)).

## Installed Heidrun Code and Heidrun Code Development

Heidrun Code and Heidrun Code Development are separate applications with separate permissions. Plain "Heidrun Code" means the installed application that the developer uses. The name "Heidrun" alone is the former name of the installed application, and an older installation can still have it, so it stays revoked too. Always write "Heidrun Code Development" in full when referring to the application used for development testing.

| Application | Purpose | macOS application identifier | Permission for Codex |
| --- | --- | --- | --- |
| Heidrun Code | The installed application used by the developer | `dev.heidrun-org.heidrun-code` | Revoked. Codex must not control this application. |
| Heidrun (former name of Heidrun Code) | An older installation of the installed application | `dev.heidrun-org.heidrun` | Revoked. Codex must not control this application. |
| Heidrun Code Development | The application built from the checkout or temporary worktree being tested | `dev.heidrun-org.heidrun-code.development` | Only development testing authorized by the developer. |

The identifiers are defined in [tauri.conf.json](packages/apps/desktop_tauri/tauri.conf.json) and [tauri.development.conf.json](packages/apps/desktop_tauri/tauri.development.conf.json). Development identity is independent of Rust optimization settings: an optimized development build is still Heidrun Code Development.

### Before application interaction

- Select Heidrun Code Development by its exact application identifier or by the full path of the development application built from the intended checkout or temporary worktree. Verify both the application identifier and the checkout or temporary worktree before the first interaction. Verify that the returned window belongs to Heidrun Code Development before sending input.
- Never select the installed application by the name "Heidrun Code" or "Heidrun", or by the identifier `dev.heidrun-org.heidrun-code` or `dev.heidrun-org.heidrun`. Never launch, focus, click, type in, close, capture the window of, or change the settings, workspaces, tabs, or panes of the installed application for development testing. Do not access the installed application to test whether permission has been revoked.
- A terminal running Codex inside installed Heidrun Code does not give Codex permission to control installed Heidrun Code. A similar appearance, the current working folder, a previous approval, and permission for Heidrun Code Development do not change this restriction.
- If the correct Heidrun Code Development application or its window cannot be identified, stop application interaction. Never fall back to installed Heidrun Code.

### Command-line access to Herdr

The same restriction applies to command-line tools and direct socket requests. Never control the installed application's Herdr session as a substitute for controlling Heidrun Code Development.

- Before any Herdr command or socket request, verify the resolved session and socket against the intended development application. Do not send discovery commands to an inherited session just because Codex is running inside Herdr.
- Installed Heidrun Code normally uses the session `heidrun`. Heidrun Code Development in the main checkout normally uses `heidrun_development`. Heidrun Code Development in a temporary worktree uses a separate session derived from the worktree name. The selection rules are in [herdr.rs](packages/apps/desktop_tauri/src/herdr.rs).
- Check environment overrides, including `HERDR_SOCKET_PATH`, `HERDR_SESSION`, and `HEIDRUN_CODE_DEVELOPMENT_SESSION`. The development application clears inherited Herdr variables at startup in [application_profile.rs](packages/apps/desktop_tauri/src/application_profile.rs); a separate command started by Codex can still inherit the installed application's variables.
- For a verified development session, clear inherited `HERDR_SOCKET_PATH` and `HERDR_SESSION` from the environment of the command and pass the verified session explicitly with `herdr --session <verified-development-session> ...`. For a direct socket request, use only the verified development socket. Stop when the resolved destination is installed Heidrun Code or is uncertain.

### Codex Computer Use permission

Repository instructions and saved Codex permissions are separate. Editing this file does not revoke a saved application approval. Keep an explicit denial for installed Heidrun Code and for the former installed Heidrun in the user's Codex configuration:

```toml
[computer_use.macos.bundle_ids]
"dev.heidrun-org.heidrun-code" = "deny"
"dev.heidrun-org.heidrun" = "deny"
```

Merge this entry into any existing table without replacing unrelated settings. Do not add an approval for Heidrun Code Development as a side effect of denying installed Heidrun Code. The exact application identifiers make the rules specific to the installed applications. See the [official Codex configuration reference](https://learn.chatgpt.com/docs/config-file/config-reference).

If Heidrun Code or Heidrun remains listed under Always-allowed apps in Codex's Computer Use settings, remove that saved approval separately. Verify the saved rule through Codex configuration, and report any unresolved saved-approval removal or need to reload an existing Codex session. Do not claim that a configuration read proves that an already-running Computer Use session has reloaded the rule. Computer Use permissions do not block shell commands, so the Herdr restrictions above still apply.

This restriction follows [issue 769](https://github.com/heidrun-org/heidrun/issues/769).

## Git submodules

Clone Heidrun Code with its submodules:

```sh
git clone --recurse-submodules git@github.com:heidrun-org/heidrun_code.git
```

After a pull, or in an existing clone without initialized submodules, run this command from the checkout root:

```sh
git submodule update --init --recursive
```

- `submodules/coding_agent_plugin` contains the independent [coding agent skills repository](https://github.com/jeromeetienne/coding_agent_plugin) at the commit recorded by Heidrun Code.
- Make shared skill changes in the independent repository. Heidrun Code's existing `.agents/skills` remain in place and are not synchronized automatically.
- `pnpm worktree:create` initializes the submodules of the new worktree before installing packages.
- To adopt a newer published skill version, check out the intended commit inside the submodule and commit the updated submodule reference in Heidrun Code. A normal submodule update restores the recorded commit; it does not follow the latest remote commit.
- The submodule contains instructions and is outside the pnpm workspace. The application build, tests, and release scripts do not import the submodule.

## Project memory

This file is read by Claude Code (through `CLAUDE.md`) and by Codex.

- The branch `dev_jerome` is the personal development branch of Jérôme Étienne. Jérôme's work goes on `dev_jerome`.
- **NEVER delete or remove the branches `dev`, `dev_jerome`, or `dev_eric`. Never, in any case, locally or on the remote repository.** These branches are permanent. When you merge a pull request (on GitLab, a merge request) from one of these branches, never use the option `--delete-branch` of `gh pr merge`, and never use the option `--remove-source-branch` of `glab mr merge`. Delete only a temporary branch of the Issue Fix Workflow.
- The branch `dev_eric` is the personal development branch of Eric. Eric's work goes on `dev_eric`.
- Each developer works on the personal development branch of that developer only. Never put the work of Jérôme on `dev_eric`, and never put the work of Eric on `dev_jerome`.

## Docs folder

The folder `docs` belongs to the coding agents: the coding agents write its files, and the coding agents read them. Every file and every folder in the folder `docs` follows the skill [docs_folder_system](.agents/skills/docs_folder_system/SKILL.md). Read the skill before you add, change, rename, move, or delete a file or a folder in the folder `docs` ([issue 811](https://github.com/heidrun-org/heidrun/issues/811)).
The skill names no detail of this repository: it reads the values of this repository in the section "Docs folder system values" below.

### Docs folder system values

- Documentation folder: `docs`
- Files with no metadata header: `docs/release_notes/prefix.md`. The release script copies this file into the text of every GitHub release, so a header would appear in every release.

## Agent rules

The folder `docs/agents_rules` holds all the rules that every coding agent obeys. Before you change the code, read the glossary and the rule files that match the part that you change, as the skill [docs_folder_agents_rules_system](.agents/skills/docs_folder_agents_rules_system/SKILL.md) says. This skill needs the skill [docs_folder_system](.agents/skills/docs_folder_system/SKILL.md). Start at [docs/agents_rules/index.md](docs/agents_rules/index.md): each file `index.md` says what each rule file holds and when to read it ([issue 811](https://github.com/heidrun-org/heidrun/issues/811)).
The skill names no detail of this repository: it reads the values of this repository in the section "Docs folder agents rules system values" below.

### Docs folder agents rules system values

- Agent rules folder: `docs/agents_rules`
- Glossary folder: `docs/agents_rules/glossary`. The glossary also gives the official name "coding agent" for Claude Code, Codex, and Antigravity.
- Maximum size of a file: 10000 bytes.
- Size test command: `pnpm --filter agents_rules_checker test`

## Issue Fix Workflow

Every issue fix in this repository follows the skill [issue_fix_workflow](.agents/skills/issue_fix_workflow/SKILL.md). Read the skill before you start an issue fix, each time that the developer asks to fix an issue ([issue 656](https://github.com/heidrun-org/heidrun/issues/656)).
The skill names no detail of this repository: it reads the values of this repository in the section "Issue Fix Workflow values" below.

### Issue Fix Workflow values

- Target branch: the personal development branch of the developer, as the section "Project memory" says: `dev_jerome` for Jérôme, and `dev_eric` for Eric.
- Worktree creation command: `pnpm worktree:create <name>`, run at the root of the main checkout, where `<name>` is the name of the temporary branch. Never create a worktree with `git worktree add`. The command also clones the compiled Rust files of the main checkout into the worktree, so the first build in the worktree is much faster and uses much less disk space. Build the main checkout before you create a worktree. The command initializes the submodules at their recorded commits with `git submodule update --init --recursive`. At the end, the command runs `pnpm install --frozen-lockfile` in the new worktree, so the worktree has a `node_modules` folder and `pnpm dev` runs at once. Do not run `pnpm install` by hand after the command. When the installation fails, the command prints the error and exits with a non-zero code, and the worktree stays.
- Worktree folder: `.claude/worktrees/<name>`, inside the main checkout.
- Launch command: `cd <path of the temporary worktree> && pnpm dev`.
- Issue tracker commands: this repository is on GitHub, so use the `gh` command here. Use the `glab` command only for a repository on GitLab, as [github_and_gitlab_support.md](docs/agents_rules/github_and_gitlab_support.md) says.
  - Read an issue: `gh issue view <number> --comments`. On GitLab: `glab issue view <number> --comments`.
  - Comment on an issue: `gh issue comment <number> --body "<comment>"`. On GitLab: `glab issue note <number> --message "<comment>"`.
  - Create an issue: see the section "GitHub and GitLab".
  - Create a pull request: `gh pr create`. On GitLab, create a merge request: `glab mr create`.
  - Merge a pull request: `gh pr merge`. On GitLab, merge the merge request: `glab mr merge`. The section "Project memory" says which branches are never deleted.
  - Close an issue: `gh issue close <number>`. On GitLab: `glab issue close <number>`.
  - The text of an issue and of a comment follows the section "GitHub and GitLab", part "Writing the text of an issue".
- Chat rename: available in Claude Code only. The identifier of this chat is in the environment variable `CLAUDE_CODE_HOST_SESSION_ID`. Read it with `echo $CLAUDE_CODE_HOST_SESSION_ID`, then give it as `session_id` to the tool `mcp__ccd_session_mgmt__set_session_title`. Never search for this chat in the list of sessions: this chat is often missing from the list. For Codex, or when the variable is empty, the rename is not available.
- Background: the Issue Fix Review exists because the developer cannot validate a change without the application ([issue 500](https://github.com/heidrun-org/heidrun/issues/500)), it has two separate messages ([issue 526](https://github.com/heidrun-org/heidrun/issues/526)), and the Issue Fix Implementation starts again after each change request ([issue 610](https://github.com/heidrun-org/heidrun/issues/610)).

## Bug Triage Workflow

The Bug Triage Workflow keeps the list of open issues small. It has four steps: collect the open issues, classify each issue, report to the developer in the chat, and decide. A triage starts only when the developer asks for it in the chat. The coding agent closes an issue only when the developer names the number of the issue. The full steps are in the skill [bug_triage_workflow](.agents/skills/bug_triage_workflow/SKILL.md). Read the skill before you start a triage ([issue 655](https://github.com/heidrun-org/heidrun/issues/655)).

## Git Cleanup Adviser

The Git Cleanup Adviser reviews Git branches and worktrees and reports which ones appear safe to remove, with evidence. It gives advice only and does not remove branches or worktrees. Read the skill [.agents/skills/git_cleanup_adviser/SKILL.md](.agents/skills/git_cleanup_adviser/SKILL.md) when the developer asks which branches or worktrees can be removed ([issue 673](https://github.com/heidrun-org/heidrun/issues/673)).

## CONTEXT.md files

Before you edit or add a file in a folder, read the nearest file `CONTEXT.md` in this folder or in its parent folders. The skill [context_md_system](.agents/skills/context_md_system/SKILL.md) gives all the rules of the `CONTEXT.md` files. Read the skill each time that you create a folder that holds source code, change the exported interface or the responsibility of a folder, or change a `CONTEXT.md` file ([issue 676](https://github.com/heidrun-org/heidrun/issues/676)).

## GitHub and GitLab

Every command for GitHub in this section has a matching command for GitLab, as [docs/agents_rules/github_and_gitlab_support.md](docs/agents_rules/github_and_gitlab_support.md) requires. This repository is on GitHub, so use the `gh` command here. Use the `glab` command only for a repository on GitLab.

### Creating an issue

Create an issue with the `gh` command: `gh issue create --title "<title>" --body "<body>"`. On GitLab, use the `glab` command: `glab issue create --title "<title>" --description "<body>"`. If you have screenshots related to the issue, attach them in the same command, as described in the section "Attaching an image to an issue". Write the text of the issue as the section "Writing the text of an issue" says.

### Attaching an image to an issue

Attach every screenshot, image, or video related to an issue with the `--attach` flag of the `gh` command. The flag uploads the file to GitHub and adds it to the issue. The flag takes a file path, and an optional alt text after `#`. Repeat the flag to attach several files, up to 50 files per command.

- When you create the issue: `gh issue create --title "<title>" --body "<body>" --attach './screenshot.png#Alt text'`
- When the issue already exists: `gh issue edit <issue number> --attach './screenshot.png#Alt text'`

On GitLab, the `--attach` option of the `glab` command works in the same way, but it is experimental, and it takes a file path without alternative text.

- When you create the issue: `glab issue create --title "<title>" --description "<body>" --attach './screenshot.png'`
- When the issue already exists: `glab issue update <issue number> --attach './screenshot.png'`

Never commit an image to the repository, and never push an image to a branch, only to show it in an issue. If you need a screenshot in a specific place in the body, write `![Alt text](screenshot.png)` in the body, and the `--attach` flag rewrites the reference to the uploaded file.

### Writing the text of an issue

These two rules apply to the body of an issue, and to every comment that you write in an issue.

- Every file name of the repository that you write in the text of an issue is a link to the file. Write the file name as the label of the link, and the address of the file on GitHub as the target, for example `[HOW_TO_RELEASE.md](https://github.com/heidrun-org/heidrun_code/blob/main/HOW_TO_RELEASE.md)`. Link to the branch `main`, or to the branch that holds the file when `main` does not have the file yet. On GitLab, the address of a file has the form `https://<host>/<group>/<project>/-/blob/main/<path>`.
- Every issue that you write in the text of an issue is its own bullet that starts with a dash, and the bullet holds only the plain address of the issue, for example `- https://github.com/heidrun-org/heidrun/issues/506`. GitHub changes such a bullet into the title, the state, and the number of the issue. A numbered list, a link with a label, or an issue number inside a sentence shows only the number. Write the words that explain the issues above the list, not inside the bullet. On GitLab, write each issue as its own bullet in the same way, with a plus sign after the reference, for example `- #506+`, so that GitLab shows the title.

## Starting Heidrun Code to test it or to take a screenshot

Always start Heidrun Code with the command line option `--no-splash-screen` when you start it to test it, and above all when you take a screenshot. Without the option, the splash screen covers the application for 3 seconds after the main window appears, so a screenshot taken in this time shows the splash screen and not the application, and you wait for nothing.

- In development, run `pnpm dev -- -- --no-splash-screen` at the root of the repository or of the worktree. The command `tauri dev` gives the arguments after its second `--` to the application.
- For the built application on macOS, run `open -a "Heidrun Code" --args --no-splash-screen` while Heidrun Code is not running.
- The rules of the splash screen are in [docs/agents_rules/user_interface/window/window_state_and_start.md](docs/agents_rules/user_interface/window/window_state_and_start.md), in the section "Splash screen".

## Environment variables

The file `.env.example` at the root of the repository lists and explains every environment variable that the application reads. A developer copies it to the file `.env`, which Git ignores, and removes the comment sign of each variable that the developer wants. A development build of the application loads the file `.env` at the start, with the module `packages/apps/desktop_tauri/src/environment_file.rs`. A release build never loads it. A variable that is already set in the shell keeps the value of the shell.

- When you add code that reads an environment variable, add the variable to `.env.example` in the same change: a block of comments that says what the variable does, its default value, and its accepted values, then the variable on one commented-out line.
- Keep every variable of `.env.example` commented out, so that a copy of the file changes nothing.
- The Rust test of the module `environment_file` fails when `.env.example` and the code do not list the same variables.

## Tests

- The tests have two levels, the fast tests and the slow tests, and the rule is in [test_levels.md](docs/agents_rules/test_levels.md): read it before you add a test, a package that has tests, or a test command. `pnpm test` at the repository root runs the fast tests only. It is the same command as `pnpm test:fast`. It exits with a non-zero code when a test fails.
- `pnpm test:fast` runs the fast tests of every package.
- `pnpm test:slow` runs the slow tests: `pnpm --filter voice_input test:slow` and `pnpm --filter change_log_generator test`.
- `pnpm test:full` runs `pnpm test:fast`, then `pnpm test:slow`. Run it before a release, as [HOW_TO_RELEASE.md](HOW_TO_RELEASE.md) says.
- A test is slow when it loads a real model, or when it is in a package that the developer rarely changes and that runs for about 10 seconds or more. The tests of `voice_input` that load the real model `tiny` are slow, and all the tests of `change_log_generator` are slow. A package with a slow test has the scripts `test:fast` and `test:slow`, and the root script `test:slow` calls it ([issue 826](https://github.com/heidrun-org/heidrun/issues/826)).
- The script `test` of every package that uses Vitest is `vitest run --minWorkers=1 --maxWorkers=4`, so that Vitest starts at most four worker processes at the same time. With four workers the tests of `web_frontend` took 59 seconds instead of 137 seconds with two workers ([issue 826](https://github.com/heidrun-org/heidrun/issues/826)). Vitest 2 needs both options: the default minimum is the number of processor cores minus one, and Vitest stops with an error when the minimum is higher than the maximum. Give both options to every new package that uses Vitest. A test file of `web_frontend` that needs no simulated web page (no `document`, no `window`, no mounted component) starts with the line `// @vitest-environment node`, so that Vitest does not start jsdom for this file ([issue 826](https://github.com/heidrun-org/heidrun/issues/826)). The default test environment of `web_frontend` is happy-dom, which starts faster than jsdom. The 12 test files that fail in happy-dom (the Markdown rendering, the browser storage, and some SVG and network behavior) start with the line `// @vitest-environment jsdom` ([issue 826](https://github.com/heidrun-org/heidrun/issues/826)). The setup file `packages/apps/web_frontend/src/test_setup.ts` makes `vi.waitFor` check again every 2 milliseconds, not every 50 milliseconds, because a test slept between two checks ([issue 826](https://github.com/heidrun-org/heidrun/issues/826)). The texts of the locale files reach the code as one module, `virtual:locale-messages`, built by `packages/apps/web_frontend/vite.config.ts`, because a test that calls `vi.resetModules()` loaded 202 JSON modules again at each call, and this cost about 60 milliseconds for each test ([issue 826](https://github.com/heidrun-org/heidrun/issues/826)).
- `pnpm --filter web_frontend test` runs the Vitest tests of the package `packages/apps/web_frontend`. The test files sit next to the code, and are named `*.test.ts`.
- `pnpm --filter desktop_tauri test` builds the package `mobile_website`, then runs `cargo test` for the package `packages/apps/desktop_tauri`. The Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter website_public test` runs the Vitest tests of the package `packages/auxiliary/website_public`: the configuration, the pages, the page of shortcuts, the identity texts, the macOS quarantine message in the developer documents and its absence from the release text, the splash image component, the favicon, the link preview cards (the Open Graph tags, the X card tags, and the card image), and a complete build of the website. The test files sit in the folder `tests`.
- `pnpm --filter coding_agent_cli test` runs `cargo test` for the package `packages/auxiliary/coding_agent_cli`, with fake `claude` and `codex` commands. The tests of the command line sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter mobile_website test` runs the Vitest tests of the package `packages/auxiliary/mobile_website`: the Needs you screen, the Panes screen, the screen of one pane with the macro button and the microphone button, the Launchers screen, the bottom bar, the confirmation sheet, the pairing key and the calls to the mobile server, the address of each screen, the colors of the output, the development server with its fake computer, and the rules of a page under a strict content security policy. The tests start the whole page against a fake computer, and the test files sit in the folder `tests`. `pnpm --filter mobile_website build` builds the website. `pnpm --filter mobile_website dev` starts a development server that reloads the page when a file changes, with a fake computer, or with the real desktop application when the variables `MOBILE_API_TARGET` and `MOBILE_API_HOST` (the host name of the tunnel) are set.
- `pnpm --filter mobile_server test` builds the package `mobile_website`, then runs `cargo test` for the package `packages/auxiliary/mobile_server`: the checks of a request (the header Host, which must be the host name of the tunnel, the header Origin, the pairing key, and the lock after ten bad keys), the closed list of methods, the routes with a fake handler, the files of the mobile website with their types, the file `mobile.json`, the finding of the program `ngrok`, the reading of the address of the tunnel, and the life of the server on the loopback address, with a fake `ngrok` program. One more test opens a real tunnel, so it runs only by hand with `cargo test live_ -- --ignored`. The Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter data_layer_code_hosting test` runs `cargo test` for the package `packages/data_layers/data_layer_code_hosting`: the events of the operation log that each public function writes (the tree of the nested operations, the parameters, the counts, and the failures), the two JSON schemas, the SQLite file, the reading of the pages of GitHub with a fake GitHub, the modes initialize and update, and the read-only query. The tests of the command line use a fake `gh` command and sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter data_layer_source_control test` runs `cargo test` for the package `packages/data_layers/data_layer_source_control`: the events of the operation log that each public function writes (the tree of the nested operations, the parameters, the counts, and the failures), the JSON schema, the SQLite file, the reading of the commits of a real Git repository, the modes initialize and update, and the read-only query. The tests of the command line use a real Git repository in a temporary folder and sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter data_layer_user_activity test` runs `cargo test` for the package `packages/data_layers/data_layer_user_activity`: the events of the operation log that each public function writes (the tree of the nested operations, the parameters, the counts, and the failures), the JSON schema, the SQLite file, the reading of the file of user activity records, the modes initialize and update, and the read-only query. The tests of the command line use a fake file of user activity records in a temporary folder and sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter data_layer_coding_agents test` runs `cargo test` for the package `packages/data_layers/data_layer_coding_agents`: the events of the operation log that each public function writes (the tree of the nested operations, the parameters, the counts, and the failures), the reading of the chat session files of Claude Code and of Codex, the cache of the scans, the reading of the memory files, the subagents, and the skills with their headers, the four JSON schemas, the SQLite file with its link tables and the three tables of the configuration of the coding agent, the mark of a removed file, the tokens of each minute (the table, the index and its query plan, the write that changes only the rows that changed, the chat session that two files hold, the folder and the workspaces that overlap, the days of a time zone with a day of 23 or 25 hours), the model prices (the versions, the fetch that fails, the refresh once a day), the view with the cost (a model with no price has no cost, and the prices of the cached tokens that fall back to the input price), the modes initialize and update, and the read-only query. The tests of the command line use fake folders of the two coding agents, a fake home folder, and a real Git repository with a fake remote, and sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter heidrun_code_data test` runs `cargo test` for the package `packages/data_layers/heidrun_code_data`: the four sources and their fixed order, the command `operations` (the actions info, summary, list, replay, snapshot, and overhead, the usage patterns, the operations that never ended, the replay of a query on a snapshot, the replay of a synchronization in an isolated file that never touches the real file, the log that cannot be written, and the programs that write the log together), the commands `update`, `initialize`, `query`, `sources`, `schema`, `usage` (the tokens and the cost by minute, hour, and day, in a time zone), and `read` with the history of one file, the limit added to a query, the output formats, the errors as JSON, the lock of the SQLite file, and the file `SKILL.md` compared with the help and the schema. The tests of the command line use a real Git repository in a temporary folder, a fake `gh` command, fake folders of the two coding agents with one memory file, one skill in the repository, a fake home folder, and a fake file of user activity records, and sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter data_layer_operation_log test` runs `cargo test` for the package `packages/data_layers/data_layer_operation_log`: the record format and its version, the removal of the secrets from a text, a field, and an address, the SQL statement without its values, the file that grows to 8 MiB and is replaced, the lines that two threads write together, the events that cannot be written and are reported by the next event, the nesting of the operations, the operation that panics or is dropped, the reading of the file with the unfinished operations (running or interrupted), the filters, the groups and the percentiles, and the measure of the cost of the log (a budget of 1 millisecond and 2 KiB for an operation). The Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter voice_input test:fast` runs `cargo test --lib` for the package `packages/auxiliary/voice_input`, and `pnpm --filter voice_input test:slow` runs `cargo test --test transcription_with_tiny_model`. The command `pnpm --filter voice_input test` runs both. The fast tests are: the conversion of the audio of the microphone to 16 kilohertz and one channel, the list of the 12 Whisper models, the download of a model with a fake server (a complete download, a download that stops early, a missing file, and no server), the cleaning of the text of Whisper, the replacement of the words of the word replacement list in that text (whole words only, upper and lower case, the longest entry first, an empty list, a chain of replacements, a list that loops, and the spaces at the ends of an entry), the refusal of an unknown language, and the rotation of the file of the Whisper logs. The slow tests are: a spoken sentence changed into text with the real model `tiny`, which the first run downloads once from Hugging Face into the folder of the build, and the lines of the real model in the file of the Whisper logs. One test records the real microphone and runs only by hand with `cargo test live_ -- --ignored`. The building of the package needs `cmake`. The slow tests sit in the folder `tests`, and the fast Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter heidrun_code_ctrl test` runs `cargo test` for the package `packages/auxiliary/heidrun_code_ctrl`: the three kinds of macro, the file of the personal macros, the keys `prompts` and `launchers` of the file `.heidrun/config.json` with their other keys kept (and the old key `actions`), the file `launchers.json` of the launchers of the user level (a missing file, a file that is not valid and stays as it is, and the repeated identifier), the four orders list, add, update, and delete on the macros, on the launchers, and on the voice words with their errors, the file `voice_words.json` of the word replacement list (the spaces at the ends of the texts kept, an empty text that Heidrun writes allowed, and an empty or repeated text that Whisper writes refused), the launcher of the kind Coding agent kept intact, the output formats markdown and json, the arguments of the command line, and the file `SKILL.md` compared with the help, with its examples run. The tests of the command line use a temporary `HEIDRUN_CODE_DIR` and a temporary project and sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file.
- `pnpm --filter change_log_generator test` runs the Vitest tests of the package `packages/dev_tools/change_log_generator`: the range of the pull requests, the heading, the place of a section in the file, and the command line. The test files sit in the folder `tests`. These tests are slow tests, because each test starts a new process, and the developer rarely changes this package. `pnpm test:slow` runs them, and `pnpm test` does not.
- `pnpm --filter worktree_tools test` runs the Vitest tests of the package `packages/dev_tools/worktree_tools`: the creation of a worktree with the clone of the compiled Rust files, the cleaning of the old target folders, and the two command lines. The test files sit in the folder `tests`.
- `pnpm --filter video_recorder test` runs the Vitest tests of the package `packages/dev_tools/video_recorder`: the calculation of the cut and of `clicks.json`, the command line `video:cut` with a real `ffmpeg`, and the click logger script. The test files sit in the folder `tests`.
- `pnpm --filter install_script_tests test` runs the Vitest tests of the package `packages/dev_tools/install_script_tests`: the script `scripts/install.sh`, run with a fake `curl`, a fake `hdiutil`, a fake `ditto`, a fake `uname`, and a fake `pgrep`, in a temporary folder in place of `/Applications`. It checks the copy, the eject, the deletion of the temporary folder, and the message of each stop. The test files sit in the folder `tests`.
- `pnpm --filter agents_rules_checker test` runs the Vitest tests of the package `packages/dev_tools/agents_rules_checker`: the maximum size of a file in the folder `docs/agents_rules` and in all its subfolders, as the section "Docs folder agents rules system values" gives it, and the skill `issue_fix_workflow` (it names no detail of this repository, it names every value, it has the four parts, its link in the folder `.claude/skills` works, and the section "Issue Fix Workflow values" of this file gives every value), the skill `context_md_system` (it names no detail of this repository, it has its rules and its template, this file points to it, and its link in the folder `.claude/skills` works), and the skills `docs_folder_system` and `docs_folder_agents_rules_system` (each names no detail of this repository, names every value, has its rules and its template, this file points to it and gives every value, and its link in the folder `.claude/skills` works, and the second skill names the first skill). The test files sit in the folder `tests`.
- `pnpm --filter data_layer_boundary_checker test` runs the Vitest tests of the package `packages/dev_tools/data_layer_boundary_checker`: the check that the Past chats sidebar section and the Statistics window get all their data through the packages of the folder `packages/data_layers` (the Rust files of the folders `past_chats` and `statistics` of the desktop application, the files outside these folders that name a package of the data layer, the manifest `Cargo.toml`, and the web page files of the two parts), run on the real repository, and the bypass tests that add each kind of forbidden code to a copy of the files and prove that the check fails. The test files sit in the folder `tests`.
- `pnpm --filter multi_layer_graph test` runs the Vitest tests of the package `packages/experiments/multi_layer_graph`: the reading of a temporary SQLite file with the tables of the data layer packages, the finding of `#N` and `Fixes #N` in a text, the building of the multi-layer graph, the command line, and the degree, the neighbors, the search, and the markup of the panels of the page. The test files sit in the folder `tests`.
- `pnpm --filter parallax_dino_runner test` runs the Vitest tests of the package `packages/experiments/parallax_dino_runner`: the lane change and the jump of the dinosaur, the touch between the dinosaur and the things, the shots and the size change of the rocks, the ammunition and the crates, the size and the lane of the thing of each commit, the generator of the commits and the crates, the end of a run at the newest commit, the file `commits.json` and the fake commits, the script that reads the Git history of a real Git repository in a temporary folder and gives the lanes, the static build with relative addresses and no network address, the speed and the score, the parallax layers, the random numbers with a seed, the world of the game with its commands and its runs, and the shape of the pixel pictures. The test files sit in the folder `tests`.
- `pnpm --filter promotional_videos test` runs the Vitest tests of the package `packages/experiments/promotional_videos`: the scenario "the dinosaur hits a boulder" played with the rules of the game on a fixture of 40 commits, the keys of the commands, and the filter graph of `ffmpeg` (the comic words, the crossfade of the intro, the delay of the recorded sound, the fade-out of the intro music, the end of the outro music at its last silence, and the fade to the outro). The tests also read the reports of `ffmpeg` that find the last silence of a music file, and they compare the document `data/scenarios/video_game_first.scenario.md` with the scenario of the code. The tests start no browser. The test files sit in the folder `tests`.
- `pnpm --filter localai_decisions_candle test` runs `cargo test --release` for the package `packages/experiments/localai_decisions_candle`: the token identifiers, the logits, the probabilities, and the chosen labels of the real model GLiNER2.5-Decide compared with the results of the Python package gliner2 on 33 examples (the 21 examples of the model card and 12 edge cases, such as a long text, French, Chinese, and Hindi), the splitting of words compared with the Python word splitter on 19 texts, the choice of labels from logits (one label, several labels, the threshold, and `top_k`), the refusal of models with another architecture or another encoder, the limit of 512 tokens, the command line tool (a text from the arguments, from a file, and from standard input, a file of tasks, and the errors), and the refusal of a backend that the build does not include. The tests need the model `fastino/GLiNER2.5-Decide` in the Hugging Face cache, and the first run downloads it (1.9 GB). The Python results are saved in `tests/fixtures`, and the script in `python_reference` writes them again. The Rust tests sit in a `#[cfg(test)]` module at the end of each source file, and the other tests sit in the folder `tests`. The command `pnpm test` at the root does not run these tests, because they need the model of 1.9 GB. The benchmark tests check the fixed decision count, average time and throughput, error propagation, the built-in cases, and the benchmark command options.
- `pnpm --filter localai_decisions_llamacpp test` runs `cargo test --release` for the package `packages/experiments/localai_decisions_llamacpp`: the answers and the number of prompt tokens of the real model Kev-0.8B compared with the answers of the server of llama.cpp v0.6.0 on 8 requests (the example of the server README, an object state, special tokens in the text, 10 levels, French, chat messages, a long state, and 12 options), the errors of a request with the messages of the server, the batch size, the refused GPU of a processor build, the model names, the command line tool (the short form, a request from a file and from standard input, and the errors), the escape of the special tokens, the text of a JSON value for Kev, the sorted keys, the confidence formulas, and the filter `tojson` with the floats of llama.cpp. The tests need the model `ggml-org/Kev-0.8B-GGUF` (file `Q8_0`) in the Hugging Face cache, and the first run downloads it (0.81 GB). The first build compiles llama.cpp and needs `cmake`. The answers of the server are saved in `tests/fixtures`, and the script in `server_reference` writes them again. The Rust tests sit in a `#[cfg(test)]` module at the end of each source file, and the other tests sit in the folder `tests`. The command `pnpm test` at the root does not run these tests, because they need the model of 0.81 GB. The benchmark tests check the fixed decision count, average time and throughput, error propagation, the built-in cases, and the benchmark command options.
- When you add a feature, add the tests that match the feature in the same change. When you fix a bug, add a test that fails without the fix.
