---
name: heidrun-data
description: Answer a question about the history of a repository from the data layers of Heidrun Code, its past chats with Claude Code and Codex, the memory files, subagents, and skills of the coding agent, its commits, its issues, its pull requests, and the activity of the developer, with the command line heidrun_data. Use it for a post-mortem of a commit, of an issue, or of a pull request, to find what the developer typed or ran many times, or to find what failed many times in the past chats.
---

# heidrun_data

This skill uses the `heidrun_data` command line. Installing the skill does not install that command. To get the command, install the Heidrun Code application, which places `heidrun_data` in `~/.local/bin` when it starts, or run the command through the Heidrun Code repository's `pnpm --silent data_layer:heidrun_data` script.

`heidrun_data` is one command line that reads the four data layers of Heidrun Code. The four data layers write the facts of four sources in one SQLite file, `data_layer.sqlite` in `HEIDRUN_CODE_DIR`, or `~/.config/heidrun_code/data_layer.sqlite` when the variable is unset or empty:

| Source | What it holds | Tables |
| --- | --- | --- |
| `coding_agents` | The chat sessions that Claude Code and Codex saved for the repository, with their tokens, and what each one is linked to. The configuration of the coding agent: the memory files of Claude Code, the subagents, and the skills. The tokens of each minute, with their estimated cost in US dollars, and the model prices. | `chat_sessions`, `chat_session_folders`, `chat_session_issues`, `chat_session_pull_requests`, `chat_session_files`, `memory_files`, `subagents`, `skills`, `token_usage_minutes`, `token_usage_synchronizations`, `model_price_versions`, `model_prices`, and the views `latest_model_prices` and `token_usage_with_cost` |
| `source_control` | Every commit of the Git repository, merges included. | `commits` |
| `code_hosting` | Every issue and every pull request of the GitHub repository. | `issues`, `pull_requests` |
| `user_activity` | The active periods of the developer in front of Heidrun Code, one per workspace. | `user_activity_records` |

The tables hold facts. The words of a chat, the diff of a commit, and the comments of an issue are not in the tables: the command `read` gives them from the source.

## When not to use it

- The current state of the repository: the open issues of today, the branch, the files. `git` and `gh` answer that, and faster. `heidrun_data` is for the history: what happened, in which chat session, at which cost.
- A question about one chat session whose id you already know: `heidrun_data read chat_session <id>` is enough, without a query.

## The four steps

Always give `--format jsonl`, so the output is one JSON object per line and never a text table.

1. **See what the data holds, and how fresh it is.**
   ```bash
   heidrun_data sources --format jsonl
   ```
   One line per source, with the number of rows of each table and `lastUpdatedAt`: the newest date held by the source (the newest `committedAt`, `updatedAt`, or `endedAt`), and not the time of the last `update`. Compare it with the date of the thing you study: if the thing is newer, the data ends before it, so run `update` first and say so when the data is still missing.
2. **Update when the data is old.** Run it in a folder of the repository.
   ```bash
   heidrun_data update --format jsonl
   ```
   `heidrun_data update coding_agents` updates one source only. The command writes only what is new, so it is safe to run again and again. A source that fails does not stop the others: read the errors on the standard error output. The command waits while the desktop application Heidrun Code writes the SQLite file. Give `--verbose` to see the line `waiting for the lock file <path>` on the standard error output: a command that prints this line and then nothing for a minute is waiting for the lock, not broken.
3. **Read the shape once.**
   ```bash
   heidrun_data schema --format jsonl
   heidrun_data schema chat_sessions
   ```
   The first command prints every table, its columns, its primary key, and the joins of the link tables. The second prints the JSON schema of the column `data` of one table, with the description of each field. The schema is the one place for the fields: never guess a field name or a join, and never take it from memory.
4. **Query, then read.**
   ```bash
   heidrun_data query --format jsonl "SELECT ... FROM ..."
   heidrun_data read chat_session <id> --format jsonl
   ```
   `query` adds `LIMIT 1000` to a statement that has no limit outside the parentheses: a `LIMIT` in a subquery does not count. Give `--limit 0` to remove it, and `-` in place of the statement to read the statement from the standard input.

In the examples below, replace `heidrun-org/heidrun` with the repository of the folder. The file can hold several repositories, and this query lists them:

```bash
heidrun_data query --format jsonl "SELECT DISTINCT repository FROM chat_sessions"
```

## The tables and their joins

