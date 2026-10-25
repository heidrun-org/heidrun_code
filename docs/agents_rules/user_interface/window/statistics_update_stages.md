# User interface of Heidrun Code: Statistics window, stages of the update of the database

- Created: 25 October 2026
- Last updated: 25 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Source "Git history"](statistics_git_history.md), [Tab "Work of one person"](statistics_person_work.md), [Data layer access](../../data_layer_access.md), [Bootstrap and utility classes](../../web_styling/bootstrap_utility_classes.md)
- Related issue: [issue 874](https://github.com/heidrun-org/heidrun_code/issues/874)

This file holds what the tab "Work of one person", source "Git history", shows while the command `person_work_synchronize` updates the database of the data layer.

## What the tab shows

- The component `PersonWorkUpdateStages.vue` fills the tab: a big busy wheel (the Bootstrap `spinner-border`, 3 rem wide) in the middle, the text "Reading the commits, the pull requests, and the issues…", the text of the stage in progress, and the list of the stages of each chosen workspace that is read.
- The six stages, in this order: "Reading the commits of {repository}", "Writing the commits of {repository} in the SQLite file", "Reading the issues of {repository}", "Writing the issues of {repository} in the SQLite file", "Reading the pull requests of {repository}", "Writing the pull requests of {repository} in the SQLite file". The name of the repository is the part after the slash of `owner/name`, or the last part of the folder before the first report.
- A stage that waits has an empty circle and a grey text. The stage in progress has a small busy wheel, a bold text, the count "{done} of {total}", the percent, and a Bootstrap progress bar as a thin line on the lower edge of its row. A stage that is done has a green check mark.
- Nothing moves while the stages change: every row keeps the height of one line (one icon width, a long text ends with an ellipsis, the progress bar inside the row), and the text of the stage in progress sits in a slot of one fixed line.
- A stage whose total is not known shows no percent and no progress bar, and shows "{done} read" when it read at least one item. A read of GitHub that starts at a date does not know the total.
- The text of the stage in progress slides up into its place each time that a new stage starts. The global rule `prefers-reduced-motion` of `styles.css` stops the movement.

## Where the progress comes from

- The command `person_work_synchronize` takes a Tauri channel, `onProgress`, and sends a `PersonWorkProgress` (`repository`, `stage`, `doneCount`, `totalCount`, `isFinished`) at the start of each stage, after each batch of 500 commits or each page of 100 items of GitHub, and at the end of each stage.
- The reports come from the functions `refresh_source_control_with_progress` of the package `data_layer_source_control` and `refresh_code_hosting_with_progress` of the package `data_layer_code_hosting`. The total of a read of GitHub is the field `totalCount` of the list, given only when the read starts at the beginning.
- `lib/person_work_update_stages.ts` keeps the last report of each stage and gives the state and the percent of the six stages.

## Tests

- `lib/person_work_update_stages.test.ts`: the states, the percent, an unknown total, and a total of zero items.
- `components/PersonWorkTab.test.ts`: the big busy wheel, the six stages, the check marks, the count, the percent, the progress bar, and a stage with no known total.
- The Rust tests of `statistics/person_work.rs`, of `refresh.rs` of the package `data_layer_source_control`, and of `refresh.rs` of the package `data_layer_code_hosting`: the order of the reports and their counts.
