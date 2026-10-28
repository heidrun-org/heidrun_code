# Glossary of Heidrun Code: guards

- Created: 16 October 2026
- Last updated: 23 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md), [User interface of Heidrun Code: the Guards section of the Settings window](../user_interface/window/settings_guards.md), [Guards](../../architecture/guards.md)
- Related issue: [issue 589](https://github.com/heidrun-org/heidrun/issues/589), [issue 596](https://github.com/heidrun-org/heidrun/issues/596)

This document gives one short definition for each word of the guards. The other words of Heidrun Code are in [index.md](index.md).

### Guard

A check that Heidrun Code makes on a command before it types the command in a terminal. A guard that matches the command either asks the developer to confirm the command, or forbids it. A guard is a built-in guard or a project guard.

### Built-in guard

A guard that Heidrun Code has in its code. It always asks the developer to confirm, and never forbids. Each built-in guard has a key, for example `guards.why.gitClean`, and a reason, for example "git clean -f (untracked files deleted)". A project turns a built-in guard off with the list `disabled` of the key `guards` of the file `.heidrun/config.json`. A built-in guard cannot be changed. The Guards section shows the label "Hardcoded" on each built-in guard, and the guard window calls it a hardcoded guard.

### Project guard

A guard that a project adds, in the list `projectGuards` of the key `guards` of the file `.heidrun/config.json`. It has a name that no other guard of the project has, an optional description, an action, and one or more lines. A command matches the project guard when it matches at least one line.

### Action

What Heidrun Code does when a command matches a project guard. "Ask to confirm" opens the confirmation window, which has a button to run the command anyway. "Forbid" never sends the command, and the confirmation window has no button to run it. The file writes them as `confirm` and `block`.

### Line

One condition of a project guard: a type and a text. The type is "Contains", "Starts with", "Ends with", or "Regular expression". The first three compare the text with the command and ignore the case and the number of spaces. "Regular expression" is a regular expression of JavaScript that ignores the case.

### Guard window

The window that opens over the Settings window. It adds a project guard ("Add a guard"), changes one ("Edit the guard"), or shows a built-in guard that cannot be saved. It has the field "Try a command", which tells which line matches the command.

### Confirmation window

The window that Heidrun Code opens when a guard stops a command. It shows the command, the reason, the description of the project guard, and the buttons. For a command that a guard forbids, it has no button to run the command. The button "Change this guard" opens the Guards section of the Settings window.

### Guards section

The section "Guards" of the Settings window. One list shows the project guards first, then the built-in guards, in the same way. The developer adds, changes, and removes the project guards there, reads a built-in guard, and turns a built-in guard off for the project.

## Rules

- Write "guard", "built-in guard", "project guard", "action", "line", "guard window", "confirmation window", and "Guards section" in full. Do not write "rule", "filter", "safety check", "pattern", or "danger window" for them.
