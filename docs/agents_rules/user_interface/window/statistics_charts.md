# User interface of Heidrun Code: Statistics window, the charts

- Created: 15 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: charts of the Statistics window](../../glossary/statistics_charts.md), [Statistics window](statistics_window.md), [Tab "User activity"](statistics_user_activity.md), [Tab "Work of one person"](statistics_person_work.md)
- Related issue: [issue 498](https://github.com/heidrun-org/heidrun/issues/498), [issue 629](https://github.com/heidrun-org/heidrun/issues/629)

This file gives the rules that every chart of the Statistics window follows, today and in the future. Read it each time that you add a chart, or change a chart, in the Statistics window.

## Every chart has a legend and a chart information card

- Every chart of the Statistics window has a chart legend and a chart information card (both words are defined in [glossary/statistics_charts.md](../../glossary/statistics_charts.md)). A new chart without them is not finished.
- The chart legend is one line above the bars, at the left, in the order of the parts of a bar. A click on it does nothing, so a click never hides a color, except in the bar chart of the tab "Work of one person" (`StackedBarChart.vue`): there a click on a name filters the chart, as [statistics_person_work.md](statistics_person_work.md) says, and the settings keep this filter between two runs. The chart has no legend while it has no color to name.
- The tooltip of Plotly.js is always off (`hoverinfo` is `none` on every trace), because it takes only a few tags of HTML. The chart reads the events `plotly_hover` and `plotly_unhover` of Plotly.js, and draws the chart information card itself.
- The chart information card is a popover of Bootstrap, written in HTML. It shows while the pointer is over a bar, it never takes the pointer, and it closes when the pointer leaves the bar, and when the data, the time range, the theme, or the language changes.
- The chart information card sits beside the bar: at the right of a bar in the left half of the chart, and at the left of a bar in the right half. An arrow touches the bar at the height of the pointer. The middle of the card is at the height of the pointer, and the card stays inside the chart.
- The first line is the title of the bar: the slot, or the day. A second line, the word "Total" and the total of the bar, is there only when the colors of the bar can be added, for example the user activity time of the workspaces or the AI cost of the coding agents. A chart whose colors cannot be added has no total, for example the commits and the pull requests of a day.
- One row follows for each color that has a value above 0 in the bar: a small dot of the color of the part, its name, and its value with its unit. A chart with one color and a total has no row, because the row would repeat the total. A row never has a color that is not in the chart legend.
- The name of a color and the title are written as text, never as markup, so a sign `<` of a folder name does not make a tag.

## The code

- The place of the card beside a bar, the margins of the chart, the gap between two bars, and the options of the chart legend are the pure class `ChartInformationCard` and the constants `CHART_MARGIN`, `CHART_BAR_GAP`, and `CHART_LEGEND` in `packages/apps/web_frontend/src/lib/chart_information_card.ts`. A chart takes its margins, its gap, and its legend from this file, so the card can find the bar without the internal values of Plotly.js.
- The card is the component `components/ChartInformationCardPopover.vue`. The parent of the component has the class `position-relative`. A chart gives it the title, the total, and the rows, and the place that `ChartInformationCard.anchor` computes.
- The charts are `components/UserActivityHistogram.vue` ([statistics_user_activity_stacked_bars.md](statistics_user_activity_stacked_bars.md)) and `components/StackedBarChart.vue` ([statistics_person_work.md](statistics_person_work.md)). A new chart uses `ChartInformationCardPopover.vue` and does not copy it.

## Tests

- `lib/chart_information_card.test.ts` tests the side, the edge, the top, and the arrow of the card.
- The test of each chart tests that the tooltip of Plotly.js is off, that the chart legend is there, that no card shows until the pointer is over a bar, the title, the total, and the rows of the card, that a color with no value has no row, and that the card closes when the pointer leaves the bar. A new chart adds the same tests in the same change.
