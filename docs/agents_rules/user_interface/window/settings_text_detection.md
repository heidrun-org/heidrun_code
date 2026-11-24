# User interface of Heidrun Code: the text detection in the Settings window

- Created: 22 October 2026
- Last updated: 24 November 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [The detection in the text of the terminals](terminal_text_detection.md), [Information card of every option of the Settings window](settings_information_cards.md), [Glossary of Heidrun Code: terminal text detection](../../glossary/terminal_text_detection.md)
- Related issue: [issue 793](https://github.com/heidrun-org/heidrun/issues/793), [issue 638](https://github.com/heidrun-org/heidrun/issues/638), [issue 1083](https://github.com/heidrun-org/heidrun_code/issues/1083)

Text detection is a section after Terminal in the Settings window. `SettingsTextDetectionSection.vue` shows two independent switches with information cards.

- **Issues, pull requests, and merge requests** controls the reference color, hover card, and Command-click preview. It is saved as `terminalTextDetection`.
- **Ordinary web links** controls opening an ordinary web address in the browser with Command-click. It is saved as `terminalWebAddresses`.

Both switches are on by default and apply to open terminals. If the older master switch was off, both switches start off. A saved choice to turn off ordinary web links or both reference families carries forward into its corresponding switch.

The terminal reference formats and the workspace settings are described in [Terminal references](terminal_text_detection_references.md).
