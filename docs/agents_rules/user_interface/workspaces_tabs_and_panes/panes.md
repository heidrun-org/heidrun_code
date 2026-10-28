# User interface of Heidrun Code: panes

- Created: 13 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md)
- Related issue: [issue 698](https://github.com/heidrun-org/heidrun/issues/698), [issue 803](https://github.com/heidrun-org/heidrun/issues/803), [issue 805](https://github.com/heidrun-org/heidrun/issues/805), [issue 326](https://github.com/heidrun-org/heidrun/issues/326), [issue 428](https://github.com/heidrun-org/heidrun/issues/428), [issue 465](https://github.com/heidrun-org/heidrun/issues/465), [issue 475](https://github.com/heidrun-org/heidrun/issues/475), [issue 636](https://github.com/heidrun-org/heidrun/issues/636), [issue 688](https://github.com/heidrun-org/heidrun/issues/688), [issue 690](https://github.com/heidrun-org/heidrun/issues/690), [issue 712](https://github.com/heidrun-org/heidrun/issues/712), [issue 767](https://github.com/heidrun-org/heidrun/issues/767), [issue 791](https://github.com/heidrun-org/heidrun/issues/791), [issue 810](https://github.com/heidrun-org/heidrun/issues/810)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../glossary/index.md).

## Panes

The rules of the pane header are in [pane_headers.md](pane_headers.md).

- A tab with one pane shows one terminal over the whole viewport.
- A tab with several panes shares the viewport between its panes.
- The panes are not cards. How the panes meet the frame of the viewport, and their corners, are in [panes_appearance.md](../../web_styling/panes_appearance.md).
- Two panes that touch have one line between them. The developer grabs the line to change the size of the panes. The place to grab is as wide as the gap between the viewport and a sidebar (`--pane-gap`). The look of the line is in [panes_appearance.md](../../web_styling/panes_appearance.md).
- The selected pane and a blocked pane have a ring. The color and the place of the ring, and the border of the panes, are in [panes_appearance.md](../../web_styling/panes_appearance.md).
- The developer moves a pane by pressing its header and dropping it on another pane, in the same tab or in another tab. The rules are in [pane_move.md](pane_move.md).
- A click on a pane gives the focus to that pane. Heidrun Code remembers the panes that had the focus: see [pane_focus_history.md](pane_focus_history.md).
- The header of a pane has two split buttons, "Split right" and "Split down". A plain click on a split button splits the pane and starts the default command of a new tab, the option `newTabCommand` of the settings, in the new pane. With a coding agent, the new pane starts a free coding agent, the same as the plus button of the tab bar, and the tab keeps its name. A shift click on a split button splits the pane and starts a terminal in the new pane. The shortcuts Command+D and Shift+Command+D, and the entries "Split to the right" and "Split to the bottom" of the command palette, do the same as a plain click ([issue 465](https://github.com/heidrun-org/heidrun/issues/465), [issue 688](https://github.com/heidrun-org/heidrun/issues/688)).
- Every pane has a toggle button in its header that shows and hides that pane's composition bar: see [composition_bar.md](composition_bar.md).
- A click on the pin button in the header of a pane pins the pane. A pinned pane goes into the column of pinned panes.
- The column of pinned panes sits at the right edge of the viewport, beside the panes of the selected tab. It shows every pinned pane in every tab, the tab of the pinned pane included. Its width is the same in every tab, so a pinned pane keeps the same width in every tab.
- The panes of the selected tab that are not pinned fill the width that the column leaves. A tab whose panes are all pinned shows the same picture as an empty tab.
- The header of a pinned pane in the column shows the pressed pin button, as in the panes of the selected tab. A click on the pressed pin button unpins the pane.
- A pinned pane does not change when the developer selects another tab or another workspace. Only the panes of the selected tab change.

## Copying selected terminal text

- Command+C and the Copy button read the selected cells through Herdr's `pane.selection.read` operation. Visual wraps
  are joined, and intentional line breaks stay. Copying does not infer line boundaries from the length of a line.
- The text of Herdr must be the selected text: without the spaces and the line breaks, it is the same as the displayed
  selection. Otherwise the copy keeps the displayed selection and writes the two texts in the console. The displayed
  selection goes to the clipboard at once, so a fast paste gets it; Herdr's text replaces it only when confirmed. A right
  click keeps the selection, for the item Copy of the context menu ([issue 805](https://github.com/heidrun-org/heidrun/issues/805)).
- The selection belongs to the current viewport, including when Herdr has scrolled into older output. The displayed
  selected rows must match Herdr's visible rows, and Herdr validates the content revision before returning the text.
- When output, scrolling, resizing, or the selection changes during copying, when the selection goes past the visible
  rows, or when Herdr cannot read the selection, the copy uses the selection that the terminal showed when the copy
  started. Copying never leaves the clipboard unchanged: a coding agent that works redraws its pane many times each
  second, so a copy that waits for an unchanged terminal would fail ([issue 803](https://github.com/heidrun-org/heidrun/issues/803)).
- A message asks the developer to select the text again and retry only when writing to the clipboard fails, or when the
  selection has no text. After the copy, only the copied selection is cleared: a selection made during the copy stays.
- The tests are in `terminal_selection.test.ts`.

## Command that starts Codex

- Heidrun Code starts Codex with the plain command, for example `codex` or `codex resume '<session identifier>'`. Heidrun Code types nothing else before the command, so no long line shows in the pane. The commands are the new tab, the resume of a chat, and a launcher whose command starts with `codex` ([issue 791](https://github.com/heidrun-org/heidrun/issues/791)).
- Heidrun Code does not set the text color or the background color of the pane before Codex starts. The former `printf` line that sent the terminal commands `OSC 10` and `OSC 11` is removed. OSC means Operating System Command ([issue 636](https://github.com/heidrun-org/heidrun/issues/636)).
- Known effect: Codex chooses its light colors or its dark colors from the text color and the background color of the pane. When Codex gets no answer to both questions, it keeps its dark colors, which can be hard to read on a light background. The developer checks Codex in the light theme of Heidrun Code after a change of this rule.
- The test is in `agents_codex_plain_command.test.ts`.

## Needs you

- The Needs you sidebar section is a sidebar section of the right sidebar. It holds one card for each agent that is blocked, that asks a question, or that has finished, with the blocked agents first.
- The Needs you sidebar section shows the title "Needs you" at its top, above the cards and above the message "No agent is blocked, no agent has finished, and no agent asks a question." The space around the title is in [sidebars_appearance.md](../../web_styling/sidebars_appearance.md).
- A click on a card shows the pane of the agent. A card also lets the developer answer a blocked agent, pin the pane, and hide the card.
- The button of the Needs you sidebar section shows the number of cards. The number is red when an agent is blocked.
- Hiding a Finished card, or selecting its pane, acknowledges that completion and changes the displayed pane status to Idle. The tab, workspace, and application indicators then follow the remaining pane statuses. The acknowledgement does not move Herdr focus.
- A Finished pane also becomes Idle after the delay that the settings give (15 minutes by default), unless the delay is set to never. The delay starts again for each new completion. A later Working or Blocked status is never changed by an earlier completion or its delay.
- Hiding a Blocked card only hides the card until the next status change; hiding the card does not answer the coding agent. A detected question remains until the developer answers or hides the question.
- The list of all the workspaces sits at the bottom of the sidebar section, under the cards, when the option `showWorkspacesInNeedsYou` is on (the default). The rules are in [needs_you_workspaces.md](../sidebars/needs_you_workspaces.md) ([issue 417](https://github.com/heidrun-org/heidrun/issues/417)).

