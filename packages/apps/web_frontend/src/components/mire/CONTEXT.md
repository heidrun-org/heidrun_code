# Directory Context: `/packages/apps/web_frontend/src/components/mire`

## Purpose
The Mire view: the static radial graph, the right sidebar with the counters, the filters, the path of the selection, and the details of the selected node, and the modal that opens it from the More menu.

## Key Exports & Entry Points
- `MireDialog.vue`: the modal over the main window. `App.vue` mounts it while `mireModal.isOpen` (`../../stores/mire/mire_modal.ts`) is true.
- `MireView.vue`: the graph and the sidebar. It opens a `MireViewConnection` when it mounts and closes it when it unmounts, so a separate window can mount it the same way. It emits `openedInHeidrunCode`.
- `MireGraph.vue`: the SVG drawing, with the positions of `../../lib/mire/mire_layout.ts`, the selection by click, and the keyboard moves.
- `MireSidebar.vue`: the counters (`MireCounters.vue`), the coverage notices, the path (`MirePath.vue`), and one details component for Heidrun, a workspace or a tab, a coding agent, or a subagent.
- `mire_view_texts.ts`: `MireViewTexts`, the badges, the status signs, the message texts, and the lists of pending attention.
- `mire_view_test_support.ts`: the Herdr snapshot and the observations of the tests of this folder. Only the test files import it.
- Command to run this folder: `pnpm --dir packages/apps/web_frontend exec vitest run src/components/mire`

## Rules
- A component here reads and changes the Mire state through `../../stores/mire/`, and calls no Tauri command itself, except the read-only `pane.read` of the terminal preview through `../../lib/api.ts`.
- Nothing here builds the Mire model or restates its rules: the model, the statuses, and the counters come from `../../lib/mire/`.
- The terminal preview never attaches to the terminal and never takes the input focus. The preview of a subagent is called "Transcript", never "terminal".
- Every status shows with a sign or a text next to its color, and every color comes from a theme variable of `styles.css`.
- No Approve button. "Open in Heidrun Code" selects the pane in the main window and closes the modal.

## Background
- The rules of the view are in [mire_graph_and_sidebar.md](../../../../../../docs/agents_rules/user_interface/mire/mire_graph_and_sidebar.md), from [issue 971](https://github.com/heidrun-org/heidrun_code/issues/971) and [issue 972](https://github.com/heidrun-org/heidrun_code/issues/972).
