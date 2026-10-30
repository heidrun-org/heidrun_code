# Heidrun Code Dashboard display modes

- Created: 30 October 2026
- Last updated: 30 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Heidrun Code Dashboard graph and sidebar](heidrun_code_dashboard_graph_and_sidebar.md), [Glossary of Heidrun Code: Heidrun Code Dashboard](../../glossary/heidrun_code_dashboard.md), [Window state and start](../window/window_state_and_start.md)
- Related issue: [issue 968](https://github.com/heidrun-org/heidrun_code/issues/968), [issue 973](https://github.com/heidrun-org/heidrun_code/issues/973)

This file gives the rules of the two display modes of the Heidrun Code Dashboard: the modal over the main window, and the separate Heidrun Code Dashboard window for a second screen. It also gives the rules of the actions that both modes share. Both modes mount the same `HeidrunCodeDashboardView.vue`, which follows [heidrun_code_dashboard_graph_and_sidebar.md](heidrun_code_dashboard_graph_and_sidebar.md). A third, read-only display mode, `localNetwork`, shows the same view on a phone or a tablet: its rules are in [heidrun_code_dashboard_local_network.md](heidrun_code_dashboard_local_network.md).

## Modal

- The item "Dashboard" of the More menu opens the modal. Escape (when the graph does not use the key) and the close button close it, and give the keyboard focus back to the element that had it before the modal opened.
- The button "Open in a separate window", with the icon `window-stack`, opens the separate Heidrun Code Dashboard window and closes the modal. When the window cannot open, the modal stays and a message says so.
- "Open in Heidrun Code" closes the modal and leaves the keyboard focus to the pane that it shows.

## Separate Heidrun Code Dashboard window

- It is a Tauri window with the label `heidrun_code_dashboard`, built by `packages/apps/desktop_tauri/src/heidrun_code_dashboard/heidrun_code_dashboard_window.rs`. Only one exists at a time: a second request focuses it.
- It opens at 1280 × 820 logical pixels, or at most 90 percent of the work area, centered on the screen of the main window. The window state plugin never saves it (`WINDOW_STATE_DENYLIST` in `lib.rs`).
- It loads `index.html?window=heidrun_code_dashboard`. `main.ts` then imports `start_heidrun_code_dashboard_window.ts` only: no restore and no copy of `localStorage`, no session start, no notification, no phone push, no status item, no mobile server, no voice input, and no Herdr server start.
- Its Herdr snapshot comes from `HeidrunCodeDashboardWindowSession`: `session.snapshot` at the start, and again after the Herdr events that the desktop application sends to every window. It follows the closed Finished cards of the main window through the `storage` event.
- Its capability `capabilities/heidrun_code_dashboard_window.json` gives only: listen and unlisten to events, read and set full screen, close, and the zoom of the font size. A test checks this list.
- A thin bar holds the title and the button "Full screen" / "Exit full screen". ⌃⌘F (the item of the menu Window) also works. ⌘W closes the window. Escape never closes it.
- When the main window is destroyed, the Heidrun Code Dashboard window closes, so that Heidrun Code never stays open with the Heidrun Code Dashboard window alone. Only the main window can block its closing for unsaved files.

## One shared collector

- Each mounted view registers with its own view identifier (`heidrun_code_dashboard_view_<mode>_…`), and the collector records the window of each view. Both modes share the one loop of collections.
- Closing the modal removes only the view of the modal. Closing the Heidrun Code Dashboard window removes only the views of that window, in Rust, because a closed window never unmounts its views.

## Width of the right sidebar

- The developer drags the left edge of the right sidebar to change its width, with `Resizer.vue`, in the modal and in the separate Heidrun Code Dashboard window: 380 pixels by default, 280 at least, and the graph keeps 400 at least. A double click gives the default width back. The width is saved in `localStorage` and shared by the two modes. On a device of the local network, the sidebar has no drag handle.
- The rule comes from [issue 982](https://github.com/heidrun-org/heidrun_code/issues/982).

## Actions

- "Open in Heidrun Code" shows a target in the main window: the pane of a coding agent (the button of the sidebar, or a double click on the dot), a tab (a double click on the label shaped like a tab), or a workspace (a double click on the hexagon or the sector).
- "Open in Heidrun Code" reads the Herdr snapshot again just before it acts. A pane that moved opens at its current workspace and tab. A target that is gone opens nothing, and the sidebar shows "It is not in the Herdr session any more: nothing was opened." When Herdr does not answer, nothing opens and the sidebar says so.
- From the Heidrun Code Dashboard window, the action calls `heidrun_code_dashboard_open_in_main_window` with the kind (`workspace`, `tab`, or `pane`) and the identifier of the target: the main window gets the event `heidrun_code_dashboard://open-in-main-window`, reads the snapshot again, selects the target or shows the message, and takes the focus. The Heidrun Code Dashboard window stays open.
- No Approve button, and no control operation for a Codex child chat.
- No voice input in the Heidrun Code Dashboard: the voice input of Heidrun Code writes into the composition bar of the main window, and its owner and its queue live in the memory of the main window only, so the Heidrun Code Dashboard window cannot target a pane with it safely.
- The terminal preview reads `pane.read` only. It has no input element and no `tabindex`, so it never takes the focus and never resizes a terminal, in both modes.

## Tests

- `pnpm --dir packages/apps/web_frontend exec vitest run src/components/heidrun_code_dashboard src/stores/heidrun_code_dashboard src/start_heidrun_code_dashboard_window.test.ts src/main_start_order.test.ts`
- `cargo test --package heidrun_code heidrun_code_dashboard`, at the root of the repository: the frame of the window, the capability, the page, and the shared collector of the two modes.
