# User interface of Heidrun Code: Statistics window, tab "Work of one person"

- Created: 15 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: work of one person](../../glossary/person_work.md), [Statistics window](statistics_window.md), [layout.md](layout.md), [Source "Git history"](statistics_git_history.md), [Source "AI cost"](statistics_ai_cost.md), [Totals](statistics_totals.md), [Inputs](statistics_person_work_inputs.md), [Legend filter](statistics_person_work_legend_filter.md), [Workspace selector](statistics_person_work_workspace.md), [Slot length](statistics_person_work_slots.md)
- Related issue: [issue 482](https://github.com/heidrun-org/heidrun/issues/482), [issue 523](https://github.com/heidrun-org/heidrun/issues/523), [issue 559](https://github.com/heidrun-org/heidrun/issues/559), [issue 616](https://github.com/heidrun-org/heidrun/issues/616), [issue 622](https://github.com/heidrun-org/heidrun/issues/622), [issue 629](https://github.com/heidrun-org/heidrun/issues/629), [issue 707](https://github.com/heidrun-org/heidrun/issues/707)

This file is a part of the rules of the window of Heidrun Code. The words are defined in [glossary/person_work.md](../../glossary/person_work.md). The rules of the source "AI cost" are in [statistics_ai_cost.md](statistics_ai_cost.md).

## The tab

- The Statistics window has the tab "Work of one person" after the tab "User activity". The tab "User activity" is still the selected tab when the window opens.
- The window does not read the data of the tab when it opens, so a developer that never opens the tab never waits for GitHub. The source "Git history" reads its data the first time that the tab is shown. The source "AI cost" reads the stored token usage each time that the developer chooses it, and each time that the chosen workspaces change; it never opens a whole chat history by itself ([statistics_ai_cost.md](statistics_ai_cost.md)). The source "Git history" reads each chosen folder once, keeps its data while the window stays open, and reads it again the next time that the window opens. A change of the chosen workspaces reads only the folders that are new ([statistics_person_work_workspace.md](statistics_person_work_workspace.md)).
- The tab uses the repositories and the folders of the workspaces that the workspace selector chooses ([statistics_person_work_workspace.md](statistics_person_work_workspace.md)). When no workspace is open, the tab shows the text "No workspace is open…" and reads nothing.
- While the data is read, the tab shows the text "Reading the commits, the pull requests, and the issues…" (Git history) or "Reading the stored token usage of the coding agents…" (AI cost). When the data cannot be read, it shows the error in a Bootstrap alert (`alert theme-danger`), and no chart. The error of one source does not change the other source. When the repository has no commit, no pull request, and no issue in the last 30 days, the Git history shows a text and no chart. When no coding agent used tokens in the last 30 days, the AI cost shows a text and no chart.
- The tab follows the rules of [bootstrap_utility_classes.md](../../web_styling/bootstrap_utility_classes.md). Every text of the tab is in every language, and `pnpm --filter web_frontend check:translations` shows no key of the tab as missing.

## From top to bottom

- The inputs, in two columns, then the totals and the bar chart. The rules of the inputs are in [statistics_person_work_inputs.md](statistics_person_work_inputs.md).
- The totals. For the Git history: the number of commits, the number of pull requests, the number of issues, the lines added, and the lines deleted of the person in the time range. For the AI cost: the cost of Claude Code, the cost of Codex, and the two together, in US dollars, for example "$4.00", or in tokens ([statistics_ai_cost.md](statistics_ai_cost.md)). A cost of exactly zero is "$0.00". A change of the person, of the unit, or of the time range changes the totals at once.
- Under each total, its average per day. The rules of the lines and of the average per day are in [statistics_totals.md](statistics_totals.md).
- The bar chart takes the rest of the height, with at least 240 pixels. For the AI cost, the lines of text about the cost that is not complete and about the freshness of the data are under the bar chart ([statistics_ai_cost.md](statistics_ai_cost.md)).

## The bar chart

- Both sources use the same component, `StackedBarChart.vue`. It is drawn with Plotly.js, as the histogram of the user activity time is, with the same loading and the same reading of the colors of the theme (`lib/chart_theme.ts`). It follows the dark theme and the light theme, it is drawn again when the theme, the language, the source, the unit, the workspace, the person, or the time range changes, and it changes size when the window changes size.
- It has one bar for each slot of the time range ([statistics_person_work_slots.md](statistics_person_work_slots.md)). With the slot length "1 day", it has 3, 7, 14, or 30 bars, and the last bar is today. For 3 days and 7 days, the horizontal axis shows the weekday and the date of each day. For 14 days and 30 days, it shows the date only.
- Each bar has two colors, one on top of the other (`barmode` is `stack`), and a legend names them. Git history: the two colors that the metric chooses ([statistics_git_history.md](statistics_git_history.md)). AI cost: the cost of Claude Code of the slot below, and the cost of Codex of the slot above. The colors of both sources are in [statistics_and_settings_appearance.md](../../web_styling/statistics_and_settings_appearance.md).
- The vertical axis starts at 0. For the Git history, it shows whole numbers only, and it goes up one by one while the highest bar is 8 or less. For the AI cost, it shows US dollars with the sign "$", or tokens with one unit for all ticks. A higher bar lets Plotly.js choose the step.
- Both sources follow [statistics_charts.md](statistics_charts.md): a chart legend above the bars, and a chart information card beside the bar under the pointer. The title of the card is the slot, for example "Monday, October 12" for a day. Git history: the card has no total, and one row for each color of the metric, each with its number, and a color that has 0 has no row. AI cost: the card has the total of the slot, and one row for each coding agent that has a cost or tokens in the slot, with its amount in the unit that is chosen.
- Heidrun Code remembers every choice of the inputs ([statistics_remembered_selections.md](statistics_remembered_selections.md)).
- A click on a name of the chart legend filters the chart, and Heidrun Code remembers the filter between two runs. The rules are in [statistics_person_work_legend_filter.md](statistics_person_work_legend_filter.md).
- The title of the chart gives the name of the person for the Git history ("{person}: commits and pull requests, in slots of 1 day", or "{person}: lines added and lines deleted, in slots of 1 day"), and "AI cost in slots of 1 day, for each coding agent" (or "Tokens in slots of…") for the AI cost.

## What counts, and where the data comes from

- The source "Git history": [statistics_git_history.md](statistics_git_history.md).
- The source "AI cost": [statistics_ai_cost.md](statistics_ai_cost.md).
- The workspace that both sources read: [statistics_person_work_workspace.md](statistics_person_work_workspace.md).

## Tests

- `lib/person_work.test.ts` tests the finding of the people (name and login, accents, hyphens, emails of GitHub, the shown name, the order), and the counting of each slot and the totals. The tests of the slots are in [statistics_person_work_slots.md](statistics_person_work_slots.md).
- `components/PersonWorkTab.test.ts` tests the filter by a click on the chart legend and its memory, the reading of the Git history, the radio button groups, the workspace selector, the person chooser, the totals, the stacked bars, their legends and their chart information cards, the radio button group of the metric, the change of the person, of the source, of the metric, and of the time range, and the texts of the error, of the missing workspace, of GitHub, and of the empty repository, with a replacement for Plotly.js. It tests the source "AI cost" too: [statistics_ai_cost.md](statistics_ai_cost.md).
- `components/StatisticsModal.test.ts` tests that the tab list has the two tabs, and that the tab "Work of one person" reads its data only when it is shown.
- The Rust tests of the module `person_work` test the command with a real Git repository and a real SQLite file in a temporary folder, and with a fake GitHub: the time range, the author, the date, and the lines of a commit, the merge commits, the pull requests and the issues, the failure of GitHub, a folder that is not a repository, and a text that is not a time.
