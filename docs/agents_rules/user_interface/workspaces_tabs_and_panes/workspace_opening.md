# User interface of Heidrun Code: opening a workspace

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Workspace](workspace.md), [Tabs](tabs.md)
- Related issue: [issue 379](https://github.com/heidrun-org/heidrun/issues/379), [issue 685](https://github.com/heidrun-org/heidrun/issues/685), [issue 688](https://github.com/heidrun-org/heidrun/issues/688)

The information card of the workspace status bar section shows one "Open workspace" row that opens the folder picker. The More button at the far right opens a floating submenu above the row containing the three ways to open a workspace.

## Open workspace from folder

- The entry "Open workspace from folder" asks for a folder, then creates the workspace with the name of the folder and selects it at once, with its first tab and its first pane. Herdr creates this first tab with the workspace, so Heidrun Code creates no other tab. The pane of this first tab runs the default command of a new tab, the option `newTabCommand` of the settings, the same as a plain click on the plus button of the tab bar ([tabs.md](tabs.md)). With "terminal", the pane is the shell that Herdr started in the folder. With Claude Code, Codex, or Antigravity, Heidrun Code renames the first tab after the coding agent and starts the coding agent in the first pane ([issue 379](https://github.com/heidrun-org/heidrun/issues/379), [issue 688](https://github.com/heidrun-org/heidrun/issues/688)).

## Open workspace from this repo's worktrees

- The entry "Open workspace from this repo's worktrees" sits after "Open workspace from folder" in the submenu. It is disabled when there is no selected workspace or the selected workspace has no repository root. A disabled entry has no hover treatment or title tooltip. The cursor over the information card is in [status_bar_appearance.md](../../web_styling/status_bar_appearance.md). The entry opens a centered window titled "Open workspace from this repo's worktrees". Reading begins when the developer selects the entry. When the read finishes within half a second, the window opens with the worktrees already shown. Otherwise, it opens in the loading state and shows the worktrees when the read finishes. The window lists every existing worktree of the selected workspace's repository, including the main checkout, and refreshes the list each time it opens or when the developer selects the refresh button in the header. During a refresh, the current rows stay visible until the refreshed list is ready. The rows can be sorted by name, creation time, or latest commit time, in either order. Each row shows a folder icon beside its branch or detached-head name, its folder path, its creation time when available, and the time of its latest commit when available. A separator appears between rows. Selecting a row selects the existing workspace for that folder, or creates and selects a workspace when none exists. A copy button in the top right of each row copies the folder path and shows a check for two seconds after a successful copy ([issue 685](https://github.com/heidrun-org/heidrun/issues/685)).


## Open workspace from this repo's submodules

- The entry "Open workspace from this repo's submodules" follows "Open workspace from this repo's worktrees" and has the same requirements for a selected workspace and a repository root. The entry uses the same selection window, sorting, refresh, and copy controls as the worktree entry. The window lists the direct Git submodules of the selected workspace's repository by name and path relative to the repository, with the folder creation and latest commit times when available. Selecting an available submodule opens its folder as a workspace or selects the existing workspace for that folder. A submodule without a checkout is disabled and shows an explanation ([issue 1115](https://github.com/heidrun-org/heidrun_code/issues/1115)).


## Open as workspace from the File explorer sidebar section

- The context menu shows **Open as workspace** after **Open with VS Code**. Choosing **Open as workspace** opens the folder of the right-clicked row as a workspace in Heidrun Code and selects the workspace. The same action opens a Git worktree folder. On a file row, **Open as workspace** stays visible and disabled ([issue #1131](https://github.com/heidrun-org/heidrun_code/issues/1131)).
