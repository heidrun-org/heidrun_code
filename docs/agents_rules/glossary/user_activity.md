# Glossary of Heidrun Code: user activity

- Created: 14 October 2026
- Last updated: 23 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md), [User interface of Heidrun Code: User activity sidebar section](../user_interface/sidebars/user_activity.md), [User interface of Heidrun Code: Statistics window](../user_interface/window/statistics_window.md)
- Related issue: [issue 440](https://github.com/heidrun-org/heidrun/issues/440), [issue 473](https://github.com/heidrun-org/heidrun/issues/473), [issue 486](https://github.com/heidrun-org/heidrun/issues/486), [issue 494](https://github.com/heidrun-org/heidrun/issues/494), [issue 498](https://github.com/heidrun-org/heidrun/issues/498), [issue 552](https://github.com/heidrun-org/heidrun/issues/552)

This document gives one short definition for each word of the activity of the developer in front of Heidrun Code. The other words of Heidrun Code are in [index.md](index.md).

## The activity of the developer

### User activity time

The time that the developer is active in front of Heidrun Code, counted for one workspace. It is not the agent time: the agent time is the time that a coding agent works on a request ([issue 438](https://github.com/heidrun-org/heidrun/issues/438)).

### Action

One keyboard action or one mouse action that reaches the Heidrun Code window: a key press, a mouse button press, a turn of the mouse wheel, or a move of the mouse pointer over the window. An action that happens while the Heidrun Code window is not in front does not count.

### Cool down

The time with no action after which the developer is no longer active. It is 5 seconds.

### Active period

The time from the first action to the end of the cool down, in one workspace. An active period also ends when the Heidrun Code window goes behind another window, when the selected workspace changes, and when Heidrun Code closes.

### User activity record

One line of the file `~/.config/heidrun_code/user_activity.jsonl`: the description of one active period. It holds the folder of the workspace, three times, the number of keyboard actions, the number of mouse actions, and the reason why the active period ended. It never holds a key that the developer typed, and never a text of the screen.

### User activity sidebar section

The sidebar section of the right sidebar that shows the user activity records of today, with the icon `stopwatch`. It is a view to check by eye that the detection of the activity of the developer works.

## The Statistics window

### Statistics window

The large window that the item "Statistics" of the More menu opens. It is as large as the large Git window. Its title bar holds the buttons of its tabs, and the tab "User activity" is its first tab.

### User activity tab

The tab "User activity" of the Statistics window. It holds one histogram of the user activity time, and three choices: the time range (the last day, the last week, or the last month), the slot length, and the workspaces.

### Histogram of the user activity time

The bar chart of the User activity tab. It shows the user activity time of the last day, of the last week, or of the last month, as the developer chooses, with one bar for each slot. Each bar is stacked: it has one part of one color for each chosen workspace. It has a chart legend and a chart information card, as every chart of the Statistics window has ([statistics_charts.md](statistics_charts.md)).

### Slot

One bar of a histogram of the user activity time. The developer chooses the slot length, and each time range offers its own lengths: 15 minutes, 30 minutes, or 1 hour in the last day (1 hour at first), 1 hour, 6 hours, or 1 day in the last week (1 day at first), and 6 hours or 1 day in the last month (1 day at first). A slot of minutes or hours starts on a multiple of its length of the clock, for example 14:15 to 14:30 for a slot of fifteen minutes. The last slot of a histogram is the slot of the current time, and it is not finished.
