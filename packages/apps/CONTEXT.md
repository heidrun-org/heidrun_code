# Directory Context: `/packages/apps`

## Purpose
The packages that produce the application Heidrun Code. Nothing else lives here.

## Key Exports & Entry Points
- `desktop_tauri/`: the macOS application, the Rust backend and the Tauri shell. See its own README.md.
- `web_frontend/`: the user interface, written with Vue 3 and TypeScript. The window of `desktop_tauri` displays it. See its own README.md.

## Rules
- Desktop colors, button states, and status appearances follow [the shared design rules](../../docs/agents_rules/web_styling/shared_design.md); `web_frontend/src/design` checks application styles in the normal frontend tests.
- Tab, split pane, and workspace creation use `NewPane` from `web_frontend/src/stores/new_pane.ts`; the keyboard shortcuts follow [the tab rules](../../docs/agents_rules/user_interface/workspaces_tabs_and_panes/tabs.md).
- `desktop_tauri/src/application_profile.rs` selects installed or development resources from the compiled application identifier before the application starts workers.
- A package that only supports the application, such as a website or a library for the scripts, goes in `packages/auxiliary`, never here.
- A package that is only a tool for the developers of Heidrun Code goes in `packages/dev_tools`, never here.
- The package `desktop_tauri` builds the package `web_frontend` through the relative path `../web_frontend/dist`, so both packages stay in this folder.

- The desktop application saves fixed workspace folders by Herdr session and workspace identifier; the web frontend reads `workspace_folder` from enriched snapshots and never derives a workspace folder from a pane. For a workspace opened by `heidrun_code_ctrl`, the creation token `heidrun_workspace_folder` supplies the original folder once; later token changes cannot move the saved folder.

- A pane moves when the developer drags its header: `web_frontend/src/stores/pane_move.ts` owns the pointer events and calls `lib/pane_move.ts` for the four drop triangles and the Herdr steps; the rules are in [the pane move rules](../../docs/agents_rules/user_interface/workspaces_tabs_and_panes/pane_move.md).

- The macro menu sets `macroEditor.selectedId` and `macroEditor.isFromProject` before opening the macro editor; a null selection creates a macro. See [the macro rules](../../docs/agents_rules/glossary/macros.md).

- The file listing returns submodule folders separately from files and reads initialized submodules with their own ignore rules; the File explorer follows [the file rules](../../docs/agents_rules/user_interface/sidebars/files.md).

- The web frontend keeps raw Herdr snapshots for lifecycle tracking and applies completion-specific acknowledgements through `FinishedStatus` before publishing the displayed snapshot; pane, tab, workspace, and application indicators read that displayed snapshot.

## Background
- The folder `packages` was split into `apps` and `auxiliary` in [issue #120](https://github.com/heidrun-org/heidrun/issues/120).
