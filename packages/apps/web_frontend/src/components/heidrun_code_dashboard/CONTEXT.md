# Directory Context: `/packages/apps/web_frontend/src/components/heidrun_code_dashboard`

## Purpose
The Heidrun Code Dashboard view: the static radial graph, the right sidebar with the counters, the filters, the path of the selection, and the details of the selected node, the modal that opens it from the More menu, and the page of the separate Heidrun Code Dashboard window.

## Key Exports & Entry Points
- `HeidrunCodeDashboardDialog.vue`: the modal over the main window. `App.vue` mounts it while `heidrunCodeDashboardModal.isOpen` (`../../stores/heidrun_code_dashboard/heidrun_code_dashboard_modal.ts`) is true.
- `HeidrunCodeDashboardDialog.vue` also has the button "Open in a separate window".
- `HeidrunCodeDashboardWindowRoot.vue`: the page of the separate Heidrun Code Dashboard window, mounted by `../../start_heidrun_code_dashboard_window.ts`: the button of full screen, ⌘W, and the same `HeidrunCodeDashboardView.vue`.
- `HeidrunCodeDashboardLocalNetworkRoot.vue`: the page of a phone or a tablet of the local network, mounted by `../../start_heidrun_code_dashboard_local_network.ts`: the button of full screen when the web browser allows it, the message of a lost connection, and the same `HeidrunCodeDashboardView.vue`, with the sidebar below the graph on a narrow screen.
- `HeidrunCodeDashboardView.vue`: the graph, the drag handle of the width of the sidebar (`../Resizer.vue`, not on the local network), and the sidebar. It opens a `HeidrunCodeDashboardViewConnection` when it mounts and closes it when it unmounts, in both display modes. It emits `openedInHeidrunCode`.
- `HeidrunCodeDashboardGraph.vue`: the SVG drawing, with the positions of `../../lib/heidrun_code_dashboard/heidrun_code_dashboard_layout.ts`, the selection by click, the keyboard moves, the pause button, and the animations of `heidrun_code_dashboard_graph_animations.css`.
- `HeidrunCodeDashboardGraphEffects.vue`: the short effects of the real transitions (burst, red flash, travel of a message), with the arcs of `heidrun_code_dashboard_message_arcs.ts`.
- `HeidrunCodeDashboardSidebar.vue`: the counters (`HeidrunCodeDashboardCounters.vue`), the coverage notices, the path (`HeidrunCodeDashboardPath.vue`), and one details component for Heidrun, a workspace or a tab, a coding agent, or a subagent.
- `heidrun_code_dashboard_view_texts.ts`: `HeidrunCodeDashboardViewTexts`, the badges, the status signs, the message texts, and the lists of pending attention.
- `heidrun_code_dashboard_view_test_support.ts`: the Herdr snapshot and the observations of the tests of this folder. Only the test files import it.
- Command to run this folder: `pnpm --dir packages/apps/web_frontend exec vitest run src/components/heidrun_code_dashboard`

## Rules
- A component here reads and changes the Heidrun Code Dashboard state through `../../stores/heidrun_code_dashboard/`, and calls no Tauri command itself, except the read-only `pane.read` of the terminal preview through `../../lib/api.ts`.
- Nothing here builds the Heidrun Code Dashboard model or restates its rules: the model, the statuses, and the counters come from `../../lib/heidrun_code_dashboard/`.
- The terminal preview never attaches to the terminal and never takes the input focus. The preview of a subagent is called "Transcript", never "terminal".
- Every status shows with a sign or a text next to its color, and every color comes from a theme variable of `styles.css`.
- An animation never moves a node and runs only under the class `heidrun-code-dashboard-animated`. A message arc joins only two nodes that explicit identifiers resolve, never two names.
- In the display mode `localNetwork`, nothing here calls a Tauri command: "Open in Heidrun Code", the terminal preview, and the transcript preview do not show.
- No Approve button and no voice input. "Open in Heidrun Code" reads Herdr again, then selects the pane in the main window and closes the modal; the separate Heidrun Code Dashboard window stays open.
- `HeidrunCodeDashboardWindowRoot.vue` calls only the Tauri window functions that `packages/apps/desktop_tauri/capabilities/heidrun_code_dashboard_window.json` allows.

## Background
- The rules of the view are in [heidrun_code_dashboard_graph_and_sidebar.md](../../../../../../docs/agents_rules/user_interface/heidrun_code_dashboard/heidrun_code_dashboard_graph_and_sidebar.md), from [issue 971](https://github.com/heidrun-org/heidrun_code/issues/971) and [issue 972](https://github.com/heidrun-org/heidrun_code/issues/972). The two display modes are in [heidrun_code_dashboard_display_modes.md](../../../../../../docs/agents_rules/user_interface/heidrun_code_dashboard/heidrun_code_dashboard_display_modes.md), from [issue 973](https://github.com/heidrun-org/heidrun_code/issues/973). The page of the local network is in [heidrun_code_dashboard_local_network.md](../../../../../../docs/agents_rules/user_interface/heidrun_code_dashboard/heidrun_code_dashboard_local_network.md), from [issue 978](https://github.com/heidrun-org/heidrun_code/issues/978).
- The rules of the animations are in [heidrun_code_dashboard_animations.md](../../../../../../docs/agents_rules/user_interface/heidrun_code_dashboard/heidrun_code_dashboard_animations.md), from [issue 974](https://github.com/heidrun-org/heidrun_code/issues/974).
