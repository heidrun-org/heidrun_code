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
- `MireView.vue` holds the graph and the right sidebar. The modal and the separate Mire window mount the same component, with the width of the sidebar: [mire_display_modes.md](mire_display_modes.md).
- A view calls `mire_subscribe` with its own view identifier when it mounts, listens to the event `mire://observations`, and calls `mire_unsubscribe` when it unmounts. No view open means no collection.
- The model is built again when the Herdr data or the observations change, and every two seconds, so that a silent collector shows stale.
- The Herdr socket comes from `herdr_paths`. The session name is the folder name in `<configuration>/sessions/<name>/herdr.sock`, or unknown for another form of the path.

## Static radial graph

- A sector starts 70 units inside the workspace ring, and an angle of 0.24 radians separates two sectors, as in the proposal of issue 955: a wide empty space stays around Heidrun and between the sectors. The dashed border of a sector that is not selected uses the color `--faint`, so that the dashes stay visible.
- Every sector reaches the same outer radius: the radius that the deepest workspace needs for its coding agents and subagents. When a subagent appears in one workspace, every sector grows with it.
- The graph fills its area: its square view box fits the drawn sectors and the labels of the subagents, with a margin of 24 units, and Heidrun stays at the centre.
- Heidrun is at the centre, with the whole picture `baby_goat.webp`, not cut to a circle. The goat stands on the back edge of a keyboard drawn in perspective, like a keyboard on a table, as in the proposal of issue 955. The lines to the workspaces start at the centre, behind the goat, and are straight. The lines from a workspace to its coding agents, and from a coding agent to its subagents, are curves: each curve leaves the parent along the ring of the parent, towards the angle of the child, and bends to reach the child along the ray of the child. When Heidrun is selected, the white dashed circle is just outside the long marks of the sight ring, 3 units away. The workspace hexagons are on the first ring, one satellite for each coding agent on the second ring, and the subagents on the third ring. A nested subagent is further out, next to its parent.
- The label of a workspace is a box with a dark background and a border of the color of its status. The box sits on the line between Heidrun and the hexagon, at the first third of the line from the hexagon, or nearer to Heidrun when the box would touch the hexagon. The full name always shows: the text gets smaller, from 12 down to 7 units, so that the box fits between Heidrun and the hexagon and in the arc of its sector ([issue 982](https://github.com/heidrun-org/heidrun_code/issues/982)).
- Each workspace has a sector sized by its coding agents and subagents, with a minimum angle so that a small workspace keeps room for its label.
- The coding agents of a workspace follow the order of its tabs, so that the coding agents of one tab sit side by side. The label of a coding agent is shaped like a tab, with the exact tab name and the icon of the coding agent, the same icon as the tabs of Heidrun Code: the icon `claude` of Bootstrap Icons for Claude Code, and the icon `openai` for Codex. Another coding agent gets the first letter of its name.
- `MireLayout.compute` reads only the hierarchy, the identifiers, and the names. The same model gives the same positions, and a status change moves nothing. The filter hides nodes and never moves the others.
- A long label of a coding agent or of a subagent is shortened with an ellipsis, and the full name stays in the title. A crowded sector hides the labels that have no room. The SVG drawing has a view box, so it follows every resize. With no workspace, the view shows a plain text message.
- The colors are `--working`, `--blocked`, `--done`, and `--idle` of `styles.css`. A blocked node and a blocked sector have a red glow. Each node also has a sign (▸ Working, ! Blocked, ✓ Finished, – Idle, ? unknown) and an accessible name with the status in words.
- Unknown has a dashed outline. A stale, unmatched, or not observed coding agent or subagent has a dashed outline and the word under its label.
- The animations, the pause, and the links of the messages follow [mire_animations.md](mire_animations.md).

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
- There is no Approve button. "Open in Heidrun Code" reads the Herdr snapshot again, then selects the exact workspace, tab, and pane in the main window and closes the modal, or shows why nothing opened: [mire_display_modes.md](mire_display_modes.md).

## Counters and filters

- The counters are at the top of the sidebar: one button for each visible status, with the total and the number of coding agents and of subagents, from `model.counters`. The totals never follow the filter.
- A click on a counter filters on its status. The filter shows the matching coding agents and subagents, keeps their non-matching ancestors faint, and hides the other items and the workspaces with nothing that shows.
- A second click on the same counter, or the button "All", clears the filter.

## Tests

- `pnpm --dir packages/apps/web_frontend exec vitest run src/lib/mire/mire_layout.test.ts src/stores/mire src/components/mire src/components/MoreMenu.test.ts` runs the tests of the layout, the store, the selection, the graph, the sidebar, the counters, the modal, and the More menu item.
