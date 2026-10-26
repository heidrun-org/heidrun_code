# User interface of Heidrun Code: diff pane

- Created: 26 October 2026
- Last updated: 26 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [File view pane](file_view_pane.md), [Pane headers](pane_headers.md), [Source control](../sidebars/source_control.md)
- Related issue: [issue 885](https://github.com/heidrun-org/heidrun_code/issues/885)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../glossary/index.md). It gives the rules of the diff pane: a pane that shows the changes of one file, read only.

## Diff pane

A diff pane shows the changes of one file, compared to the last commit (HEAD), in the place where a pane normally shows a terminal ([issue 885](https://github.com/heidrun-org/heidrun_code/issues/885)). The developer reads the changes there and cannot change them. The first step has no editing and no Git action. The diff pane is the first step to replace the large Git window, which covers the application.

## Opening a diff pane

A click on a file line of the Source control sidebar section opens the changes of the file in a diff pane, and no longer in the large Git window.

- When the selected pane is a terminal, running or idle, or a file view pane, a new pane opens to the right of it, in the same tab, and shows the changes. The selected pane stays as it was. Heidrun Code never replaces, hides, or stops a terminal.
- When the selected pane is a diff pane, the file replaces the file of that pane. No new pane opens.
- When no pane is selected, or when Herdr fails, the large Git window opens on the file, and a toast shows the error of Herdr when there is one.
- The new pane becomes the selected pane.
- The entry of the large Git window in the menu "More actions", and the buttons "View the changes" of the group headers, keep opening the large Git window.

## What the diff pane shows

- The pane has one line of controls, the header. The header has the name of the file and the short path of the file, then the controls of the diff, then the buttons "Pin the pane", "Split right", "Split down", Zen Mode, and "Close the pane". The title of the name is the absolute path of the file. A double click on the name does not start a rename. The header has no button for the composition bar and no macro menu, and the pane has no composition bar.
- The controls of the diff are always visible, and they are in this order:
  - The circled question mark. A click opens the information card "About these changes", below it, with the path of the file inside the Git repository, its status in the group "Staged Changes" and in the group "Changes" (for example "Modified", or "No" when the group does not hold the file), the number of added lines, the number of removed lines, the last commit that the diff compares with (its short identifier and its subject, or "No commit yet"), and the date of that commit. The card opens with a click, never with the pointer only over it, with `InformationCard.vue`.
  - The button group "Diff" and "Side by side". It saves its choice in the setting `diffMode`, which the large Git window also uses. When the large Git window left the setting on "File" or "Preview", the diff pane shows "Diff".
  - The switch "Wrap lines", which saves its choice in the setting `codeWrap`.
  - The menu button with three dots, the same menu as the file view pane. Its entries are "Refresh", "Open the file", "Copy path", "Show in Finder", and "Open in VS Code", with no entry "Search". "Refresh" reads the diff again, and the Git status of the workspace of the pane. "Open the file" opens the file in a file view pane, so that a file has one way to be read in a pane. A deleted file has no entry "Open the file".
- The header shows no numbers of added and removed lines, which are in the information card, and "Refresh" and "Open the file" are in the menu, so that the name of the file has room in a pane of half the window.
- The diff pane has no file list, no filter, no button "File", no button "Preview", and no list of open pull requests. The developer opens another file from the Source control sidebar section.
- The diff pane reads the diff when the pane opens, when the file of the pane changes, and when the Git status of the workspace is read for the first time. The poll of the Git status does not read the diff again, so that the diff does not flash. The button "Refresh" reads it again.
- A diff with no text change (a committed file, a binary file, or a rename) shows a message in the place of the diff. A workspace that is not a Git repository, or a file outside the Git repository of the workspace, shows an error.
- The pane shows at most 6000 lines, as the large Git window.
- The texts of the pane are in the locale file `diffPane.json`, except the texts that the large Git window also shows, which stay in `gitModal.json`.

## How Heidrun Code keeps the diff pane

The diff pane is a Herdr pane with a terminal that only waits, as the file view pane ([file_view_pane.md](file_view_pane.md), section "How Heidrun Code keeps the file view pane").

- The label of the pane is `Heidrun diff: <absolute path of the file>`. The label marks the pane as a diff pane, and Herdr keeps it, so the diff pane comes back after a restart of Heidrun Code.
- The waiting command is `echo 'Below the diff pane of Heidrun'; sleep 99999999`.
- The diff pane finds the Git repository in the Git status of the workspace of the pane, and gives the path inside it to the backend command `git_diff`.

## Where the code is

- `DiffPaneLabel` in `lib/diff_pane_label.ts` writes and reads the label.
- `DiffPanes` in `stores/diff_panes.ts` opens a file in a diff pane. `ViewPanes` in `stores/view_panes.ts` splits, labels, and starts the waiting terminal for the diff pane and for the file view pane.
- `DiffPane.vue` is the body of the pane, and `PaneCard.vue` shows it in place of the terminal. `DiffPane.vue` teleports the controls of the diff into the header, as `FileView.vue` does, and gives its first entries to the slot of `FileViewMenu.vue`.
- `DiffPaneInformationCard.vue` is the circled question mark and its information card.
- `DiffLines.vue` draws the lines of a diff, unified or side by side, for the diff pane and for the large Git window.
- The tests are `diff_pane_label.test.ts`, `diff_panes.test.ts`, `DiffPane.test.ts`, `PaneCardDiffPane.test.ts`, and `SourceControlPanel.test.ts`.

## Background

- The decisions of the first step (a new pane next to a terminal, a diff pane that replaces only a diff pane, the controls that the pane keeps, and the file opened through the file view pane) follow the questions of [issue 885](https://github.com/heidrun-org/heidrun_code/issues/885) and the rules of the file view pane of [issue 714](https://github.com/heidrun-org/heidrun/issues/714).
