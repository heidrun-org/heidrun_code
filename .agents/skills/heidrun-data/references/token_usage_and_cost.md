# Token usage and cost

- Created: 17 October 2026
- Last updated: 17 October 2026
- Status: Maintained description of the stored token usage and of the estimated cost
- Related framing: [Project instructions](https://github.com/heidrun-org/heidrun_code/blob/dev_jerome/AGENTS.md)
- Related rules: [Source "AI cost"](https://github.com/heidrun-org/heidrun_code/blob/dev_jerome/docs/agents_rules/user_interface/window/statistics_ai_cost.md), [Workspace selector](https://github.com/heidrun-org/heidrun_code/blob/dev_jerome/docs/agents_rules/user_interface/window/statistics_person_work_workspace.md), [Glossary of Heidrun Code: work of one person](https://github.com/heidrun-org/heidrun_code/blob/dev_jerome/docs/agents_rules/glossary/person_work.md)
- Related issue: [issue 616](https://github.com/heidrun-org/heidrun/issues/616), [issue 482](https://github.com/heidrun-org/heidrun/issues/482), [issue 559](https://github.com/heidrun-org/heidrun/issues/559)

This file says how Heidrun Code stores the tokens that the coding agents used, how it turns them into an estimated cost in US dollars, and how to ask for them. The package [`data_layer_coding_agents`](https://github.com/heidrun-org/heidrun_code/blob/dev_jerome/packages/data_layer_coding_agents/README.md) owns the tables. The command `usage` of [`heidrun_data`](https://github.com/heidrun-org/heidrun_code/blob/dev_jerome/packages/heidrun_data/README.md) and the source "AI cost" of the Statistics window read them. The general rules of the data layers are in [the four data layers](https://github.com/heidrun-org/heidrun_code/blob/dev_jerome/docs/statistics/the_four_data_layers.md).

## What is stored

The tokens come from the chat session files of Claude Code and of Codex. A chat session file is not opened again when a statistic needs a number: the numbers are in the SQLite file.

| Name | Kind | Content |
| --- | --- | --- |
| `token_usage_minutes` | table | One row for each repository, chat session, model, and minute where tokens were used. The columns `freshInputTokens`, `cachedInputTokens`, `cacheWriteInputTokens`, and `outputTokens` hold the four kinds of tokens. The columns `codingAgent` and `folder` say who wrote the chat session and where it started. |
| `token_usage_synchronizations` | table | One row for each workspace: the date of the last read (`synchronizedAt`), the date up to which the files were read (`readUpTo`), and the mode. |
| `model_price_versions` | table | One row for each version of the price list: when it was retrieved (`retrievedAt`), when it was checked (`checkedAt`), its source, its unit, a hash of its content, and the number of models. |
| `model_prices` | table | The four prices of each model in each version, in US dollars for one million tokens. |
| `latest_model_prices` | view | The prices of the latest version. |
| `token_usage_with_cost` | view | The rows of `token_usage_minutes` with the columns `priceVersion`, `priceModel`, and `costUsd`. |

### The minute

- A minute is the minute of the record in which the coding agent reports the tokens of one request. It is not a measure of the time that the model needed to generate the tokens.
- The column `minuteAt` is an ISO 8601 text in UTC, with the seconds at zero, for example `2026-10-14T10:31:00.000Z`. Texts of this form sort in the order of time, so a time range is a range of texts.
- A record without a date gives rows with an empty `minuteAt`. These tokens count in the total of their chat session and in no time range.
- A request counts once. Claude Code writes one answer on several lines, and a resumed or forked chat session repeats the lines of its parent: the scan counts each answer once. The answers of the subagents and of the workflows count for the chat session that started them.
- Claude Code copies a chat session into the project folder of the folder where the developer resumes it. When two files hold the same chat session identifier, the chat session counts once, with the file that changed last. The result is the same for a read of everything and for a read of the files that changed.

### The index

One index exists: `token_usage_minutes_by_minute` on `repository` and `minuteAt`. SQLite uses it for every time range. An index on the folder was tried on the Teamwright history. SQLite never chose it, not even for a folder with one row, and the timings were the same, so it was removed.

Query plan of the tokens of the Teamwright repository in 30 days:

```sql
EXPLAIN QUERY PLAN
SELECT SUM(freshInputTokens + cachedInputTokens + cacheWriteInputTokens + outputTokens)
FROM token_usage_minutes
WHERE repository = 'jeromeetienne/teamwright'
  AND minuteAt >= '2026-09-16T22:00:00.000Z' AND minuteAt < '2026-10-16T22:00:00.000Z';
```

The plan is `SEARCH token_usage_minutes USING INDEX token_usage_minutes_by_minute (repository=? AND minuteAt>? AND minuteAt<?)`. The test `uses_an_index_for_a_time_range_of_a_repository_and_of_a_folder` fails when a plan scans the whole table.

## The workspace

- A workspace is a folder. It owns the chat sessions that started in this folder or in a folder below it: a worktree (`.claude/worktrees/<name>`) or a sub-folder. A chat session of a folder next to the repository, such as `<repository>-site`, is not in it.
- The column `folder` of a row is the folder where its chat session started. A query for a workspace keeps the rows whose `folder` is the folder, or starts with the folder and a slash.
- A chat session has one row for each minute and model, whatever the number of workspaces that own it. When the Statistics window chooses two workspaces that overlap, for example a repository and its worktree, one query takes the folders together, and a row is read once. The totals never count a chat session two times.
- The command `usage` and the library take a list of folders in one call for the same reason.

## How the rows are kept up to date

- `initialize` reads every chat session file of the workspace. `update` reads again only the chat sessions whose files changed at the date `readUpTo` or later, and reads everything when the workspace was never read.
- A chat session counts as changed at the latest change of its file, of the files of its subagents, and of the files of its workflows.
- A write replaces all the rows of one chat session in one transaction: it inserts the new rows, updates the rows whose tokens changed, and deletes the rows that the files do not hold any more. A file that was shortened, replaced, or corrected gives the same rows as a read from the beginning.
- A chat session that was not read keeps its rows. A run that reads the same files again changes no row. The report counts the rows inserted, updated, deleted, and unchanged.
- The write takes the lock `lock_database` of the SQLite file, like the other data layers. A migration is automatic: the statements `CREATE ... IF NOT EXISTS` add the new tables to an existing SQLite file and keep every other row.

## The prices and the cost

- The prices come from the public price list of the project LiteLLM (the providers `anthropic` and `openai`). The unit is US dollars for one million tokens. The tables keep the source, the unit, the retrieval time, and the version of each price list.
- Heidrun Code fetches the price list when the latest version was checked one day ago or more. A new version is made only when the content of the price list changed. A price list that did not change only updates the date `checkedAt`.
- A fetch that fails is a warning, not an error. The latest known prices stay in use and no row changes. The command line prints the warning on the standard error output and the exit code stays 0. The Statistics window shows the warning.
- The view `token_usage_with_cost` uses the latest version for the whole history. It does not keep the price of the day when the tokens were used. When a price changes, the cost of the old tokens changes with it.
- A model is matched by its exact name, then by its name without a date `-YYYYMMDD` at the end.
- The cost of a row is the sum of the four numbers of tokens, each multiplied by its price, divided by one million. A model whose list has no price for cached input tokens or for cache write input tokens uses the price of the input tokens for them.
- A model without a price gives `costUsd` equal to `NULL`. It never gives zero. A sum of `costUsd` with SQL ignores `NULL`, so it is a partial total. The command `usage` and the Statistics window say so:
  - `unpricedTokens` is the number of tokens whose model has no price.
  - `isCostComplete` is true only when `unpricedTokens` is zero.
- The cost is an estimate at the public price of each model. It is not an invoice, and it is not the payment of a subscription.

## Days: UTC and local

- The minutes and the hours are in UTC.
- A day is a calendar day of a time zone. The command `usage` and the Statistics window cut the days with the time zone of the computer, or with the option `--time-zone`. A day lasts 23 hours when the clocks go forward and 25 hours when they go back. The tests `gives_a_day_of_23_hours_and_a_day_of_25_hours_when_the_clock_changes` and `the_days_follow_the_time_zone_and_a_day_lasts_25_hours_when_the_clock_goes_back` check it.
- A day of UTC is `substr(minuteAt, 1, 10)` in SQL. A day of a time zone needs the offset of the time zone. In SQL, add the offset only for a time range where it does not change. Paris is UTC+2 from 29 March 2026 to 25 October 2026, so the examples below that use `'+2 hours'` are right for the 30 days to 17 October 2026 and wrong across 25 October. For a time range that crosses a change of the clocks, use the command `usage`.
- The totals of the minutes, of the hours, and of the days of the same time range are equal.

## Examples for the Teamwright history

The repository is `jeromeetienne/teamwright`, and its folder is `/Users/jetienne/webwork/teamwright`. The values below are those of the history of 17 October 2026. They grow as the history grows. Run the commands from the root of the repository of Heidrun Code. Read the history once before the first question. Later, the mode `update` reads only what changed:

```sh
pnpm --silent data_layer:heidrun_data initialize coding_agents --repository jeromeetienne/teamwright --folder /Users/jetienne/webwork/teamwright
```

The tokens and the cost of 30 days, for each day of Paris, hour, or minute:

```sh
pnpm --silent data_layer:heidrun_data usage --folder /Users/jetienne/webwork/teamwright --repository jeromeetienne/teamwright --since 2026-09-17 --until 2026-10-17 --time-zone Europe/Paris --by day --format table
pnpm --silent data_layer:heidrun_data usage --folder /Users/jetienne/webwork/teamwright --repository jeromeetienne/teamwright --since 2026-09-17 --until 2026-10-17 --time-zone Europe/Paris --by hour --format jsonl
pnpm --silent data_layer:heidrun_data usage --folder /Users/jetienne/webwork/teamwright --repository jeromeetienne/teamwright --since 2026-09-17 --until 2026-10-17 --time-zone Europe/Paris --by minute --format jsonl
```

The three groupings give 28 days with tokens, 354 hours, and 10037 minutes, and the same total in each: 8444959890 tokens and 2468.41 US dollars. The cost of each chat session in the same time range:

```sh
pnpm --silent data_layer:heidrun_data usage --folder /Users/jetienne/webwork/teamwright --repository jeromeetienne/teamwright --since 2026-09-17 --until 2026-10-17 --time-zone Europe/Paris --by day --by-chat --format jsonl
```

The command `query` runs SQL. The same total with SQL:

```sql
SELECT SUM(freshInputTokens + cachedInputTokens + cacheWriteInputTokens + outputTokens) AS tokens,
       ROUND(SUM(costUsd), 4) AS usd
FROM token_usage_with_cost
WHERE repository = 'jeromeetienne/teamwright'
  AND minuteAt >= '2026-09-16T22:00:00.000Z' AND minuteAt < '2026-10-16T22:00:00.000Z';
```

The answer is 8444959890 tokens and 2468.4112 US dollars. The daily cost in US dollars, for the days of Paris:

```sql
SELECT substr(datetime(minuteAt, '+2 hours'), 1, 10) AS day, ROUND(SUM(costUsd), 2) AS usd
FROM token_usage_with_cost
WHERE repository = 'jeromeetienne/teamwright'
  AND minuteAt >= '2026-09-16T22:00:00.000Z' AND minuteAt < '2026-10-16T22:00:00.000Z'
GROUP BY day
ORDER BY day;
```

The first rows are 2026-09-17 with 167.94, 2026-09-18 with 225.45, and 2026-09-19 with 196.23. The five chat sessions that cost most in the whole history:

```sql
SELECT chatSessionId, ROUND(SUM(costUsd), 2) AS usd
FROM token_usage_with_cost
WHERE repository = 'jeromeetienne/teamwright'
GROUP BY chatSessionId
ORDER BY usd DESC
LIMIT 5;
```

The first row is the chat session `776bfa28-22fd-4f6f-b93e-6d74ae5f4da2` with 311.46. The chat sessions that cost more than 50 US dollars:

```sql
SELECT chatSessionId, ROUND(SUM(costUsd), 2) AS usd
FROM token_usage_with_cost
WHERE repository = 'jeromeetienne/teamwright'
GROUP BY chatSessionId
HAVING SUM(costUsd) > 50
ORDER BY usd DESC;
```

There are 45 of them. The workspace of the folder and the folders below it, with the tokens that have no price:

```sql
SELECT ROUND(SUM(costUsd), 4) AS usd,
       SUM(CASE WHEN costUsd IS NULL THEN freshInputTokens + cachedInputTokens + cacheWriteInputTokens + outputTokens ELSE 0 END) AS unpricedTokens
FROM token_usage_with_cost
WHERE repository = 'jeromeetienne/teamwright'
  AND (folder = '/Users/jetienne/webwork/teamwright' OR folder LIKE '/Users/jetienne/webwork/teamwright/%')
  AND minuteAt >= '2026-09-16T22:00:00.000Z' AND minuteAt < '2026-10-16T22:00:00.000Z';
```

Run a SQL example with `pnpm --silent data_layer:heidrun_data query --format table "<sql>"`.

## The Statistics window

The source "AI cost" of the tab "Work of one person" reads these tables ([the AI cost rules](https://github.com/heidrun-org/heidrun_code/blob/dev_jerome/docs/agents_rules/user_interface/window/statistics_ai_cost.md)).

- It never opens a chat session file by itself. The first import of a workspace opens every chat session file of the workspace once, and it only starts when the developer clicks the button "Import the history". Until then the tab says that the history is not imported, and the chart does not hold the workspace.
- A workspace that was imported is brought up to date each time that the tab reads it: the command `ai_cost_synchronize` calls the function `refresh_ai_cost`, with the scan cache next to the SQLite file. This opens only the files that changed.
- The tab shows the date of the last update ("Token usage updated on {time}.") and the version of the prices ("Prices: version {version}, checked on {time}."). It shows a warning when the prices could not be refreshed, and a message when the cost is not complete.
- One call of the application takes all the chosen folders together, so the data layer counts a chat session once.

## Measurements

The measurements use the Teamwright history on the computer of the developer, with a release build, on 17 October 2026. The history has 2114 chat session files. 2006 chat sessions used tokens (788 of Claude Code and 1218 of Codex). They give 24948 minute rows and 17.9 billion tokens, from 23 August 2026 to 14 October 2026. The time range of the retrieval is the 30 days from 17 September 2026 to 17 October 2026. A copy of the SQLite file and of the scan cache was used, so the data of the developer did not change. The chat session files were in the cache of the operating system.

| Step | Conditions | Time |
| --- | --- | --- |
| Initial import: `initialize`, all three steps (chat sessions, configuration, token usage) | scan cache empty | 23.0 seconds, then 20.2 seconds for a second run |
| Scan of the chat session files only, as the old path did it (see below) | scan cache empty | 12.7 seconds |
| Scan of the chat session files only | scan cache warm | 0.14 seconds (0.06 seconds to open the cache file, 0.08 seconds to look at the files) |
| Incremental `update`, nothing new | 1 chat session read | 1.0 second |
| Incremental `update`, the chat sessions of the last 7 days | 430 chat sessions read, no row changed | 4.6 seconds |
| Fetch of the price list | network, 2.9 megabytes | 0.13 seconds |
| Retrieval of the 30 days with `heidrun_data usage`, tokens and dollars, whole process | by day, 28 rows | 49 milliseconds (median of 7 runs) |
| | by hour, 354 rows | 47 milliseconds |
| | by minute, 10037 rows | 69 milliseconds |
| One SQL statement on the file, without the start of a program | any of the examples above | 11 to 21 milliseconds |

The old application path was the command `ai_cost_in_range` that read the chat session files with the scan cache of the application, then cut the tokens into hours. I did not run the old command again. I measured its main work with a small program that opens the same scan cache and scans the same files with the same library: it is the row "Scan of the chat session files only". It leaves out the cost of the conversion into hours and of the answer to the web page, which are small. A running application keeps the scan cache in memory, so the warm path costs about 0.08 seconds there.

What the numbers say:

- The first import costs about as much as one cold scan, and it is done once for a workspace.
- Each later question of the Statistics window reads the SQLite file: 11 to 21 milliseconds for one statement, against 0.08 to 0.14 seconds for the warm scan and 12.7 seconds for the cold scan. The scan cache of the application is also not needed for the question.
- The index brings the same timing with and without an index on the folder.

The totals are not the same as those of the old path for two reasons. The old path counted a chat session that two files hold twice. It also gave no cost to every hour of a chat session when one of its models had no price, and the new rows give a partial cost with the tokens that have no price.

## Where the code is

| Part | Place |
| --- | --- |
| The tables, the index, and the views | `packages/data_layer_coding_agents/src/storage/token_usage_schema.rs` |
| The rows and the queries | `packages/data_layer_coding_agents/src/storage/token_usage_database.rs` and `usage_grouping.rs` |
| The reading of the chat session files | `packages/data_layer_coding_agents/src/coding_agents/token_usage_reader.rs` |
| The prices | `packages/data_layer_coding_agents/src/pricing/` and `src/storage/model_price_database.rs` |
| The command `usage` | `packages/heidrun_data/src/usage.rs` |
| The commands of the application | In Heidrun Code: `packages/apps/desktop_tauri/src/statistics/ai_cost.rs`, and `past_chats/chats.rs` for the refresh of the prices in the background |
| The tab | In Heidrun Code: `packages/apps/web_frontend/src/components/PersonWorkTab.vue` and `lib/ai_cost.ts` |

## Open points

- The view `token_usage_with_cost` is created with `CREATE VIEW IF NOT EXISTS`. A later change of its definition does not reach a SQLite file that already has the view, so that change needs a statement `DROP VIEW`.
- Antigravity has no chat session file reader, so its tokens are not stored.
- GitLab does not change this file: the token usage comes from the files of the coding agents and not from the code hosting.
