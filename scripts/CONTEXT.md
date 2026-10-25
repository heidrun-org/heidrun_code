# Directory Context: `/scripts`

## Purpose
The scripts that the maintainers run from the root of the repository: the release of the application and the page of shortcuts.

## Key Exports & Entry Points
- `release_dmg.ts`: builds the macOS disk image and uploads it to the GitHub release, twice: with its version in its name, and as `Heidrun_aarch64.dmg`, the file that `install.sh` downloads. Command: `pnpm release:dmg`.
- `shortcuts-readme.mjs`: writes the page of shortcuts of the website. Command: `pnpm docs:shortcuts`.
- `identity-texts.mjs`: writes the title, the motto, and the description of Heidrun Code from `data/identity.json` into `README.md`, and the description into `AGENTS.md` and `docs/release_notes/prefix.md`. Command: `pnpm docs:identity`.
- `install.sh`: installs the latest Heidrun Code in `/Applications`, with no macOS message "damaged", and links its command lines in `~/.local/bin`. The users run it with `curl -fsSL https://raw.githubusercontent.com/heidrun-org/heidrun_code/main/scripts/install.sh | sh`, so this path never changes. Its tests are the package `packages/dev_tools/install_script_tests`.
- `build_command_line_tools.sh`: builds `heidrun_code_ctrl` and `heidrun_data` into the resources of the Heidrun Code application bundle before Tauri packages the app. A release build runs it each time. `pnpm dev` runs it through `pnpm bundled_commands:build`, only when the sources of the two tools changed ([issue #864](https://github.com/heidrun-org/heidrun_code/issues/864)).
- `claude-statusline.sh`: the status line of Claude Code for this repository.
- `antigravity-statusline.sh`: reports Antigravity quota to Herdr and keeps the previous Antigravity status line visible.

## Rules
- A script that needs its own dependencies, tests, or several files is a full npm package in the folder `packages/dev_tools`, not in this folder. See the `CONTEXT.md` of that folder.
- A script reads the repository from the folder where it runs.
- `install.sh` uses only the commands of macOS and `curl`, and runs with `sh`, because the users pipe it to `sh`.
- `install.sh` downloads only the file `Heidrun_aarch64.dmg` of the latest release, and `release_dmg.ts` must upload that file with every release.
- `install.sh` links the bundled command lines without replacing an existing program in `~/.local/bin`.
- `build_command_line_tools.sh` builds with `MACOSX_DEPLOYMENT_TARGET` set to `minimumSystemVersion` of `tauri.conf.json`, the value of the release build of the application, because both builds share `target/release`. It copies a tool into `bundled_commands` only when its content changed, because the build script of the application watches the date of these files ([issue #877](https://github.com/heidrun-org/heidrun_code/issues/877)).

## Background
- `install.sh` comes from [issue #515](https://github.com/heidrun-org/heidrun/issues/515). `curl` puts no quarantine mark on a file, so macOS does not check the signature of the application.
- The change log generator left this folder and went to `packages/auxiliary` in [issue #120](https://github.com/heidrun-org/heidrun/issues/120), and then to `packages/dev_tools` in [issue #226](https://github.com/heidrun-org/heidrun/issues/226). It became a package in [issue #118](https://github.com/heidrun-org/heidrun/issues/118).
