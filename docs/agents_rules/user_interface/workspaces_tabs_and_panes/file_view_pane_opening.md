# User interface of Heidrun Code: opening a file view pane

- Created: 26 October 2026
- Last updated: 26 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [File view pane](file_view_pane.md), [Search in files](../sidebars/file_search.md)
- Related issue: [issue 714](https://github.com/heidrun-org/heidrun/issues/714), [issue 886](https://github.com/heidrun-org/heidrun_code/issues/886), [issue 898](https://github.com/heidrun-org/heidrun_code/issues/898), [issue 899](https://github.com/heidrun-org/heidrun_code/issues/899)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../glossary/index.md). It gives the actions that open a file in a file view pane, and the place of the pane that opens. The other rules of the file view pane are in [file_view_pane.md](file_view_pane.md).

## Opening a file

These actions open a file in a file view pane:

- A click on a file in the File explorer sidebar section.
- The new file that the button "New file" of the File explorer sidebar section creates.
- The button "Open the file" of a file line of the Source control sidebar section.
- The entry "Open the file" of the menu of a diff pane.
- A click on a file name in a terminal. When a line number follows the file name, for example `src/main.rs:42`, the editor puts the cursor on that line and shows it in the middle of the pane. A second click on the same name goes to the line again.
- A click on a line of the Search in files sidebar section, at that line ([file_search.md](../sidebars/file_search.md)).
- The box that searches a file by its name. The shortcut ⌘P and the entry "Open a project file…" of the command palette open it on top of the panes, as in VS Code. It lists the files of the project of the selected pane, or of the repository of the selected workspace when no pane is selected. The developer types a part of the name: the letters only need to be in order, and a `/` moves to the next folder. The arrow keys move in the list, Enter or a click opens the file, and the key Escape or a click outside closes the box ([issue 898](https://github.com/heidrun-org/heidrun_code/issues/898)).

The file view pane opens in this way:

- When the selected pane is a terminal, running or idle, a new pane opens to the right of it, in the same tab, and shows the file. The terminal stays as it was. Heidrun Code never replaces, hides, or stops a terminal.
- When the selected pane is a file view pane, the file replaces the file of that pane. No new pane opens. When that pane holds unsaved changes of another file, a new pane opens to its right instead, so that the changes stay.
- When no pane is selected, nothing opens, and a toast says "Select a pane first: the file opens next to it". When Herdr fails, nothing opens, and a toast shows the error of Herdr.
- The new pane becomes the selected pane.

## Where the code is

- `FileViewPanes.open` in `stores/file_view_panes.ts` takes the absolute path and the line, and keeps the line in `fileViewLineRequests` until the file view pane shows it.
- `openFileRef` in `stores/files.ts` resolves a file name of a terminal and gives its line.
- `QuickOpenModal.vue` is the box of ⌘P, `QuickOpen` in `stores/quick_open.ts` opens it, and `QuickOpenSearch` in `lib/quick_open_search.ts` finds a file by a part of its name.
- The tests are `file_view_panes.test.ts`, `FileView.test.ts`, `QuickOpenModal.test.ts`, `quick_open_search.test.ts`, and `removed_windows.test.ts`.
