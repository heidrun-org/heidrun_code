# User interface of Heidrun Code: Statistics window, tab "Work of one person", slot length

- Created: 17 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: work of one person](../../glossary/person_work.md), [Tab "Work of one person"](statistics_person_work.md), [Source "Git history"](statistics_git_history.md), [Source "AI cost"](statistics_ai_cost.md), [Tab "User activity"](statistics_user_activity.md), [Charts](statistics_charts.md)
- Related issue: [issue 616](https://github.com/heidrun-org/heidrun/issues/616), [issue 707](https://github.com/heidrun-org/heidrun/issues/707)

This file is a part of the rules of the tab "Work of one person". The words "slot" and "slot length" are defined in [glossary/person_work.md](../../glossary/person_work.md). The tab "User activity" has a slot length too ([statistics_user_activity.md](statistics_user_activity.md)), and this tab uses the same words, the same buttons, and the same texts.

## The choice

- The radio button group of the slot length is on the line of the source and of the time range, after the radio button group of the time range, and it has the label "Slot length". It has the same Bootstrap form as the other groups (`btn-group` with `btn-check btn-outline theme-secondary` labels), with an id `statistics-person-slot-<hours>` on each input, and the title "Cut the time range into slots of {slot length}" on each button. Both sources show it.
- Every time range (the last 3, 7, 14, and 30 days) offers the same buttons, from the shortest to the longest: "1 hour", "6 hours", and "1 day". The slot length "1 day" is chosen at first.
- A change of the time range keeps the slot length. When a time range does not offer the slot length in use, the tab goes back to "1 day". A change of the slot length never changes the time range, the source, the unit, the workspaces, or the person. Heidrun Code remembers the slot length and the time range ([statistics_remembered_selections.md](statistics_remembered_selections.md)).
- A change of the slot length reads nothing again, for both sources: the tab cuts the data that it already read. The chart is drawn again at once and never shows the reading text.
- The totals and the average per day do not depend on the slot length, because they are for the whole time range.

## The slots

- A day is cut from its midnight, in the time zone of the computer. The first slot of a day starts at this midnight, and each slot lasts the slot length, counted in real hours from there, so a slot never crosses midnight. A slot of "1 day" is the day.
- On a day of 25 hours (the clock goes back), "1 hour" gives 25 slots and "6 hours" gives a fifth slot of 1 hour at the end of the day. On a day of 23 hours (the clock goes forward), "1 hour" gives 23 slots, and "6 hours" gives a last slot of 5 hours. A slot of "1 day" lasts 23 or 25 hours on these days.
- A time zone with a half hour offset, such as India, has its slots at its own local hours.
- A commit, a pull request, and an issue count in the slot that holds their date. The tokens and the cost of an hour of the AI cost count in the slot that holds the hour, and the data layer gives its hours with the same cut ([statistics_ai_cost.md](statistics_ai_cost.md)), so every hour is inside one slot.

## The bar chart

- One bar for each slot: 3 days give 3, 12, or 72 bars, 7 days give 7, 28, or 168 bars, 14 days give 14, 56, or 336 bars, and 30 days give 30, 120, or 720 bars. The last slot ends at the end of today.
- The horizontal axis has no more than 13 labels. The step between two labels is the shortest of 5, 10, 15, 30, 60, 120, 180, 360, 720, 1440, and 4320 minutes that is a whole number of slots, as `UserActivitySlots.labelStepFor` gives it. A label sits on a slot that starts at a multiple of the step since midnight. A label on a midnight is the day: the weekday and the date for 3 days and 7 days, and the date only for 14 days and 30 days. Any other label is the time of the clock, in the time format of the settings. For the last 14 days and the last 30 days, with every slot length, the step is 3 days, so the labels are every third midnight counted back from today. For the last 7 days, the step is 1 day with every slot length. For the last 3 days, the step is 1 day with "1 day", and 6 hours with "6 hours" and "1 hour".
- The title of the horizontal axis is "Day" for "1 day", and "Start of the slot" for the other slot lengths. The title of the chart, and the description for a screen reader, end with "in slots of {slot length}", for example "AI cost in slots of 6 hours, for each coding agent".
- The title of the chart information card is the day, for example "Monday, October 12", for "1 day". For another slot length, it is the day, the start, and the end of the slot, for example "Monday, October 12, 06:00 to 12:00". The end of the last slot of a day is "00:00".
- The bars sit on the numbers 0, 1, 2, and so on, and the axis names the bars that have a label, because the text of a slot is not unique: "06:00" is in every day. `StackedBarChart.vue` takes `labels` with one item for each bar, and an item that is `null` has no label.

## The code

- `lib/calendar_slots.ts`, the class `CalendarSlots`, cuts the days of `CalendarDays` into slots and finds the slot that holds a time. It has no clock.
- `lib/slot_text.ts`, the class `SlotText`, writes the length of a slot, the labels of the axis, the title of the chart information card, and a time of the clock.
- `PERSON_WORK_PERIODS` in `lib/person_work.ts` gives the slot lengths of each time range. `PersonWork.compute` and `AiCost.compute` take the slot length in hours.
- `UserActivitySlots.labelStepFor` in `lib/user_activity_slots.ts` is the step of the labels for both tabs.

## Tests

- `lib/calendar_days.test.ts` tests the days. `lib/calendar_slots.test.ts` tests the number and the limits of the slots for 1 hour, 6 hours, and 1 day, the days of 23 and 25 hours in the time zone `Europe/Paris`, and the finding of the slot that holds a time.
- `lib/slot_text.test.ts` tests the text of the length, the places and the texts of the labels, the limit of 13 labels, and the title of the card.
- `lib/person_work.test.ts` and `lib/ai_cost.test.ts` test the counting in each slot, and that the totals are the same for every slot length.
- `components/PersonWorkTab.test.ts` tests the buttons of each time range, the slot length that stays or goes back, the bars, the labels, the titles, the chart information card, and that a change of the slot length reads nothing again, for both sources.
- The Rust tests of `usage_grouping.rs` test the slots of the data layer, and the Rust tests of the module `ai_cost` test the hours that the command gives.
