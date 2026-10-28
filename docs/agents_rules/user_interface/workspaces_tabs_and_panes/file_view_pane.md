# User interface of Heidrun Code: file view pane

- Created: 21 October 2026
- Last updated: 27 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [Panes](panes.md), [Pane headers](pane_headers.md), [Files](../sidebars/files.md), [File view pane editing](file_view_pane_editing.md), [Search in files](../sidebars/file_search.md), [Opening a file view pane](file_view_pane_opening.md), [HTML preview](file_view_pane_html_preview.md)
- Related issue: [issue 714](https://github.com/heidrun-org/heidrun/issues/714), [issue 784](https://github.com/heidrun-org/heidrun/issues/784), [issue 886](https://github.com/heidrun-org/heidrun_code/issues/886), [issue 897](https://github.com/heidrun-org/heidrun_code/issues/897), [issue 898](https://github.com/heidrun-org/heidrun_code/issues/898), [issue 925](https://github.com/heidrun-org/heidrun_code/issues/925), [issue 928](https://github.com/heidrun-org/heidrun_code/issues/928)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../glossary/index.md). It gives the rules of the file view pane: a pane that shows one file. The editing of the file and the actions on the selected lines are in [file_view_pane_editing.md](file_view_pane_editing.md).

## File view pane

A file view pane shows one file in the place where a pane normally shows a terminal ([issue 714](https://github.com/heidrun-org/heidrun/issues/714)). The developer reads the file there and changes it there. Heidrun Code has no other place that shows or edits a file: the Files window is gone ([issue 886](https://github.com/heidrun-org/heidrun_code/issues/886)).

## Opening a file

The actions that open a file in a file view pane, the line of a file name, the box of ⌘P, and the place of the new pane are in [file_view_pane_opening.md](file_view_pane_opening.md).

## What the file view pane shows

- The pane has one line of controls, the header, and no second line under it ([issue 784](https://github.com/heidrun-org/heidrun/issues/784)). The header has the name of the file and the short path of the file, then the controls of the file, then the buttons "Pin the pane", "Split right", "Split down", Zen Mode, and "Close the pane". The title of the name is the absolute path of the file. A double click on the name does not start a rename, because the label of the pane holds the file. The header has no button for the composition bar and no macro menu, and the pane has no composition bar.
- The controls of the file are always visible, and they are in this order:
  - The button "Save", only while the file has unsaved changes ([file_view_pane_editing.md](file_view_pane_editing.md)).
  - The button group "Preview" and "Raw" (only for a Markdown file and an HTML file). The title of "Preview" is "Preview: show the rendered text, with the front matter in a card", and the title of "Raw" is "Raw: show the file as it is".
  - The menu button with three vertical dots. It opens a dropdown menu with the entries "Search" (only while code or Raw is shown), "Copy path", "Show in Finder", and "Open in VS Code", then a divider, then the switches "Wrap lines" and "Wrap at 80 columns" (only for a Markdown file) ([issue 897](https://github.com/heidrun-org/heidrun_code/issues/897)). A click on a switch changes its setting and leaves the menu open. The button opens the menu with a click, Enter, or Space. The arrow keys, Home, and End move between the entries and the switches, and the key Escape or the key Tab closes the menu. Escape gives the keyboard back to the button.
- When the header is narrow, the short path is shortened first, then the name. The controls of the file never shrink.
- The button group "Preview" and "Raw" saves its choice in the setting `filesMdRead`, the switch "Wrap lines" saves its choice in the setting `codeWrap`, and the switch "Wrap at 80 columns" saves its choice in the setting `markdownWrapAt80Columns`. The texts of the controls are in the locale file `fileView.json`.
- A code file, and a Markdown file in Raw, is shown in the code editor, where the developer can change it. The key ⌘F opens the search panel of the editor in the same way as the button "Search". The editor never takes the keyboard from the pane when the file opens.
- A Markdown file is shown as rendered text in Preview, on the background of a pane (`--bg`), not of the code theme. A web link opens in the browser, and a link that is only an anchor shows its heading. A link to a file opens the file in the same pane, as in a browser, or in a new pane to its right when the pane has unsaved changes: a relative path starts at the folder of the Markdown file, a path that starts with `/` starts at the root of the project, an anchor shows the heading that has this anchor on GitHub, and `#L42` shows line 42. Any other link opens nothing ([issue 928](https://github.com/heidrun-org/heidrun_code/issues/928)). The rendered text uses the whole width of the pane. When the switch "Wrap at 80 columns" is on, the rendered text stays in a column of about 80 characters, in the middle of the pane. The rendered skill file of the window of a skill follows the same setting ([issue 897](https://github.com/heidrun-org/heidrun_code/issues/897)). An image is shown as a picture. A file that cannot be read shows the error in the place of the file.
- The entry "Copy path" copies the path inside the project, and the absolute path when the developer holds the key Option.
- The file is read when the pane opens, when the file of the pane changes, and when the developer changes the button group "Preview" and "Raw". The pane shows the new content when the file changes on the disk, as [file_view_pane_editing.md](file_view_pane_editing.md) says.

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
- `FileViewPanes` in `stores/file_view_panes.ts` opens a file in a file view pane, and keeps the line to show in `fileViewLineRequests`, with `ViewPanes` in `stores/view_panes.ts`, which the diff pane also uses ([diff_pane.md](diff_pane.md)).
- `MarkdownLinks` in `lib/markdown_links.ts` finds the target of a link and the heading of an anchor, and `fileViewAnchorRequests` keeps the anchor to show.
- `FrontMatter` in `lib/front_matter.ts` splits the front matter block from the body of a Markdown file.
- `FileView.vue` is the body of the pane, and `PaneCard.vue` shows it in place of the terminal. `PaneCard.vue` gives the file view an element of its header, and `FileView.vue` teleports the controls of the file into that element. `FileViewMenu.vue` is the dropdown menu.
- `CodeEditor.vue` and `lib/editor.ts` have the read only option, the option that keeps the keyboard in its place, and the event of the selected lines.
- The tests are `file_view_label.test.ts`, `file_view_panes.test.ts`, `front_matter.test.ts`, `markdown_links.test.ts`, `FileView.test.ts`, `PaneCard.test.ts`, `PaneCardFileView.test.ts`, and `FilesPanel.test.ts`.

## Background

- The label, the split, the command, and the waiting terminal were tested with a real Herdr server in a separate session: the label kept spaces and a colon, and the command ran in the new pane. The test never used the session of Heidrun Code or of Heidrun Code Development.
- The decision to open a new pane next to a terminal, and never to replace a terminal, comes from the developer in [issue 714](https://github.com/heidrun-org/heidrun/issues/714).
