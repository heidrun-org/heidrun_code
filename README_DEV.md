# Heidrun Code: guide for developers

This document is for the developers who work on Heidrun Code. It explains four tasks: how to build the application, how to launch the application during development, how to test the application, and how to release the application. The file `README.md` describes the application itself, and the file `AGENTS.md` gives the rules for changes to this repository.

All commands run in the root folder of the repository, on macOS.

## Build the application

You need [Herdr](https://herdr.dev) 0.9 or later, Rust stable, Node.js 20 or later, [pnpm](https://pnpm.io), and [CMake](https://cmake.org) (`brew install cmake`). The package `voice_input` needs CMake to build the C++ engine whisper.cpp.

Install the dependencies once, then build:

```bash
pnpm install
pnpm build
```

The command `pnpm build` builds the web frontend, then the Rust backend, then packages both into the application. The result is in `packages/apps/desktop_tauri/target/release/bundle/`:

- `macos/Heidrun Code.app` is the application. Drag it into `/Applications`.
- `dmg/Heidrun_<version>_<architecture>.dmg` is the disk image.

To build only the web frontend, run `pnpm build:web`.

## Install the current development version

Quit Heidrun Code, then build the application from the current source:

```bash
pnpm build
```

Open the folder containing the built application:

```bash
open packages/apps/desktop_tauri/target/release/bundle/macos
```

Drag `Heidrun Code.app` into `/Applications` and choose "Replace" when Finder asks. Then open Heidrun Code from `/Applications`.

## Launch the application during development

```bash
pnpm dev
```

The command starts the web frontend with its development server on `http://localhost:1420`, then opens the application window. When you change a file of the web frontend, the window updates without a restart. When you change a Rust file, the command rebuilds the backend and restarts the window.

To use the installed Heidrun Code for your daily work while you develop Heidrun Code, read [application_installations.md](docs/architecture/application_installations.md). It explains Heidrun Code Development, the separate application that `pnpm dev` starts, the resources that the two applications keep apart, and the commands to use both at the same time.

To work on the web frontend alone, in a browser, run `pnpm dev:web`. Without the application window, the functions of the Rust backend are not available.

To work on the mobile website alone, with no application window and no real computer behind it, run `pnpm --filter mobile_website dev`. The command starts a development server on `http://127.0.0.1:5183`, prints an address with a pairing key, and answers the calls of the page with four made-up coding agents. When you change a file of `packages/auxiliary/mobile_website/src`, the page reloads by itself and stays on the same screen, because the address names the screen. To use the real coding agents instead, start Heidrun Code once with `pnpm dev -- -- --no-splash-screen`, turn the mobile access on, copy the host name of the address that the section shows (for example `words-of-the-tunnel.ngrok-free.dev`), then run `MOBILE_API_TARGET=http://127.0.0.1:47823 MOBILE_API_HOST=<that host name> pnpm --filter mobile_website dev`. The host name changes each time that Heidrun Code opens the tunnel. The page then reloads when you change a file of the website, and you start Heidrun Code again only when the calls between the page and the application change. The development server sends no `Content-Security-Policy` header, so check the strict policy with the mobile server before you finish.

To set an environment variable of the application during development, for example `HEIDRUN_CODE_DIR`, copy the file `.env.example` to a file named `.env` at the root of the repository, and remove the `#` at the start of the line of the variable. The file `.env.example` explains every variable that the application reads. Git ignores the file `.env`. Only a development build reads it, once at the start, so run `pnpm dev` again after a change. A variable that is already set in your shell keeps the value of the shell.

```bash
cp .env.example .env
```

## Test the application

```bash
pnpm test
```

The command runs the fast tests, and ends with a non-zero exit code when a test fails. The command `pnpm test:slow` runs the slow tests (the real Whisper model of `voice_input`, and `change_log_generator`). The command `pnpm test:full` runs the fast tests, then the slow tests, and the release steps use it. To run the tests of one package:

| Command | Tests |
| --- | --- |
| `pnpm --filter web_frontend test` | The Vitest tests of `packages/apps/web_frontend`. The test files sit next to the code, and are named `*.test.ts`. |
| `pnpm --filter desktop_tauri test` | Builds `mobile_website`, then runs the `cargo test` tests of `packages/apps/desktop_tauri`. The tests sit in a `#[cfg(test)]` module at the end of each source file. |
| `pnpm --filter website_public test` | The Vitest tests of `packages/auxiliary/website_public`: the configuration, the pages, and a complete build of the website. The test files sit in the folder `tests`. |
| `pnpm --filter coding_agent_cli test` | The Rust tests (`cargo test`) of `packages/auxiliary/coding_agent_cli`, with fake `claude` and `codex` commands. The tests of the command line sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file. |
| `pnpm --filter mobile_website test` | The Vitest tests of `packages/auxiliary/mobile_website`: the three screens, the bottom bar, the confirmation sheet, the pairing key, the address of each screen, the colors of the output, and the rules of a page under a strict content security policy. The tests start the whole page against a fake computer, and one test starts the development server. The test files sit in the folder `tests`. |
| `pnpm --filter mobile_server test` | Builds `mobile_website`, then runs the Rust tests (`cargo test`) of `packages/auxiliary/mobile_server`: the checks of a request, the closed list of methods, the routes with a fake handler, the files of the mobile website with their types, the file `mobile.json`, the finding of the program `ngrok`, the reading of the address of the tunnel, the host name check, and the life of the server on the loopback address, with a fake `ngrok` program. The Rust tests sit in a `#[cfg(test)]` module at the end of each source file. One more test opens a real tunnel on the Internet, so it runs only by hand: `cd packages/auxiliary/mobile_server && cargo test live_ -- --ignored --nocapture`. |
| `pnpm --filter voice_input test:fast` | The fast Rust tests (`cargo test --lib`) of `packages/auxiliary/voice_input`: the conversion of the audio, the 12 Whisper models, the download with a fake server, and the text of Whisper. |
| `pnpm --filter voice_input test:slow` | The slow Rust tests of `packages/auxiliary/voice_input`: a spoken sentence changed into text with the real model `tiny`, which the first run downloads once. `pnpm --filter voice_input test` runs both. |
| `pnpm --filter data_layer_code_hosting test` | The Rust tests (`cargo test`) of `packages/data_layers/data_layer_code_hosting`: the two JSON schemas, the SQLite file, the reading of the pages of GitHub with a fake GitHub, the modes initialize and update, and the read-only query. The tests of the command line use a fake `gh` command and sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file. |
| `pnpm --filter data_layer_source_control test` | The Rust tests (`cargo test`) of `packages/data_layers/data_layer_source_control`: the JSON schema, the SQLite file, the reading of the commits of a real Git repository, the modes initialize and update, and the read-only query. The tests of the command line use a real Git repository in a temporary folder and sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file. |
| `pnpm --filter data_layer_user_activity test` | The Rust tests (`cargo test`) of `packages/data_layers/data_layer_user_activity`: the JSON schema, the SQLite file, the reading of the file of user activity records, the modes initialize and update, and the read-only query. The tests of the command line use a fake file of user activity records in a temporary folder and sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file. |
| `pnpm --filter data_layer_coding_agents test` | The Rust tests (`cargo test`) of `packages/data_layers/data_layer_coding_agents`: the reading of the chat session files of Claude Code and of Codex, the cache of the scans, the JSON schema, the SQLite file with its link tables, the modes initialize and update, and the read-only query. The tests of the command line use fake folders of the two coding agents and sit in the folder `tests`, and the other Rust tests sit in a `#[cfg(test)]` module at the end of each source file. |
| `pnpm --filter change_log_generator test` | The Vitest tests of `packages/dev_tools/change_log_generator`, the generator of the change log. The test files sit in the folder `tests`. These are slow tests: `pnpm test:slow` runs them. |
| `pnpm --filter install_script_tests test` | The Vitest tests of `packages/dev_tools/install_script_tests`, the tests of the script `scripts/install.sh`. They run the script with a fake `curl`, a fake `hdiutil`, a fake `ditto`, a fake `uname`, and a fake `pgrep`, and install in a temporary folder in place of `/Applications`. The test files sit in the folder `tests`. |
| `pnpm --filter worktree_tools test` | The Vitest tests of `packages/dev_tools/worktree_tools`, the tools that create a worktree and clean the old target folders. The test files sit in the folder `tests`. |

When you add a feature, add the matching tests in the same change. When you fix a bug, add a test that fails without the fix.

## Release the application

```bash
pnpm release:dmg
```

The command builds the disk image for macOS and uploads it to the GitHub release of the version in the root `package.json`. The release is named `v<version>`, for example `v0.2.0`. You need the GitHub command line tool `gh`, signed in to an account that can create releases.

Before you run the command:

1. Set the new version in the root `package.json`, in `packages/apps/desktop_tauri/package.json`, in `packages/apps/desktop_tauri/tauri.conf.json`, and in `packages/apps/desktop_tauri/Cargo.toml`.
2. Commit all your changes and push them. The command stops with the command to run when the repository is not in sync with GitHub, because GitHub cannot tag a commit that it does not have.

The text of the release is, in this order:

1. The file `docs/release_notes/prefix.md`. It is the same for every release.
2. The file of the option `--notes-file`, if you give one.
3. The list of changes that GitHub generates from the pull requests.

Options:

| Option | Effect |
| --- | --- |
| `--notes-file <path>` | Adds the text of the Markdown file after the prefix, for example `docs/release_notes/v0.2.0.md`. |
| `--recreate` | Deletes the existing release and its tag, then creates them again on the current commit. The release gets a new date. |
| `--help` | Shows the description of the command and its options. |

When the release already exists and you do not use `--recreate`, the command replaces the disk image and rewrites the text of the release. The release keeps its first date.

The command uploads the disk image twice: once with the version in its name, for example `Heidrun_0.2.7_aarch64.dmg`, and once with a name that never changes, `Heidrun_aarch64.dmg`. The second copy gives the web address of the latest disk image, `https://github.com/heidrun-org/heidrun_code/releases/latest/download/Heidrun_aarch64.dmg`, which the script `scripts/install.sh` uses. The command stops when the build does not give a disk image for Apple silicon (a file that ends with `_aarch64.dmg`).

The disk image is built for the architecture of your machine only, and it is not signed and not notarized.

When someone downloads the disk image with a web browser, the web browser puts a quarantine mark on the file. Then macOS shows the message "“Heidrun Code” is damaged and can't be opened" when that person opens Heidrun Code for the first time. Heidrun Code is not damaged. macOS shows this message because Apple did not notarize the application. To open Heidrun Code, drag Heidrun Code to the Applications folder, run this command in a terminal, then open Heidrun Code again:

```bash
xattr -dr com.apple.quarantine "/Applications/Heidrun Code.app"
```

The text of a GitHub release does not mention this message, because the command `curl` of the next section does not put the quarantine mark.

## Install the application with one command

```bash
curl -fsSL https://raw.githubusercontent.com/heidrun-org/heidrun_code/main/scripts/install.sh | sh
```

The script [`scripts/install.sh`](scripts/install.sh) installs the latest release in `/Applications`. A web browser puts the quarantine mark `com.apple.quarantine` on a file that it downloads, and macOS checks the signature of an application only when the application has this mark, so it shows the message "damaged" for Heidrun Code. The command `curl` does not put the mark, so the application opens with no message. The script does these steps, in this order:

1. It stops with a message when the computer is not macOS, when the processor is not Apple silicon, when `/Applications/Heidrun Code.app` is running, or when the user cannot write in `/Applications`.
2. It downloads `Heidrun_aarch64.dmg` of the latest release into a temporary folder, with `curl -fL`.
3. It mounts the disk image with `hdiutil attach -nobrowse -readonly -mountpoint`.
4. It replaces `/Applications/Heidrun Code.app` with the copy from the disk image, with `ditto`.
5. It ejects the disk image and deletes the temporary folder, also when a step fails.
6. It prints the installed version, read from `Contents/Info.plist` of the application.

The environment variable `HEIDRUN_CODE_APPLICATIONS_FOLDER` changes the folder that receives `Heidrun Code.app`. The tests use it, and a developer can use it to try the script with no change to `/Applications`. The tests of the script are the package [`packages/dev_tools/install_script_tests`](packages/dev_tools/install_script_tests). The script cannot work for a release that has no file `Heidrun_aarch64.dmg`: v0.2.7 and the releases before it do not have it.

## Work in a Git worktree

A Git worktree is a second folder of the same repository, on its own branch. Each worktree has its own Cargo target folder, and a new target folder is empty. The first build in a new worktree compiles every Rust dependency again: it takes 52 to 65 seconds and about 2.5 GB of disk space. The commands below remove most of this cost.

```bash
pnpm worktree:create <name>
```

The command creates the worktree `.claude/worktrees/<name>` on a new branch with the same name. On macOS, it then clones the folder `packages/apps/desktop_tauri/target/debug` of the main checkout into the worktree, with a copy-on-write clone. The clone takes about 10 seconds and 14 MB of disk space. The first build in the worktree then takes 23 to 32 seconds and about 883 MB of disk space. At the end, the command runs `pnpm install --frozen-lockfile` in the worktree, so the worktree has a `node_modules` folder and `pnpm dev` runs at once. The command is the package [`packages/dev_tools/worktree_tools`](packages/dev_tools/worktree_tools).

- Build the main checkout before you create a worktree. When the main checkout has no folder `target/debug`, the command creates the worktree without the clone and says so.
- The clone needs macOS and the Apple File System. The worktree is inside the main checkout, so both folders are on the same disk.
- The clone shares its files with the main checkout only at the start. Each file that Cargo rewrites becomes a real copy.
- The installation reads `pnpm-lock.yaml` and never changes it. When the installation fails, the command prints the error of `pnpm` and exits with the code 1. The worktree stays, so fix the cause and run `pnpm install --frozen-lockfile` in the worktree.
- To start the new branch from a commit other than the current commit of the main checkout, add the option `--base <ref>`.

```bash
pnpm --filter desktop_tauri target:clean
```

The command lists the target folders of the worktrees that no build has used for 7 days. It deletes nothing. To delete them, add the option `--yes`. To change the number of days, add the option `--days <number>`. The command never touches the main checkout. It does not show the size of the folders, because the clones share their disk blocks, so the command `du` shows a size that is too high.

## Generate the change log

```bash
pnpm release:change_log
```

The command writes a section of the file `CHANGELOG.md` in the root of the repository, in the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format, from the pull requests that were merged between two releases. If the file does not exist, the command creates it with the header of the format. The command also prints the new section on the standard output. The command is the package [`packages/dev_tools/change_log_generator`](packages/dev_tools/change_log_generator).

Without option, the section is `Unreleased`: from the last release to the current commit. The last release is the Git tag with the highest version number, for example `v0.2.0`. A pull request is a commit whose first line starts with `Merge pull request #`.

To choose another range, use the options `--from` and `--to`:

| Command | Range | Heading of the section |
| --- | --- | --- |
| `pnpm release:change_log` | last release → now | `## [Unreleased]` |
| `pnpm release:change_log --from v0.2.0` | `v0.2.0` → now | `## [Unreleased]` |
| `pnpm release:change_log --to v0.2.0` | the release before `v0.2.0`, or the start → `v0.2.0` | `## [0.2.0] - <date>` |
| `pnpm release:change_log --from start --to v0.2.0` | the start of the history → `v0.2.0` | `## [0.2.0] - <date>` |
| `pnpm release:change_log --from v0.2.0 --to v0.3.0` | `v0.2.0` → `v0.3.0` | `## [0.3.0] - <date>` |

The date of a release is the date of the commit of its tag. The sections of the file are in this order: `Unreleased` first, then the releases from the highest version to the lowest. The command puts the new section at its place. If the file already has a section with the same version, the command replaces it, so you can run the command again. When the new section is a release and this release is the last release, the command also removes the section `Unreleased`, because its pull requests now belong to this release. The other sections never change.

Without `--ai`, the section is a plain list of the merged pull requests, with the title and the link of each one. The command does not choose a category.

Options:

| Option | Effect |
| --- | --- |
| `--from <tag>` | The release after which the changes start. `start` means the start of the history. The default is the release before `--to`, or the start if there is none. |
| `--to <tag>` | The release where the changes end. `now` means the current commit. The default is `now`. |
| `--ai` | A coding agent writes the section, with the categories `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Security`. The command sends the messages of the merged pull requests to the executable of the package [`coding_agent_cli`](packages/auxiliary/coding_agent_cli), which `cargo run` builds when needed. You need `codex`, `claude`, or `agy` installed and signed in, and the Rust tools. |
| `--agent <name>` | The coding agent for the option `--ai`: `codex` (the default), `claude`, or `agy`. |
| `--help` | Shows the description of the command and its options. |

The command exits with code 1 and prints an error message when a tag does not exist.

Read the new section before you commit it: a coding agent can make a mistake.
