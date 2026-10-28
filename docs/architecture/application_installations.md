# Installed Heidrun Code and Heidrun Code Development

- Created: 17 October 2026
- Last updated: 26 October 2026
- Status: Maintained installation and development guide
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Window startup](../agents_rules/user_interface/window/window_state_and_start.md), [Data layer access](../agents_rules/data_layer_access.md)
- Related issue: [issue 640](https://github.com/heidrun-org/heidrun/issues/640), [issue 772](https://github.com/heidrun-org/heidrun/issues/772)

Use installed Heidrun Code for daily work, and Heidrun Code Development to test source changes. The applications can open the same repository. A development reload or restart affects Heidrun Code Development only.

| Resource | Heidrun Code | Heidrun Code Development |
| --- | --- | --- |
| Application identifier | `dev.heidrun-org.heidrun-code` | `dev.heidrun-org.heidrun-code.development` |
| Application name | Heidrun Code | Heidrun Code Development |
| Default application data | `~/.config/heidrun_code` | `~/.config/heidrun_code_development` |
| Default Herdr session in the main checkout | `heidrun` | `heidrun_development` |
| Herdr session from a temporary worktree | `heidrun` | `heidrun_` followed by the existing cleaned worktree name |
| Settings and saved window position | Installed application storage | Separate development application storage |
| Copy of the saved options (`local_storage.json`) | `~/.config/heidrun_code` | `~/.config/heidrun_code_development` |
| New mobile access configuration | Off, default port 47823 | Off, default port 47824 |
| Source changes | Applied through an explicit build and installation | Frontend reload or application restart |

The data folder contains personal macros, history, user activity, caches, the translation table of dynamic topics, the database of the four data layers, the application log, and mobile configuration and pairing records. Existing installed data stays at the existing location. Development does not copy, move, or migrate installed data.

## Run both applications

Open installed Heidrun Code from Applications. In the source checkout or temporary worktree, run:

```sh
pnpm dev -- -- --no-splash-screen
```

The command builds the mobile website first, then starts the real development application and the frontend server on port 1640. The separate port avoids using an existing frontend server on the original port 1420. This command supports one development application at a time; several simultaneous development frontend servers are outside this change.

The development window title, application name, status item tooltip, and first status item menu entry identify Heidrun Code Development. Startup prints the effective application identifier, data folder, Herdr session, and socket to the terminal.

## Build the applications

```sh
pnpm build:development
```

This builds `packages/apps/desktop_tauri/target/release/bundle/macos/Heidrun Code Development.app`. The application uses embedded frontend files and needs no development server. The development identity is selected from the compiled application identifier, so Rust release optimisation does not select installed resources. Copy this application beside Heidrun Code if a standalone development installation is useful.

```sh
pnpm build
```

This retains the installed Heidrun Code identity and builds the normal application and disk image. The existing installer still installs `Heidrun Code.app` and does not replace `Heidrun Code Development.app`. Building alone does not replace the application in Applications.

## Deliberate overrides and command line tools

Heidrun Code Development ignores inherited `HEIDRUN_CODE_DIR`, `HERDR_SESSION`, `HERDR_SOCKET_PATH`, and Herdr pane context. A development command commonly starts inside a daily-work pane, so those inherited values must not choose daily-work resources.

To choose a development test folder or an externally managed development session, use:

```sh
HEIDRUN_CODE_DEVELOPMENT_DIR=/absolute/path/to/test-data pnpm dev
HEIDRUN_CODE_DEVELOPMENT_SESSION=heidrun_development_test pnpm dev
```

A development data folder must be absolute and must differ from the installed default folder, including an existing symbolic link to the installed folder. Choose a folder that is also separate from any custom installed data folder. A custom session must use at most 40 letters, digits, hyphens or underscores, and cannot be `heidrun` or `default`. An explicitly selected session stays running when the application quits, as existing externally selected sessions do.

The development application reads a developer's `.env`, including in an optimised development bundle; installed Heidrun Code does not read `.env`. The dedicated development overrides can be set in `.env`. An inherited daily-work variable in `.env` is ignored in development.

The command line tools use `HEIDRUN_CODE_DIR` to select the intended application data. They do not infer an application from the current checkout:

```sh
# Installed data with the default locations
pnpm --silent heidrun_code_ctrl macros list
pnpm --silent data_layer:heidrun_data sources

# Development data with the default locations
HEIDRUN_CODE_DIR="$HOME/.config/heidrun_code_development" pnpm --silent heidrun_code_ctrl macros list
HEIDRUN_CODE_DIR="$HOME/.config/heidrun_code_development" pnpm --silent data_layer:heidrun_data sources
```

For a custom development folder, give the same absolute folder to `HEIDRUN_CODE_DIR` when running a command line tool. The four data layer database defaults also follow this folder. An explicit `--database` still selects another database.

## Shared resources and mobile access

Repository files, project macros, installed coding agent programs, coding agent accounts, and external coding agent configuration remain shared. Development can use the existing Claude Code status-line integration, but development startup does not migrate, refresh, install, hide, or uninstall the globally installed integration. Change the shared status-line integration in installed Heidrun Code.

Mobile access starts off in a new development data folder and creates a separate pairing key when enabled. Saved ports take precedence over the new-configuration defaults. Separate local ports do not give an ngrok account a second public address: an account with one fixed address may reject a second tunnel. Development does not stop another application's ngrok process through the "Stop the old ngrok" action. No live simultaneous public-tunnel test is claimed for this change.

## Validation

The initial feasibility test used installed Heidrun Code, the real Tauri development application, installed Herdr 0.9.3, an idle Codex process in the installed pane, and a continuously printing shell in the development pane. A temporary macOS application wrapper allowed normal Quit to be exercised. The test used explicitly named test sessions rather than existing daily-work sessions.

Representative raw output after the frontend reload, Rust restart, and development Quit:

```text
[vite] page reload index.html
Info File src/main.rs changed. Rebuilding application...
Finished `dev` profile [unoptimized + debuginfo] target(s)
Running `target/debug/heidrun --no-splash-screen`
installed pane: agent=codex agent_status=idle terminal_id=term_65e096c6bc0c01
installed Heidrun Code process: 96347
installed Codex process: 2926
installed socket: sessions/heidrun_640_installed/herdr.sock
development socket: sessions/heidrun_640_development/herdr.sock
```

This proves concurrent desktop use with an idle coding agent and active development terminal for that run. Automated tests cover development identity, safe data paths, inherited environment values, separate session selection, and agreement between all four database paths. Developer review should also exercise a working coding agent, changes to settings and personal macros, and quitting each application with both values of "Keep agents running after quit".

The final optimised standalone bundle also reported Heidrun Code Development, `~/.config/heidrun_code_development`, and `heidrun_codex_separate-development-640` while installed-session variables were inherited. With "Keep agents running after quit" on, the development test terminal continued printing after normal Quit. After restarting the application and turning the setting off, normal Quit removed only the development socket; the installed Codex process and terminal identifier stayed unchanged. The two saved window-state files were in separate application-identifier folders.

The final desktop suite passed 318 tests, with six intentionally skipped tests. The affected data layer, `heidrun_code_data`, macro, and mobile server suites passed, as did the data-access boundary checker and the agent-rules size checker. The live coding agent remained idle during these tests; a working coding agent and simultaneous public tunnels remain for developer review.
