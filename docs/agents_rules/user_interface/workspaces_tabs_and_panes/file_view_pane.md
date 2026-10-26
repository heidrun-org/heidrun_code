# User interface of Heidrun Code: file view pane

- Created: 21 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [Panes](panes.md), [Pane headers](pane_headers.md), [Files](../sidebars/files.md)
- Related issue: [issue 714](https://github.com/heidrun-org/heidrun/issues/714), [issue 784](https://github.com/heidrun-org/heidrun/issues/784)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../glossary/index.md). It gives the rules of the file view pane: a pane that shows one file, read only.

## File view pane

A file view pane shows one file in the place where a pane normally shows a terminal ([issue 714](https://github.com/heidrun-org/heidrun/issues/714)). The developer reads the file there and cannot change it. The first step has no editing, no save button, and no button that writes a file. The Files window still edits files.

## Opening a file

A click on a file in the File explorer sidebar section opens the file in a file view pane, and no longer in the Files window.

- When the selected pane is a terminal, running or idle, a new pane opens to the right of it, in the same tab, and shows the file. The terminal stays as it was. Heidrun Code never replaces, hides, or stops a terminal.
- When the selected pane is a file view pane, the file replaces the file of that pane. No new pane opens.
- When no pane is selected, or when Herdr fails, the Files window opens the file, and a toast shows the error of Herdr when there is one.
- The shortcut ⌘P and a file name in a terminal keep opening the Files window.
- The new pane becomes the selected pane.

## What the file view pane shows

- The pane has one line of controls, the header, and no second line under it ([issue 784](https://github.com/heidrun-org/heidrun/issues/784)). The header has the name of the file and the short path of the file, then the controls of the file, then the buttons "Pin the pane", "Split right", "Split down", Zen Mode, and "Close the pane". The title of the name is the absolute path of the file. A double click on the name does not start a rename, because the label of the pane holds the file. The header has no button for the composition bar and no macro menu, and the pane has no composition bar.
- The controls of the file are always visible, and they are in this order:
  - The button group "Preview" and "Raw" (only for a Markdown file). The title of "Preview" is "Preview: show the rendered text, with the front matter in a card", and the title of "Raw" is "Raw: show the file as it is". The Files window keeps the name "Code" for "Raw".
  - The switch "Wrap lines".
  - The menu button with three dots. It opens a dropdown menu with the entries "Search" (only while code or Raw is shown), "Copy path", "Show in Finder", and "Open in VS Code". The button opens the menu with a click, Enter, or Space. The arrow keys, Home, and End move between the entries, and the key Escape or the key Tab closes the menu. Escape gives the keyboard back to the button.
- When the header is narrow, the short path is shortened first, then the name. The controls of the file never shrink.
- The button group "Preview" and "Raw" saves its choice in the setting `filesMdRead`, and the switch "Wrap lines" saves its choice in the setting `codeWrap`. The Files window uses the same two settings. The texts of the controls are in the locale file `fileView.json`, except "Preview" and "Wrap lines", which are the texts of the Files window in `filesModal.json`.
- A code file is shown in the code editor, in read only mode. The key ⌘F opens the search panel of the editor in the same way as the button "Search". The editor never takes the keyboard from the pane when the file opens.
- A Markdown file is shown as rendered text in Preview, and a link of the text opens in the browser. An image is shown as a picture. A file that cannot be read shows the error in the place of the file.
- The entry "Copy path" copies the path inside the project, and the absolute path when the developer holds the key Option.
- The file is read when the pane opens, when the file of the pane changes, and when the developer changes the button group "Preview" and "Raw". The first step does not read the file again when the file changes on the disk.

## The front matter card

The front matter is the block at the start of a Markdown file, between two lines that each hold three dashes ([issue 784](https://github.com/heidrun-org/heidrun/issues/784)).

- In Preview, a Markdown file that starts with a front matter block shows the block in a card above the rendered text. The rest of the file is rendered as Markdown. The two lines of dashes are not shown, neither in the card nor as horizontal rules.
- The card shows the text of the block unchanged, in a monospace font, with the line breaks and the indentation of the file. A long line wraps. The corners and the background of the card are in [panes_appearance.md](../../web_styling/panes_appearance.md).
- Heidrun Code does not parse the block, so a block with an error still shows.
- A file with no block, with an empty block, or with a first line of dashes that has no closing line of dashes shows no card, and Heidrun Code renders the file as before.
- In Raw, the pane shows the whole file as it is, with no card.

## How Heidrun Code keeps the file view pane

A pane of Heidrun Code is a pane of Herdr, and Herdr sets the layout of the panes. The file view pane is therefore a Herdr pane with a terminal that only waits, and Heidrun Code draws the file over that terminal.

- Heidrun Code splits the selected pane to the right with the Herdr request `pane.split`, in the workspace folder.
- Heidrun Code gives the new pane the label `Heidrun file view: <absolute path of the file>` with the Herdr request `pane.rename`. The label marks the pane as a file view pane. Herdr keeps the label, so the file view pane comes back after a restart of Heidrun Code.
- Heidrun Code runs the command `echo 'Below the file view of Heidrun'; sleep 99999999` in the new pane with the command `herdr pane run`. The command prints a line for a person who looks at the pane in Herdr, and then waits for about three years, so nobody types a command into the hidden terminal. The command has no shell comment, because the shell zsh reads a comment in a typed line only when its option `interactivecomments` is on.
- A pane whose label is only a name, for example `build`, is a terminal. Every place that shows the name of a pane reads it with `paneName`, which gives the name of the file for a file view pane.
- Closing the file view pane closes the Herdr pane and ends the waiting command.

## Where the code is

- `FileViewLabel` in `lib/file_view_label.ts` writes and reads the label.
- `FileViewPanes` in `stores/file_view_panes.ts` opens a file in a file view pane.
- `FrontMatter` in `lib/front_matter.ts` splits the front matter block from the body of a Markdown file.
- `FileView.vue` is the body of the pane, and `PaneCard.vue` shows it in place of the terminal. `PaneCard.vue` gives the file view an element of its header, and `FileView.vue` teleports the controls of the file into that element. `FileViewMenu.vue` is the dropdown menu.
- `CodeEditor.vue` and `lib/editor.ts` have the read only option.
- The tests are `file_view_label.test.ts`, `file_view_panes.test.ts`, `front_matter.test.ts`, `FileView.test.ts`, `PaneCard.test.ts`, `PaneCardFileView.test.ts`, and `FilesPanel.test.ts`.

## Background

- The label, the split, the command, and the waiting terminal were tested with a real Herdr server in a separate session: the label kept spaces and a colon, and the command ran in the new pane. The test never used the session of Heidrun Code or of Heidrun Code Development.
- The decision to open a new pane next to a terminal, and never to replace a terminal, comes from the developer in [issue 714](https://github.com/heidrun-org/heidrun/issues/714).
