# Glossary of Heidrun Code: terminal text detection

- Created: 22 October 2026
- Last updated: 23 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md), [User interface of Heidrun Code: the detection in the text of the terminals](../user_interface/window/terminal_text_detection.md), [User interface of Heidrun Code: the text detection in the Settings window](../user_interface/window/settings_text_detection.md)
- Related issue: [issue 793](https://github.com/heidrun-org/heidrun/issues/793), [issue 638](https://github.com/heidrun-org/heidrun/issues/638)

This document gives one short definition for each word of the detection in the text of the terminals. The other words of Heidrun Code are in [index.md](index.md).

## Words

### Text detection

The part of Heidrun Code that reads the text of a terminal and finds things that Heidrun Code can act on: web addresses, references to issues, requests, tickets, and commits, file paths, and the suggestions of a coding agent. It never changes, hides, or blocks the text of the terminal.

### Detection family

A group of rules that find one sort of thing, with one switch in the Text detection section of the Settings window. There are 11: web addresses, issues, pull requests and merge requests, tickets, commits, file paths, shell commands, slash commands, numbered steps, the agent list and input box, and questions and numbered choices. The list is `DETECTION_FAMILY_IDS` in the file `lib/detection_families.ts`.

### Rule of the text detection

One test that finds one form of text, for example "number sign and number" for `#12`, or "address without its host" for `/issues/12`. Each rule belongs to one detection family.

### Precedence

The fixed order of the rules. When two rules find the same text, the first rule keeps it. The switches never change the precedence: a family that is off still keeps its text, and only loses its colors, hover buttons, and actions.

### Hover buttons

The small buttons that appear near a piece of text when the pointer is over it, for example "Open" and "Preview" for an issue, or "Run" for a shell command. They go only over blank cells of the terminal, so they never cover a character. A ⌘-click on the text runs the main action without the buttons.

### Rule catalog

The list of the rules of every detection family, with the real regular expressions that each rule runs, the examples that it finds, and the examples that it refuses. It is `DetectionCatalog` in the file `lib/detection_catalog.ts`. The Text detection section of the Settings window shows it, and a test runs every example through the real detection.

### Try a text field

The field of the Text detection section of the Settings window where the developer types or pastes a text and sees what the text detection finds in it: the family, the rule, the place, the destination, the hover buttons, and the rule that took the text when two rules found it. It runs no action.
