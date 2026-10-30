# Directory Context: `/packages/apps/web_frontend/src/components/mire`

## Purpose
The Mire view: the static radial graph, the right sidebar with the counters, the filters, the path of the selection, and the details of the selected node, the modal that opens it from the More menu, and the page of the separate Mire window.

## Key Exports & Entry Points
- `MireDialog.vue`: the modal over the main window. `App.vue` mounts it while `mireModal.isOpen` (`../../stores/mire/mire_modal.ts`) is true.
- `MireDialog.vue` also has the button "Open in a separate window".
- `MireWindowRoot.vue`: the page of the separate Mire window, mounted by `../../start_mire_window.ts`: the button of full screen, ⌘W, and the same `MireView.vue`.
- `MireView.vue`: the graph and the sidebar. It opens a `MireViewConnection` when it mounts and closes it when it unmounts, in both display modes. It emits `openedInHeidrunCode`.
- `MireGraph.vue`: the SVG drawing, with the positions of `../../lib/mire/mire_layout.ts`, the selection by click, the keyboard moves, the pause button, and the animations of `mire_graph_animations.css`.
- `MireGraphEffects.vue`: the short effects of the real transitions (burst, red flash, travel of a message), with the arcs of `mire_message_arcs.ts`.
- `MireSidebar.vue`: the counters (`MireCounters.vue`), the coverage notices, the path (`MirePath.vue`), and one details component for Heidrun, a workspace or a tab, a coding agent, or a subagent.
- `mire_view_texts.ts`: `MireViewTexts`, the badges, the status signs, the message texts, and the lists of pending attention.
- `mire_view_test_support.ts`: the Herdr snapshot and the observations of the tests of this folder. Only the test files import it.
- Command to run this folder: `pnpm --dir packages/apps/web_frontend exec vitest run src/components/mire`

## Rules
- A component here reads and changes the Mire state through `../../stores/mire/`, and calls no Tauri command itself, except the read-only `pane.read` of the terminal preview through `../../lib/api.ts`.
- Nothing here builds the Mire model or restates its rules: the model, the statuses, and the counters come from `../../lib/mire/`.
- The terminal preview never attaches to the terminal and never takes the input focus. The preview of a subagent is called "Transcript", never "terminal".
- Every status shows with a sign or a text next to its color, and every color comes from a theme variable of `styles.css`.
- An animation never moves a node and runs only under the class `mire-animated`. A message arc joins only two nodes that explicit identifiers resolve, never two names.
- No Approve button and no voice input. "Open in Heidrun Code" reads Herdr again, then selects the pane in the main window and closes the modal; the separate Mire window stays open.
- `MireWindowRoot.vue` calls only the Tauri window functions that `packages/apps/desktop_tauri/capabilities/mire_window.json` allows.

## Background
- The rules of the view are in [mire_graph_and_sidebar.md](../../../../../../docs/agents_rules/user_interface/mire/mire_graph_and_sidebar.md), from [issue 971](https://github.com/heidrun-org/heidrun_code/issues/971) and [issue 972](https://github.com/heidrun-org/heidrun_code/issues/972). The two display modes are in [mire_display_modes.md](../../../../../../docs/agents_rules/user_interface/mire/mire_display_modes.md), from [issue 973](https://github.com/heidrun-org/heidrun_code/issues/973).
- The rules of the animations are in [mire_animations.md](../../../../../../docs/agents_rules/user_interface/mire/mire_animations.md), from [issue 974](https://github.com/heidrun-org/heidrun_code/issues/974).
