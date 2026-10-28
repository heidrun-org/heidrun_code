# User interface of Heidrun Code: Statistics window, remembered selections

- Created: 19 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Last state of each option](window_state_and_start.md), [Tab "User activity"](statistics_user_activity.md), [Tab "Work of one person"](statistics_person_work.md), [Legend filter](statistics_person_work_legend_filter.md)
- Related issue: [issue 707](https://github.com/heidrun-org/heidrun/issues/707)

This file is a part of the rules of the Statistics window. The words are defined in [glossary/user_activity.md](../../glossary/user_activity.md) and in [glossary/person_work.md](../../glossary/person_work.md).

## The rule

- Each selection of the two tabs is saved as soon as the developer changes it. Each tab starts with its saved selections each time that the Statistics window opens, and after a restart of Heidrun Code. A selection with no saved value starts with the first choice that the rules of its tab give.
- The two tabs keep their selections apart: a change in one tab never changes the other tab.
- The rule "Last state of each option" in [window_state_and_start.md](window_state_and_start.md) applies. The store `stores/settings.ts` saves each selection under the key `heidrun.settings`, with one line in `defaults`. A saved value that has the wrong type, or that is not in the list of the values of its option, is dropped at the start, and the option uses its first choice.
- A tab saves a choice of the developer only. A change that the tab makes by itself is never saved: a chosen workspace that closes, and the person that the tab takes because the saved person is not in the list.
- The window does not remember which tab is shown: it always opens on the tab "User activity".

## The selections of the tab "User activity"

- `statisticsUserActivityRange`: the time range, `day`, `week`, or `month`.
- `statisticsUserActivitySlotLength`: the slot length. The tab uses it only when the saved time range offers it. Otherwise the tab uses the slot length that the saved time range starts with. A change of the time range saves the slot length that the time range goes back to.
- `statisticsUserActivityWorkspaces`: the workspace selector, with the field `isEveryWorkspaceChosen` and the list `folders`. The tab saves the folder of each workspace, because a folder is the same at each run of Heidrun Code.
  - When `isEveryWorkspaceChosen` is true, the tab chooses every workspace that is open, a workspace that opens later included. This is the first choice.
  - Otherwise the tab chooses the workspaces of `folders` that are open. An empty list is the choice "None" and stays empty.
  - When no workspace of a non-empty list is open, the tab chooses every workspace.

## The selections of the tab "Work of one person"

- `statisticsPersonWorkSource`: the source, `git_history` or `ai_cost`. With the saved source `ai_cost`, the tab reads the stored token usage at once when it is shown, as the rule "A source reads its data only when it is shown" says. It never imports a history by itself.
- `statisticsPersonWorkMetric`: the metric of the Git history, `commits_and_pull_requests` or `lines`.
- `statisticsPersonWorkUnit`: the unit of the AI cost, `dollars` or `tokens`.
- `statisticsPersonWorkPerson`: the identifier of the person that the developer chose in the person chooser. An empty text means that the developer never chose a person.
  - The tab chooses the saved person as soon as the list of the people holds this person, even when the first reads gave other people.
  - When the list does not hold the saved person, the tab chooses the person with the most items, and the saved value stays. The saved person comes back when a chosen workspace lists this person again.
- `statisticsPersonWorkRange`: the time range, `three_days`, `seven_days`, `fourteen_days`, or `thirty_days`.
- `statisticsPersonWorkSlotHours`: the slot length in hours, 1, 6, or 24. The tab uses it only when the saved time range offers it. Otherwise the tab uses 24.
- `statisticsPersonWorkWorkspaces`: the workspace selector, with the field `isSaved` and the list `workspaceIds`. The tab saves the identifier of each workspace, as the option `selectedWorkspaceId` saves the selected workspace.
  - When `isSaved` is false, the tab chooses the selected workspace alone, or else the first open workspace. This is the first choice.
  - Otherwise the tab chooses the workspaces of `workspaceIds` that are open. An empty list is the choice "None" and stays empty.
  - When no workspace of a non-empty list is open, the tab chooses the selected workspace alone.

## A selection that the source hides stays saved

- The source "AI cost" hides the metric and the person chooser, and the source "Git history" hides the unit. A hidden selection keeps its saved value, so it comes back when the developer shows the source again.

## Tests

- `stores/settings.test.ts` tests the first choices, the reading after a restart, and the values that are dropped.
- `components/UserActivityTab.test.ts` and `components/PersonWorkTab.test.ts` test that each selection is saved at once, that a tab built again starts with it, that a restart keeps it, the selections that the source hides, the workspaces that are not open, the person that is not in the list, and the values that are corrupted.
- `components/StatisticsModal.test.ts` tests that closing and opening the window keeps the selections, and that the two tabs keep theirs apart.
