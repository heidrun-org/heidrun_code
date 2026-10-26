# The status dot

- Created: 12 October 2026
- Last updated: 21 October 2026
- Status: Maintained status dot rules, with status transition differences noted
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../agents_rules/glossary/index.md)
- Related issue: [issue 739](https://github.com/heidrun-org/heidrun/issues/739), [issue 767](https://github.com/heidrun-org/heidrun/issues/767)

The status dot is a small colored indicator: a solid dot for Blocked, Finished, and Idle, and a spinning ring for Working. It shows the status of a pane, of a tab, of a workspace, and of the application, so that the developer sees at a glance which panes work, which pane waits for an answer, and which pane has finished. The three levels (workspace, tab, pane) have the definitions of [the glossary](../agents_rules/glossary/index.md).

## The statuses

A pane has one status at a time.

| Status | Color and appearance | Meaning |
| --- | --- | --- |
| Blocked | Solid red dot | The coding agent stopped, and needs an answer from the developer: a question or a permission. |
| Working | Purple spinning ring | The coding agent works, or a command runs in a plain terminal. |
| Finished | Solid green dot | The coding agent or the command was doing something and is now done. No specific answer, such as an answer to a question or a permission request, is required. The value in the code is `done`. |
| Idle | Solid gray dot | The coding agent has started but has not yet received a task, or the Finished status has ended under the rules below. A plain terminal is idle before a command starts and after its Finished status ends. |

The same status has the same color and appearance wherever the status appears for a pane, tab, workspace, or application. Working is the only animated status. Blocked, Finished, and Idle remain static.

The dark theme and mobile website use the colors of the existing macOS status item. The light theme uses darker shades of the same status colors so that the indicators remain visible on a light background.

| Status | Dark theme and mobile website | Light theme |
| --- | --- | --- |
| Blocked | `#eb4034` | `#cc3a35` |
| Working | `#bf5af2` | `#8e2ac4` |
| Finished | `#34c759` | `#1e8a4c` |
| Idle | `#8f8f8f` | `#737373` |

The Working ring has no filled center. The ring has a gap and makes one full turn every 0.8 seconds. Changing status restores the static dot without keeping the rotation. A connection indicator is a separate kind of information: a connected computer has a static green dot, without the Working animation.

- The code sets the colors with the variables `--blocked`, `--working`, `--done`, and `--idle` in `packages/apps/web_frontend/src/styles.css`.
- Herdr has a fifth value, `unknown`. Herdr gives it when no rule matches the pane. The dot of this status is gray.
- A hollow gray ring is not a status. It shows that no coding agent runs in the workspace.

## The status of a pane

### A pane with a coding agent

When the developer starts a coding agent in a pane, the pane is idle. The next table gives each change of status, and the event that causes it.

| From | To | Event |
| --- | --- | --- |
| Idle | Working | The developer sends a message to the coding agent, and the agent starts to work. |
| Working | Blocked | The coding agent needs an answer, and it waits. |
| Blocked | Working | The developer answers, and the coding agent continues. |
| Working | Finished | The coding agent ends its answer. |
| Finished | Idle | The configured delay expires, or the developer acknowledges or removes the Finished card in the Needs you sidebar section, whichever happens first. |
| Finished | Working | The developer sends a new task and the coding agent starts to work before Finished changes to Idle. |

The delay starts when the pane becomes Finished. The delay is the existing configurable delay for Finished items, which defaults to 15 minutes. When the delay is set to never, only acknowledgement or removal of the Finished card changes an otherwise inactive Finished pane to Idle. A new task can make the pane Working before the delay expires; the previous task's delay must not change a Working or Blocked pane to Idle. A Blocked pane never becomes Idle because of the Finished delay.

```
idle ──▶ working ──▶ finished ──▶ idle
            │  ▲
            ▼  │
          blocked
```

### A pane with a plain terminal

A pane that runs a plain terminal follows the same state machine, so that every pane works in the same way.

- The pane starts idle.
- The pane becomes working when the developer starts a command that is not a coding agent, for example `htop`.
- The pane becomes finished when the command ends.
- A finished pane becomes idle when the configured delay expires, or the developer acknowledges or removes its Finished card in the Needs you sidebar section, whichever happens first. A new command makes the pane Working without waiting for that change to Idle.
- When the command is a coding agent, the pane stays idle until the developer sends a message to the agent.

## The status of a tab

The status of a tab comes from the statuses of the panes of the tab. Heidrun Code starts from the status computed by Herdr, applies the completion acknowledgements described below, and shows the resulting status in the tab bar (`TabBar.vue`). The status with the highest priority wins, in this order:

1. Blocked
2. Working
3. Finished
4. Idle
5. Unknown

- One blocked pane makes the whole tab blocked, even when the other panes work.
- Herdr says in its documentation that a blocked pane makes its tab and its workspace blocked. The order of the other statuses was observed on Herdr 0.9.3 for Finished before Idle before Unknown. Heidrun Code uses the complete order in `STATUS_RANK` in `packages/apps/web_frontend/src/lib/tab_icon.ts`, to choose the icon of the tab.
- A blocked tab shows a static red dot.

## The status of a workspace

The status of a workspace comes from the statuses of the tabs of the workspace, with the same priority as for a tab. Heidrun Code applies the same completion acknowledgements to the status computed by Herdr. Heidrun Code shows the resulting status before the name of each workspace in the information card of the workspace status bar section (`dotClassesOf` in `WorkspaceStatusSummary.vue`).

A workspace in which no pane runs a coding agent shows the hollow ring in the place of a color.

## The status of the application

The application has one status dot, before the name of the selected workspace in the workspace status bar section, at the left end of the status bar (`dotClasses` in `WorkspaceStatusSummary.vue`). Two rules choose its color, in this order:

1. When a coding agent in **another** workspace is blocked, the dot is red. Otherwise, when a coding agent in another workspace has finished, the dot is green. The coding agents of the selected workspace never count here.
2. Otherwise, the dot shows the status of the selected workspace, or the hollow ring when no coding agent runs in it.

A coding agent in another workspace counts for the first rule only when its card is in the Needs you sidebar section (`otherWorkspaceStatus` in `session.ts`). A Finished card leaves the section and its pane becomes Idle when the configured delay expires, or the developer acknowledges or removes the Finished card, whichever happens first. The delay defaults to 15 minutes. A coding agent that works in another workspace does not change the dot. Removing a Blocked card does not answer the coding agent's question or permission request, and does not make the pane Idle.

## Completion acknowledgements in Heidrun Code

The desktop session store retains the raw Herdr snapshot for lifecycle tracking and publishes a displayed snapshot through `FinishedStatus` in `packages/apps/web_frontend/src/lib/finished_status.ts`. Hiding a Finished card or selecting its pane records the terminal identifier and completion sequence in the saved dismissal record. The timer records the same acknowledgement when the configured delay expires. The timer checks every Finished pane, including a pane whose card is not visible. The interval is 30 seconds, so automatic expiry can appear up to 30 seconds after the chosen delay.

An acknowledged completion becomes Idle in both the pane and coding agent records of the displayed snapshot. Heidrun Code recalculates the affected tab and workspace statuses from their remaining panes in the priority order above. The application indicator and the macOS status item read the same displayed pane statuses. Raw snapshots remain unchanged, so another snapshot cannot restore an acknowledged completion or create a false work run. New completion sequences start a new delay even when the snapshots miss the intervening Working status. A pending read of a coding agent's output cannot restore an acknowledged card.

Hiding a Blocked card does not change the Blocked status. A detected question is retained during automatic expiry because the question still needs an answer; selecting or hiding that card acknowledges the result in Heidrun Code.

### Remaining differences from Herdr and unverified behavior

Herdr 0.9.3 exposes acknowledgement through explicit focus, but exposes no separate acknowledgement request. Live controlled status reports confirmed that `agent.focus` changed `done` to `idle` while also changing focus. Heidrun Code therefore records acknowledgements locally rather than moving Herdr focus on card removal or automatic expiry. A direct Herdr read can still report `done` after Heidrun Code displays Idle, until Herdr itself acknowledges the result. Other Herdr clients and Heidrun Code Mobile retain the Herdr status; this desktop change does not rewrite the lifecycle report or synchronize acknowledgements to those clients.

The plain-terminal state machine above remains the agreed behavior. Controlled coding agent status reports do not independently verify how Herdr detects an ordinary shell command ending.

## The levels together

```
Application ◀── other workspaces: blocked, then finished
     │            (otherwise the selected workspace)
Workspace   ◀── the tabs of the workspace
     │
Tab         ◀── the panes of the tab
     │
Pane        ◀── the state machine of the pane
```

| Dot | Where it shows | How its status is chosen |
| --- | --- | --- |
| Pane | The header of the pane (`PaneCard.vue`) | The state machine of the pane. |
| Tab | The tab bar (`TabBar.vue`) | Herdr pane statuses, with Heidrun Code completion acknowledgements applied. |
| Workspace | The list of workspaces in the information card (`WorkspaceStatusSummary.vue`) | The pane statuses, with Heidrun Code completion acknowledgements applied. |
| Application | The workspace status bar section (`WorkspaceStatusSummary.vue`) | Heidrun Code, from the cards of the Needs you sidebar section, then from the selected workspace. |