Every table of a source has a few key columns and one column `data`, which holds one JSON text. Read a field with `json_extract(data, '$.field')`, and take the field names from `heidrun_data schema <table>`. The link tables of the chat sessions have no column `data`.

- `chat_sessions`: keys `repository`, `id`, `updatedAt`.
- `chat_session_issues`: columns `repository`, `chatSessionId`, `issueNumber`. Joins `chat_sessions` on `repository` and `id = chatSessionId`, and `issues` on `repository` and `number = issueNumber`.
- `chat_session_pull_requests`: columns `repository`, `chatSessionId`, `pullRequestNumber`. Joins `pull_requests` the same way.
- `chat_session_files`: columns `repository`, `chatSessionId`, `path`. The files that the coding agent wrote in the chat session, with the path that the coding agent used, often an absolute path.
- `chat_session_folders`: columns `repository`, `chatSessionId`, `folder`. The folders in which the chat session ran.
- `memory_files`, `subagents`, and `skills`: keys `repository`, `id`, `updatedAt`. The `id` is the absolute path of the file, or of the folder of a skill, so it joins `chat_session_files` on `repository` and `path = id`: the chat sessions that wrote the file. A row whose file is gone stays, with the date in the field `removedAt`. A memory file has the fields `memoryType` and `originChatSessionId`, the chat session that wrote it. A skill or a subagent with the scope `USER` is in the home folder of the developer, and is the same for every repository.
- `commits`: keys `repository`, `hash`, `committedAt`. A commit has no link table, and stores no file name: `read commit` gives the files.
- `issues` and `pull_requests`: keys `repository`, `number`, `updatedAt`. The text `Fixes #N` in the body of a pull request is the only link from a pull request to its issue.
- `user_activity_records`: keys `workspaceFolder`, `startedAt`, `endedAt`. It joins no other table.
- `token_usage_minutes`: columns `repository`, `chatSessionId`, `model`, `minuteAt`, `codingAgent`, `folder`, `freshInputTokens`, `cachedInputTokens`, `cacheWriteInputTokens`, and `outputTokens`. One row for each chat session, model, and minute where tokens were used. See "Tokens and estimated cost".
- `token_usage_synchronizations`: columns `repository`, `folder`, `synchronizedAt`, `readUpTo`, and `mode`. One row for each workspace: when its token usage was read the last time.
- `model_price_versions`: columns `version`, `retrievedAt`, `checkedAt`, `source`, `unit`, `contentHash`, and `modelCount`. One row for each version of the price list.
- `model_prices`: columns `version`, `model`, `provider`, `freshInputUsdPerMillion`, `cachedInputUsdPerMillion`, `cacheWriteInputUsdPerMillion`, and `outputUsdPerMillion`. The prices of the models in each version, in US dollars for one million tokens. It joins `model_price_versions` on `version`.
- `latest_model_prices`: a view of `model_prices` with the latest version only. It has the same columns as `model_prices`.
- `token_usage_with_cost`: a view of `token_usage_minutes` with columns `repository`, `folder`, `chatSessionId`, `codingAgent`, `minuteAt`, `model`, `freshInputTokens`, `cachedInputTokens`, `cacheWriteInputTokens`, `outputTokens`, `priceVersion`, `priceModel`, and `costUsd`. See "Tokens and estimated cost".

Every date is in UTC, written as text, so two dates compare as text. The column `repository` is `owner/name`, for example `heidrun-org/heidrun`.

What the tables do not hold:

- The tables can hold several repositories, and the same issue number can exist in two of them. Put `repository = 'owner/name'` in the `WHERE` clause of every query.
- `chat_sessions` holds only the chat sessions that started in the root folder of the repository. A chat session that started in a worktree is not in the table, and an issue fix is made in a worktree, so the chat session of the work is often missing. `read chat_session <id>` reads the files of the root folder, of the worktrees, and of the sub-folders, but only if you already know the id. When a query finds no chat session, say "no chat session found". Do not guess one.
- `token_usage_minutes` is wider than `chat_sessions`: it also holds the chat sessions that started in a worktree or in a sub-folder, and a chat session without a title. Its column `folder` says where the chat session started. A `chatSessionId` of this table can therefore be missing from `chat_sessions`: join with `LEFT JOIN`.

## Tokens and estimated cost

The tokens are stored for each minute, and the cost is calculated by the view `token_usage_with_cost`. A question about tokens or dollars needs no chat session file: it is a query, or the command `usage`.

