# User interface of Heidrun Code: the other detections in the text of the terminals

- Created: 22 October 2026
- Last updated: 27 November 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [The detection in the text of the terminals](terminal_text_detection.md), [The references](terminal_text_detection_references.md)
- Related issue: [issue 793](https://github.com/heidrun-org/heidrun/issues/793), [issue 638](https://github.com/heidrun-org/heidrun/issues/638), [issue 574](https://github.com/heidrun-org/heidrun/issues/574), [issue 1083](https://github.com/heidrun-org/heidrun_code/issues/1083)

Ordinary HTTP and HTTPS addresses are clickable with Command-click when the Ordinary web links switch is on. Heidrun Code opens them in the default browser. A recognized issue or request address uses the reference information card when that feature is enabled.

Local file paths, tracker identifiers, commit identifiers, command suggestions, numbered steps, and coding agent navigation have no actions from Text detection. An ordinary web address stays clickable even when the address points to a commit or file on a website.

Question notifications and the choice menus of blocked coding agents come from the agent session. The Text detection switches do not control those features.

When Input image previews is on, hovering over a label such as `[Image #1]` in the selected terminal shows the image attached to the chat message. When the switch is off, the labels appear as plain text.
