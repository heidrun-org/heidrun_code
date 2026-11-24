# User interface of Heidrun Code: the detection in the text of the terminals

- Created: 22 October 2026
- Last updated: 24 November 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: terminal text detection](../../glossary/terminal_text_detection.md), [The references](terminal_text_detection_references.md), [The other families](terminal_text_detection_other_families.md), [Settings window: text detection](settings_text_detection.md)
- Related issue: [issue 793](https://github.com/heidrun-org/heidrun/issues/793), [issue 638](https://github.com/heidrun-org/heidrun/issues/638), [issue 574](https://github.com/heidrun-org/heidrun/issues/574), [issue 1083](https://github.com/heidrun-org/heidrun_code/issues/1083)

Heidrun Code recognizes issue, pull request, and merge request references in terminal text. The terminal uses the same information card content as the Code hosting sidebar section. Hover starts the lookup immediately. The completed card opens once the details arrive and at least 500 milliseconds have passed. If the lookup is still running at 800 milliseconds, the card opens with a loading message and updates when the details arrive. The card opens above the reference when it fits and below otherwise. Its arrow points to the horizontal midpoint of the reference, with a gap between the arrow and the text. Hold Command and click to open the item in the browser.

The information card shows the existing merge controls when the request belongs to the workspace repository and the merge lookup confirms the same request address. The Merge button opens the existing merge window with its confirmation and repository-specific options.

The terminal adds the reference colors as decorations over the buffer cells. The text stays intact. Links encoded by the terminal and links printed as plain text follow the same reference rules.

The Settings window has independent switches for reference information cards and ordinary web links. Agent questions, choice menus, and notifications follow the agent session and its own settings.
