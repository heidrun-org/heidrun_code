# Heidrun Code Dashboard graph and sidebar

- Created: 30 October 2026
- Last updated: 30 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Heidrun Code Dashboard data and statuses](heidrun_code_dashboard_data_and_statuses.md), [Heidrun Code Dashboard radial graph](heidrun_code_dashboard_radial_graph.md), [Glossary of Heidrun Code: Heidrun Code Dashboard](../../glossary/heidrun_code_dashboard.md), [Shared design rules](../../web_styling/shared_design.md)
- Related issue: [issue 968](https://github.com/heidrun-org/heidrun_code/issues/968), [issue 971](https://github.com/heidrun-org/heidrun_code/issues/971), [issue 972](https://github.com/heidrun-org/heidrun_code/issues/972)

This file gives the rules of the Heidrun Code Dashboard view: the opening, the selection, the right sidebar, the counters, and the filters. The static radial graph follows [heidrun_code_dashboard_radial_graph.md](heidrun_code_dashboard_radial_graph.md). The code is in `packages/apps/web_frontend/src/components/heidrun_code_dashboard`, `packages/apps/web_frontend/src/stores/heidrun_code_dashboard`, and `packages/apps/web_frontend/src/lib/heidrun_code_dashboard/heidrun_code_dashboard_layout.ts`. The data that the view shows follows [heidrun_code_dashboard_data_and_statuses.md](heidrun_code_dashboard_data_and_statuses.md).

## Opening and collection

- The More menu has the item "Dashboard", with the icon `bullseye` and a title, between the items "Agents information" and "Statistics". A click opens the Heidrun Code Dashboard as a modal over the main window and closes the More menu.
- `HeidrunCodeDashboardView.vue` holds the graph and the right sidebar. The modal and the separate Heidrun Code Dashboard window mount the same component, with the width of the sidebar: [heidrun_code_dashboard_display_modes.md](heidrun_code_dashboard_display_modes.md).
- A view calls `heidrun_code_dashboard_subscribe` with its own view identifier when it mounts, listens to the event `heidrun_code_dashboard://observations`, and calls `heidrun_code_dashboard_unsubscribe` when it unmounts. No view open means no collection.
- The model is built again when the Herdr data or the observations change, and every two seconds, so that a silent collector shows stale.
- The Herdr socket comes from `herdr_paths`. The session name is the folder name in `<configuration>/sessions/<name>/herdr.sock`, or unknown for another form of the path.

## Selection

- A click on a node, on its label, or in the sector of a workspace selects it. Heidrun is selected at the start.
- A double click on a workspace, on the label shaped like a tab, or on a coding agent shows it in the main window.
- A white dashed circle around the node shows the selected workspace, coding agent, or subagent, as in the proposal of issue 955. The circle is close to the node: the space between the node and the circle is 6 units for a hexagon, 4.5 units for a coding agent, and 3.5 units for a subagent. The circle turns clockwise, and stops with the other animations. Its dashes move at the same speed on every circle, the speed of the circle of a coding agent (one turn in 8 seconds for a radius of 15.5): a larger circle turns more slowly. When a workspace, or an item inside it, is selected, its sector has a stronger background and a solid border of the color of the status of the workspace: green for Finished, purple for Working, red for Blocked, and gray otherwise.
- Every drawn node takes the keyboard focus with Tab. Left and Right go to the previous and the next sibling, Up goes to the parent in the graph, Down goes to the first child. Enter or Space selects. Escape selects Heidrun again; when Heidrun is already selected, Escape closes the modal.
- The path above the details is `Heidrun › workspace › tab › coding agent › subagent`. Each level is a button that selects it.
- When the selected node disappears, hides under the filter, or becomes stale, the selection moves to its nearest ancestor that shows. A node selected while it is already stale stays selected.

## Right sidebar


- Heidrun: the pending attention first (the requests that the developer must answer, then the others, then the blocked items with no observed request), then the workspaces.
- Workspace or tab: the status, the coverage, the saved workspace folder (never the folder of a pane), the tabs with their coding agents and the nested subagents, the pending attention, and the recent observed messages.
- Coding agent: the status, the notices, the chat link, the task texts labelled "Initial instructions" or "Last prompt" (never "current task"), the pending question or approval, the subagents, a terminal preview, and the observed messages.
- The terminal preview reads the last lines of the pane with the Herdr request `pane.read`, every two seconds. It never attaches to the terminal, never resizes it, and never takes the input focus.
- Subagent: the native status with its source, the visible status, the outcome, the notices, the parent, the initial instructions or "Not available", the pending attention, a preview labelled "Transcript" (never "terminal"), and the observed messages. The transcript of a Claude Code subagent comes from `claude_session_agents`. Codex exposes no transcript of a child chat, and the sidebar says so.
- An unavailable field says that it is unavailable. A Codex message with no text says "Content not exposed by Codex".
- The coverage notices are always visible: no observation yet, stale observations, Claude Code not observed (with the place of the option in Settings), Codex server not available, stale items, unmatched coding agents, chats that no pane claims, and the errors of the sources.
- There is no Approve button. "Open in Heidrun Code" reads the Herdr snapshot again, then selects the exact workspace, tab, and pane in the main window and closes the modal, or shows why nothing opened: [heidrun_code_dashboard_display_modes.md](heidrun_code_dashboard_display_modes.md).

## Counters and filters

- The counters are at the top of the sidebar: one button for each visible status, with the total and the number of coding agents and of subagents, from `model.counters`. The totals never follow the filter.
- A click on a counter filters on its status. The filter shows the matching coding agents and subagents, keeps their non-matching ancestors faint, and hides the other items and the workspaces with nothing that shows.
- A second click on the same counter, or the button "All", clears the filter.

## Tests

- `pnpm --dir packages/apps/web_frontend exec vitest run src/lib/heidrun_code_dashboard/heidrun_code_dashboard_layout.test.ts src/stores/heidrun_code_dashboard src/components/heidrun_code_dashboard src/components/MoreMenu.test.ts` runs the tests of the layout, the store, the selection, the graph, the sidebar, the counters, the modal, and the More menu item.
