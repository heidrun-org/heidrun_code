# User interface of Heidrun Code: moving a pane

- Created: 23 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [Panes](panes.md), [Pane headers](pane_headers.md), [Tabs](tabs.md)
- Related issue: [issue 810](https://github.com/heidrun-org/heidrun/issues/810), [issue 825](https://github.com/heidrun-org/heidrun/issues/825)

This file gives the rules for moving a pane with the pointer, inside its tab and to another tab. The words are defined in [workspaces_tabs_and_panes.md](../../glossary/workspaces_tabs_and_panes.md). The look of the move preview is in [panes_appearance.md](../../web_styling/panes_appearance.md). The paths of the tests start at `packages/apps/web_frontend/src`.

## How the developer moves a pane

- The developer presses the header of a pane, away from the buttons of the header, moves the pointer, and releases the button on another pane. The pane that the developer drops is the dragged pane. The pane under the pointer at the release is the destination pane.
- A press that moves less than 5 pixels is a click. The key Escape cancels the move.
- The move uses the pointer events of the page and never the drag and drop of the browser. The reason is in [tabs.md](tabs.md).
- The destination pane is any other pane of the selected tab.
- To move the pane to another tab, the developer keeps the button pressed and moves the pointer over that tab in the tab bar. Heidrun Code selects that tab at once. The developer then drops the pane on a pane of that tab. In this way the developer chooses the destination tab during the move.
- To move the pane into a new tab, the developer releases the button on the plus button at the end of the tab bar. While the pointer is over the plus button, the plus button shows the drop look: a solid border of 3 pixels in the color `--accent` and a background of the same color at 12 percent strength, as the move preview does. The mark disappears when the pointer leaves the plus button, when the developer releases the button, and when the developer presses Escape. A plain pointer over the plus button never shows the mark ([issue 825](https://github.com/heidrun-org/heidrun/issues/825)).

## Where the pane goes

Two diagonal lines, from corner to corner of the destination pane, cut the destination pane into four drop triangles. The drop triangle that holds the pointer at the release decides the place.

- Top triangle: the dragged pane goes above the destination pane.
- Bottom triangle: the dragged pane goes below the destination pane.
- Left triangle: the dragged pane goes to the left of the destination pane.
- Right triangle: the dragged pane goes to the right of the destination pane.

While the pointer is over a destination pane, the window shows the move preview: the half of the destination pane where the dragged pane goes. The preview shows the result before the release. The diagonals follow the real shape of the destination pane, so a tall pane has tall triangles.

## Rules

- The terminal or the coding agent that runs in the dragged pane keeps running. Heidrun Code moves the pane and never starts it again.
- A release on the dragged pane does nothing. A release outside every pane does nothing, and the pane stays where it was.
- After the move, Heidrun Code selects the dragged pane in its new place.
- When the dragged pane is the last pane of its tab, Herdr closes that tab, because a tab always has a pane.
- A release on the plus button creates a new tab that holds only the dragged pane, and selects the dragged pane. The new tab does not start the default command of a new tab. When the dragged pane is the only pane of its tab, the plus button shows no mark and a release on it does nothing, because the result would be the same tab at the end of the tab bar.
- A pinned pane in the column of pinned panes cannot be dragged and cannot be a destination pane. Only the panes that the grid shows take part ([issue 810](https://github.com/heidrun-org/heidrun/issues/810), not decided by the developer yet).
- Zen Mode shows one pane, so it starts no move.
- A move that fails shows the error notification "The pane did not move" with the reason that Herdr gives.

## How Heidrun Code asks Herdr

Herdr puts a moved pane to the right of a pane or below it. Herdr moves no pane inside its own tab: the answer says `changed` false with the reason `same_tab`. The steps are in `lib/pane_move.ts`, the class `PaneMove`, the method `plan`.

- Right triangle: one `pane.move` to the destination tab, with the split `right`.
- Bottom triangle: one `pane.move` to the destination tab, with the split `down`.
- Left triangle: the move of the right triangle, then `pane.swap` of the dragged pane and the destination pane.
- Top triangle: the move of the bottom triangle, then `pane.swap` of the dragged pane and the destination pane.
- Plus button: one `pane.move` to a new tab, from the method `planNewTab` of the class `PaneMove`. No other step follows.
- Inside one tab, the dragged pane first goes to a new temporary tab with `pane.move`, then the steps above run. Herdr closes the temporary tab when the dragged pane leaves it.
- Heidrun Code holds the refresh of the session snapshot during the steps and reads it once at the end, so the window never shows the temporary tab. The function `holdRefresh` of the session store does this.
- When a step fails after the dragged pane went to the temporary tab, Heidrun Code moves the pane back next to the destination pane and shows the reason.
- The pane identifier and the terminal identifier do not change when the pane stays in its workspace.

## Tests

- `lib/pane_move.test.ts`: the four drop triangles, the move preview halves, and the steps for each place, inside one tab and to another tab, and into a new tab.
- `stores/pane_move.test.ts`: the threshold of 5 pixels, Escape, the release on the dragged pane and outside every pane, the selection of the tab under the pointer, the mark and the drop on the plus button (also with a pane that is alone in its tab), the order of the calls to Herdr, the single read of the snapshot, and the failures.
- `components/PaneCard.test.ts`, `components/PaneGrid.test.ts`, and `components/TabBar.test.ts`: the press on the header, the pinned pane, the move preview, the mark on each tab, and the drop look of the plus button.

## Background

- The way to place a pane on the left and above comes from a live test with Herdr 0.9.5 in a separate session on 23 October 2026: a `pane.move` followed by a `pane.swap` gives all four places, and the terminal identifier stays the same ([issue 810](https://github.com/heidrun-org/heidrun/issues/810)).
