# Mire graph and sidebar

- Created: 30 October 2026
- Last updated: 30 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Mire data and statuses](mire_data_and_statuses.md), [Glossary of Heidrun Code: Mire](../../glossary/mire.md), [Shared design rules](../../web_styling/shared_design.md)
- Related issue: [issue 968](https://github.com/heidrun-org/heidrun_code/issues/968), [issue 971](https://github.com/heidrun-org/heidrun_code/issues/971), [issue 972](https://github.com/heidrun-org/heidrun_code/issues/972)

This file gives the rules of the Mire view: the opening, the static radial graph, the selection, the right sidebar, the counters, and the filters. The code is in `packages/apps/web_frontend/src/components/mire`, `packages/apps/web_frontend/src/stores/mire`, and `packages/apps/web_frontend/src/lib/mire/mire_layout.ts`. The data that the view shows follows [mire_data_and_statuses.md](mire_data_and_statuses.md).

## Opening and collection

- The More menu has the item "Mire", with the icon `bullseye` and a title, between the items "Agents information" and "Statistics". A click opens the Mire as a modal over the main window and closes the More menu.
- `MireView.vue` holds the graph and the right sidebar. The modal wraps it, so that a separate window can mount the same component.
- A view calls `mire_subscribe` with its own view identifier when it mounts, listens to the event `mire://observations`, and calls `mire_unsubscribe` when it unmounts. No view open means no collection.
- The model is built again when the Herdr data or the observations change, and every two seconds, so that a silent collector shows stale.
- The Herdr socket comes from `herdr_paths`. The session name is the folder name in `<configuration>/sessions/<name>/herdr.sock`, or unknown for another form of the path.

## Static radial graph

- Heidrun is at the centre, with the picture `baby_goat.webp`. The workspace hexagons are on the first ring, one satellite for each coding agent on the second ring, and the subagents on the third ring. A nested subagent is further out, next to its parent.
- Each workspace has a sector sized by its coding agents and subagents, with a minimum angle so that a small workspace keeps room for its label.
- The coding agents of a workspace follow the order of its tabs, so that the coding agents of one tab sit side by side. The label of a coding agent is shaped like a tab, with the exact tab name and the badge C (Claude Code) or X (Codex).
- `MireLayout.compute` reads only the hierarchy, the identifiers, and the names. The same model gives the same positions, and a status change moves nothing. The filter hides nodes and never moves the others.
- A long label is shortened with an ellipsis, and the full name stays in the title. A crowded sector hides the labels that have no room. The SVG drawing has a view box, so it follows every resize. With no workspace, the view shows a plain text message.
- The colors are `--working`, `--blocked`, `--done`, and `--idle` of `styles.css`. A blocked node and a blocked sector have a red glow. Each node also has a sign (▸ Working, ! Blocked, ✓ Finished, – Idle, ? unknown) and an accessible name with the status in words.
- Unknown has a dashed outline. A stale, unmatched, or not observed coding agent or subagent has a dashed outline and the word under its label.
- The graph has no animation in this stage.

## Selection

- A click on a node, on its label, or in the sector of a workspace selects it. Heidrun is selected at the start.
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
- There is no Approve button. "Open in Heidrun Code" selects the exact workspace, tab, and pane in the main window and closes the modal.

## Counters and filters

- The counters are at the top of the sidebar: one button for each visible status, with the total and the number of coding agents and of subagents, from `model.counters`. The totals never follow the filter.
- A click on a counter filters on its status. The filter shows the matching coding agents and subagents, keeps their non-matching ancestors faint, and hides the other items and the workspaces with nothing that shows.
- A second click on the same counter, or the button "All", clears the filter.

## Tests

- `pnpm --dir packages/apps/web_frontend exec vitest run src/lib/mire/mire_layout.test.ts src/stores/mire src/components/mire src/components/MoreMenu.test.ts` runs the tests of the layout, the store, the selection, the graph, the sidebar, the counters, the modal, and the More menu item.
