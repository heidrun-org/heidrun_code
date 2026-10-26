# User interface of Heidrun Code: the detection in the text of the terminals

- Created: 22 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: terminal text detection](../../glossary/terminal_text_detection.md), [The references](terminal_text_detection_references.md), [The other families](terminal_text_detection_other_families.md), [Settings window: text detection](settings_text_detection.md)
- Related issue: [issue 793](https://github.com/heidrun-org/heidrun/issues/793), [issue 638](https://github.com/heidrun-org/heidrun/issues/638), [issue 574](https://github.com/heidrun-org/heidrun/issues/574)

This file is a part of the rules of the user interface of Heidrun Code. It gives the rules of the detection in the text of the terminals: the list of the detection families, the precedence, the hover buttons, and the switches. The words are defined in [terminal_text_detection.md](../../glossary/terminal_text_detection.md).

## The rule

- Heidrun Code reads the text of a terminal and offers actions on some of it. The detection never changes, hides, or blocks the text of the terminal. The stream of the terminal is never changed: the colors are decorations on top of the cells.
- What the detection finds is decided in one place, the list `DETECTION_FAMILY_IDS` in `lib/detection_families.ts`. A new sort of detection is a new detection family in that list. It gets a switch, a card in the section Text detection of the Settings window, an information card, and a table in this folder in the same change.
- Every regular expression is a constant of `DetectionPatterns` in `lib/detection_patterns.ts`, and every rule is an entry of `DetectionCatalog` in `lib/detection_catalog.ts` with examples that a test runs through the real detection. The Settings window shows both, as [settings_text_detection.md](settings_text_detection.md) says.
- Every detection family has a switch. A switch of the whole detection turns every family off. The switches apply at once to the text that is already on the screen: the colors, the hover buttons, and the actions follow.

## The detection families

The order is the order of the Settings window. The forms and the examples are in [terminal_text_detection_references.md](terminal_text_detection_references.md) and [terminal_text_detection_other_families.md](terminal_text_detection_other_families.md).

| Family | Identifier | Needs |
| --- | --- | --- |
| Web addresses | `webAddresses` | Nothing. |
| Issues | `issueReferences` | A Git remote, for the destination. |
| Pull requests and merge requests | `requestReferences` | A Git remote, for the destination. |
| Tickets | `tickets` | A ticket address in `.heidrun/config.json`. |
| Commits | `commits` | A Git remote, for the destination. |
| File paths | `filePaths` | Nothing. |
| Shell commands | `shellCommands` | A pane that runs a coding agent (Claude Code or Codex), also for the block of several lines. |
| Slash commands | `slashCommands` | A pane that runs Claude Code. |
| Numbered steps | `numberedSteps` | A pane that runs a coding agent. |
| Agent list and input box | `agentList` | A pane that runs Claude Code. |
| Questions and numbered choices | `questionsAndChoices` | A coding agent. |

## The precedence

- The code is `TerminalDetection.detectLine` in `lib/terminal_detection.ts`. The terminal and the sample field call the same function, so the sample shows what a terminal does.
- The rules that claim the whole line come first: for Claude Code, the input box when a row of the agent list has the selection, then a row of the agent list; for every coding agent, the block of a shell command, which needs a space after the `!` (`!34` is a merge request). A winner takes every other piece of its line.
- Then a shell command inside a sentence, the references, the file paths, the slash commands, and the numbered step. The first rule that finds a piece of text keeps it. Inside the references the order is: the address with its host, the address without its host, the words and a number ("PR #12"), another repository ("group/app#12"), "!34", "#12", the tickets, the commit identifiers.
- The numbered step does not take a piece. Its hover area stops before the first other piece that starts after the marker, and the step has no hover buttons when another piece covers the marker.
- The precedence does not depend on the switches. A family that is off keeps its text: "PR #12" is not read as the issue "#12" when the pull requests are off, and a file name is not read again as a path when the commit identifier in it is off. The switch only removes the colors, the hover buttons, and the actions of its own family.
- One exception: a web address that no family that is on claims stays a web address when the family "Web addresses" is on. The web-link add-on of the terminal makes its link. The add-on is first in the order of the link providers of xterm, and xterm keeps the link of the first provider when two links overlap. The add-on asks `TerminalDetection.findAddressReference` whether the address is an issue, a pull request, a merge request, or a commit, and shows the same hover buttons.

## The hover buttons

- The hover buttons ("Open", "Preview", "Run"…) appear when the pointer is over a piece of text that has a button. A ⌘-click on the text runs the main action: the preview for an issue or a request, and the open, run, or send for the others. A plain web address has no hover button: only the ⌘-click opens it.
- The hover buttons go only over blank cells of the screen: no character, no colored cell, no inverse cell, and not the cell of the cursor. `HoverButtonsPlacement.find` in `lib/hover_buttons_placement.ts` reads the line of the text, the line above, and the line below, and keeps the nearest blank place. The distance is the number of blank columns between the place and the text, plus 4 columns for each line between the place and the line of the text. A place with a distance above 40 does not count.
- The hover buttons first ask for a place that also holds the line of the destination under the buttons. When no blank place fits, they ask again without that line, and the destination is then in the tooltip of the first button.
- When there is no blank place, the hover buttons do not show. The ⌘-click still runs the main action, and the underline still tells that the text is active.
- The hover buttons stay while the pointer is on them, and close 350 ms after the pointer leaves the text and them.

## The switches and their persistence

- The settings `terminalTextDetection` (the whole detection) and `disabledDetectionFamilies` (the identifiers of the families that are off) are in the user settings, saved by `stores/settings.ts` in the key `heidrun.settings` of the local storage. Both are on at first. A saved identifier that is not a family is dropped when the settings load.
- The project file `.heidrun/config.json` has the section `references` (`forge`, `repo`, `tickets`, and `enabled`). Its key `enabled` set to `false` turns the four reference families off for the project. It is stronger than the user switches: a reference needs its user switch and the project key. The user switches never write the project file. The key `tickets` gives the ticket address and the prefixes of the tickets, the key `repo` replaces the Git remote, and the key `forge` replaces the forge that Heidrun Code guesses from the host.

## The tests

- `lib/refs.test.ts` tests the rules. `lib/terminal_detection.test.ts` tests the precedence, the switches, the web addresses, and the sample. `lib/hover_buttons_placement.test.ts` tests the placement. `lib/detection_catalog.test.ts` runs every example of the catalog through the real detection. `stores/session_text_detection.test.ts` tests the questions and the choices. `components/settings/SettingsTextDetectionSection.test.ts` tests the Settings window part.
- The window of the terminal itself is not tested in jsdom, because xterm needs a real renderer. The change of the hover buttons and of the link providers is checked by hand in Heidrun Code Development.
