# User activity source material

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Transferred source material
- Related framing: [Glossary migration sources](README.md)
- Related issue: [issue 1135](https://github.com/heidrun-org/heidrun_code/issues/1135)

Original source `/docs/agents_rules/glossary/user_activity.md` in the [pinned revision](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db). The headings identify original line numbers. Proposed destinations and inventory notes describe the transfer. Approval of a product rule is recorded with the resulting specification.

### Source line 10

This document gives one short definition for each word of the activity of the developer in front of Heidrun Code. The other words of Heidrun Code are in [index.md](source_index.md).

### Source line 12

#### The activity of the developer

### Source line 14

- Glossary entry: [User activity time](../../glossary/statistics.md#12-user-activity-time).
- Proposed destinations: Glossary.

#### User activity time

The time that the developer is active in front of Heidrun Code, counted for one workspace. It is not the agent time: the agent time is the time that a coding agent works on a request ([issue 438](https://github.com/heidrun-org/heidrun/issues/438)).

### Source line 18

- Glossary entry: [Action](../../glossary/statistics.md#11-user-activity-action).
- Proposed destinations: Glossary, Behaviour.
- Inventory notes: Action also names a project guard result. Review both definitions and the Sidebars terminology rule.

#### Action

One keyboard action or one mouse action that reaches the Heidrun Code window: a key press, a mouse button press, a turn of the mouse wheel, or a move of the mouse pointer over the window. An action that happens while the Heidrun Code window is not in front does not count.

### Source line 22

- Glossary entry: [Cool down](../../glossary/user_activity.md#11-cool-down).
- Proposed destinations: Glossary, Behaviour.

#### Cool down

The time with no action after which the developer is no longer active. It is 5 seconds.

### Source line 26

- Glossary entry: [Active period](../../glossary/user_activity.md#12-active-period).
- Proposed destinations: Glossary, Behaviour.

#### Active period

The time from the first action to the end of the cool down, in one workspace. An active period also ends when the Heidrun Code window goes behind another window, when the selected workspace changes, and when Heidrun Code closes.

### Source line 30

- Glossary entry: [User activity record](../../glossary/user_activity.md#13-user-activity-record).
- Proposed destinations: Glossary, Behaviour, Technical documentation.

#### User activity record

One line of the file `~/.config/heidrun_code/user_activity.jsonl`: the description of one active period. It holds the folder of the workspace, three times, the number of keyboard actions, the number of mouse actions, and the reason why the active period ended. It never holds a key that the developer typed, and never a text of the screen.

### Source line 34

- Glossary entry: [User activity sidebar section](../../glossary/user_activity.md#14-user-activity-sidebar-section).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### User activity sidebar section

The sidebar section of the right sidebar that shows the user activity records of today, with the icon `stopwatch`. It is a view to check by eye that the detection of the activity of the developer works.

### Source line 38

#### The Statistics window

### Source line 40

- Glossary entry: [Statistics window](../../glossary/user_activity.md#15-statistics-window).
- Proposed destinations: Glossary, User Interface.

#### Statistics window

The large window that the item "Statistics" of the More menu opens. It almost fills the main window. Its title bar holds the buttons of its tabs, and the tab "User activity" is its first tab.

### Source line 44

- Glossary entry: [User activity tab](../../glossary/user_activity.md#16-user-activity-tab).
- Proposed destinations: Glossary, User Interface.

#### User activity tab

The tab "User activity" of the Statistics window. It holds one histogram of the user activity time, and three choices: the time range (the last day, the last week, or the last month), the slot length, and the workspaces.

### Source line 48

- Glossary entry: [Histogram of the user activity time](../../glossary/user_activity.md#17-histogram-of-the-user-activity-time).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Histogram of the user activity time

The bar chart of the User activity tab. It shows the user activity time of the last day, of the last week, or of the last month, as the developer chooses, with one bar for each slot. Each bar is stacked: it has one part of one color for each chosen workspace. It has a chart legend and a chart information card, as every chart of the Statistics window has ([statistics_charts.md](statistics_charts.md)).

### Source line 52

- Glossary entry: [Slot](../../glossary/statistics.md#13-slot).
- Proposed destinations: Glossary, Behaviour.
- Inventory notes: Compare Slot in Work of one person. Preserve differences in aggregation period and available lengths.

#### Slot

One bar of a histogram of the user activity time. The developer chooses the slot length, and each time range offers its own lengths: 15 minutes, 30 minutes, or 1 hour in the last day (1 hour at first), 1 hour, 6 hours, or 1 day in the last week (1 day at first), and 6 hours or 1 day in the last month (1 day at first). A slot of minutes or hours starts on a multiple of its length of the clock, for example 14:15 to 14:30 for a slot of fifteen minutes. The last slot of a histogram is the slot of the current time, and it is not finished.
