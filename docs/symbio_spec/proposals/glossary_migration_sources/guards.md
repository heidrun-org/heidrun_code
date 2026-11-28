# Guards source material

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Transferred source material
- Related framing: [Glossary migration sources](README.md)
- Related issue: [issue 1135](https://github.com/heidrun-org/heidrun_code/issues/1135)

Original source `/docs/agents_rules/glossary/guards.md` in the [pinned revision](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db). The headings identify original line numbers. Proposed destinations and inventory notes describe the transfer. Approval of a product rule is recorded with the resulting specification.

### Source line 10

This document gives one short definition for each word of the guards. The other words of Heidrun Code are in [index.md](source_index.md).

### Source line 12

- Glossary entry: [Guard](../../glossary/guards.md#21-guard).
- Proposed destinations: Glossary, Behaviour.

#### Guard

A check that Heidrun Code makes on a command before it types the command in a terminal. A guard that matches the command either asks the developer to confirm the command, or forbids it. A guard is a built-in guard or a project guard.

### Source line 16

- Glossary entry: [Built-in guard](../../glossary/guards.md#22-built-in-guard).
- Proposed destinations: Glossary, Behaviour, User Interface, Technical documentation.
- Inventory notes: Check the scope of the label Hardcoded against the official term Built-in guard.

#### Built-in guard

A guard that Heidrun Code has in its code. It always asks the developer to confirm, and never forbids. Each built-in guard has a key, for example `guards.why.gitClean`, and a reason, for example "git clean -f (untracked files deleted)". A project turns a built-in guard off with the list `disabled` of the key `guards` of the file `.heidrun/config.json`. A built-in guard cannot be changed. The Guards section shows the label "Hardcoded" on each built-in guard, and the guard window calls it a hardcoded guard.

### Source line 20

- Glossary entry: [Project guard](../../glossary/guards.md#23-project-guard).
- Proposed destinations: Glossary, Behaviour, Technical documentation.

#### Project guard

A guard that a project adds, in the list `projectGuards` of the key `guards` of the file `.heidrun/config.json`. It has a name that no other guard of the project has, an optional description, an action, and one or more lines. A command matches the project guard when it matches at least one line.

### Source line 24

- Glossary entry: [Action](../../glossary/guards.md#11-guard-action).
- Proposed destinations: Glossary, Behaviour, User Interface, Technical documentation.
- Inventory notes: Action also names an input event in User activity. Keep the two meanings separate pending review.

#### Action

What Heidrun Code does when a command matches a project guard. "Ask to confirm" opens the confirmation window, which has a button to run the command anyway. "Forbid" never sends the command, and the confirmation window has no button to run it. The file writes them as `confirm` and `block`.

### Source line 28

- Glossary entry: [Line](../../glossary/guards.md#24-line).
- Proposed destinations: Glossary, Behaviour, Technical documentation.

#### Line

One condition of a project guard: a type and a text. The type is "Contains", "Starts with", "Ends with", or "Regular expression". The first three compare the text with the command and ignore the case and the number of spaces. "Regular expression" is a regular expression of JavaScript that ignores the case.

### Source line 32

- Glossary entry: [Guard window](../../glossary/guards.md#25-guard-window).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Guard window

The window that opens over the Settings window. It adds a project guard ("Add a guard"), changes one ("Edit the guard"), or shows a built-in guard that cannot be saved. It has the field "Try a command", which tells which line matches the command.

### Source line 36

- Glossary entry: [Confirmation window](../../glossary/guards.md#26-confirmation-window).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Confirmation window

The window that Heidrun Code opens when a guard stops a command. It shows the command, the reason, the description of the project guard, and the buttons. For a command that a guard forbids, it has no button to run the command. The button "Change this guard" opens the Guards section of the Settings window.

### Source line 40

- Glossary entry: [Guards section](../../glossary/guards.md#27-guards-section).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Guards section

The section "Guards" of the Settings window. One list shows the project guards first, then the built-in guards, in the same way. The developer adds, changes, and removes the project guards there, reads a built-in guard, and turns a built-in guard off for the project.

### Source line 44

#### Rules

### Source line 46

- Proposed destinations: Glossary.
- Inventory notes: Reconcile the scope of Action with User activity and the terminology rule in Sidebars.

- Write "guard", "built-in guard", "project guard", "action", "line", "guard window", "confirmation window", and "Guards section" in full. Do not write "rule", "filter", "safety check", "pattern", or "danger window" for them.
