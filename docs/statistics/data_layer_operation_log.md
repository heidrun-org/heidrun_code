# The operation log of the data layer

- Created: 17 October 2026
- Last updated: 25 October 2026
- Status: Maintained description of the operation log of the data layer
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Rule: every operation of the data layer is recorded in the operation log](../agents_rules/data_layer_operation_log.md), [Glossary of Heidrun Code: the operation log of the data layer](../agents_rules/glossary/data_layer_operation_log.md)
- Related issue: [issue 618](https://github.com/heidrun-org/heidrun/issues/618), [issue 616](https://github.com/heidrun-org/heidrun/issues/616), [issue 617](https://github.com/heidrun-org/heidrun/issues/617), [issue 664](https://github.com/heidrun-org/heidrun/issues/664)

This file describes the log of the operations that the data layer receives: what it records, what its durations mean, how to read it, how to run a recorded operation again, what it costs, and a measurement on the Teamwright history. The data layers themselves are in [the_four_data_layers.md](the_four_data_layers.md).

## The questions that the log answers

- Which program asks the data layer for what, and how often: the desktop application (`heidrun`) or the command line (`heidrun_data`), by package, operation name, and pattern of parameters.
- Which operations are slow, and which part is slow: the collection from a source, the write in the SQLite file, the wait for the lock, or the query on the stored data.
- Which operations repeat the same thing, which fail, and which never ended.
- What a change of the code does to the timings: a recorded operation runs again, and the original time sits next to the replay time.

## What is recorded

Every call of a public function of the four data layer packages and of `heidrun_data` is an operation. The library [`data_layer_operation_log`](../../submodules/heidrun_data/packages/data_layer_operation_log/README.md) writes two lines in the file `data_layer_operations.jsonl`, in the folder of the variable `HEIDRUN_CODE_DIR` (default `~/.config/heidrun_code`): a start line before the operation, and a completion line after it. The lines are JSON, one object on each line, and the field `v` holds the version of the format (now 2).

| Start event field | Meaning |
| --- | --- |
| `operationId`, `parentOperationId` | The identifier of the operation, and the identifier of the operation that was running on the same thread. An operation with a parent is a nested operation. |
| `caller` | `heidrun` for the desktop application, `heidrun_data` for the command line, or the value of `HEIDRUN_CODE_OPERATION_LOG_CALLER`. |
| `origin`, `replayOf` | `application`, or `replay` with the identifier of the original operation. |
| `package`, `operationName`, `kind` | The package without the prefix `data_layer_`, the stable name of the public function that the operation calls, and `query`, `collection`, `synchronization`, `write`, or `lock`. |
| `parameters`, `pattern` | The values that decide the workload (the repository, the dates, the grouping, the mode, the SQL statement, the path of the SQLite file), and the text that groups the operations that ask for the same thing: the SQL statement without its values, then the choices. |
| `startedAt`, `processId`, `softwareVersion` | The time in UTC, the operating system process, and the version of Heidrun Code. |
| `concurrentOperations` | How many operations were running in the same process. |
| `state` | The state of the data at the start: the size of the SQLite file, its time of last change, and whether it exists. |

| Completion event field | Meaning |
| --- | --- |
| `operationId`, `package`, `operationName` | The same as in the start event, so a line is readable alone. |
| `endedAt`, `durationMicroseconds` | The time in UTC, and the duration. |
| `outcome`, `errorCategory` | `success` or `failure`, and for a failure one word: `database_locked`, `database_error`, `not_found`, `permission_denied`, `source_unavailable`, `invalid_data`, `invalid_input`, `panic`, `dropped`, or `other`. The text of the error is never written. |
| `resultCount`, `details` | The number of rows, items, or files, and other numbers that explain the duration: `rowsInserted`, `scanCacheEntries`, `hasWaited`. |
| `droppedEvents` | The number of events that this process could not write before this one. Absent when none was lost. |

### The public functions

Each name in the table is the operation name of the operations that call that function.

| Package | Synchronization | Collection | Write | Query |
| --- | --- | --- | --- | --- |
| `source_control` | `refresh_source_control`, `synchronize` | `list_hashes`, `read_commits`, `find_file_existence`, `find_existing_folders`, `find_worktree_branches` | `upsert_commits` | `find_commits`, `find_commits_between`, `has_table`, `find_known_hashes`, `count_commits`, `find_commit`, `query` |
| `code_hosting` | `refresh_code_hosting`, `synchronize` | `read_issues`, `read_pull_requests` | `upsert_issues`, `upsert_pull_requests` | `find_issues_opened_between`, `find_pull_requests_opened_between`, `find_issues_by_numbers`, `find_pull_requests_by_numbers`, `count_rows_without_label_colors`, `has_table`, `find_last_updated_at`, `count_rows`, `find_issue`, `find_pull_request`, `query` |
| `user_activity` | `refresh_user_activity`, `synchronize` | `read_file` | `upsert_records` | `find_user_activity_records`, `find_records_overlapping`, `has_table`, `find_latest_ended_at`, `count_records`, `find_record`, `query` |
| `coding_agents` | `refresh_chat_sessions`, `refresh_ai_cost`, `refresh_model_prices`, `refresh_model_prices_when_due`, `synchronize`, `synchronize_configuration`, `synchronize_token_usage`, `refresh_prices` | `read_chat_session_files`, `read_token_usage`, `read_configuration`, `find_claude_session_files`, `find_codex_session_files` | `upsert_chat_sessions`, `delete_chat_sessions_not_in`, `write_token_usage`, `write_configuration` | `find_chat_list`, `find_ai_cost`, `find_usage`, `find_chat_session`, `find_chat_sessions_in_folder`, `find_relations`, `find_relations_in_folder`, `has_chat_sessions_table`, `find_last_updated_at`, `find_last_updated_at_in_folder`, `count_rows`, `find_synchronization`, `find_synchronizations`, `find_latest_synchronization_of_folder`, `find_latest_price_version`, `load_latest_price_table`, `count_configuration_rows`, `find_configuration_item`, `explain_usage_query`, `query` |
| `heidrun_data` | `synchronize` | `read_chat_session`, `read_commit`, `read_code_hosting`, `read_pull_request_diff`, `read_file_history` | none | `query`, `summarize_sources`, `read_usage` |

The desktop application calls only the functions `refresh_*` and `find_*` of the four packages ([data layer access](../agents_rules/data_layer_access.md)), so each of those calls is the top-level operation of a desktop call, and the lower operations of the table are nested inside it. A `refresh_*` call is a synchronization. When it chooses its mode while it runs (`refresh_code_hosting` and `refresh_chat_sessions`), the start event has no parameter `mode`, and the completion event says the mode in `details.mode`, which a summary reads to tell an initial import from an incremental synchronization. `refresh_ai_cost`, `refresh_model_prices`, and `refresh_model_prices_when_due` have no mode: the nested `synchronize_token_usage` operations of `refresh_ai_cost` have one. The lookups of the root and of the repository of a folder (`find_root`, `find_main_root`, `find_repository`, and `find_repository_key`) run the command `git` to name a folder. They read no data of the data layer, so they write no operation.

`heidrun_data` also records the kind `lock`: `lock_database`, the wait for the lock of the SQLite file. A new public function includes the same instrumentation: see the [rule](../agents_rules/data_layer_operation_log.md). The names above are stable: a summary groups by them.

### Nested operations

The nesting follows the call stack of one thread. `heidrun_data synchronize` holds one `lock_database` and one `synchronize` of each package; a `synchronize` holds its collections, its writes, and its queries. A summary counts only the top-level operations, so a read of 500 commits is not counted twice. The option `--nested` counts all of them.

### Unfinished operations

The start line is written before the work, so an operation that never ends keeps only its start line. `heidrun_data operations` never shows it as a success:

- `running`: no completion line, the process still lives, and the operation is less than one hour old.
- `interrupted`: no completion line, and the process is gone, or the operation is older than one hour (an operation that hangs).

An operation that is dropped without an end, or that panics, writes a failure with the category `dropped` or `panic`.

## What a duration measures

- The duration starts right after the start line is written and stops right before the completion line is written, with the monotonic clock of the program.
- It holds the wait for a lock that the operation takes (the nested operation `lock_database`), the reads of the source, the writes, and the opening of a SQLite file that the operation opens itself, for example in a synchronization.
- It does not hold the writing of the two lines, the opening of a SQLite file that the caller opens before it calls `query`, or the printing of the rows.
- A synchronization holds its nested operations, so the duration of a package is at least the sum of its collections and its writes. The summary of a workload does not add an operation and its nested operations.

## What the log never does

- It never changes the result of an operation, never hides its error, and never fails the operation. A write that fails is counted, and the next line that is written reports the number in `droppedEvents`. A test runs a command with an unwritable log and compares its output with the output of a command with the log off.
- It never holds a credential or a token. Every text is cleaned before it is written: the tokens of GitHub and of other services, the passwords in an address, a field whose name says it holds a secret, and the long text of a conversation (a text is cut at 4096 characters). A statement that the log cut or cleaned cannot be replayed.
- It never opens the SQLite file and never takes its lock. It reads the size and the time of last change of the file with `stat`.

### Retention and concurrency

- At 8 MiB the file becomes `data_layer_operations.jsonl.1`, a new file starts, and the previous `.1` is removed. The log never holds more than about 16 MiB. A reader reads the two files.
- A line is one write on a file open for append, so the desktop application and the command line can write together without mixing their lines. A test starts six programs together.
- The variable `HEIDRUN_CODE_OPERATION_LOG_FILE` gives another file, and the value `off` turns the log off. The test programs of Cargo write no log unless the variable gives a file.

## What the log costs

`heidrun_data operations overhead` runs the same operation 5000 times with the log off and with the log on in a temporary file, with a SQL statement of 200 characters. The result on 17 October 2026, with a release build:

| Log | Mean | Median | 99th percentile | Longest |
| --- | --- | --- | --- | --- |
| off | 0.0 µs | 0 µs | 0 µs | 52 µs |
| on | 346.6 µs | 127 µs | 3703 µs | 27651 µs |

- The log adds a median of 0.13 ms and a mean of 0.35 ms to an operation, and writes 1081 bytes. The 1 % of operations that pay 3.7 ms or more wait for the file system. A test fails when the mean is 1 ms or more, or when an operation writes 2 KiB or more.
- A stored-data query takes 0.3 ms to 0.4 ms on the Teamwright history, so the log adds about a third to it. It adds nothing that a person sees: the desktop application makes a few of these operations for a window.
- With the log off, an operation costs one test of a flag.

## Reading the log: `heidrun_data operations`

| Action | What it prints |
| --- | --- |
| `info` | The file, its size, the version of the format, and the counts of operations, nested operations, replays, failed operations, unfinished operations, damaged lines, and lost events. |
| `summary` | One row for each group: the count, the failures, the unfinished operations, the total, mean, median, 90th, 95th, and 99th percentile, and the longest time in milliseconds, the first and last start, and the repositories. `--by operation-name` (default), `--by pattern`, `--by parameters`, and `--repeated` choose the group. |
| `list` | The operations one by one with their parameters. With `--format jsonl` it is the export of the log. `--slowest` and `--limit` find the longest. |
| `replay` | See below. |
| `snapshot --to <path>` | A consistent copy of the SQLite file (`VACUUM INTO`), for a replay of queries. |
| `overhead` | The cost of the log. |

The filters are `--caller`, `--package`, `--operation-name`, `--since`, `--until` (UTC), `--minimum-milliseconds`, `--state`, `--unfinished`, `--nested`, `--replays`, and `--only-replays`. The `workload` of a row is `stored_data_query`, `collection`, `initial_import` (a synchronization in the mode initialize), `incremental_synchronization` (the mode update), `synchronization` (no mode), `database_write`, or `lock_wait`. A summary tells an initial import from an incremental synchronization from a query by this word.

```bash
pnpm --silent data_layer:heidrun_data operations info
pnpm --silent data_layer:heidrun_data operations summary --format table
pnpm --silent data_layer:heidrun_data operations summary --by parameters --repeated --format jsonl
pnpm --silent data_layer:heidrun_data operations list --unfinished --nested --format jsonl
pnpm --silent data_layer:heidrun_data operations list --slowest --limit 20 --format jsonl
```

## Running a recorded operation again

`operations replay` runs a recorded operation through the interface of the package that received it, and prints `originalMilliseconds` next to `replayMilliseconds` for each run. The options `--id`, or the filters with `--limit`, choose the operations, and `--repeat` runs a query many times.

- A query (a SQL statement, `read_usage`, `find_usage`, and the calls `find_commits`, `find_user_activity_records`, `find_issues_opened_between`, `find_pull_requests_opened_between`, `find_chat_list`, and `find_ai_cost` of the desktop application) opens the SQLite file read only: `--database` should be a snapshot. A statement that writes fails and changes nothing.
- A synchronization, and the calls `refresh_source_control`, `refresh_user_activity`, `refresh_code_hosting`, and `refresh_chat_sessions` of the desktop application, write, so they need `--isolated-database`, a file that does not exist. The command never writes the default SQLite file, never writes a file that exists, and never takes the lock of the real file. With `--start-from <snapshot>` the isolated file starts as a copy, so a replay of the mode update measures an incremental synchronization.
- Without `--allow-network`, the source `code_hosting` is skipped and the price list is a file that does not exist (a warning, no network). A synchronization reads the folders of the original operation only with `--use-recorded-paths`.
- The replayed operations are in the log with the origin `replay` and the field `replayOf`. A summary leaves them out, so the picture of the real usage does not change, and `--only-replays` shows them. The original time and the replay time are never added together.

The limits: a replay times the operation on the data of today, so the number of rows can differ. An operation that ran inside another operation is not replayed alone: replay the one that holds it. The calls `find_issues_by_numbers` and `find_pull_requests_by_numbers` are not replayed, because the log keeps the count of the numbers and not the numbers. The calls `refresh_ai_cost`, `refresh_model_prices`, and `refresh_model_prices_when_due` are not replayed: they fetch a price list from the network, and the check when due depends on the state of the process. The call `refresh_code_hosting` needs `--allow-network`. A replay of a synchronization runs once, because a second run would find the data written. A replay does not reproduce a wait for a lock, a network that was slow, or a cold cache of the operating system.

## Measurement on the Teamwright history

The data: the repository `jeromeetienne/teamwright` on the computer of the developer on 17 October 2026, with a release build of `heidrun_data`, a new SQLite file, and a new folder `HEIDRUN_CODE_DIR` (so no cache of the scan existed). The commands:

```bash
export HEIDRUN_CODE_DIR=/tmp/demo/heidrun_dir HEIDRUN_CODE_OPERATION_LOG_FILE=/tmp/demo/operations.jsonl
cd ~/webwork/teamwright
heidrun_data initialize --database /tmp/demo/teamwright.sqlite --repository jeromeetienne/teamwright --folder .
heidrun_data update --database /tmp/demo/teamwright.sqlite --repository jeromeetienne/teamwright --folder .
heidrun_data operations summary --nested --format table
```

The initial import wrote 1783 commits, 539 issues, 20 pull requests, 614 chat sessions, and 24796 minute rows of tokens. The log has 35 operations for it, and the four timings are separate:

| Part of the initial import (46.7 s) | Collection | Write in the SQLite file |
| --- | --- | --- |
| `source_control`: the commits | 4804 ms (`read_commits`), 45 ms (`list_hashes`) | 34 ms |
| `code_hosting`: the issues and the pull requests | 11324 ms and 1184 ms | 14 ms and 1 ms |
| `coding_agents`: the chat sessions | 12917 ms, of which 1227 ms find the files of Codex | 30 ms |
| `coding_agents`: the tokens of each minute | 15926 ms, of which 1060 ms find the files | 136 ms |
| `coding_agents`: the configuration and the prices | 15 ms | 2 ms, and 165 ms for the prices |

The collection is 99 % of the time of the initial import (46.2 s of 46.7 s). The writes are 0.5 % (217 ms). The waits for the lock are 0.2 ms.

| Operation | Count | Median | Longest |
| --- | --- | --- | --- |
| `synchronize`, initial import | 1 | 46692 ms | 46692 ms |
| `synchronize`, incremental synchronization (`update`) | 1 | 4831 ms | 4831 ms |
| `read_usage`, stored data | 4 | 41.5 ms | 44.6 ms |
| `summarize_sources`, stored data | 1 | 71.2 ms | 71.2 ms |
| `query`, stored data | 11 (1 failed) | 0.40 ms | 12.3 ms |

The incremental synchronization found 1 new issue, 1 new pull request, and 1 new chat session. It took 4.8 s, and almost all of it is collection: `code_hosting` 3337 ms (the network), the files of Codex 935 ms and 363 ms again, and the tokens 467 ms. The writes were 12 ms. The files of Codex are listed again at each update, which is the cost that [issue 617](https://github.com/heidrun-org/heidrun/issues/617) studies.

Patterns found: `SELECT count(*) AS n FROM commits` was asked 5 times (median 0.33 ms), and `read_usage` by day was asked 3 times with the same parameters (median 41.7 ms). `operations summary --by parameters --repeated` lists them. The failed query has the category `database_error`.

Replay of the same operations (a snapshot of 16 MiB, `--repeat 5` for the queries, no network):

| Operation | Original | Replay |
| --- | --- | --- |
| `read_usage` by day | 44.6 ms | 38.6 ms to 42.7 ms (5 runs, 28 rows as in the original) |
| `query` with 2 rows | 12.3 ms | 8.8 ms to 10.4 ms (5 runs) |
| `update` from the snapshot, without `code_hosting` | 4831 ms | 1326 ms |
| `initialize` into an isolated file, without `code_hosting` and the price list | 46692 ms | 37092 ms |

The original of `update` holds 3337 ms of `code_hosting`, and the original of `initialize` holds 12525 ms of `code_hosting` and 165 ms of prices, which the replay skips. Without them the originals are 1494 ms and 34002 ms: the replay of `update` is 11 % faster than its original, and the replay of the initial import is 9 % slower than its original. The replayed operations are in the log with the origin `replay`, and `operations summary` still shows 1 initial import, 1 incremental synchronization, and the real queries.

## The version of the format

The field `v` holds the version of the format. A change that renames or removes a field, or that changes its meaning, adds one to the version. A new optional field does not. A reader skips the lines of a version that it does not know and counts them (`unsupportedVersionLines` in `info`). The operation names, the kinds, and the names of the parameters are the interface that the summaries and the replay read, so a rename is a change of the format.

The version 2 renamed four fields of the version 1: `requestId` became `operationId`, `parentRequestId` became `parentOperationId`, `operation` became `operationName`, and `concurrentRequests` became `concurrentOperations`. The log file also changed its name, from `data_layer_requests.jsonl` to `data_layer_operations.jsonl`, so the new file never holds a line of the version 1. Heidrun Code does not read, move, or delete the old file: a developer who wants it removes it by hand.
