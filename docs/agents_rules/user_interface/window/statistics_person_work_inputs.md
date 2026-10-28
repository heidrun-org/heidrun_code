# User interface of Heidrun Code: Statistics window, tab "Work of one person", inputs

- Created: 17 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: work of one person](../../glossary/person_work.md), [Tab "Work of one person"](statistics_person_work.md), [Workspace selector](statistics_person_work_workspace.md), [Slot length](statistics_person_work_slots.md), [Source "Git history"](statistics_git_history.md)
- Related issue: [issue 629](https://github.com/heidrun-org/heidrun/issues/629), [issue 707](https://github.com/heidrun-org/heidrun/issues/707)

This file is a part of the rules of the tab "Work of one person". The words are defined in [glossary/person_work.md](../../glossary/person_work.md). The totals and the bar chart are in [statistics_person_work.md](statistics_person_work.md).

## The layout

- The inputs are in two columns on one block that wraps on a narrow window. The left column has two lines. The first line has the radio button group of the source and the person chooser (Git history only). The second line has the radio button group of the metric (Git history only) or the radio button group of the unit (AI cost only). The right column has two lines, and each line is pushed to the right edge of the window with the class `ms-auto`. The first line has the radio button group of the slot length, then the radio button group of the time range. The second line has the workspace selector ([statistics_person_work_workspace.md](statistics_person_work_workspace.md)). Every one of these inputs has a visible label before it, in a Bootstrap `form-text` span. The size of the button groups and of the person chooser is in [statistics_and_settings_appearance.md](../../web_styling/statistics_and_settings_appearance.md). Heidrun Code remembers the choice of the source, of the metric, of the unit, of the workspace, of the person, of the time range, and of the slot length ([statistics_remembered_selections.md](statistics_remembered_selections.md)), and the filter of the chart legend ([statistics_person_work_legend_filter.md](statistics_person_work_legend_filter.md)).

## The inputs

- The radio button group of the source has the same Bootstrap form as the one of the tab "User activity", with two buttons that have a text and a title: "Git history", chosen at first, and "AI cost". A click shows the other source at once.
- The radio button group of the metric is shown for the source "Git history" only. It chooses what the bar chart counts: "Commits and pull requests", chosen at first, or "Lines added and deleted" ([statistics_git_history.md](statistics_git_history.md)). A click draws the other bar chart at once, from the data that the tab already read, and reads nothing again. A change of the source keeps the metric.
- The person chooser, a `select` with the classes `form-control form-control-sm`, is shown for the source "Git history" only, because the AI cost is the cost of the chats on this computer and not the work of one person. The person with the most items is chosen at first.
- The radio button group of the time range has four buttons that have a text and a title, from the shortest to the longest: "3 days", "7 days" (chosen at first), "14 days", and "30 days". The texts do not repeat the word "Last", because the label "Time range" is before the group; the title of each button says "last". A click draws the bar chart of this time range at once, from the data that the tab already read. A change of the source keeps the time range.

## Tests

- `components/PersonWorkTab.test.ts` tests that every button group has a visible label before it, that the slot length and the time range are on the first line of the right column and the workspace selector on the second line, both lines at the right edge, that the other inputs stay in the left column, that every button group and the person chooser are small, and the texts of the buttons.