- **A minute is the minute of the record** that reports the tokens of an operation, in UTC. The tokens are not measured while the model writes them: an operation that lasts three minutes puts all its tokens in one minute. A record without a date has `minuteAt` equal to the empty text: its tokens are in the total of the chat session, and in no time range. An operation without a known model has `model` equal to the empty text.
- **The workspace is the column `folder`**: the folder where the chat session started. A workspace owns the rows whose `folder` is its folder or a folder below it, such as a worktree. Write that as `(folder = '/Users/me/app' OR (folder >= '/Users/me/app/' AND folder < '/Users/me/app0'))`, which uses the index. A chat session counts once, so two workspaces that overlap never count a row twice if you put both tests in one `WHERE` with `OR`.
- **Always limit the time range with `minuteAt`**, as text: `minuteAt >= '2026-10-01' AND minuteAt < '2026-11-01'`. The index `token_usage_minutes_by_minute` serves `repository` and `minuteAt`.
- **The cost is an estimate.** It is the tokens of each kind multiplied by the public price of the model, from the price list of LiteLLM, in US dollars for one million tokens. It is not an invoice, and not the payment of a subscription. The four kinds of tokens have four prices; a price that the list does not give for the cache is the input price. A model name that ends with a date (`-20251001`) uses the price of the name without the date.
- **An unknown price is an unknown cost, never zero.** `costUsd` is null when the model has no price, and `sum(costUsd)` skips the nulls. So a sum is complete only when `count(*) = count(costUsd)`. Always select `count(*) - count(costUsd) AS unpricedRows` next to the sum, and say that the total is partial when it is not 0.
- **One price version in a result.** The view uses the latest version for every row, old rows included: a past day is priced with today's prices. `priceVersion` tells which version. The versions stay in `model_price_versions` with their `source`, `retrievedAt`, `checkedAt`, `unit`, and `contentHash`. `update coding_agents` fetches the price list when the latest version is a day old; `--refresh-prices` forces it, and `--price-list <address or file>` replaces the source.
- **Days in SQL are UTC days** if you cut `minuteAt` as text with `substr(minuteAt, 1, 10)`. A local day needs the time zone: use the command `usage --by day --time-zone Europe/Paris`, which cuts the days with the rules of the time zone, daylight saving time included.

The daily tokens and the known cost of a workspace in UTC, with the rows that have no price:

```bash
heidrun_data query --format jsonl "
SELECT substr(minuteAt, 1, 10) AS day,
       sum(freshInputTokens + cachedInputTokens + cacheWriteInputTokens + outputTokens) AS tokens,
       sum(costUsd) AS knownCostUsd,
       count(*) - count(costUsd) AS unpricedRows
FROM token_usage_with_cost
WHERE repository = 'heidrun-org/heidrun'
  AND (folder = '/Users/me/app' OR (folder >= '/Users/me/app/' AND folder < '/Users/me/app0'))
  AND minuteAt >= '2026-10-01' AND minuteAt < '2026-11-01'
GROUP BY day ORDER BY day"
```

The chat sessions ranked by their estimated total cost:

```bash
heidrun_data query --format jsonl "
SELECT chatSessionId, round(sum(costUsd), 2) AS knownCostUsd, count(*) - count(costUsd) AS unpricedRows
FROM token_usage_with_cost
WHERE repository = 'heidrun-org/heidrun' AND minuteAt >= '2026-10-01'
GROUP BY chatSessionId ORDER BY knownCostUsd DESC LIMIT 10"
```

The chat sessions that cost more than 50 dollars, with their title when they have one:

```bash
heidrun_data query --format jsonl "
SELECT u.chatSessionId, round(sum(u.costUsd), 2) AS knownCostUsd, json_extract(c.data, '$.title') AS title
FROM token_usage_with_cost AS u
LEFT JOIN chat_sessions AS c ON c.repository = u.repository AND c.id = u.chatSessionId
WHERE u.repository = 'heidrun-org/heidrun' AND u.minuteAt >= '2026-10-01'
GROUP BY u.chatSessionId HAVING sum(costUsd) > 50 ORDER BY knownCostUsd DESC"
```

The command `usage` gives the same numbers without SQL, one row per period, with `isCostComplete` and `unpricedTokens` in every row. It reads the SQLite file only and fails when the token usage was never read, so run `heidrun_data initialize coding_agents` once before the first question:

