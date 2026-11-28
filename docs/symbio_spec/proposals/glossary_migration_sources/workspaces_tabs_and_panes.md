# Workspaces, Tabs, and Panes source material

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Transferred source material
- Related framing: [Glossary migration sources](README.md)
- Related issue: [issue 1135](https://github.com/heidrun-org/heidrun_code/issues/1135)

Original source `/docs/agents_rules/glossary/workspaces_tabs_and_panes.md` in the [pinned revision](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db). The headings identify original line numbers. Proposed destinations and inventory notes describe the transfer. Approval of a product rule is recorded with the resulting specification.

### Source line 10

This document gives one short definition for each word of the workspaces, the tabs, the panes, the coding agents that run in a pane, and the parts of the window that hold the panes. The other words of Heidrun Code are in [index.md](source_index.md).

### Source line 12

#### The three levels that come from Herdr

### Source line 14

- Proposed destinations: Glossary.

A workspace holds tabs. A tab holds panes.

```
Workspace
└── Tab
    └── Pane
```

### Source line 22

- Glossary entry: [Workspace](../../glossary/workspaces_tabs_and_panes.md#11-workspace).
- Proposed destinations: Glossary.

#### Workspace

One project with a fixed workspace folder. In most cases, the workspace folder is one repository. A workspace holds tabs.

### Source line 26

- Glossary entry: [Workspace folder](../../glossary/workspaces_tabs_and_panes.md#21-workspace-folder).
- Proposed destinations: Glossary, Behaviour, User Interface.

#### Workspace folder

The folder chosen when a workspace is created. Every workspace has exactly one workspace folder. The workspace folder stays fixed for the lifetime of the workspace, even when a terminal or a coding agent changes its current working folder. Every new terminal and every new coding agent in the workspace starts in the workspace folder. The Workspace card shows the workspace folder, and the Git branch in the status bar belongs to the workspace folder. To use another folder, including a Git worktree, the developer opens a separate workspace for that folder.

### Source line 30

- Glossary entry: [Git worktree](../../glossary/workspaces_tabs_and_panes.md#12-git-worktree).
- Proposed destinations: Glossary.

#### Git worktree

One working folder registered by Git in a repository. It has its own checked-out branch, or no branch when its head is detached.

### Source line 34

- Glossary entry: [Tab](../../glossary/workspaces_tabs_and_panes.md#22-tab).
- Proposed destinations: Glossary, User Interface.

#### Tab

One entry of the tab bar. A tab belongs to one workspace. A tab holds one or more panes.

### Source line 38

- Glossary entry: [Pane](../../glossary/workspaces_tabs_and_panes.md#13-pane).
- Proposed destinations: Glossary.
- Inventory notes: Check whether terminal describes the underlying implementation or every user-visible Pane, given File view pane and Diff pane.

#### Pane

One terminal inside a tab. The terminal runs a shell or a coding agent, for example Claude Code or Codex. A pane belongs to one tab.

### Source line 42

- Glossary entry: [File view pane](../../glossary/workspaces_tabs_and_panes.md#14-file-view-pane).
- Proposed destinations: Glossary, User Interface, Behaviour, Technical documentation.

#### File view pane

A pane that shows one file in place of its terminal. The developer reads and changes the file there, and saves it with ⌘S. A click on a file in the File explorer sidebar section, a click on a line of the Search in files sidebar section, and the box of ⌘P open it. The label of the pane holds the absolute path of the file, and the terminal of the pane only waits. The rules are in file_view_pane.md (`/docs/agents_rules/user_interface/workspaces_tabs_and_panes/file_view_pane.md` in the original documentation).

### Source line 46

- Glossary entry: [Diff pane](../../glossary/workspaces_tabs_and_panes.md#15-diff-pane).
- Proposed destinations: Glossary, User Interface, Behaviour, Technical documentation.

#### Diff pane

A pane that shows the changes of one file, compared to the last commit, read only, in place of its terminal. A click on a file line of the Source control sidebar section opens it. The label of the pane holds the absolute path of the file, and the terminal of the pane only waits. The rules are in diff_pane.md (`/docs/agents_rules/user_interface/workspaces_tabs_and_panes/diff_pane.md` in the original documentation).

### Source line 50

- Glossary entry: [Front matter](../../glossary/workspaces_tabs_and_panes.md#23-front-matter).
- Proposed destinations: Glossary, Behaviour.

#### Front matter

The block at the start of a Markdown file, between two lines that each hold three dashes. Heidrun Code shows it as written and does not parse it.

### Source line 54

- Glossary entry: [Front matter card](../../glossary/workspaces_tabs_and_panes.md#24-front-matter-card).
- Proposed destinations: Glossary, User Interface.

#### Front matter card

The card that a file view pane shows above the rendered text of a Markdown file in Preview, with the text of the front matter inside. The rules are in file_view_pane.md (`/docs/agents_rules/user_interface/workspaces_tabs_and_panes/file_view_pane.md` in the original documentation).

### Source line 58

#### The programs that run in a pane

### Source line 60

- Glossary entry: [Coding agent](../../glossary/workspaces_tabs_and_panes.md#25-coding-agent).
- Proposed destinations: Glossary, Platform Support.
- Inventory notes: Keep the official term and verify the supported list before recording a support expectation.

#### Coding agent

One program that the developer runs in a pane to write code with a language model. The coding agents that Heidrun Code supports are Claude Code, Codex, and Antigravity. "Coding agent" is the official name of each one of them. Write "coding agent" in full, and write the name of the program, for example Claude Code, only when the text is about that one program. Do not write "AI agent", "AI coding agent", "agent", or "assistant" for a coding agent.

### Source line 64

#### The parts of the window that hold the panes

### Source line 66

- Glossary entry: [Tab bar](../../glossary/workspaces_tabs_and_panes.md#26-tab-bar).
- Proposed destinations: Glossary, User Interface.

#### Tab bar

The horizontal row at the top of the viewport, inside the border of the viewport. It shows the tabs of the selected workspace, one entry for each tab.

### Source line 70

- Glossary entry: [Viewport](../../glossary/workspaces_tabs_and_panes.md#27-viewport).
- Proposed destinations: Glossary, User Interface, Styling.

#### Viewport

The main area of the window, between the left sidebar and the right sidebar. It has a border, like each sidebar. It holds the tab bar, the panes of the selected tab that are not pinned, and the column of pinned panes.

### Source line 74

- Glossary entry: [Pinned pane](../../glossary/workspaces_tabs_and_panes.md#28-pinned-pane).
- Proposed destinations: Glossary, User Interface, Behaviour, Styling.

#### Pinned pane

A pane that the developer keeps visible. The pin button in the header of the pane pins the pane. A pinned pane stays visible, with the same width, when the developer changes tab or workspace.

### Source line 78

- Glossary entry: [Column of pinned panes](../../glossary/workspaces_tabs_and_panes.md#29-column-of-pinned-panes).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Column of pinned panes

The column at the right edge of the viewport. It holds the pinned panes, one above the other, in every tab.

### Source line 82

#### The parts of a pane

### Source line 84

- Glossary entry: [Usage wheel](../../glossary/workspaces_tabs_and_panes.md#210-usage-wheel).
- Proposed destinations: Glossary, User Interface, Behaviour, Styling.

#### Usage wheel

The small circle in the header of a pane that shows how much of the context window the coding agent used. The circle fills like a ring, with the colors normal, warning, and critical. It has no word and no number beside it. It appears only while the pointer is over the pane, as the buttons of the pane header do. A click on the usage wheel opens its information card, which gives the percent used, the number of tokens used, and the size of the context window.

### Source line 88

- Glossary entry: [Composition bar](../../glossary/workspaces_tabs_and_panes.md#211-composition-bar).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Composition bar

The area under a pane's terminal that opens after the developer drops image files while that pane is focused, or clicks the toggle button in that pane's header. It holds a plus button that adds images, one small picture for each image, a text input, a button "Send", and a push-to-talk button when the voice input is on ([voice_input.md](voice_input.md)). The button "Send" pastes the images in its pane, then writes the text. Each pane keeps its own open state, images, and text when focus changes. It stays open after a send. It starts closed unless the saved setting "Show the composition bar when starting a coding agent" opens it for a new pane that starts directly with a coding agent. A drop or a click on the pane's toggle button also opens it, and that button hides it.

### Source line 92

- Glossary entry: [Big view](../../glossary/workspaces_tabs_and_panes.md#212-big-view).
- Proposed destinations: Glossary, User Interface.

#### Big view

The large picture of one image of the composition bar, with a button on each side to go to the previous image and to the next image. A click on a small picture of the composition bar opens it.

### Source line 96

- Glossary entry: [Zen Mode](../../glossary/workspaces_tabs_and_panes.md#213-zen-mode).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Zen Mode

A temporary mode entered from the header of a pane. It shows only the pane whose header button was pressed, hides the surrounding interface, and keeps that pane's header visible.

### Source line 100

#### Moving a pane

The rules are in pane_move.md (`/docs/agents_rules/user_interface/workspaces_tabs_and_panes/pane_move.md` in the original documentation).

### Source line 104

- Glossary entry: [Dragged pane](../../glossary/workspaces_tabs_and_panes.md#214-dragged-pane).
- Proposed destinations: Glossary, User Interface.

#### Dragged pane

The pane whose header the developer presses and moves with the pointer.

### Source line 108

- Glossary entry: [Destination pane](../../glossary/workspaces_tabs_and_panes.md#215-destination-pane).
- Proposed destinations: Glossary, Behaviour.

#### Destination pane

The pane under the pointer when the developer releases the button. The dragged pane goes next to the destination pane.

### Source line 112

- Glossary entry: [Drop triangle](../../glossary/workspaces_tabs_and_panes.md#216-drop-triangle).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Drop triangle

One of the four triangles, top, bottom, left, and right, that two diagonal lines from corner to corner cut in a destination pane. The drop triangle that holds the pointer at the release decides on which side of the destination pane the dragged pane goes.

### Source line 116

- Glossary entry: [Move preview](../../glossary/workspaces_tabs_and_panes.md#217-move-preview).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Move preview

The half of the destination pane where the dragged pane goes. The window shows it while the pointer is over a destination pane, before the release.

### Source line 120

#### Rules

### Source line 122

- Proposed destinations: Glossary.

- The word "tab" means only a tab of Herdr, as defined above. An icon of a sidebar icon bar is not a tab.

### Source line 123

- Proposed destinations: Glossary.
- Inventory notes: Resolve alongside File view pane and Diff pane.

- The word "pane" means only a terminal inside a tab. A list of tabs is not a list of panes.

### Source line 124

- Proposed destinations: Glossary.

- Write "coding agent" in full. Never write "agent" alone, "AI agent", or "AI coding agent" for Claude Code, Codex, or Antigravity.

### Source line 125

- Proposed destinations: Glossary.

- Write "pinned pane" and "column of pinned panes". Do not write "docked pane", "side view", or "alongside".

### Source line 126

- Proposed destinations: Glossary.

- Write "composition bar". Do not write "composition box", "image zone", "attachment bar", or "drop zone" for the area under the focused pane. Write "big view", not "lightbox" or "full screen view", for the large picture.

### Source line 127

- Proposed destinations: Glossary.

- Write "dragged pane", "destination pane", "drop triangle", and "move preview" for the parts of a pane move. Do not write "target pane" or "drop zone" for them.

### Source line 128

- Proposed destinations: Glossary.

- Write "usage wheel". Do not write "context bar", "gauge", or "ring" for the circle in the header of a pane.
