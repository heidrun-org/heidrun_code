# Heidrun Code Dashboard radial graph

- Created: 30 October 2026
- Last updated: 30 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Heidrun Code Dashboard graph and sidebar](heidrun_code_dashboard_graph_and_sidebar.md), [Heidrun Code Dashboard animations](heidrun_code_dashboard_animations.md), [Glossary of Heidrun Code: Heidrun Code Dashboard](../../glossary/heidrun_code_dashboard.md)
- Related issue: [issue 968](https://github.com/heidrun-org/heidrun_code/issues/968), [issue 989](https://github.com/heidrun-org/heidrun_code/issues/989)

This file gives the rules of the static radial graph of the Heidrun Code Dashboard view. The code is in `packages/apps/web_frontend/src/lib/heidrun_code_dashboard/heidrun_code_dashboard_layout.ts` and `packages/apps/web_frontend/src/components/heidrun_code_dashboard`. The opening, the selection, the right sidebar, the counters, and the filters follow [heidrun_code_dashboard_graph_and_sidebar.md](heidrun_code_dashboard_graph_and_sidebar.md).

## Static radial graph

- A sector starts 70 units inside the workspace ring, and an angle of 0.24 radians separates two sectors, as in the proposal of issue 955: a wide empty space stays around Heidrun and between the sectors. The dashed border of a sector that is not selected uses the color `--faint`, so that the dashes stay visible.
- Every sector reaches the same outer radius: the radius that the deepest workspace needs for its coding agents and subagents. When a subagent appears in one workspace, every sector grows with it.
- The graph fills its area: its square view box fits the drawn sectors and the labels of the subagents, with a margin of 24 units, and Heidrun stays at the centre.
- Heidrun is at the centre, with the whole picture `baby_goat.webp`, not cut to a circle. The goat stands on the back edge of a keyboard drawn in perspective, like a keyboard on a table, as in the proposal of issue 955. The lines to the workspaces start at the centre, behind the goat, and are straight. The lines from a workspace to its coding agents, and from a coding agent to its subagents, are curves: each curve leaves the parent along the ring of the parent, towards the angle of the child, and bends to reach the child along the ray of the child. When Heidrun is selected, the white dashed circle is just outside the long marks of the sight ring, 3 units away. The workspace hexagons are on the first ring, one satellite for each coding agent on the second ring, and the subagents on the third ring. A nested subagent is further out, next to its parent.
- The label of a workspace is a box with a dark background and a border of the color of its status. The box sits on the line between Heidrun and the hexagon, at the first third of the line from the hexagon, or nearer to Heidrun when the box would touch the hexagon. The full name always shows: the text gets smaller, from 12 down to 7 units, so that the box fits between Heidrun and the hexagon and in the arc of its sector ([issue 982](https://github.com/heidrun-org/heidrun_code/issues/982)).
- Each workspace has a sector sized by its coding agents and subagents, with a minimum angle so that a small workspace keeps room for its label.
- The coding agents of a workspace follow the order of its tabs, so that the coding agents of one tab sit side by side. The label of a coding agent is shaped like a tab, with the exact tab name and the icon of the coding agent, the same icon as the tabs of Heidrun Code: the icon `claude` of Bootstrap Icons for Claude Code, and the icon `openai` for Codex. Another coding agent gets the first letter of its name.
- `HeidrunCodeDashboardLayout.compute` reads only the hierarchy, the identifiers, and the names. The same model gives the same positions, and a status change moves nothing. The filter hides nodes and never moves the others.
- A long label of a coding agent or of a subagent is shortened with an ellipsis, and the full name stays in the title. A crowded sector hides the labels that have no room. The SVG drawing has a view box, so it follows every resize. With no workspace, the view shows a plain text message.
- The colors are `--working`, `--blocked`, `--done`, and `--idle` of `styles.css`. A blocked node and a blocked sector have a red glow. Each node also has a sign (▸ Working, ! Blocked, ✓ Finished, – Idle, ? unknown) and an accessible name with the status in words.
- Unknown has a dashed outline. A stale, unmatched, or not observed coding agent or subagent has a dashed outline and the word under its label.
- The animations, the pause, and the links of the messages follow [heidrun_code_dashboard_animations.md](heidrun_code_dashboard_animations.md).

## Tests

- `pnpm --dir packages/apps/web_frontend exec vitest run src/lib/heidrun_code_dashboard/heidrun_code_dashboard_layout.test.ts src/components/heidrun_code_dashboard` runs the tests of the layout and of the graph.