```bash
heidrun_data usage --by day --since 2026-09-14 --until 2026-10-14 --time-zone Europe/Paris --format jsonl
heidrun_data usage --by hour --since 2026-10-14 --format jsonl
heidrun_data usage --by-chat --since 2026-10-01 --format jsonl
```

`sources` shows the number of rows of each table, and `SELECT * FROM token_usage_synchronizations` tells when the token usage of each workspace was read the last time (`synchronizedAt`). If that date is old, run `heidrun_data update coding_agents`.

## The command `read`

`read` gives the content of one thing from its source. It writes nothing.

| Command | What it prints |
| --- | --- |
| `heidrun_data read chat_session <id>` | The records of the chat session, one per line: `at`, `role` (`developer`, `coding_agent`, or `tool`), `text`, and `isError`. A tool call is `<name>: <input>` and a tool result is `result: <output>`, each shortened to one line; `--full` prints them whole. |
| `heidrun_data read commit <hash>` | The message, the files changed, then the diff. `--no-diff` stops after the files. |
| `heidrun_data read issue <number>` | The body, then every comment with its author and its date. |
| `heidrun_data read file_history <path>` | Every tool call of a chat session that wrote the file (`Write`, `Edit`, `Bash`, `apply_patch`, ...), in the order of the dates, with its chat session and its input in full. The `old_string` and `new_string` of an `Edit` are the diff. Give the absolute path: a file name alone matches the end of the path, so it can find another file with the same name. A shell command counts only when it names the path and has a sign of a write (`>`, `sed -i`, `tee`, `mv`, `cp`, `rm`), so check the result. A change made by hand is not found. It reads every chat session file, so it can take some seconds. |
| `heidrun_data read pull_request <number>` | The body, then every comment, review, and review comment with its author, its date, and for a review comment its file and its line, in the order of the dates, then the diff. `--no-diff` stops before the diff. |

With `--format jsonl`, each line has these fields:

- `read chat_session`: `at`, `role`, `text`, `isError`. `isError` is `true` for a tool result that Claude Code marks as failed, `false` for a tool result that Claude Code marks as a success, and `null` when the coding agent gives no mark: for every other record, and for every record of Codex.
- `read commit`: one object with `hash`, `authorName`, `authorEmail`, `committedAt`, `message`, `files` (a list of `path`, `insertions`, `deletions`), and `diff` unless `--no-diff` is given.
- `read file_history`: `at`, `chatSessionId`, `tool`, and `input`, the input of the tool call as JSON.
- `read issue` and `read pull_request`: `kind` (`issue`, `pull_request`, `comment`, `review`, `review_comment`, or `diff`), `author`, `at`, and `text`. The body has `number`, `title`, and `state` too, a review has `state`, and a review comment has `path` and `line`.

`read issue` and `read pull_request` need the repository. The default is the remote `origin` of the current folder; `--repository owner/name` replaces it. `read chat_session` and `read commit` work from any folder of the repository, a worktree included.

## Example: post-mortem of an issue

The chat sessions that worked on the issue 500, in order:

```bash
heidrun_data query --format jsonl "
SELECT cs.id,
       json_extract(cs.data, '$.codingAgent') AS codingAgent,
       json_extract(cs.data, '$.firstRecordAt') AS firstRecordAt,
       json_extract(cs.data, '$.userMessageCount') AS userMessageCount
FROM chat_session_issues AS link
JOIN chat_sessions AS cs ON cs.repository = link.repository AND cs.id = link.chatSessionId
WHERE link.repository = 'heidrun-org/heidrun' AND link.issueNumber = 500
ORDER BY firstRecordAt"
```

Then read each chat session and the issue:

```bash
heidrun_data read chat_session <id> --format jsonl
heidrun_data read issue 500 --format jsonl
```

For a pull request, use `chat_session_pull_requests` and `pullRequestNumber`, then `heidrun_data read pull_request <number>`.

## Example: post-mortem of a commit

A commit has no link table. Read the commit to get its files and its date, then find the chat sessions that were active around `committedAt` and that wrote a file of the commit. A path in `chat_session_files` is the path that the coding agent used, often an absolute path, so match the end of the path:

```bash
heidrun_data read commit <hash> --no-diff --format jsonl
heidrun_data query --format jsonl "
SELECT DISTINCT cs.id, json_extract(cs.data, '$.title') AS title
FROM chat_sessions AS cs
JOIN chat_session_files AS files ON files.repository = cs.repository AND files.chatSessionId = cs.id
WHERE cs.repository = 'heidrun-org/heidrun'
  AND (files.path LIKE '%/<file of the commit>' OR files.path = '<file of the commit>')
  AND json_extract(cs.data, '$.firstRecordAt') <= '<committedAt>'
  AND json_extract(cs.data, '$.lastRecordAt') >= '<committedAt minus one day>'"
```

