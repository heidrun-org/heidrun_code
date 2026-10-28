# User interface of Heidrun Code: Statistics window, tab "Work of one person", source "AI cost"

- Created: 15 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: work of one person](../../glossary/person_work.md), [Tab "Work of one person"](statistics_person_work.md), [Chat summary](../sidebars/chats/chat_summary.md), [Workspace selector](statistics_person_work_workspace.md)
- Related issue: [issue 482](https://github.com/heidrun-org/heidrun/issues/482), [issue 523](https://github.com/heidrun-org/heidrun/issues/523), [issue 558](https://github.com/heidrun-org/heidrun/issues/558), [issue 559](https://github.com/heidrun-org/heidrun/issues/559), [issue 557](https://github.com/heidrun-org/heidrun/issues/557), [issue 616](https://github.com/heidrun-org/heidrun/issues/616)

This file is a part of the rules of the tab "Work of one person". The layout of the tab, the two radio button groups, and the bar chart are in [statistics_person_work.md](statistics_person_work.md). The words are defined in [glossary/person_work.md](../../glossary/person_work.md). The tables, the prices, and the measurements are in [token_usage_and_cost.md](../../../statistics/token_usage_and_cost.md).

## What counts for the AI cost

- The tab shows the tokens that Claude Code and Codex used, with their estimated cost, from the stored token usage: one row for each chat session, model, and minute, in UTC. The chat sessions are those of this computer that started in the folder of a chosen workspace, or in a folder below it, such as a worktree (`.claude/worktrees/<name>`) or a sub-folder. A chat session of a folder next to the repository, such as `<repository>-site`, does not count. The Past chats sidebar section lists only the chat sessions of the root.
- The data layer adds the minutes into hours of the days of the time zone of the computer, and the tab adds the hours into the slots of the slot length that the developer chooses ([statistics_person_work_slots.md](statistics_person_work_slots.md)). A chat session that lasts several slots is therefore in several bars, with the cost of each slot. A day of 23 or 25 hours is cut by its real length.
- The program reads every file of the chat sessions: for Codex, the files `.jsonl` and the files `.jsonl.zst`; for Claude Code, the file of each chat session, and the files of its subagents and of its workflows. The tokens of a subagent or of a workflow count for the chat session that started it. A chat session that two files hold counts once ([token_usage_and_cost.md](../../../statistics/token_usage_and_cost.md)).
- The tokens of a request whose record has no date are in no day and in no time range.
- A review chat of Codex does not count, as it is not in the Past chats sidebar section ([chats_list.md](../sidebars/chats/chats_list.md)).
- The cost uses the latest prices for all the history. A model with no known price has tokens and no cost, and never a cost of zero. The cost of a day is then partial: it counts the models that have a price. When the unit is US dollars and the time range holds such tokens, a line of text under the chart says "The cost is not complete: the tokens of models with no known price ({tokens}) are not counted in it."

## The import of the history

- The first import of a workspace opens every chat file of the workspace once, which can take a few minutes. The tab never starts it by itself. A workspace that was never imported gives no day, and the tab shows no total and no chart until a chosen workspace is imported. The tab then shows the text "The history of the chats of {count} workspace is not imported yet, so it is not in the chart…" and the button "Import the history" with the id `statistics-person-import`. A click imports the workspaces that are not imported. While it runs, the tab shows the text "Importing the history of the chats…" in place of the reading text.
- A workspace that was imported is brought up to date each time that the tab reads: only the chat files that changed since the last read are opened. The tab does not show the update as a step. The tab reads again only when the source or the chosen folders change, never when Heidrun Code makes the list of the open workspaces again (it does so after each change that Herdr reports), so the chart does not blink.
- The tab shows the date of the last update, "Token usage updated on {time}." (the oldest date of the chosen workspaces that were imported), then the version of the prices, "Prices: version {version}, checked on {time}.". When no price is stored, the second text is "No price of the models is stored yet, so no cost is shown.".
- When the prices cannot be refreshed, the tab shows the warning "The prices of the models could not be refreshed, so the latest known prices are used: {error}" in an alert (`alert theme-warning`), and the chart stays. When one workspace cannot be read, the tab shows its error in an alert (`alert theme-danger`) and still shows the other workspaces.

## The unit: US dollars or tokens

- When the source "AI cost" is shown, a radio button group of the unit comes after the radio button group of the source. It has the same Bootstrap form, with two buttons that have a text and a title: "US dollars", chosen at first, and "Tokens". The source "Git history" does not show it. A click shows the other unit at once, from the data that the tab already read, so a change of the unit reads nothing. The choice is remembered.
- The tokens of a day are the input tokens, with the ones read from the cache and written to it, and the output tokens, for every model: the numbers that the Past chats sidebar section shows ([chat_summary.md](../sidebars/chats/chat_summary.md)).
- In tokens, a model with no known price counts with its tokens, because a token has no price. The line of text about the cost that is not complete is shown only in US dollars.
- A number of tokens is written as the information card of a chat writes it: a number under one thousand as it is, else two decimal digits and KT (thousand), MT (million), BT (billion), or TT (trillion), for example "20.61 KT". A total of zero is "0".
- In tokens, the three totals, their average per day, the stacked bars, the chart legend, and the chart information card show tokens, in the same places where they show US dollars. The title of the chart is "Tokens of each day, for each coding agent", and the title of the vertical axis is "Tokens".
- The vertical axis in tokens has one unit for all its ticks: the biggest of KT, MT, BT, and TT that does not go over the highest bar, or one token for a highest bar under one thousand, for example "5 MT", "10 MT", "15 MT". `StackedBarChart.vue` divides the heights by the size of this unit. The chart information card still shows the exact text of each value.

## The average per day

- Under each of the three totals, the tab shows the average per day: the total divided by the number of days of the time range, 7 or 30, in US dollars, for example "$0.57 per day", or in tokens, rounded to whole tokens, for example "9.29 KT per day". The rules are in [statistics_totals.md](statistics_totals.md).

## Where the data comes from

- The tab calls two commands of `packages/apps/desktop_tauri/src/statistics/ai_cost.rs`, both with the list of the chosen folders. `ai_cost_synchronize` takes the lock of the SQLite file, refreshes the prices when they are one day old, and updates the token usage of the workspaces that were imported. It imports the others only when `isImportAllowed` is true. `ai_cost_in_range` only reads the SQLite file, with the time range and the time zone, and gives the state of each workspace and one row for each hour and coding agent (`startedAt`, `day`, `codingAgent`, `tokens`, `costUsd`, `unpricedTokens`), with the version of the prices. An hour is a slot of one hour of a day of the time zone, so it never crosses midnight.
- The data layer adds up the chosen folders in one query, so a chat session that two folders own counts once.
- The calculation is the pure class `AiCost` in `packages/apps/web_frontend/src/lib/ai_cost.ts`. It puts each row in its slot, with the class `CalendarSlots`, and adds the cost and the tokens. It has no clock: the caller gives the current time.

## Tests

- `lib/ai_cost.test.ts` tests the slots of the time range, the cost and the tokens of each coding agent for each slot, the totals, the tokens with no known price, the rows outside the time range, the workspaces that are not imported, the oldest date of the update, and the time zone.
- `components/PersonWorkTab.test.ts` tests that the tab does not read before the developer chooses the source "AI cost", the totals, the average per day, the stacked bars, their legend and chart information card in US dollars and in tokens, the hidden person chooser, the unit, the two commands and the order of their calls, the button "Import the history" and the import that never starts alone, the warning of the prices, the error of one workspace, the cost that is not complete, the date of the update and the version of the prices, the empty time range, the list of the open workspaces that is made again with the same folders and that reads nothing, and the error.
- `dev/tauri_mock.test.ts` tests the fake answers of the two commands.
- `lib/chat_usage.test.ts` tests the unit of the vertical axis in tokens (`tokenUnitFor`).
- The Rust tests of the module `ai_cost` test the import that waits for the button, the update of an imported workspace, the hours of a time zone with a day of 25 hours or a half hour offset, the cost that is not complete, the workspaces that overlap, and the errors. The Rust tests of the package `data_layer_coding_agents` test the tables, the write that changes only the rows that changed, the prices, the cost, and the grouping ([token_usage_and_cost.md](../../../statistics/token_usage_and_cost.md)).
