# Directory Context: `/packages/apps/web_frontend/src/stores/mire`

## Purpose
The state of the Mire views of one window: the live observations, the Mire model built from them and from the session store, the selection, the filter, the connection to the shared collector, the modal, and the separate Mire window.

## Key Exports & Entry Points
- `mire_store.ts`: `mireState`, `mireModel`, `mireIndex`, `mireVisibility`, `mireMessages`, `mireSelectedEntry`, `mireSelectedPath`, `MireViewConnection` (subscribe, listen, unsubscribe), `MireOpenResult`, `MireDisplayMode`, and `MireStore` (select, filter, follow the selection, open the pane in the main window after a new reading of Herdr, read a Claude Code subagent transcript).
- `mire_navigation.ts`: `MireNavigation`, the pure index, path, filter visibility, selection fallback, and keyboard moves.
- `mire_animations.ts`: `mireAnimationState` (the pause and the effects) and `MireAnimations` (start on the mount of the graph, stop on the unmount, toggle the pause, remove an effect). It keeps the state of the previous models and the seen message identifiers of the open view.
- `mire_modal.ts`: `mireModal` and `MireModal.open()` / `MireModal.close()` (which gives the focus back) / `MireModal.openInSeparateWindow()`.
- `mire_separate_window.ts`: `MireSeparateWindow`, which opens the separate Mire window, and in the main window shows the pane that the window asks for with the event `mire://open-pane`.
- `mire_local_network_session.ts`: `MireLocalNetworkSession` and `mireLocalNetworkPageState`, the state of the Mire on the page of a device of the local network, read from the Mire server every second, kept in the session state and in the Mire state.
- `mire_local_network_settings.ts`: `MireLocalNetworkSettings` and `mireLocalNetworkSettingsState`, the status, the switch, and the new pairing key of the section "Mire" of the Settings window.
- `mire_window_session.ts`: `MireWindowSession`, the Herdr snapshot of the separate Mire window, kept in the session state.
- Command to run this folder: `pnpm --dir packages/apps/web_frontend exec vitest run src/stores/mire`

## Rules
- `mire_navigation.ts` reads no store and calls no Tauri command: it takes the model and gives plain values.
- A view registers in the collector only while it is mounted: `MireViewConnection.open()` on mount, `close()` on unmount.
- The selection follower runs only while a view is connected, so the model is not built while no Mire view is open.
- The counters come from `model.counters`, never from the filtered nodes.
- In the separate Mire window, only `MireWindowSession` writes the session state: never call `start`, `refresh`, or a selection function of `../session` there, because they notify, push to the phone, and change the selection of the main window.
- "Open in Heidrun Code" reads the Herdr snapshot again before it acts, in the modal and in the separate window.
- On the page of a device of the local network (display mode `localNetwork`), only `MireLocalNetworkSession` writes the session state, `MireViewConnection` registers nothing in the collector, and no Tauri command runs; `mireIsOnLocalNetwork` hides the actions that need the desktop application.
- The animations start no timer: the follower of the transitions runs only while the graph is mounted, and the Mire starts paused when the system asks for reduced motion.

## Background
- The rules are in [mire_graph_and_sidebar.md](../../../../../../docs/agents_rules/user_interface/mire/mire_graph_and_sidebar.md), from [issue 971](https://github.com/heidrun-org/heidrun_code/issues/971) and [issue 972](https://github.com/heidrun-org/heidrun_code/issues/972), and in [mire_display_modes.md](../../../../../../docs/agents_rules/user_interface/mire/mire_display_modes.md), from [issue 973](https://github.com/heidrun-org/heidrun_code/issues/973).
