# Glossary of Heidrun Code: status bar

- Created: 14 October 2026
- Last updated: 23 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md), [User interface of Heidrun Code: status bar](../user_interface/window/status_bar.md)
- Related issue: [issue 405](https://github.com/heidrun-org/heidrun/issues/405), [issue 475](https://github.com/heidrun-org/heidrun/issues/475), [issue 494](https://github.com/heidrun-org/heidrun/issues/494), [issue 629](https://github.com/heidrun-org/heidrun/issues/629), [issue 688](https://github.com/heidrun-org/heidrun/issues/688), [issue 694](https://github.com/heidrun-org/heidrun/issues/694)

This document gives one short definition for each word of the status bar, the information card, and the information card tooltip. The other words of Heidrun Code are in [index.md](index.md).

## The status bar

### Status bar

The horizontal row at the bottom of the window. It holds status bar sections.

### Status bar section

One part of the status bar. It shows one piece of information, for example the usage of Claude, Codex, Antigravity, or the Git branch. A click on a status bar section opens its information card.

### Unspecified Claude quota

The status bar text "Claude quota: unspecified" appears when quota monitoring and Claude are on in the Settings window, but Heidrun Code has received no Claude quota figures from the Claude Code status line. It means the quota is unknown to Heidrun Code, not that usage is zero.

### Information card

A small card that opens on a click, never when the mouse pointer only moves over its part. It gives more detail about that part, and it can hold buttons. It opens above a status bar section, at the left of a part of the right sidebar, at the right of a part of the left sidebar, below a circled question mark of a page of the Settings window, or below the usage wheel in the header of a pane. The part gets a background while the pointer is over it and while the information card is open. A second click on the part, the key Escape, a click outside, and the loss of the keyboard focus close the information card. The files line of a chat in the Past chats sidebar section has the first information card that opens at the left of a part of a sidebar.

### Information card tooltip

A card that has the look of an information card of the Settings window (a heading with the circled question mark, then blocks that have a title and a text) and that opens like a tooltip: below an element, after a delay of 1.5 seconds, which is longer than the delay of the tooltip of the HTML attribute `title`, when the pointer stays over the element or the element keeps the keyboard focus. It closes at once when they leave. It is a child of the element `body`, and it draws no element around the element that owns it. It is not an information card: an information card opens on a click and can hold buttons, and an information card tooltip never takes the pointer and holds no button. The buttons of the tabs in the title bar of the Statistics window have one.

### Workspace status bar section

The first status bar section, at the left end of the status bar. It shows the status dot and the name of the selected workspace. Its information card gives the details of the selected workspace, and lists the workspaces to select, rename, close, move, or create.
