# Directory Context: `/packages/apps/web_frontend/src/stores/mire`

## Purpose
The state of the Mire views of one window: the live observations, the Mire model built from them and from the session store, the selection, the filter, the connection to the shared collector, and the modal.

## Key Exports & Entry Points
- `mire_store.ts`: `mireState`, `mireModel`, `mireIndex`, `mireVisibility`, `mireMessages`, `mireSelectedEntry`, `mireSelectedPath`, `MireViewConnection` (subscribe, listen, unsubscribe), and `MireStore` (select, filter, follow the selection, open the pane in the main window, read a Claude Code subagent transcript).
- `mire_navigation.ts`: `MireNavigation`, the pure index, path, filter visibility, selection fallback, and keyboard moves.
- `mire_modal.ts`: `mireModal` and `MireModal.open()` / `MireModal.close()`.
- Command to run this folder: `pnpm --dir packages/apps/web_frontend exec vitest run src/stores/mire`

## Rules
- `mire_navigation.ts` reads no store and calls no Tauri command: it takes the model and gives plain values.
- A view registers in the collector only while it is mounted: `MireViewConnection.open()` on mount, `close()` on unmount.
- The selection follower runs only while a view is connected, so the model is not built while no Mire view is open.
- The counters come from `model.counters`, never from the filtered nodes.

## Background
- The rules are in [mire_graph_and_sidebar.md](../../../../../../docs/agents_rules/user_interface/mire/mire_graph_and_sidebar.md), from [issue 971](https://github.com/heidrun-org/heidrun_code/issues/971) and [issue 972](https://github.com/heidrun-org/heidrun_code/issues/972).
