# Mire display modes

- Created: 30 October 2026
- Last updated: 30 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Mire graph and sidebar](mire_graph_and_sidebar.md), [Glossary of Heidrun Code: Mire](../../glossary/mire.md), [Window state and start](../window/window_state_and_start.md)
- Related issue: [issue 968](https://github.com/heidrun-org/heidrun_code/issues/968), [issue 973](https://github.com/heidrun-org/heidrun_code/issues/973)

This file gives the rules of the two display modes of the Mire: the modal over the main window, and the separate Mire window for a second screen. It also gives the rules of the actions that both modes share. Both modes mount the same `MireView.vue`, which follows [mire_graph_and_sidebar.md](mire_graph_and_sidebar.md).

## Modal

- The item "Mire" of the More menu opens the modal. Escape (when the graph does not use the key) and the close button close it, and give the keyboard focus back to the element that had it before the modal opened.
- The button "Open in a separate window", with the icon `window-stack`, opens the separate Mire window and closes the modal. When the window cannot open, the modal stays and a message says so.
- "Open in Heidrun Code" closes the modal and leaves the keyboard focus to the pane that it shows.

## Separate Mire window

- It is a Tauri window with the label `mire`, built by `packages/apps/desktop_tauri/src/mire/mire_window.rs`. Only one exists at a time: a second request focuses it.
- It opens at 1280 × 820 logical pixels, or at most 90 percent of the work area, centered on the screen of the main window. The window state plugin never saves it (`WINDOW_STATE_DENYLIST` in `lib.rs`).
- It loads `index.html?window=mire`. `main.ts` then imports `start_mire_window.ts` only: no restore and no copy of `localStorage`, no session start, no notification, no phone push, no status item, no mobile server, no voice input, and no Herdr server start.
- Its Herdr snapshot comes from `MireWindowSession`: `session.snapshot` at the start, and again after the Herdr events that the desktop application sends to every window. It follows the closed Finished cards of the main window through the `storage` event.
- Its capability `capabilities/mire_window.json` gives only: listen and unlisten to events, read and set full screen, close, and the zoom of the font size. A test checks this list.
- A thin bar holds the title and the button "Full screen" / "Exit full screen". ⌃⌘F (the item of the menu Window) also works. ⌘W closes the window. Escape never closes it.
- When the main window is destroyed, the Mire window closes, so that Heidrun Code never stays open with the Mire window alone. Only the main window can block its closing for unsaved files.

## One shared collector

- Each mounted view registers with its own view identifier (`mire_view_<mode>_…`), and the collector records the window of each view. Both modes share the one loop of collections.
- Closing the modal removes only the view of the modal. Closing the Mire window removes only the views of that window, in Rust, because a closed window never unmounts its views.

## Actions

- "Open in Heidrun Code" reads the Herdr snapshot again just before it acts. A pane that moved opens at its current workspace and tab. A pane that is gone opens nothing, and the sidebar shows "This pane is gone: nothing was opened." When Herdr does not answer, nothing opens and the sidebar says so.
- From the Mire window, the action calls `mire_open_in_main_window`: the main window gets the event `mire://open-pane`, reads the snapshot again, selects the pane or shows the message, and takes the focus. The Mire window stays open.
- No Approve button, and no control operation for a Codex child chat.
- No voice input in the Mire: the voice input of Heidrun Code writes into the composition bar of the main window, and its owner and its queue live in the memory of the main window only, so the Mire window cannot target a pane with it safely.
- The terminal preview reads `pane.read` only. It has no input element and no `tabindex`, so it never takes the focus and never resizes a terminal, in both modes.

## Tests

- `pnpm --dir packages/apps/web_frontend exec vitest run src/components/mire src/stores/mire src/start_mire_window.test.ts src/main_start_order.test.ts`
- `cargo test --package heidrun_code mire`, at the root of the repository: the frame of the window, the capability, the page, and the shared collector of the two modes.
