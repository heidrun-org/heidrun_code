# User interface of Heidrun Code: layout of the window

- Created: 13 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md)
- Related issue: [issue 303](https://github.com/heidrun-org/heidrun/issues/303), [issue 315](https://github.com/heidrun-org/heidrun/issues/315), [issue 323](https://github.com/heidrun-org/heidrun/issues/323), [issue 380](https://github.com/heidrun-org/heidrun/issues/380), [issue 371](https://github.com/heidrun-org/heidrun/issues/371), [issue 690](https://github.com/heidrun-org/heidrun/issues/690)

This document says where each part of the window goes and how each part works. The words are defined in [glossary/index.md](../../glossary/index.md). The layout below is the layout of the window.

The other files of the folder `docs/agents_rules/user_interface` give the rules of the other parts. [AGENTS.md](../../../../AGENTS.md) lists them.

## Layout

```
┌───────────┬─────────────────────────────────────┬───────────┐
│           │ [tab 1] [tab 2] [+]                 │           │
│   left    ├─────────────────────┬───────────────┤   right   │
│  sidebar  │ panes of the        │ pinned panes  │  sidebar  │
│           │ selected tab        │ in a column   │           │
│           │                     │               │           │
├───────────┴─────────────────────┴───────────────┴───────────┤
│ status bar: [● heidrun] [status bar section] [...]          │
└─────────────────────────────────────────────────────────────┘
```

## Rules of the layout

- The viewport gets the most width, because the developer reads and writes text there.
- A sidebar has no fixed maximum width. The developer drags the line of a sidebar to make the sidebar wider, until the viewport, without the column of pinned panes, is 400 pixels wide. Then the sidebar cannot get wider. The same rule holds for the left sidebar and for the right sidebar ([issue #371](https://github.com/heidrun-org/heidrun/issues/371)).
- The left sidebar, the viewport, and the right sidebar are three frames of the same kind. The tab bar is inside the frame of the viewport. The panes inside the frame of the viewport have no frame of their own: see the section "Panes". The border, the corners, and the backgrounds of the frames and of the panes are in [panes_appearance.md](../../web_styling/panes_appearance.md).
- The gap between the viewport and a sidebar is 5 pixels (`--pane-gap`), whether the sidebar is expanded or collapsed. An expanded sidebar fills the gap with its line to drag, and a collapsed sidebar, which has no line to drag, keeps an empty gap of the same width, so the viewport does not move when the developer collapses or expands a sidebar ([issue #323](https://github.com/heidrun-org/heidrun/issues/323)).
- A part that the developer uses rarely does not take space all the time. A part that the developer uses often is always visible.
- The top bar is 43 pixels high. The gap above the search box, the theme button, and the more button is 9 pixels, and the gap below them is also 9 pixels, down to the first tab of the tab bar and to the first button of each sidebar icon bar ([issue #315](https://github.com/heidrun-org/heidrun/issues/315)).
- The top bar holds the Back button and the Forward button, in this order, just on the left of the search button. They are 30 pixels high, like the theme button. The rules of the two buttons are in [pane_focus_history.md](../workspaces_tabs_and_panes/pane_focus_history.md) ([issue #380](https://github.com/heidrun-org/heidrun/issues/380)).
- The search button in the top bar shows the selected workspace name inside its border, in place of the text "Search, run a command…", as in Visual Studio Code. Clicking the name opens search, just like clicking the rest of the search button. The name updates when the developer switches workspace or renames the selected workspace. A change of tab, pane, or terminal folder does not change the name. The name stays on one line, fits within the search button, and ends with an ellipsis when space is limited. Hovering over the name shows the full name. The existing controls keep their space. When no workspace is selected or the selected workspace is missing, the search button shows its usual search text ([issue #752](https://github.com/heidrun-org/heidrun/issues/752)).
- Zen Mode is a temporary alternate layout. It hides the top bar, tab bar, sidebars, sidebar icon bars, and status bar so the visible pane fills the window content. Existing keyboard shortcuts still switch tabs and workspaces, search, and move through the pane focus history. The window stays in its current macOS virtual space.

## Text that must stay on one line

- A piece of information that must not go to the next line, for example a folder path, a file path, or a Git branch name, is always shown on one line.
- When the container is too narrow to show the whole text on one line, the text does not wrap and does not break in the middle of a word. The container cuts the text at its edge.
- While the pointer is over the container, the text scrolls sideways, so that the developer can read the whole text.
- The folder path in the information card of the Workspace status bar section follows these rules ([issue #303](https://github.com/heidrun-org/heidrun/issues/303)).

## Files

- Heidrun Code never modifies a file of the developer. Only the coding agents that run in the panes modify files.
- A part of the window that shows files, for example a file explorer, only reads them. It has no button to rename, move, delete, or edit a file. The only exception is the File explorer sidebar section, which can create a new empty file and a new empty folder ([files.md](../sidebars/files.md)).

