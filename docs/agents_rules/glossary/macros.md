# Glossary of Heidrun Code: macros

- Created: 16 October 2026
- Last updated: 8 November 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md)
- Related issue: [issue 602](https://github.com/heidrun-org/heidrun/issues/602), [issue 649](https://github.com/heidrun-org/heidrun/issues/649), [issue 836](https://github.com/heidrun-org/heidrun_code/issues/836), [issue 756](https://github.com/heidrun-org/heidrun/issues/756), [issue 796](https://github.com/heidrun-org/heidrun/issues/796), [issue 1029](https://github.com/heidrun-org/heidrun_code/issues/1029)

This document gives one short definition for each word of the macros, and of the command line that controls them. The other words of Heidrun Code are in [index.md](index.md).

## The macros

### Macro

A reusable text that the developer writes into a pane with one click. A macro has an id, a title, a description, and content. A macro can be kept at the user level or the project level.

### User macro

A macro that the developer made, and that is kept for this computer, for every project, in the user macro file.

### User macro file

The file `macros.json` in the folder of the variable `HEIDRUN_CODE_DIR`, or else in `~/.config/heidrun_code`. It is a JSON list of macros. The window and the command line `heidrun_code_ctrl` both read and write it.

### Project macro

A macro that the developer made, and that is kept in the key `prompts` of the file `.heidrun/config.json` of a project. The file is shared with the other developers of the project, and the key keeps the old name of the feature.

## The command line

### heidrun_code_ctrl

The command line that controls the Heidrun Code application, for a coding agent. Its `SKILL.md` teaches a coding agent the commands. The groups `macros`, `launchers`, and `voice_words` each have list, add, update, and delete and change watched files. The group `voice_words` changes the word replacement list of the voice input, which is not a macro. The group `workspaces` has list, open, rename, focus, and close and talks to the running Herdr through its executable. A running Heidrun Code shows these changes in its window.

## Rules

- Write "user macro" and "project macro". The internal identifier `personal` remains for the existing user macro files and command-line options.
- Write `heidrun_code_ctrl` in full. Do not write a shorter name for it.
- The word "macro" means only a text that is written into a pane. A launcher is not a macro.

- The macro menu keeps one row per macro, with View, Edit, and Delete buttons for user macros and project macros. View shows the title as text, and the full Markdown description and content in rendered cards, with no input fields or saving controls. These buttons never insert text into a pane. Delete asks for confirmation and cancelling preserves the macro.
- The macro menu is 420 pixels wide, or the width of the window minus 16 pixels when the window is narrower. The View, Edit, and Delete buttons are small icon buttons with no border. They sit at the right end of the first line of the row, on the same line as the title of the macro, and the description stays on the line under the title. The title keeps free space on its right, so a long title wraps before the buttons and never goes under them.
- Create at the bottom of the macro menu opens a blank form. Edit opens the selected macro with its title, description, and text filled in. Save writes the macro and closes the window. Selection and deletion belong in the menu, not in the editor.
- Clicking a macro inserts its text; Shift+click also presses Enter.

- A macro description supports multiple lines and Markdown. Create and Edit show the original Markdown in a multiline Description field. Saving preserves the description, and the macro menu shows only the first description line as raw plain text under the title, without interpreting Markdown or HTML. The macro field is labelled Content in Create and Edit.

- Create and Edit show a Location radio button group between Description and Content. The choices are User and Project. View displays the macro's current location in the same place. Edit can move a macro between the two locations while preserving its id and content.

- The group headings are “Project macro” and “User macro”. Each nonempty group has its heading, including when only one group exists.
