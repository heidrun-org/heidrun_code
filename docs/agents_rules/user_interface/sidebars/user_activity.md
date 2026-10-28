# User interface of Heidrun Code: User activity sidebar section

- Created: 14 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: user activity](../../glossary/user_activity.md), [Sidebars](sidebars.md), [Status bar](../window/status_bar.md)
- Related issue: [issue 440](https://github.com/heidrun-org/heidrun/issues/440)

This file is a part of the rules of the sidebars of Heidrun Code. The words are defined in [glossary/user_activity.md](../../glossary/user_activity.md).

## Detection

- Heidrun Code listens on the window, before any component, to the events `keydown`, `mousedown`, `mousemove`, and `wheel`, in the capture phase. A terminal pane that stops an event does not hide it from Heidrun Code.
- The developer is active when the Heidrun Code window has the focus, a workspace is selected, and the last action is less than the cool down ago. The cool down is 5 seconds.
- An action while the Heidrun Code window does not have the focus does not count. When the window loses the focus, the active period ends at once.
- The code of the detection is in `lib/user_activity.ts` (the rules, with no clock and no timer) and in `stores/user_activity.ts` (the events, the timer, and the file).

## The user activity records

- Each active period ends with one user activity record, written as one JSON line at the end of the file `~/.config/heidrun_code/user_activity.jsonl`. The folder `HEIDRUN_CODE_DIR` replaces `~/.config/heidrun_code` when the variable is set, like for the history.
- A record has these fields: `workspaceFolder`, `startedAt`, `lastActionAt`, `endedAt`, `keyboardActionCount`, `mouseActionCount`, and `endReason`.
- `workspaceFolder` is the folder of the workspace, not its name and not its identifier: the worktree path of the workspace, or else the current working directory of one of its panes.
- Each time is an ISO 8601 text in the time zone of the computer, with the milliseconds and the offset, for example `2026-10-14T19:52:03.412+02:00`. It is never a number.
- `endedAt` is the time when the developer stopped to be active: `lastActionAt` plus the cool down, or the earlier time of the event that ended the active period.
- `endReason` is one of `cool_down`, `window_behind`, `workspace_changed`, and `app_closed`. After `workspace_changed`, when the developer is still active, a new active period starts at once in the new workspace, and the change counts as its first action. The record of an active period that is running when the application quits through the menu may be lost, because the page has no time to write it.
- A record never holds a key that the developer typed, and never a text of the screen. The counts are numbers only.
- The Statistics window reads the records through the data layer, not from the file ([statistics_window.md](../window/statistics_window.md)).
- The file keeps the records of the last 400 days. A line that is not a JSON object with a valid `endedAt` is removed at the next read.

## The User activity sidebar section

- It belongs to the right sidebar, after the Past chats sidebar section, with the icon `stopwatch` and no number. Its title is "User activity".
- Its header has the title, and a Bootstrap badge at the right: "Active" in the success color, or "Not active" in the secondary color. Under the header, the text "since 19:52:03" shows while the developer is active.
- Below, from top to bottom: the folder of the selected workspace, the total time of each folder today (the longest first), and the last 30 active periods (the newest first), then the path of the file. A period shows its time range, its length, its folder, the number of keyboard actions, the number of mouse actions, and the reason why it ended, in words.
- A folder path stays on one line and scrolls sideways while the pointer is over its row, like every folder path ([layout.md](../window/layout.md)).

## The test aid in the menu bar

- While the environment variable `HEIDRUN_CODE_STATUS_ITEM_USER_ACTIVITY` is set, the icon of Heidrun Code in the status item of the macOS menu bar is faded while the developer is not active, and normal while the developer is active. The rule is in [status_bar.md](../window/status_bar.md).
