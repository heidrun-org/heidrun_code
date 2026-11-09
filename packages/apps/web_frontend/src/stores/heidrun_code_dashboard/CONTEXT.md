# Directory Context: `/packages/apps/web_frontend/src/stores/heidrun_code_dashboard`

## Purpose
The state of the Heidrun Code Dashboard views of one window: the live observations, the Heidrun Code Dashboard model built from them and from the session store, the selection, the filter, the connection to the shared collector, the modal, and the separate Heidrun Code Dashboard window.

## Key Exports & Entry Points
- `heidrun_code_dashboard_store.ts`: `heidrunCodeDashboardState`, `heidrunCodeDashboardModel`, `heidrunCodeDashboardIndex`, `heidrunCodeDashboardVisibility`, `heidrunCodeDashboardMessages`, `heidrunCodeDashboardSelectedEntry`, `heidrunCodeDashboardSelectedPath`, `HeidrunCodeDashboardViewConnection` (subscribe, listen, unsubscribe), `HeidrunCodeDashboardOpenResult`, `HeidrunCodeDashboardDisplayMode`, and `HeidrunCodeDashboardStore` (select, filter, follow the selection, open the pane in the main window after a new reading of Herdr, read a Claude Code subagent transcript).
- `heidrun_code_dashboard_navigation.ts`: `HeidrunCodeDashboardNavigation`, the pure index, path, filter visibility, selection fallback, and keyboard moves.
- `heidrun_code_dashboard_animations.ts`: `heidrunCodeDashboardAnimationState` (the pause and the effects) and `HeidrunCodeDashboardAnimations` (start on the mount of the graph, stop on the unmount, toggle the pause, remove an effect). It keeps the state of the previous models and the seen message identifiers of the open view.
- `heidrun_code_dashboard_modal.ts`: `heidrunCodeDashboardModal` and `HeidrunCodeDashboardModal.open()` / `HeidrunCodeDashboardModal.close()` (which gives the focus back) / `HeidrunCodeDashboardModal.openInSeparateWindow()`.
- `heidrun_code_dashboard_separate_window.ts`: `HeidrunCodeDashboardSeparateWindow`, which opens the separate Heidrun Code Dashboard window, and in the main window shows the workspace, the tab, or the pane that the window asks for with the event `heidrun_code_dashboard://open-in-main-window`.
- `heidrun_code_dashboard_local_network_session.ts`: `HeidrunCodeDashboardLocalNetworkSession` and `heidrunCodeDashboardLocalNetworkPageState`, the state of the Heidrun Code Dashboard on the page of a device of the local network, read from the Heidrun Code Dashboard server every second, kept in the session state and in the Heidrun Code Dashboard state.
- `heidrun_code_dashboard_local_network_settings.ts`: `HeidrunCodeDashboardLocalNetworkSettings` and `heidrunCodeDashboardLocalNetworkSettingsState`, the status, the switch, and the new pairing key of the section "Heidrun Code Dashboard" of the Settings window.
- `heidrun_code_dashboard_sidebar_width.ts`: `heidrunCodeDashboardSidebarWidth` and `HeidrunCodeDashboardSidebarWidth` (load, set), the width of the right sidebar, saved in `localStorage` and shared by the modal and the separate Heidrun Code Dashboard window.
- `heidrun_code_dashboard_window_session.ts`: `HeidrunCodeDashboardWindowSession`, the Herdr snapshot of the separate Heidrun Code Dashboard window, kept in the session state.
- Command to run this folder: `pnpm --dir packages/apps/web_frontend exec vitest run src/stores/heidrun_code_dashboard`

## Rules
- `heidrun_code_dashboard_navigation.ts` reads no store and calls no Tauri command: it takes the model and gives plain values.
- A view registers in the collector only while it is mounted: `HeidrunCodeDashboardViewConnection.open()` on mount, `close()` on unmount.
- The selection follower runs only while a view is connected, so the model is not built while no Heidrun Code Dashboard view is open.
- The counters come from `model.counters`, never from the filtered nodes.
- In the separate Heidrun Code Dashboard window, only `HeidrunCodeDashboardWindowSession` writes the session state: never call `start`, `refresh`, or a selection function of `../session` there, because they notify, push to the phone, and change the selection of the main window.
- "Open in Heidrun Code" reads the Herdr snapshot again before it acts, in the modal and in the separate window.
- On the page of a device of the local network (display mode `localNetwork`), only `HeidrunCodeDashboardLocalNetworkSession` writes the session state, `HeidrunCodeDashboardViewConnection` registers nothing in the collector, and no Tauri command runs; `heidrunCodeDashboardIsOnLocalNetwork` hides the actions that need the desktop application.
- The animations start no timer: the follower of the transitions runs only while the graph is mounted, and the Heidrun Code Dashboard starts paused when the system asks for reduced motion.

## Background
- The rules are in [heidrun_code_dashboard_graph_and_sidebar.md](../../../../../../docs/agents_rules/user_interface/heidrun_code_dashboard/heidrun_code_dashboard_graph_and_sidebar.md), from [issue 971](https://github.com/heidrun-org/heidrun_code/issues/971) and [issue 972](https://github.com/heidrun-org/heidrun_code/issues/972), and in [heidrun_code_dashboard_display_modes.md](../../../../../../docs/agents_rules/user_interface/heidrun_code_dashboard/heidrun_code_dashboard_display_modes.md), from [issue 973](https://github.com/heidrun-org/heidrun_code/issues/973).
