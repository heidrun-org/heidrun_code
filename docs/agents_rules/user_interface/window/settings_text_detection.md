# User interface of Heidrun Code: the text detection in the Settings window

- Created: 22 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [The detection in the text of the terminals](terminal_text_detection.md), [Information card of every option of the Settings window](settings_information_cards.md), [Glossary of Heidrun Code: terminal text detection](../../glossary/terminal_text_detection.md)
- Related issue: [issue 793](https://github.com/heidrun-org/heidrun/issues/793), [issue 638](https://github.com/heidrun-org/heidrun/issues/638)

This file gives the rules of the section "Text detection" of the Settings window. It is a section of its own, after the section Terminal, with the icon `regex`. The components are in the folder `components/settings`: `SettingsTextDetectionSection.vue` (the section), `SettingsTextDetectionFamily.vue` (the card of one detection family), and `SettingsTextDetectionSample.vue` (the field "Try a text").

## What the page shows

The page shows data, not descriptions. A reader sees what the detection runs, and tests it, without reading the code.

- The switch "Detect things in the text of the terminals" (`data-option="textDetection"`), then one sentence that says what the detection does.
- The data of the project of the selected workspace, read from `refContext`: the folder, the repository, the code hosting service, the ticket address, the ticket prefixes, whether the references are on, and the number of slash commands that Claude Code knows. Each row has `data-row`. These values decide the destination of a found text, so the page shows them.
- The field "Try a text" (`data-option="textDetectionSample"`).
- One card for each detection family, in the order of `DETECTION_FAMILY_IDS` (`data-option="detectionFamily"`, `data-family`). Each card has the switch of the family with its information card, one sentence, and one block for each rule of the family from `DetectionCatalog.FAMILIES` (`data-rule`).

## One rule

- The name of the rule, a badge when the rule works only in panes that run a coding agent or Claude Code, and one sentence that says what the rule looks for.
- A warning line (`data-need`) when the project of the selected workspace does not meet what the rule needs: a repository, a ticket address, a GitLab project, known slash commands, or the references switched on. The line says what happens: "nothing is found", or "the text is found, but it has no destination".
- Each regular expression of the rule, as the real `RegExp` of the class `DetectionPatterns` (`regex.toString()`), with the purpose of the expression above it (`data-pattern`). The terminal runs the same object, so the page cannot show another pattern.
- Examples that are found, and examples that are refused (`data-example`, `found` or `refused`). Each example is run through the real detection (`DetectionCatalog.check`), in the project of the selected workspace, and the page shows the result: the matched text when it differs from the example, the hover buttons, and the destination. A found example that the project cannot find says "not found in this project". A refused example says "nothing found".
- The family "Ticket keys" also explains what a ticket key is, and shows the two forms of the key `tickets` of the project file `.heidrun/config.json` (`data-field="tickets-setup"`).

## The field "Try a text"

- It has a text area with a visible label "Try a text", a choice "Pretend the pane runs" (a plain terminal, Claude Code, or Codex), the repository of the selected workspace, and the result.
- It reads each line of the text with `TerminalDetection.detectText`, which is the function of the terminals, with the repository of the selected workspace, its slash commands, the kind of pane, and the switches. The result is empty until the developer types.
- For each piece found it shows: the text, the line, the characters, the family, the rule, the destination, the repository named in the text, the hover buttons, and what a ⌘-click does. A piece of a family that is off says that the family is off and that nothing happens. A piece without a destination says that it is colored and has no action.
- For each piece that another rule took, it names the rule that won. It shows the question and the numbered choices that the whole text holds, for a pane of a coding agent.
- The field never opens an address, never sends a message to a pane, and never runs a command. The test `SettingsTextDetectionSection.test.ts` fails when it does.

## The switches

- While the whole detection is off, the family switches keep their saved state, are dimmed, and cannot be changed.
- The page changes the settings at once. Open terminals follow: the colors, the underline, the hover buttons, and the actions change without a new pane.
- The examples show what a rule does whatever the switches say: the switches do not change the result of an example.

## The single source of the data

- Every regular expression of the detection is a constant of `DetectionPatterns` in `lib/detection_patterns.ts`. `lib/refs.ts` and `lib/terminal_detection.ts` run these constants, and the web-link add-on of the terminal receives `WEB_ADDRESS` as its `urlRegex`. A new regular expression goes there, never inline in a function.
- Every rule is an entry of `DetectionCatalog.FAMILIES` in `lib/detection_catalog.ts`, with its patterns, its found examples, and its refused examples. The test `lib/detection_catalog.test.ts` runs every example through the real detection, and fails when a rule stops finding a found example or finds a refused example. It also fails when a constant of `DetectionPatterns` is in no rule.
- The texts of the rules are in the locale file `textDetection.json`: `rule.<id>` (the name), `ruleWhat.<id>` (the sentence), `pattern.<id>` (the purpose of an expression), `pane.<kind>`, and `need.<kind>`.

## The tests

- `components/settings/SettingsTextDetectionSection.test.ts` tests the switches, the data of the project, the patterns, the examples and their results, the ticket explanation, the warnings, the field, and the French texts. `settings_information_cards.test.ts` lists the options of the section.
