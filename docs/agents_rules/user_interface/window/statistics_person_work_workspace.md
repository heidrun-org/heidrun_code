# User interface of Heidrun Code: Statistics window, tab "Work of one person", workspace selector

- Created: 16 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: work of one person](../../glossary/person_work.md), [Tab "Work of one person"](statistics_person_work.md), [Source "Git history"](statistics_git_history.md), [Source "AI cost"](statistics_ai_cost.md), [Tab "User activity"](statistics_user_activity.md)
- Related issue: [issue 559](https://github.com/heidrun-org/heidrun/issues/559), [issue 629](https://github.com/heidrun-org/heidrun/issues/629), [issue 707](https://github.com/heidrun-org/heidrun/issues/707)

This file is a part of the rules of the tab "Work of one person". The words are defined in [glossary/person_work.md](../../glossary/person_work.md). The layout of the tab is in [statistics_person_work.md](statistics_person_work.md).

## The workspace selector

- The workspace selector is the second line of the right column of the tab ([statistics_person_work.md](statistics_person_work.md)). It has the label "Workspaces", then two groups of small Bootstrap buttons (`btn-group-sm`, `btn-check btn-outline theme-secondary`). Both sources show it.
- The first group is a radio button group with two buttons, "All" and "None". "All" chooses every workspace, and "None" chooses no workspace. "All" is shown as chosen when every workspace is chosen, and "None" when no workspace is chosen. When only some workspaces are chosen, neither button is shown as chosen.
- The second group has one button with a checkbox for each workspace that is open in Heidrun Code now, in the order of the list of workspaces, with the name of the workspace. A workspace with no known folder has no button. The title of the button says "Show or hide the work of the workspace in the folder {folder}".
- The developer can choose one workspace, several workspaces, or all of them. At first, only the selected workspace is chosen. When the selected workspace is not open, the first open workspace is chosen. Heidrun Code remembers the choice ([statistics_remembered_selections.md](statistics_remembered_selections.md)).
- When no workspace is chosen, the tab shows the text "No workspace is chosen. Choose a workspace to see its work.", no total, and no chart, and reads nothing.
- When no workspace is open, the tab shows the text "No workspace is open…", no selector, and reads nothing.

## What the tab reads and shows

- The source "Git history" reads the data of each chosen folder once, the first time that the source is shown with that folder chosen. A folder that the tab already read is not read again while the window stays open: the tab keeps what each folder gave, also when the developer drops the workspace, so a workspace that comes back shows at once. A folder that failed is not read again.
- The source "AI cost" asks the data layer once for all the chosen folders, each time that the source is shown or that the chosen folders change: the data layer updates the stored token usage of the workspaces that were imported, then gives the days ([statistics_ai_cost.md](statistics_ai_cost.md)). A read that a newer read replaces is dropped.
- The totals, the people of the person chooser, and the bar chart are the sums over the chosen workspaces. The person chooser keeps the person when the person is still in the list.
- While a chosen folder is read, the tab shows the text of the reading in progress. When a chosen folder fails, the tab shows its error in a Bootstrap alert, and still shows the sums of the chosen folders that were read.
- Two workspaces with the same folder read that folder once. Two workspaces of the same repository, for example a folder and its worktree, give the repository once for the Git history ([statistics_git_history.md](statistics_git_history.md)). A chat session that two chosen workspaces own counts once for the AI cost, because one call takes all the folders ([statistics_ai_cost.md](statistics_ai_cost.md)).
- When a workspace that is chosen closes, it is dropped. When no chosen workspace stays open, the first open workspace is chosen.
- The tab keeps the source, the unit, and the time range when the chosen workspaces change.

## Where the list comes from

- The list is `openWorkspaces` in `packages/apps/web_frontend/src/stores/user_activity.ts`: each workspace of Heidrun Code with its folder, found by `workspaceCwd`. The tab starts with `selectedWorkspaceId` of the same file.
- The sums of the Git history come from the pure function `PersonWork.merge` (`lib/person_work.ts`). The command `person_work_synchronize` takes one folder, and the tab calls it once for each folder, then calls `person_work_in_range` with the repository that it gave. The command `ai_cost_in_range` takes the list of the chosen folders, and the data layer adds them up.

## Tests

- `lib/person_work.test.ts` tests the join of the Git history of several workspaces: the order, the repository that counts once, and the errors of GitHub. The Rust tests of the module `ai_cost` test the chat session that two overlapping folders own, which counts once.
- `components/PersonWorkTab.test.ts` tests the buttons, the first choice, the radio button group "All" and "None", the sums of several workspaces for both sources, the reads that are not repeated, the folder that two workspaces share, the error of one workspace, the text when no workspace is chosen, and the workspace that closes.
- `components/StatisticsModal.test.ts` tests that the tab reads its data only when it is shown, for an open workspace.
