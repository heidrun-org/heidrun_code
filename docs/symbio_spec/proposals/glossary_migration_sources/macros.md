# Macros source material

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Transferred source material
- Related framing: [Glossary migration sources](README.md)
- Related issue: [issue 1135](https://github.com/heidrun-org/heidrun_code/issues/1135)

Original source `/docs/agents_rules/glossary/macros.md` in the [pinned revision](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db). The headings identify original line numbers. Proposed destinations and inventory notes describe the transfer. Approval of a product rule is recorded with the resulting specification.

### Source line 10

This document gives one short definition for each word of the macros, and of the command line that controls them. The other words of Heidrun Code are in [index.md](source_index.md).

### Source line 12

#### The macros

### Source line 14

- Glossary entry: [Macro](../../glossary/macros.md#11-macro).
- Proposed destinations: Glossary · Reusable text and user and project relationships, Behaviour.

#### Macro

A reusable text that the developer writes into a pane with one click. A macro has an id, a title, a description, and content. A macro can be kept at the user level or the project level.

### Source line 18

- Glossary entry: [User macro](../../glossary/macros.md#12-user-macro).
- Proposed destinations: Glossary · User macro scope, Technical documentation.

#### User macro

A macro that the developer made, and that is kept for this computer, for every project, in the user macro file.

### Source line 22

- This passage is preserved as repository or technical terminology.
- Proposed destinations: Technical documentation · User macro file, paths, format and readers and writers.

#### User macro file

The file `macros.json` in the folder of the variable `HEIDRUN_CODE_DIR`, or else in `~/.config/heidrun_code`. It is a JSON list of macros. The window and the command line `heidrun_code_ctrl` both read and write it.

### Source line 26

- Glossary entry: [Project macro](../../glossary/macros.md#13-project-macro).
- Proposed destinations: Glossary · Project macro scope and sharing, Technical documentation.

#### Project macro

A macro that the developer made, and that is kept in the key `prompts` of the file `.heidrun/config.json` of a project. The file is shared with the other developers of the project, and the key keeps the old name of the feature.

### Source line 30

#### The command line

### Source line 32

- Glossary entry: [heidrun_code_ctrl](../../glossary/macros.md#21-heidrun_code_ctrl).
- Proposed destinations: Glossary · Purpose of heidrun_code_ctrl, System Overview, Technical documentation.

#### heidrun_code_ctrl

The command line that controls the Heidrun Code application, for a coding agent. Its `SKILL.md` teaches a coding agent the commands. The groups `macros`, `launchers`, and `voice_words` each have list, add, update, and delete and change watched files. The group `voice_words` changes the word replacement list of the voice input, which is not a macro. The group `workspaces` has list, open, rename, focus, and close and talks to the running Herdr through its executable. A running Heidrun Code shows these changes in its window.

### Source line 36

#### Rules

### Source line 38

- Proposed destinations: Glossary, Technical documentation.

- Write "user macro" and "project macro". The internal identifier `personal` remains for the existing user macro files and command-line options.

### Source line 39

- Proposed destinations: Glossary.

- Write `heidrun_code_ctrl` in full. Do not write a shorter name for it.

### Source line 40

- Proposed destinations: Glossary.

- The word "macro" means only a text that is written into a pane. A launcher is not a macro.

### Source line 42

- Proposed destinations: User Interface, Behaviour.

- The macro menu keeps one row per macro, with View, Edit, and Delete buttons for user macros and project macros. View shows the title as text, and the full Markdown description and content in rendered cards, with no input fields or saving controls. These buttons never insert text into a pane. Delete asks for confirmation and cancelling preserves the macro.

### Source line 43

- Proposed destinations: User Interface, Styling.

- The macro menu is 420 pixels wide, or the width of the window minus 16 pixels when the window is narrower. The View, Edit, and Delete buttons are small icon buttons with no border. They sit at the right end of the first line of the row, on the same line as the title of the macro, and the description stays on the line under the title. The title keeps free space on its right, so a long title wraps before the buttons and never goes under them.

### Source line 44

- Proposed destinations: User Interface, Behaviour.

- Create at the bottom of the macro menu opens a blank form. Edit opens the selected macro with its title, description, and text filled in. Save writes the macro and closes the window. Selection and deletion belong in the menu, not in the editor.

### Source line 45

- Proposed destinations: Behaviour.
- Inventory notes: Implementation and test references support checking this passage. Record approval separately.

- Clicking a macro inserts its text; Shift+click also presses Enter.

### Source line 47

- Proposed destinations: User Interface, Behaviour.

- A macro description supports multiple lines and Markdown. Create and Edit show the original Markdown in a multiline Description field. Saving preserves the description, and the macro menu shows only the first description line as raw plain text under the title, without interpreting Markdown or HTML. The macro field is labelled Content in Create and Edit.

### Source line 49

- Proposed destinations: User Interface, Behaviour.

- Create and Edit show a Location radio button group between Description and Content. The choices are User and Project. View displays the macro's current location in the same place. Edit can move a macro between the two locations while preserving its id and content.

### Source line 51

- Proposed destinations: User Interface, Behaviour.

- The group headings are “Project macro” and “User macro”. Each nonempty group has its heading, including when only one group exists.
