# User interface of Heidrun Code: workspace, tab, and pane command integration

- Created: 20 October 2026
- Last updated: 31 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Workspace](workspace.md), [Glossary of Heidrun Code](../../glossary/workspaces_tabs_and_panes.md)
- Related issue: [issue 657](https://github.com/heidrun-org/heidrun/issues/657), [issue 999](https://github.com/heidrun-org/heidrun_code/issues/999)

This file describes how the workspace, tab, and pane commands of `heidrun_code_ctrl` reach the running Heidrun Code window through Herdr.

- `heidrun_code_ctrl workspaces` has list, open, rename, focus, and close. The commands talk to Herdr through its executable; no command talks directly to Heidrun Code or starts a server.
- `open` supplies the fixed creation folder in the Herdr token `heidrun_workspace_folder`. Heidrun Code saves that folder once and never changes a saved folder when this token changes. A snapshot removes saved folder records for closed workspaces, including a close through the command line, so a reused workspace identifier cannot inherit an old folder.
- The wire event `workspace_focused` selects the requested workspace. Herdr names its subscription `workspace.focused`.
- `open` and `focus` publish a distinct `heidrun_focus_request` token. The wire event `workspace_metadata_updated` selects the workspace only for a new request value. Repeated metadata and ordinary refreshes preserve the developer's selection.
- On startup Heidrun Code restores the saved workspace selection; old focus request tokens do not override that selection.
- `heidrun_code_ctrl tabs` has list, create, rename, focus, and close, and `heidrun_code_ctrl panes` has list, split, rename, focus, close, send-text, send-keys, wait-output, and read. They choose the session like the workspace commands. `panes focus` sends the socket request `pane.focus`, because `herdr pane focus` only moves to a neighbor pane. `tabs close` and `panes close` refuse a coding agent without `--force`, like `workspaces close`.
- `tabs create`, `tabs focus`, `panes split`, and `panes focus` publish a new `heidrun_focus_request` whose value ends with `;pane=<pane id>`. The window then selects the workspace, the tab of the pane, and the pane, as a click on the pane does. Herdr keeps each token until a new value replaces it, so the pane is part of the same value: a later request of the workspace alone never selects an old pane. The `workspace_focused` event that Herdr sends after such a request keeps the requested pane ([issue 999](https://github.com/heidrun-org/heidrun_code/issues/999)).

## Refresh

- **No timer reads the snapshot of Herdr** (the workspaces, the tabs, the panes, and the statuses of the agents). The store `session.ts` reads it once at the start, after each event that Herdr pushes (`herdr://event`), after each connection (`herdr://connected`), after each loss of events (`herdr://resync`), and after each action of the developer in Heidrun Code. Each read gives the page a new list of workspaces, so everything that watches this list by identity runs again. A timer would do this every few seconds for nothing, and the chart of the Statistics window would blink ([issue 616](https://github.com/heidrun-org/heidrun/issues/616)). A timer is not needed as a safety net: Herdr pushes an event for each change of the snapshot that was measured on 17 October 2026 (the creation, the rename, the move, and the close of a workspace, a tab, or a pane, the statuses of the agents, the tokens, and the folder of a pane), and the read after `herdr://connected` and `herdr://resync` covers a lost event. The rename of a pane is the one change with no event: Heidrun Code reads the snapshot after its own rename, as after every action. The test `session_no_herdr_poll.test.ts` fails when a timer that reads the snapshot comes back. The usage of Codex is the one exception: Codex writes it outside Heidrun Code, no event announces it, so the page reads it every 10 seconds.