A commit can have many files: write one `LIKE` condition for each file, and leave out the files that every change touches, such as `Cargo.lock`. If no chat session is found, the chat session may have run in a worktree: see "What the tables do not hold".

Then `heidrun_data read chat_session <id>` on each one, and look for the moment when the coding agent made the change.

## Example: the corrections of the developer

A memory file of type `feedback` is a correction that the developer gave to the coding agent, with the chat session where it happened:

```bash
heidrun_data query --format jsonl "
SELECT json_extract(data, '$.name') AS name,
       json_extract(data, '$.description') AS description,
       json_extract(data, '$.originChatSessionId') AS chatSessionId,
       updatedAt
FROM memory_files
WHERE repository = 'heidrun-org/heidrun'
  AND json_extract(data, '$.memoryType') = 'feedback'
  AND json_extract(data, '$.removedAt') IS NULL
ORDER BY updatedAt"
```

The tables keep only the last state of a memory file. Its changes, with the text before and after, are in the chat sessions: `heidrun_data read file_history <id of the row> --format jsonl` gives each tool call that wrote it, and `read chat_session <chatSessionId>` shows why.

## Example: what the developer typed, ran, or hit many times

The method, the counts found on the repository of Heidrun Code, and the limits are in [references/repeated_pattern.md](references/repeated_pattern.md). In short: list the chat sessions of the period, read each one, keep the lines of one role, normalize the texts, count the equal ones, then group the near-equal ones.

```bash
heidrun_data query --format jsonl "
SELECT id FROM chat_sessions
WHERE repository = 'heidrun-org/heidrun'
  AND json_extract(data, '$.lastRecordAt') > '2026-10-01'"
```

Dates are text, so `date('now', '-10 day')` can replace the fixed date. Then `heidrun_data read chat_session <id> --format jsonl` on each one.

- **What the developer typed**: the lines with `role` equal to `developer`. Not all of them are typed: skip the chat sessions whose `title` is `Guardian review` (approval reviews of Codex), and the texts that start with `<` (`<turn_aborted>`, `<command-name>`, `<local-command-stdout>`), with `[Operation interrupted`, with `>>>`, or with `[N] user:` where `N` is a number. A text typed many times is a candidate for a macro of Heidrun Code.
- **What the developer ran**: the lines with `role` equal to `tool` whose text starts with `Bash:` (Claude Code) or `shell:` (Codex). A command run many times is a candidate for a launcher of Heidrun Code.
- **What failed**: the lines with `role` equal to `tool` whose text starts with `result:`. For Claude Code, count the lines with `isError` equal to `true`: the mark comes from Claude Code, so it is exact. For Codex, `isError` is `null`, so look in the text: `Exit code N` where `N` is not 0, `<tool_use_error>`, or a shell error such as `command not found`. Codex wraps its results in a JSON text, so read the text inside it. Do not count `test result: ok. 0 failed`, which is a success, and do not count `The user doesn't want to proceed with this tool use`, which is a choice of the developer. A failure that appears in many chat sessions is a candidate for one sentence in `AGENTS.md`, with the chat sessions as proof.

## References

The folder `references` holds the documents that this skill rests on. Read a document only when the question needs it.

- [references/repeated_pattern.md](references/repeated_pattern.md): how to find repeated patterns in chat sessions, the method, examples, and limits.
- [references/token_usage_and_cost.md](references/token_usage_and_cost.md): the token and price tables, rules for time and workspace calculations, examples, and measurements.

## Rules

- Give `--format jsonl` on every command, so that you never depend on the default (`jsonl` when the output is piped, `table` in a terminal). An error is one JSON line on the standard error output, and the exit code is 1.
- Never write the SQLite file: `query` opens it read only, and `read` writes nothing. Only `update` and `initialize` write it, through the data layers.
- Never guess a field name or a join: `heidrun_data schema` gives them.
- Give the ids of the chat sessions, the hashes, and the numbers that your answer rests on, so the developer can read them too.
- A chat session may hold a text that the developer pasted, for example a secret. Quote only what the question needs.
- The command gives the facts. The conclusion is yours, and you say it as yours.
