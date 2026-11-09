# Directory Context: `/packages/apps/web_frontend/src/components/heidrun_code_dashboard`

## Purpose
The Heidrun Code Dashboard view (the radial graph and the right sidebar), the modal of the More menu, the separate Heidrun Code Dashboard window, and the page of the local network.

## Key Exports & Entry Points
- `HeidrunCodeDashboardDialog.vue`: the modal over the main window, with the button "Open in a separate window". `App.vue` mounts it while `heidrunCodeDashboardModal.isOpen` is true.
- `HeidrunCodeDashboardWindowRoot.vue`: the page of the separate Heidrun Code Dashboard window, mounted by `../../start_heidrun_code_dashboard_window.ts`.
- `HeidrunCodeDashboardLocalNetworkRoot.vue`: the page of a phone or a tablet of the local network, mounted by `../../start_heidrun_code_dashboard_local_network.ts`.
- `heidrun_code_dashboard_screen_awake.ts`: `HeidrunCodeDashboardScreenAwake`, which keeps the screen of the device of the local network on.
- `HeidrunCodeDashboardView.vue`: the graph, the drag handle of the width of the sidebar (not on the local network), and the sidebar. It emits `openedInHeidrunCode`.
- `HeidrunCodeDashboardGraph.vue`: the SVG drawing, the selection, the keyboard moves, the pause button, and the animations of `heidrun_code_dashboard_graph_animations.css`.
- `HeidrunCodeDashboardGraphEffects.vue`: the short effects of the real transitions, with the arcs of `heidrun_code_dashboard_message_arcs.ts`.
- `HeidrunCodeDashboardSidebar.vue`: the counters, the coverage notices, the path, and one details component for each kind of node.
- `heidrun_code_dashboard_view_texts.ts`: `HeidrunCodeDashboardViewTexts`, the texts of the badges, the statuses, and the messages.
- `heidrun_code_dashboard_view_test_support.ts`: the Herdr snapshot and the observations of the tests of this folder. Only the test files import it.
- Command to run this folder: `pnpm --dir packages/apps/web_frontend exec vitest run src/components/heidrun_code_dashboard`

## Rules
- A component here reads and changes the Heidrun Code Dashboard state through `../../stores/heidrun_code_dashboard/`, and calls no Tauri command itself, except the read-only `pane.read` of the terminal preview through `../../lib/api.ts`.
- Nothing here builds the Heidrun Code Dashboard model or restates its rules: the model, the statuses, and the counters come from `../../lib/heidrun_code_dashboard/`.
- The terminal preview never attaches to the terminal and never takes the input focus. The preview of a subagent is called "Transcript", never "terminal".
- Every status shows with a sign or a text next to its color, and every color comes from a theme variable of `styles.css`.
- An animation never moves a node and runs only under the class `heidrun-code-dashboard-animated`. A message arc joins only two nodes that explicit identifiers resolve, never two names.
- In the display mode `localNetwork`, nothing here calls a Tauri command: "Open in Heidrun Code", the terminal preview, and the transcript preview do not show.
- No Approve button and no voice input. "Open in Heidrun Code" selects the pane in the main window and closes the modal.
- `HeidrunCodeDashboardWindowRoot.vue` calls only the Tauri window functions that `packages/apps/desktop_tauri/capabilities/heidrun_code_dashboard_window.json` allows.

## Background
- The rules of the view are in [heidrun_code_dashboard_graph_and_sidebar.md](../../../../../../docs/agents_rules/user_interface/heidrun_code_dashboard/heidrun_code_dashboard_graph_and_sidebar.md), from [issue 971](https://github.com/heidrun-org/heidrun_code/issues/971) and [issue 972](https://github.com/heidrun-org/heidrun_code/issues/972). The two display modes are in [heidrun_code_dashboard_display_modes.md](../../../../../../docs/agents_rules/user_interface/heidrun_code_dashboard/heidrun_code_dashboard_display_modes.md), from [issue 973](https://github.com/heidrun-org/heidrun_code/issues/973). The page of the local network is in [heidrun_code_dashboard_local_network.md](../../../../../../docs/agents_rules/user_interface/heidrun_code_dashboard/heidrun_code_dashboard_local_network.md), from [issue 978](https://github.com/heidrun-org/heidrun_code/issues/978) and [issue 991](https://github.com/heidrun-org/heidrun_code/issues/991).
- The rules of the animations are in [heidrun_code_dashboard_animations.md](../../../../../../docs/agents_rules/user_interface/heidrun_code_dashboard/heidrun_code_dashboard_animations.md), from [issue 974](https://github.com/heidrun-org/heidrun_code/issues/974).
