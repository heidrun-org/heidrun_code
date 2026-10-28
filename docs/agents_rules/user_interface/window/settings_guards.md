# User interface of Heidrun Code: the Guards section of the Settings window

- Created: 16 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [Glossary of Heidrun Code: guards](../../glossary/guards.md), [Guards](../../../architecture/guards.md)
- Related issue: [issue 589](https://github.com/heidrun-org/heidrun/issues/589), [issue 596](https://github.com/heidrun-org/heidrun/issues/596), [issue 608](https://github.com/heidrun-org/heidrun/issues/608)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/guards.md](../../glossary/guards.md). The built-in guards, the key `guards` of the file `.heidrun/config.json`, and the order of the checks are in [guards.md](../../../architecture/guards.md).

## The Guards section

- The Settings window has a section "Guards" with the Bootstrap icon `shield-exclamation`, just after the section "Confirmations". It is the component `SettingsGuardsSection.vue`. Like every section, it writes no style rule of its own: every control is a Bootstrap component or a Bootstrap utility class.
- The section shows the guards of the project of the selected workspace, and a line with the root folder of that project. A guard is never changed for all projects at once. When no workspace is selected, or when the project is not read yet, the section shows only the sentence "No project is open".
- The section reads the file `.heidrun/config.json` again each time it opens, because the developer may have changed the file by hand.
- When the file is not valid, the section shows the error, and every button that changes the file and every switch is disabled. A change would write a file that Heidrun Code cannot read.
- One Bootstrap list group shows every guard in the same way: the project guards first, in the order of the file, then the built-in guards, in the order of the table of [guards.md](../../../architecture/guards.md). A row has the name in a medium weight, a badge with the action ("Ask to confirm" in the theme `theme-warning`, "Forbid" in the theme `theme-danger`), the description with each part between two backquotes in a monospace font, and one line of text for each line of the guard: the type, then the text in a monospace font. A built-in guard has the same row, with one more badge, "Hardcoded" in the theme `theme-secondary`, and its line is its regular expression (`re.source`). The test `lib/guards_document.test.ts` fails when the description of a built-in guard (key `guards.what.*`) and the third column of the table differ.
- The Guards section follows [settings_information_cards.md](settings_information_cards.md). The line of the project has a circled question mark with an information card about the project guards, and each built-in guard has one, just before its button with an eye, with an information card about the built-in guards.
- A project guard has a button to edit it and a button to remove it. A built-in guard has a button to read it, and a Bootstrap switch. A switch that is on means that the guard is active. A switch that is off adds the key of the guard to the list `disabled`, and the row is dimmed. A built-in guard has no button to edit and no button to remove.
- When the project has no guard of its own, the section shows the plain sentence "This project has no guard of its own yet." The sentence never looks like a field.
- The button "Add a guard" is on the line of the project. It opens the guard window.
- Each change writes the file `.heidrun/config.json` at once, with the Tauri command `project_save`, and makes the next command read the guards again, without the delay of one minute. When the write fails, a toast shows the error, the project goes back to its old guards, and the switch goes back to its old state.
- The first change from the section moves the old lists `confirm` and `block` to the key `projectGuards`. Heidrun Code writes no empty list, and no empty key `guards`. The lists are written in the order `projectGuards`, `disabled`.

## The guard window

- The component is `GuardModal.vue`, and its state is `stores/guard_window.ts`. It is a Bootstrap `dialog` over the Settings window, and the key Escape closes only the guard window.
- Every input has a visible label, or a label for the screen reader when its place makes its meaning clear (the type and the text of a line). The window never shows an input that the developer has to guess.
- The fields, from the top: "Name", "Description", the action as two Bootstrap radio buttons ("Ask to confirm", "Forbid"), each with one line of help, the lines, and "Try a command".
- A line has a select of the type ("Contains", "Starts with", "Ends with", "Regular expression"), a text input, and a button to remove the line. The window keeps at least one line. The button "Add a line" adds a line of the type "Contains". A check mark shows on each line that matches the command of the field "Try a command".
- Heidrun Code refuses the name when it is empty, or when another guard of the project has it (the case and the spaces around do not count), and refuses an empty line. These errors show after the first press of "Save guard". An error under a line of the type "Regular expression" that cannot be read shows at once, with the text of the error.
- "Save guard" writes the file and closes the window. When the write fails, the window stays open.
- A built-in guard opens in the same window with the title "Hardcoded guard". Every field is read only, the line is its regular expression, the window has a note that it cannot be changed, and the only buttons are "Close" and the field "Try a command", which works. "Try a command" uses the flags of the regular expression of the guard, so the case counts only when the guard has no flag `i`.

## The button "Change this guard"

- The confirmation window has the button "Change this guard" on the left of its row of buttons, when one guard stopped the command. A click cancels the command, closes the window, and opens the Guards section. The window also shows the description of the project guard under the reason.
- The row of the guard that stopped the command has the Bootstrap theme `theme-warning`, and the list scrolls to the row. The highlight is cleared when the section closes.
- The button is absent when the file `.heidrun/config.json` is not valid, because then no single guard stopped the command.

## Tests

- `lib/guards_edit.test.ts`: the check of a draft, and the changes of the key `guards`.
- `lib/guards.test.ts`: the types of line, "Try a command", the old lists, the built-in guard that is turned off, and the guard that stops a command.
- `lib/project_config.test.ts`: the schema of the key `guards`.
- `components/settings/SettingsGuardsSection.test.ts`: the list, with the file `.heidrun/config.json` in memory.
- `components/GuardModal.test.ts`: the three modes of the guard window, its errors, and "Try a command".
- `components/DangerModal.test.ts`: the button "Change this guard" and the description.
- `lib/guards_document.test.ts`: the document of the guards lists every built-in guard.
