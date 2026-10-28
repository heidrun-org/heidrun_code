# User interface of Heidrun Code: pane headers

- Created: 19 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [Panes](panes.md)
- Related issue: [issue 345](https://github.com/heidrun-org/heidrun/issues/345), [issue 475](https://github.com/heidrun-org/heidrun/issues/475), [issue 690](https://github.com/heidrun-org/heidrun/issues/690), [issue 733](https://github.com/heidrun-org/heidrun/issues/733), [issue 734](https://github.com/heidrun-org/heidrun/issues/734), [issue 786](https://github.com/heidrun-org/heidrun/issues/786), [issue 810](https://github.com/heidrun-org/heidrun/issues/810), [issue 586](https://github.com/heidrun-org/heidrun/issues/586)

This file gives the rules of the pane header, its buttons, and its usage wheel.

## Pane header buttons

- Every pane header has a button to enter or leave Zen Mode, including pinned panes and panes without focus. Changing focus does not change the visibility or position of the Zen button. Zen Mode shows one pane across the window and hides the top bar, tab bar, sidebars, sidebar icon bars, and status bar. It preserves pane positions, split sizes, and pins; the pane header and composition bar stay unchanged. Closing the visible pane exits Zen Mode. Heidrun Code starts in normal mode and never enters macOS full-screen.

- The buttons and the usage wheel in a pane header appear only while the pointer is anywhere over that pane, including its terminal, header, and composition bar. The same rule applies to every pane, including panes without focus and pinned panes. Moving the pointer between the terminal and the header keeps the buttons visible and usable. Leaving the pane hides the buttons and the usage wheel with a 150 millisecond fade; entering the pane shows them with the same fade. A hidden button and a hidden usage wheel cannot receive pointer clicks or keyboard focus. The header, the title, and the space occupied by the buttons and by the usage wheel remain in place. Changing pane focus alone never changes button visibility ([issue 734](https://github.com/heidrun-org/heidrun/issues/734)). The usage wheel is the first item of the same group as the buttons, so it follows the same rule ([issue 786](https://github.com/heidrun-org/heidrun/issues/786)).

- A press on the header of a pane, away from its buttons, followed by a move of the pointer, moves the pane: see [pane_move.md](pane_move.md). A press that moves less than 5 pixels is a click, and the double-click on the name still renames the pane.

- The gap between the usage wheel and the first button of the pane header is in [panes_appearance.md](../../web_styling/panes_appearance.md).

## Pane header colors and usage wheel

- The tinted header of the selected pane and the muted names of the other panes are in [panes_appearance.md](../../web_styling/panes_appearance.md).

- The header of a pane shows the context window of the coding agent as a usage wheel, and only as a usage wheel: no word "context", no bar, and no number beside it. The usage wheel is a circle of 22 pixels that fills like a ring, from the top, clockwise. It has the three colors of the usage bars: normal below 60 percent, warning from 60 to 80 percent, and critical above 80 percent. A pane whose coding agent has no known context window has no usage wheel ([issue 475](https://github.com/heidrun-org/heidrun/issues/475)). The usage wheel appears only while the pointer is over the pane, as the section "Pane header buttons" says.

- A click on the usage wheel opens its information card below the usage wheel. The information card shows the percent used, the number of tokens used, and the size of the context window. A row is left out when the program does not know its number. The information card follows the rules of the information card in the glossary: it opens on a click only, and a second click, the key Escape, a click outside, and the loss of the keyboard focus close it. The pane that holds the open information card goes above the other panes, so that no other pane hides the information card. The information card stays inside the viewport: its right edge is at the left of the right sidebar, or of its sidebar icon bar when the right sidebar is collapsed, and its left edge is at the right of the left sidebar. When the room at the right of the usage wheel is too small, the card moves to the left, and its arrow still points to the usage wheel. The pane that holds the open information card also goes above the lines between the panes, the line of the right sidebar, and the corners of the viewport, so that nothing hides the card ([issue 586](https://github.com/heidrun-org/heidrun/issues/586)).
