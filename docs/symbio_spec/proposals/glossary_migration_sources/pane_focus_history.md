# Pane focus history source material

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Transferred source material
- Related framing: [Glossary migration sources](README.md)
- Related issue: [issue 1135](https://github.com/heidrun-org/heidrun_code/issues/1135)

Original source `/docs/agents_rules/glossary/pane_focus_history.md` in the [pinned revision](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db). The headings identify original line numbers. Proposed destinations and inventory notes describe the transfer. Approval of a product rule is recorded with the resulting specification.

### Source line 10

This document gives one short definition for each word of the navigation through the panes that had the focus. The other words of Heidrun Code are in [index.md](source_index.md).

### Source line 12

- Glossary entry: [Top bar](../../glossary/pane_focus_history.md#11-top-bar).
- Proposed destinations: Glossary, User Interface.

#### Top bar

The horizontal row at the very top of the window, above the three frames. From the left, it holds the Back button, the Forward button, the search button, the update button when a newer version is available, the theme button, and the more button. The search button shows the selected workspace name inside its border.

### Source line 16

- Glossary entry: [Pane focus history](../../glossary/pane_focus_history.md#12-pane-focus-history).
- Proposed destinations: Glossary, Behaviour, User Interface.

#### Pane focus history

The list that Heidrun Code keeps of the panes that had the focus, in order, with one current entry. It holds panes from every workspace and every tab. The Back button and the Forward button move the current entry. A long press on one of these two buttons opens a list of its entries.

### Source line 20

- Glossary entry: [Back button](../../glossary/pane_focus_history.md#13-back-button).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Back button

The button of the top bar, just on the left of the Forward button, with an arrow that points left. A click gives the focus to the pane of the entry before the current entry of the pane focus history.

### Source line 24

- Glossary entry: [Forward button](../../glossary/pane_focus_history.md#14-forward-button).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Forward button

The button of the top bar, between the Back button and the search button, with an arrow that points right. A click gives the focus to the pane of the entry after the current entry of the pane focus history.

### Source line 28

#### Rules

### Source line 30

- Proposed destinations: Glossary.

- Write "pane focus history", "Back button", and "Forward button" in full. Do not write "navigation history" or "focus stack" for the history.

### Source line 31

- Proposed destinations: Glossary.
- Inventory notes: Reuse the Pane definition from Workspaces, tabs and panes.

- The word "pane" keeps its meaning of the [glossary](source_index.md): one terminal inside a tab. An entry of the pane focus history is a pane, never a tab and never a chat.
