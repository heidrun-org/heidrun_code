# Glossary of Heidrun Code: workspaces, tabs, and panes

- Created: 14 October 2026
- Last updated: 23 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md), [User interface of Heidrun Code: workspaces, tabs, and panes](../user_interface/workspaces_tabs_and_panes/index.md)
- Related issue: [issue 403](https://github.com/heidrun-org/heidrun/issues/403), [issue 405](https://github.com/heidrun-org/heidrun/issues/405), [issue 475](https://github.com/heidrun-org/heidrun/issues/475), [issue 637](https://github.com/heidrun-org/heidrun/issues/637), [issue 662](https://github.com/heidrun-org/heidrun/issues/662), [issue 685](https://github.com/heidrun-org/heidrun/issues/685), [issue 690](https://github.com/heidrun-org/heidrun/issues/690), [issue 712](https://github.com/heidrun-org/heidrun/issues/712), [issue 726](https://github.com/heidrun-org/heidrun/issues/726), [issue 714](https://github.com/heidrun-org/heidrun/issues/714), [issue 786](https://github.com/heidrun-org/heidrun/issues/786), [issue 784](https://github.com/heidrun-org/heidrun/issues/784), [issue 810](https://github.com/heidrun-org/heidrun/issues/810)

This document gives one short definition for each word of the workspaces, the tabs, the panes, the coding agents that run in a pane, and the parts of the window that hold the panes. The other words of Heidrun Code are in [index.md](index.md).

## The three levels that come from Herdr

A workspace holds tabs. A tab holds panes.

```
Workspace
└── Tab
    └── Pane
```

### Workspace

One project with a fixed workspace folder. In most cases, the workspace folder is one repository. A workspace holds tabs.

### Workspace folder

The folder chosen when a workspace is created. Every workspace has exactly one workspace folder. The workspace folder stays fixed for the lifetime of the workspace, even when a terminal or a coding agent changes its current working folder. Every new terminal and every new coding agent in the workspace starts in the workspace folder. The Workspace card shows the workspace folder, and the Git branch in the status bar belongs to the workspace folder. To use another folder, including a Git worktree, the developer opens a separate workspace for that folder.

### Git worktree

One working folder registered by Git in a repository. It has its own checked-out branch, or no branch when its head is detached.

### Tab

One entry of the tab bar. A tab belongs to one workspace. A tab holds one or more panes.

### Pane

One terminal inside a tab. The terminal runs a shell or a coding agent, for example Claude Code or Codex. A pane belongs to one tab.

### File view pane

A pane that shows one file, read only, in place of its terminal. The developer cannot change the file there. A click on a file in the File explorer sidebar section opens it. The label of the pane holds the absolute path of the file, and the terminal of the pane only waits. The rules are in [file_view_pane.md](../user_interface/workspaces_tabs_and_panes/file_view_pane.md).

### Front matter

The block at the start of a Markdown file, between two lines that each hold three dashes. Heidrun Code shows it as written and does not parse it.

### Front matter card

The card that a file view pane shows above the rendered text of a Markdown file in Preview, with the text of the front matter inside. The rules are in [file_view_pane.md](../user_interface/workspaces_tabs_and_panes/file_view_pane.md).

## The programs that run in a pane

### Coding agent

One program that the developer runs in a pane to write code with a language model. The coding agents that Heidrun Code supports are Claude Code, Codex, and Antigravity. "Coding agent" is the official name of each one of them. Write "coding agent" in full, and write the name of the program, for example Claude Code, only when the text is about that one program. Do not write "AI agent", "AI coding agent", "agent", or "assistant" for a coding agent.

## The parts of the window that hold the panes

### Tab bar

The horizontal row at the top of the viewport, inside the border of the viewport. It shows the tabs of the selected workspace, one entry for each tab.

### Viewport

The main area of the window, between the left sidebar and the right sidebar. It has a border, like each sidebar. It holds the tab bar, the panes of the selected tab that are not pinned, and the column of pinned panes.

### Pinned pane

A pane that the developer keeps visible. The pin button in the header of the pane pins the pane. A pinned pane stays visible, with the same width, when the developer changes tab or workspace.

### Column of pinned panes

The column at the right edge of the viewport. It holds the pinned panes, one above the other, in every tab.

## The parts of a pane

### Usage wheel

The small circle in the header of a pane that shows how much of the context window the coding agent used. The circle fills like a ring, with the colors normal, warning, and critical. It has no word and no number beside it. It appears only while the pointer is over the pane, as the buttons of the pane header do. A click on the usage wheel opens its information card, which gives the percent used, the number of tokens used, and the size of the context window.

### Composition bar

The area under a pane's terminal that opens after the developer drops image files while that pane is focused, or clicks the toggle button in that pane's header. It holds a plus button that adds images, one small picture for each image, a text input, a button "Send", and a push-to-talk button when the voice input is on ([voice_input.md](voice_input.md)). The button "Send" pastes the images in its pane, then writes the text. Each pane keeps its own open state, images, and text when focus changes. It stays open after a send. It starts closed unless the saved setting "Show the composition bar when starting a coding agent" opens it for a new pane that starts directly with a coding agent. A drop or a click on the pane's toggle button also opens it, and that button hides it.

### Big view

The large picture of one image of the composition bar, with a button on each side to go to the previous image and to the next image. A click on a small picture of the composition bar opens it.

### Zen Mode

A temporary mode entered from the header of a pane. It shows only the pane whose header button was pressed, hides the surrounding interface, and keeps that pane's header visible.

## Moving a pane

The rules are in [pane_move.md](../user_interface/workspaces_tabs_and_panes/pane_move.md).

### Dragged pane

The pane whose header the developer presses and moves with the pointer.

### Destination pane

The pane under the pointer when the developer releases the button. The dragged pane goes next to the destination pane.

### Drop triangle

One of the four triangles, top, bottom, left, and right, that two diagonal lines from corner to corner cut in a destination pane. The drop triangle that holds the pointer at the release decides on which side of the destination pane the dragged pane goes.

### Move preview

The half of the destination pane where the dragged pane goes. The window shows it while the pointer is over a destination pane, before the release.

## Rules

- The word "tab" means only a tab of Herdr, as defined above. An icon of a sidebar icon bar is not a tab.
- The word "pane" means only a terminal inside a tab. A list of tabs is not a list of panes.
- Write "coding agent" in full. Never write "agent" alone, "AI agent", or "AI coding agent" for Claude Code, Codex, or Antigravity.
- Write "pinned pane" and "column of pinned panes". Do not write "docked pane", "side view", or "alongside".
- Write "composition bar". Do not write "composition box", "image zone", "attachment bar", or "drop zone" for the area under the focused pane. Write "big view", not "lightbox" or "full screen view", for the large picture.
- Write "dragged pane", "destination pane", "drop triangle", and "move preview" for the parts of a pane move. Do not write "target pane" or "drop zone" for them.
- Write "usage wheel". Do not write "context bar", "gauge", or "ring" for the circle in the header of a pane.
