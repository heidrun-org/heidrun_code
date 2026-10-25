# Work of one person statistics

- Created: 15 October 2026
- Last updated: 25 October 2026
- Status: Maintained description of the statistic of the tab "Work of one person"
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: work of one person](../agents_rules/glossary/person_work.md), [Tab "Work of one person"](../agents_rules/user_interface/window/statistics_person_work.md), [Slot length](../agents_rules/user_interface/window/statistics_person_work_slots.md), [Source "AI cost"](../agents_rules/user_interface/window/statistics_ai_cost.md), [Rule for GitHub and GitLab support](../agents_rules/github_and_gitlab_support.md)
- Related issue: [issue 489](https://github.com/heidrun-org/heidrun/issues/489), [issue 482](https://github.com/heidrun-org/heidrun/issues/482), [issue 558](https://github.com/heidrun-org/heidrun/issues/558), [issue 616](https://github.com/heidrun-org/heidrun/issues/616)

This file describes the statistic of the tab "Work of one person" of the Statistics window, and the data layers that it reads. The words are defined in the [glossary of the work of one person](../agents_rules/glossary/person_work.md). The rules of the tab are in [statistics_person_work.md](../agents_rules/user_interface/window/statistics_person_work.md). The data layers are explained in [the_four_data_layers.md](the_four_data_layers.md).

## What the statistic shows

One bar chart of the last 3, 7, 14, or 30 days, with one bar for each slot. A slot is 1 hour, 6 hours, or 1 day, as the developer chooses with the slot length ([statistics_person_work_slots.md](../agents_rules/user_interface/window/statistics_person_work_slots.md)). The developer chooses one of two sources:

- Git history: for one person, the commits and the pull requests of each slot, and the number of issues of the time range.
- AI cost: for each coding agent, the estimated cost in US dollars, or the tokens, of each slot. It is not about one person.

The chart has a legend that names each color. A card beside the bar under the pointer, with an arrow that points to the bar, gives the day, the total of the AI cost, and the value of each color.

The two sources read the data layers in two different ways.

## Source "Git history"

### The data layers that it reads

| Data layer | Table | Fields that the statistic uses |
| --- | --- | --- |
| `data_layer_source_control` | `commits` | `authorName`, `authorEmail`, `committedAt`, and `parents`. A commit with two or more parents is a merge, and it does not count. |
| `data_layer_code_hosting` | `pull_requests` | `author` and `createdAt`. |
| `data_layer_code_hosting` | `issues` | `author` and `createdAt`. |

### The way of the data

1. The tab is shown for the first time. It calls the command `person_work_synchronize` with the folder of the selected workspace.
2. The command finds the repository `owner/name` from the remote `origin` of the folder, and takes the lock of the SQLite file.
3. The command calls the function `refresh_source_control` of `data_layer_source_control`. The function runs `git log` and copies the new commits into the table `commits`.
4. The command calls the function `refresh_code_hosting` of `data_layer_code_hosting`. The function asks GitHub, with the command `gh`, for the issues and the pull requests that changed, and copies them into the two tables.
5. When GitHub fails, for example without a network, the command does not stop. It gives the message of the error and the repository in its answer. The tab shows a warning that the pull requests and the issues can be out of date.
6. The tab calls the command `person_work_in_range` with the repository and the 30 days that end today at midnight. The command reads the SQLite file only, with the functions `find_commits`, `find_pull_requests_opened_between`, and `find_issues_opened_between`, so it works when Git and GitHub are not available. The functions remove the merge commits.
7. The tab cuts the same rows into the days of the two time ranges, for each person. The pure class `PersonWork` does the calculation.

The first read of a repository reads every pull request and every issue from GitHub, which takes about 20 seconds for this repository. The next reads take about 5 seconds.

### What counts

- A commit counts for its author, on the day of its commit date.
- A pull request and an issue count for the login of their author, on the day of their creation date.
- A commit knows its author by a name and an email. A pull request or an issue knows its author by a login on GitHub. The tab finds one person from two spellings with the rule of the [glossary](../agents_rules/glossary/person_work.md). A person with a different login and a different name is two people.

## Source "AI cost"

### The data layer that it reads

The source "AI cost" reads the stored token usage of `data_layer_coding_agents`: the table `token_usage_minutes` and the view `token_usage_with_cost`. The tables, the minute, the workspace, the prices, the days, and the measurements are in [token_usage_and_cost.md](token_usage_and_cost.md). The tab does not open a chat session file when it draws the chart.

### The way of the data

1. The developer chooses the source "AI cost". The tab calls the command `ai_cost_synchronize` with the folders of the chosen workspaces. The command takes the lock of the SQLite file, refreshes the prices when the latest version is one day old, and runs the mode `update` of the token usage for each workspace that was imported before. A workspace that was never imported is left alone, because its import opens every chat session file. The developer imports it with the button "Import the history".
2. The tab calls the command `ai_cost_in_range` with the same folders, the 30 days that end now, and the time zone of the computer. The command only reads the SQLite file. It gives the state of each workspace and one row for each hour and coding agent: the tokens, the cost, and the tokens with no known price.
3. The tab puts each row in its slot, and adds the cost and the tokens. The pure class `AiCost` does the calculation.

The tab runs these two steps again each time that the source or the chosen workspaces change. A change of the slot length runs nothing again: the rows are hours, and the tab adds them into the new slots. It shows the date of the last update, the version of the prices, the warning of the prices, and the cost that is not complete ([statistics_ai_cost.md](../agents_rules/user_interface/window/statistics_ai_cost.md)).

## Where the code is

| Part | Place |
| --- | --- |
| The data layers | `submodules/heidrun_data/packages/data_layer_source_control`, `data_layer_code_hosting`, and `data_layer_coding_agents` |
| The commands `person_work_synchronize` and `person_work_in_range` | `packages/apps/desktop_tauri/src/statistics/person_work.rs` |
| The commands `ai_cost_synchronize` and `ai_cost_in_range` | `packages/apps/desktop_tauri/src/statistics/ai_cost.rs` |
| The lock of the SQLite file | `submodules/heidrun_data/packages/heidrun_data/src/database_lock.rs` |
| The tab and the chart | `packages/apps/web_frontend/src/components/PersonWorkTab.vue` and `StackedBarChart.vue` |
| The calculations | `packages/apps/web_frontend/src/lib/person_work.ts`, `ai_cost.ts`, `calendar_days.ts`, `calendar_slots.ts`, and `slot_text.ts` |

The tests are listed in [statistics_person_work.md](../agents_rules/user_interface/window/statistics_person_work.md) and in [statistics_ai_cost.md](../agents_rules/user_interface/window/statistics_ai_cost.md), in the sections "Tests".

## Open points

- The history of a workspace is imported when the developer asks for it. A later issue can decide whether a background import is wanted.
- A person with a different login on GitHub and a different name in Git is two people. A later step can add a table that links them.
- GitHub only: `data_layer_code_hosting` reads GitHub, so the pull requests and the issues of a repository on GitLab are not read. The rule of GitHub and GitLab support requires the same support for GitLab.
