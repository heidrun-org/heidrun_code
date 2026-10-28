# User interface of Heidrun Code: file view pane editing

- Created: 26 October 2026
- Last updated: 27 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [File view pane](file_view_pane.md), [Opening a file view pane](file_view_pane_opening.md)
- Related issue: [issue 899](https://github.com/heidrun-org/heidrun_code/issues/899), [issue 901](https://github.com/heidrun-org/heidrun_code/issues/901), [issue 931](https://github.com/heidrun-org/heidrun_code/issues/931)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../glossary/index.md). It gives the rules of the editing of a file in a file view pane, and of the actions on the selected lines. The other rules of the file view pane are in [file_view_pane.md](file_view_pane.md).

## Editing a file

- The developer types in a file view pane at once: there is no button "Edit" ([issue 899](https://github.com/heidrun-org/heidrun_code/issues/899)). A code file and a Markdown file in Raw can change. An image and a Markdown file in Preview cannot change.
- The editor never takes the keyboard when the file opens. A click in the text gives it the keyboard.
- A file that cannot be edited stays read only, and a line above the text says why, for example "Read only: binary file: it cannot be edited". The backend refuses a file larger than 5 MB, a binary file, a file that is not in UTF-8, and a file inside the folder `.git`.
- The button "Save" shows in the header only while the file has unsaved changes. The key ⌘S in the editor and the button save the file. A toast says "<name> saved", and the button goes away.
- A save writes the file only when the disk still holds the text that the editor started from. The backend compares a fingerprint of the content, writes the new text next to the file, and then renames it over the file, so a crash never leaves half a file. The permissions of the file stay.
- Unsaved changes of a Markdown file in Raw show in Preview too.

## Changes on the disk

- The desktop application watches the file of each open file view pane with the Rust library `notify`, and sends the event `file-changed` to the pane when the file changes on the disk, because a coding agent may change it ([issue 931](https://github.com/heidrun-org/heidrun_code/issues/931)). It watches the folder of the file, not the file, because a coding agent and a save often write a new file and rename it over the file. The pane looks at the disk 150 milliseconds after the last event of one change. The watch stops when the pane closes or shows another file. Each drawing of a pane has its own watch identifier, so a pane drawn again (Zen Mode) keeps its watch.
- A file without unsaved changes shows the new content at once, at the same scroll position, in the code editor, in the Markdown preview, and for an image. The message "The file changed on disk" shows for 3 seconds.
- A file with unsaved changes keeps the text of the developer, and a bar "The file changed on disk" shows above the text, in the code editor and in the Markdown preview. The button "Load the new version" reads the disk again and drops the changes. The button "Keep my version" closes the bar and writes nothing: the next save replaces the version of the disk.
- A file deleted on the disk shows "The file was deleted". The code editor adds the button "Create it again with my version". The preview keeps the last content.
- A save of the pane shows no message, because the disk then holds the fingerprint of the save.
- A save that finds a changed file shows the bar, and writes nothing.

## Unsaved changes when a pane closes

- A file view pane with unsaved changes asks before it closes: "1 file has unsaved changes: <name>. Close without saving?" with the button "Close without saving". The question comes for the button "Close the pane", for ⌘W ⌘W, for the closing of the tab, and for the closing of the workspace. Cancel keeps the pane and its changes.
- Heidrun Code asks before it quits, with ⌘Q or with the closing of the window, while a file view pane holds unsaved changes: "<count> files have unsaved changes: <names>. Quit Heidrun Code without saving?" with the button "Quit without saving".
- A file chosen while the selected file view pane holds unsaved changes opens in a new pane, as [file_view_pane_opening.md](file_view_pane_opening.md) says.
- The unsaved changes of a pane stay when the pane is drawn again, for example in Zen Mode, and go away when Herdr closes the pane.

## Actions on the selected lines

- When the developer selects text in the editor, a small bar shows under the end of the selection, with the selected lines ("lines 3–5") and the buttons "Explain" and "Fix these lines" ([issue 901](https://github.com/heidrun-org/heidrun_code/issues/901)). The bar goes away when nothing is selected, and when the text scrolls.
- A button writes a prompt into the coding agent of the same tab: the path of the file inside the project, the lines, the selected code in a code block, and the request "Explain this code to me." or "Fix these lines (explain what was wrong).". Enter is not pressed, so the developer can change the prompt first. The pane of the coding agent becomes the selected pane.
- The coding agent is the coding agent of the tab that had the keyboard last, from the pane focus history, or else the first coding agent of the tab. When the tab has no coding agent, a toast says so, and nothing is written.

## Where the code is

- `fileViewEdits` and `FileViewEditState` in `stores/file_view_edit_state.ts` keep the text of each pane, by pane identifier, and ask before a pane closes. This file imports no session store, so that `stores/session.ts` uses it in `closePane`, `closeTab`, and `closeWorkspace`.
- `FileViewEdits` in `stores/file_view_edits.ts` reads, saves, and looks at the file, gives the watch identifiers, and asks before Heidrun Code quits.
- `FileViewAgentPrompt` in `stores/file_view_agent_prompt.ts` chooses the coding agent and writes the prompt.
- The Rust commands are `file_read`, `file_stat`, and `file_write` in `files.rs`, `file_watch_start` and `file_watch_stop` in `file_watch.rs`, and `set_unsaved` and `quit_now` in `lib.rs`.
- The tests are `FileView.test.ts`, `file_view_edit_state.test.ts`, `file_view_agent_prompt.test.ts`, `session_close_unsaved_file_view.test.ts`, `file_view_panes.test.ts`, and the Rust tests `writes_atomically_and_detects_changes`, `gives_the_real_path_to_watch_even_for_a_missing_file`, and the tests of `file_watch.rs`, which use the real watcher of macOS.
