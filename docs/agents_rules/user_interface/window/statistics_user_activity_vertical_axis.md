# User interface of Heidrun Code: Statistics window, tab "User activity", the vertical axis

- Created: 19 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Charts of the Statistics window](statistics_charts.md), [Tab "User activity"](statistics_user_activity.md), [Stacked bars](statistics_user_activity_stacked_bars.md), [Glossary of Heidrun Code: user activity](../../glossary/user_activity.md)
- Related issue: [issue 683](https://github.com/heidrun-org/heidrun/issues/683), [issue 498](https://github.com/heidrun-org/heidrun/issues/498)

This file is a part of the rules of the tab "User activity". It gives the rules of the vertical axis of the histogram of the user activity time. The other rules of the tab are in [statistics_user_activity.md](statistics_user_activity.md).

## The scale

- The vertical axis starts at 0. Its top fits the highest bar, so a short activity in a long slot stays readable. A fixed top, the length of the slot, made a few short bars hard to read ([issue 683](https://github.com/heidrun-org/heidrun/issues/683)).
- The height of a bar is in minutes for a slot of 15 minutes, 30 minutes, or 1 hour, and in hours for a slot of 6 hours or of 1 day.
- The top is one of a few round values, and it is never more than the length of the slot:
  - In minutes: 5, 10, 15, 30, or 60.
  - In hours: 1, 2, 3, 6, 12, or 24.
- The top is the lowest of these values that is at least the height of the highest bar plus a tenth, so the highest bar never touches the top. When no value is high enough, the top is the length of the slot. A histogram with no activity has the lowest top.
- The highest bar is the bar of the busiest slot. It is stacked, so it holds the time of every chosen workspace. A change of the workspaces, of the time range, or of the slot length fits the top again.
- The space between two lines is 1, 2, 5, 5, and 10 minutes for the tops in minutes, and 0.5, 0.5, 1, 1, 2, and 4 hours for the tops in hours.

## The title of the axis

- The title gives the unit and the length of the slot, for example "Minutes of activity in a slot of 1 hour" or "Hours of activity in a slot of 1 day". The scale changes with the activity, so the title keeps the length of the slot on the screen. The title is translated.

## A scale never stays from an earlier choice

- The component always gives the range of the axis to Plotly.js (`autorange` is false), and never leaves it to the automatic range of Plotly.js. The same slot length and the same highest bar always give the same axis, whatever the developer chose before. A switch between a slot of 1 day and a slot of 1 hour, repeated, shows the scale of the slot length in use each time.

## The code

- The choice of the unit, of the top, and of the space between two lines is the pure class `UserActivityVerticalAxis` in `packages/apps/web_frontend/src/lib/user_activity_vertical_axis.ts`. It has no clock: the caller gives the slot length and the time of the busiest slot.
- `components/UserActivityHistogram.vue` gives the axis to Plotly.js.

## Tests

- `lib/user_activity_vertical_axis.test.ts` tests the unit, the lowest top, the top for several heights, the top that is never over the length of the slot, the same axis each time, and the lines.
- `components/UserActivityTab.test.ts` tests the top for a short activity in a slot of 1 hour, the repeated switch between 1 day and 1 hour, the stacked bar of two workspaces, the hidden workspace, the title of the axis, and the histogram with no activity. `components/StatisticsModal.test.ts` tests the axis of the default histogram.
