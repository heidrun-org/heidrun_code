# Mire rules index

- Created: 30 October 2026
- Last updated: 30 October 2026
- Status: Maintained index for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md)
- Related issue: [issue 968](https://github.com/heidrun-org/heidrun_code/issues/968), [issue 973](https://github.com/heidrun-org/heidrun_code/issues/973), [issue 978](https://github.com/heidrun-org/heidrun_code/issues/978)

This file lists the files of this folder, for agents and tools.

- [README.md](README.md): the overview of this folder, for people.
- [mire_data_and_statuses.md](mire_data_and_statuses.md): the data of the Mire: the hierarchy, the identities, the matching of a pane to its observation, the separate facts, the visible statuses, the aggregation, the coverage, the counters, the messages, and the task texts. Read it each time that you change the folder `packages/apps/web_frontend/src/lib/mire`, or a Mire view that shows a status, a counter, or a message.
- [mire_graph_and_sidebar.md](mire_graph_and_sidebar.md): the Mire view: the item "Mire" of the More menu, the modal, the subscription to the collector, the static radial graph, the selection and the keyboard, the right sidebar, the counters, and the filters. Read it each time that you change the folder `packages/apps/web_frontend/src/components/mire`, the folder `packages/apps/web_frontend/src/stores/mire`, or the file `mire_layout.ts`.
- [mire_display_modes.md](mire_display_modes.md): the two display modes of the Mire, the modal and the separate Mire window: the focus, full screen, the entry `start_mire_window.ts`, the capability of the window, the one shared collector, "Open in Heidrun Code" with its new reading of Herdr, and why the Mire has no voice input and no Approve button. Read it each time that you change the modal, the separate Mire window, `main.ts`, or `packages/apps/desktop_tauri/src/mire/mire_window.rs`.
- [mire_animations.md](mire_animations.md): the animations of the statuses and of Heidrun, the real transitions, the travel and the links of the messages, the pause, and the reduced motion. Read it each time that you change an animation of the Mire graph, `mire_transitions.ts`, or `mire_animations.ts`.
- [mire_local_network.md](mire_local_network.md): the Mire on a phone or a tablet of the local network: the section "Mire" of the Settings window, the package `mire_server`, the pairing key and its cookie, the checks, the read-only page with the display mode `localNetwork`, and the one shared collector. Read it each time that you change the package `packages/auxiliary/mire_server`, `packages/apps/desktop_tauri/src/mire/local_network.rs`, the section "Mire" of the Settings window, or the page `/mire`.
