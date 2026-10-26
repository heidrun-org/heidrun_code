# User interface of Heidrun Code: Statistics window, tab "Work of one person", legend filter

- Created: 17 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: statistics charts](../../glossary/statistics_charts.md), [Tab "Work of one person"](statistics_person_work.md), [Statistics charts](statistics_charts.md), [Last state of each option](window_state_and_start.md)
- Related issue: [issue 629](https://github.com/heidrun-org/heidrun/issues/629), [issue 707](https://github.com/heidrun-org/heidrun/issues/707)

This file is a part of the rules of the tab "Work of one person". The component is `components/StackedBarChart.vue`, and the tests are in `components/PersonWorkTab.test.ts` and `stores/settings.test.ts`.

## The filter

- A click on a name of the chart legend filters the chart ([issue 629](https://github.com/heidrun-org/heidrun/issues/629)): the chart then shows only the color of this name, for example only the commits, and the names of the other colors stay in the legend, faded. A click on another name shows only that color. A second click on the name of the only color that shows brings every color back. While the chart shows one color, the vertical axis fits this color, and the chart information card has no total and shows only the row of this color. The filter changes the chart only: the totals do not change. A change of the time range, of the slot length, of the person, of the workspaces, or of the unit keeps the filter. Each chart has its own filter: the commits and the pull requests, the lines added and the lines deleted, and the AI cost (in US dollars and in tokens). A change of the metric shows the filter of the other chart, and the filter of the first chart comes back with the first metric. The legend sends the click with the event `plotly_legendclick` of Plotly.js, and the chart sets `itemclick` to false, so Plotly.js does nothing else with the click.

## The memory of the filter

- Heidrun Code remembers the filter of each chart between two runs: the next run draws each chart with the same filter. The rule "Last state of each option" in [window_state_and_start.md](window_state_and_start.md) applies.
- The option `statisticsLegendFilters` of the store `stores/settings.ts` saves the filter. It is an object: the name of a chart points to the identifier of the only color that shows. A chart with no entry shows every color. A second click on the name of the only color that shows removes the entry.
- The names of the charts are `git_history_commits_and_pull_requests`, `git_history_lines`, and `ai_cost`. The chart of the AI cost has one filter for both units, US dollars and tokens, because both units have the same colors.
- The identifiers of the colors are `commits`, `pull_requests`, `lines_added`, `lines_deleted`, `claude`, and `codex`. The store keeps the identifier, and not the name of the color, so that a change of the language keeps the filter.
- A saved identifier that the chart does not have shows every color, and the store keeps it. An entry that is not a text, and a value that is not an object, are dropped at the start.
- The filter is saved apart from the other selections of the tab, which [statistics_remembered_selections.md](statistics_remembered_selections.md) lists.
