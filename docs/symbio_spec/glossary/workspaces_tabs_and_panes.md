# Workspaces, Tabs, and Panes

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Glossary definitions with individually recorded approvals
- Related framing: [Glossary](README.md)
- Related issue: [issue 1129](https://github.com/heidrun-org/heidrun_code/issues/1129)

## 0. Introduction

### 0.1. Scope

Workspace and Pane definitions, including Git worktree, File view pane, and Diff pane.

## 1. Definitions

### 1.1. Workspace

One project with a fixed workspace folder. In most cases, the workspace folder is one repository. A Workspace holds Tabs.

Approval: [developer’s Workspace definition](https://github.com/heidrun-org/heidrun_code/commit/663c14c92df21d70d4fdb4c348cfc94d82921983).

### 1.2. Git worktree

One working folder registered by Git in a repository. It has its own checked-out branch, or no branch when its head is detached.

Approval: [Git worktree product requirements](https://github.com/heidrun-org/heidrun_code/issues/685) and [reviewed glossary wording](https://github.com/heidrun-org/heidrun_code/commit/14131973c105b6462cc46674f1405e45769ed001).

### 1.3. Pane

A Pane is an area within a Tab that holds content. A Tab can contain several Panes. A Pane can show a terminal, including a terminal running a coding agent, a file in a [File view pane](#14-file-view-pane), or the changes to a file in a [Diff pane](#15-diff-pane). Each Pane has a Pane header with a title, information about the Pane, and controls.

Approval: [decision 000004](../decisions/2026/11/decision-000004-pane.md).

### 1.4. File view pane

A [Pane](#13-pane) that shows a file.

Approval: [decision 000004](../decisions/2026/11/decision-000004-pane.md).

### 1.5. Diff pane

A [Pane](#13-pane) that shows the changes to a file.

Approval: [decision 000004](../decisions/2026/11/decision-000004-pane.md).

## 2. Transferred definitions

The following entries come from the glossary transfer. Individual approval links identify the decisions already recorded.

### 2.1. Workspace folder

The fixed folder chosen when a Workspace is created.

[Transferred source](../proposals/glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-26).

### 2.2. Tab

An entry in the Tab bar that belongs to one Workspace and holds one or more Panes.

[Transferred source](../proposals/glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-34).

### 2.3. Front matter

The block at the start of a Markdown file between two lines of three dashes.

[Transferred source](../proposals/glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-50).

### 2.4. Front matter card

The card that shows the Front matter above the rendered Markdown in a File view pane.

[Transferred source](../proposals/glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-54).

### 2.5. Coding agent

A program the developer runs in a Pane to write code with a language model.

[Transferred source](../proposals/glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-60). The [coding agent naming decision](https://github.com/heidrun-org/heidrun_code/issues/403) establishes the term. The supported list remains open.

Review note: Keep the official term and verify the supported list before recording a support expectation.

### 2.6. Tab bar

The row at the top of the Viewport that shows the Tabs of the selected Workspace.

[Transferred source](../proposals/glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-66).

### 2.7. Viewport

The main area between the left and right sidebars that holds the Tab bar and Panes.

[Transferred source](../proposals/glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-70).

### 2.8. Pinned pane

A Pane that stays visible as the developer changes Tabs or Workspaces.

[Transferred source](../proposals/glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-74).

### 2.9. Column of pinned panes

The column at the right edge of the Viewport that holds the Pinned panes.

[Transferred source](../proposals/glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-78).

### 2.10. Usage wheel

The indicator in a Pane header that shows how much of the coding agent’s context window was used.

[Transferred source](../proposals/glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-84).

### 2.11. Composition bar

The area under a Pane’s terminal for composing text and adding images.

[Transferred source](../proposals/glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-88).

### 2.12. Big view

The large preview of an image from the Composition bar.

[Transferred source](../proposals/glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-92).

### 2.13. Zen Mode

A temporary mode that shows the selected Pane and its Pane header.

[Transferred source](../proposals/glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-96).

### 2.14. Dragged pane

The Pane the developer is moving by dragging its Pane header.

[Transferred source](../proposals/glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-104).

### 2.15. Destination pane

The Pane next to which the Dragged pane is placed.

[Transferred source](../proposals/glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-108).

### 2.16. Drop triangle

A region that determines on which side of the Destination pane the Dragged pane goes.

[Transferred source](../proposals/glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-112).

### 2.17. Move preview

The preview of the Dragged pane’s destination shown before release.

[Transferred source](../proposals/glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-116).
