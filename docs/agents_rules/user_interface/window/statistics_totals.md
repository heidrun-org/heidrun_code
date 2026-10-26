# User interface of Heidrun Code: Statistics window, tab "Work of one person", totals

- Created: 15 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: work of one person](../../glossary/person_work.md), [Tab "Work of one person"](statistics_person_work.md), [Source "AI cost"](statistics_ai_cost.md)
- Related issue: [issue 523](https://github.com/heidrun-org/heidrun/issues/523), [issue 559](https://github.com/heidrun-org/heidrun/issues/559), [issue 622](https://github.com/heidrun-org/heidrun/issues/622), [issue 629](https://github.com/heidrun-org/heidrun/issues/629)

This file is a part of the rules of the tab "Work of one person". The words are defined in [glossary/person_work.md](../../glossary/person_work.md). The layout of the tab, and the list of the totals, are in [statistics_person_work.md](statistics_person_work.md).

## The lines added and deleted

- The source "Git history" shows the lines added and the lines deleted of the person in the time range, as its fourth and fifth totals.
- The lines are the sums of the fields `insertions` and `deletions` of the commits of the person that count ([statistics_git_history.md](statistics_git_history.md)), and not of the pull requests. A binary file counts 0.
- The bar chart shows the lines of each day when the developer chooses the metric "Lines added and deleted" ([statistics_git_history.md](statistics_git_history.md)).
- The command `person_work_in_range` gives the two numbers of each commit. The package `data_layer_source_control` already keeps them.

## The average per day

- The average per day of a total is the total divided by the number of days of the time range, 7 or 30. Every day counts, also a day with no work, and a total of zero gives "0 per day".
- Each total of the tab has its average per day in a line of text under it, for the source "Git history" and for the source "AI cost". The text is "{value} per day", and in French "{value} par jour".
- A change of the person, of the source, or of the time range changes the averages at once, from the data that the tab already read.

## How the value is written

- For the commits, the pull requests, the issues, the lines added, and the lines deleted, the value has at most one decimal digit, for example "71.1", and the language of the interface chooses the separator ("71,1" in French).
- An average of more than 0 and less than 1 has two decimal digits, so that one item in 30 days is "0.03" and not "0".
- For the AI cost in US dollars, the value is a cost in US dollars, written as the totals of the AI cost are written, for example "$28.50 per day".
- For the AI cost in tokens, the average is rounded to whole tokens, then written as the information card of a chat writes tokens, for example "9.29 KT per day" ([statistics_ai_cost.md](statistics_ai_cost.md)).

## Where the calculation is

- The calculation is the pure class `AveragePerDay` in `packages/apps/web_frontend/src/lib/average_per_day.ts`. The method `of` divides, and the method `countText` writes a number of items or of lines. Both sources use the class, so the two sources divide in the same way.
- The text "{value} per day" is the key `statisticsModal.personWorkPerDay` of the locale files, in every language.

## Tests

- `lib/person_work.test.ts` tests the sums of the lines added and deleted, with a commit outside the time range. The Rust tests of the module `person_work` test the two numbers of each commit.
- `lib/average_per_day.test.ts` tests the division, a time range with no day, the number of decimal digits, and the separator of each language.
- `components/PersonWorkTab.test.ts` tests the lines, and the average per day of each total, for 3, 7, 14, and 30 days, for the source "Git history" and for the source "AI cost", in US dollars and in tokens.
