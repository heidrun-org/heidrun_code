# Status bar source material

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Transferred source material
- Related framing: [Glossary migration sources](README.md)
- Related issue: [issue 1135](https://github.com/heidrun-org/heidrun_code/issues/1135)

Original source `/docs/agents_rules/glossary/status_bar.md` in the [pinned revision](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db). The headings identify original line numbers. Proposed destinations and inventory notes describe the transfer. Approval of a product rule is recorded with the resulting specification.

### Source line 10

This document gives one short definition for each word of the status bar, the information card, and the information card tooltip. The other words of Heidrun Code are in [index.md](source_index.md).

### Source line 12

#### The status bar

### Source line 14

- Glossary entry: [Status bar](../../glossary/status_bar.md#11-status-bar).
- Proposed destinations: Glossary, User Interface.

#### Status bar

The horizontal row at the bottom of the window. It holds status bar sections.

### Source line 18

- Glossary entry: [Status bar section](../../glossary/status_bar.md#12-status-bar-section).
- Proposed destinations: Glossary, User Interface.

#### Status bar section

One part of the status bar. It shows one piece of information, for example the usage of Claude, Codex, Antigravity, or the Git branch. A click on a status bar section opens its information card.

### Source line 22

- Glossary entry: [Unspecified Claude quota](../../glossary/status_bar.md#13-unspecified-claude-quota).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Unspecified Claude quota

The status bar text "Claude quota: unspecified" appears when quota monitoring and Claude are on in the Settings window, but Heidrun Code has received no Claude quota figures from the Claude Code status line. It means the quota is unknown to Heidrun Code, not that usage is zero.

### Source line 26

- Glossary entry: [Information card](../../glossary/information_cards_and_text_detection.md#11-information-card).
- Proposed destinations: Glossary, User Interface, Behaviour, Styling.
- Inventory notes: Terminal text detection calls a hover card an Information card. Review whether the glossary needs a shared term with variants.

#### Information card

A small card that opens on a click, never when the mouse pointer only moves over its part. It gives more detail about that part, and it can hold buttons. It opens above a status bar section, at the left of a part of the right sidebar, at the right of a part of the left sidebar, below a circled question mark of a page of the Settings window, or below the usage wheel in the header of a pane. The part gets a background while the pointer is over it and while the information card is open. A second click on the part, the key Escape, a click outside, and the loss of the keyboard focus close the information card. The files line of a chat in the Past chats sidebar section has the first information card that opens at the left of a part of a sidebar.

### Source line 30

- Glossary entry: [Information card tooltip](../../glossary/status_bar.md#14-information-card-tooltip).
- Proposed destinations: Glossary, User Interface, Behaviour, Styling, Technical documentation.

#### Information card tooltip

A card that has the look of an information card of the Settings window (a heading with the circled question mark, then blocks that have a title and a text) and that opens like a tooltip: below an element, after a delay of 1.5 seconds, which is longer than the delay of the tooltip of the HTML attribute `title`, when the pointer stays over the element or the element keeps the keyboard focus. It closes at once when they leave. It is a child of the element `body`, and it draws no element around the element that owns it. It is not an information card: an information card opens on a click and can hold buttons, and an information card tooltip never takes the pointer and holds no button. The buttons of the tabs in the title bar of the Statistics window have one.

### Source line 34

- Glossary entry: [Workspace status bar section](../../glossary/status_bar.md#15-workspace-status-bar-section).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Workspace status bar section

The first status bar section, at the left end of the status bar. It shows the status dot and the name of the selected workspace. Its information card gives the details of the selected workspace, and lists the workspaces to select, rename, close, move, or create.
