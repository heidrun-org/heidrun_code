# User interface of Heidrun Code: Statistics window, tab "User activity", the stacked bars

- Created: 15 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Charts of the Statistics window](statistics_charts.md), [Glossary of Heidrun Code: user activity](../../glossary/user_activity.md), [Tab "User activity"](statistics_user_activity.md), [Statistics window](statistics_window.md)
- Related issue: [issue 498](https://github.com/heidrun-org/heidrun/issues/498), [issue 552](https://github.com/heidrun-org/heidrun/issues/552)

This file is a part of the rules of the tab "User activity". It gives the rules of the stacked bars of the histogram of the user activity time: the parts, the colors, the legend, and the chart information card. The other rules of the tab are in [statistics_user_activity.md](statistics_user_activity.md).

## The parts and the colors

- Each bar is stacked: it has one part for each chosen workspace, from the bottom to the top in the order of the buttons, and the height of a part is the user activity time of this workspace in the slot. The height of the bar is the user activity time of all the chosen workspaces. A slot with no workspace has a bar of height 0.
- The color of each workspace is in [statistics_and_settings_appearance.md](../../web_styling/statistics_and_settings_appearance.md).
- The buttons of the workspaces have no dot of color, because the chart legend gives the colors. The dot stays in the rows of the chart information card.

## The chart legend and the chart information card

- The histogram follows [statistics_charts.md](statistics_charts.md). The chart legend gives the name of each chosen workspace, in the order of the buttons, and it is not drawn while no workspace is listed.
- The title of the chart information card gives the start and the end of the slot, or the day for a slot of 1 day. In the last week and in the last month, the start of a slot that is shorter than 1 day also gives its day.
- The total is the word "Total" and the user activity time in minutes and seconds, or in hours and minutes for a slot of 6 hours or of 1 day.
- When two or more workspaces are chosen, one row follows for each workspace that has time in the slot, with its time in the same unit.

## The code

- The list of the workspaces, the color of each workspace, and the slots of each workspace are the pure class `UserActivityWorkspaces` in `packages/apps/web_frontend/src/lib/user_activity_workspaces.ts`.
- The legend, the parts, and the card are in `components/UserActivityHistogram.vue`, which uses the shared files of [statistics_charts.md](statistics_charts.md). The buttons of the workspaces are in `components/UserActivityTab.vue`.

## Tests

- `lib/user_activity_workspaces.test.ts` tests the colors and the slots of each workspace.
- `components/UserActivityTab.test.ts` tests the parts, the colors, the buttons with no dot, the legend, the rows and the totals of the card, the side and the arrow of the card, and the closing of the card.
