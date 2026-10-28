# Glossary of Heidrun Code: macros

- Created: 16 October 2026
- Last updated: 23 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md)
- Related issue: [issue 602](https://github.com/heidrun-org/heidrun/issues/602), [issue 649](https://github.com/heidrun-org/heidrun/issues/649), [issue 836](https://github.com/heidrun-org/heidrun_code/issues/836), [issue 756](https://github.com/heidrun-org/heidrun/issues/756), [issue 796](https://github.com/heidrun-org/heidrun/issues/796)

This document gives one short definition for each word of the macros, and of the command line that controls them. The other words of Heidrun Code are in [index.md](index.md).

## The macros

### Macro

A reusable text that the developer writes into a pane with one click. A macro has an id, a title, a description, and a text. There are three kinds of macro: the hard-coded macro, the personal macro, and the project macro.

### Hard-coded macro

A macro that is written in the source code of Heidrun Code, in `packages/auxiliary/heidrun_code_ctrl/src/hard_coded_macros.rs`. The window and the command line `heidrun_code_ctrl` list it, and nothing can add, change, or delete it.

### Personal macro

A macro that the developer made, and that is kept for this computer, for every project, in the personal macro file.

### Personal macro file

The file `macros.json` in the folder of the variable `HEIDRUN_CODE_DIR`, or else in `~/.config/heidrun_code`. It is a JSON list of macros. The window and the command line `heidrun_code_ctrl` both read and write it.

### Project macro

A macro that the developer made, and that is kept in the key `prompts` of the file `.heidrun/config.json` of a project. The file is shared with the other developers of the project, and the key keeps the old name of the feature.

## The command line

### heidrun_code_ctrl

The command line that controls the Heidrun Code application, for a coding agent. Its `SKILL.md` teaches a coding agent the commands. The groups `macros`, `launchers`, and `voice_words` each have list, add, update, and delete and change watched files. The group `voice_words` changes the word replacement list of the voice input, which is not a macro. The group `workspaces` has list, open, rename, focus, and close and talks to the running Herdr through its executable. A running Heidrun Code shows these changes in its window.

## Rules

- Write "hard-coded macro", "personal macro", and "project macro". Do not write "default macro", "built-in macro", or "user macro".
- Write `heidrun_code_ctrl` in full. Do not write a shorter name for it.
- The word "macro" means only a text that is written into a pane. A launcher is not a macro.

- The macro menu keeps one row per macro, with Edit and Delete buttons only for personal macros and project macros. These buttons never insert text into a pane. Delete asks for confirmation and cancelling preserves the macro.
- The macro menu is 420 pixels wide, or the width of the window minus 16 pixels when the window is narrower. The Edit and Delete buttons are small icon buttons with no border. They sit at the right end of the first line of the row, on the same line as the title of the macro, and the description stays on the line under the title. The title keeps free space on its right, so a long title wraps before the buttons and never goes under them.
- Create at the bottom of the macro menu opens a blank form. Edit opens the selected macro with its title, description, and text filled in. Save writes the macro and closes the window. Selection and deletion belong in the menu, not in the editor.
- Clicking a macro inserts its text; Shift+click also presses Enter.
