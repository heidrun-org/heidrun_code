# Workspaces, Tabs, and Panes

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Approved glossary definitions
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
