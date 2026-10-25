# Ten metrics from the join of the three inputs

- Created: 16 October 2026
- Last updated: 25 October 2026
- Status: Maintained list of the metrics, with their queries and their results on this repository
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [The four data layers](../statistics/the_four_data_layers.md)
- Related issue: [issue 564](https://github.com/heidrun-org/heidrun/issues/564), [issue 561](https://github.com/heidrun-org/heidrun/issues/561)

This file lists the metrics that the join of the three inputs of [inputs.md](inputs.md) gives, and that no single input gives alone: the chat sessions of the coding agents, the commits, and the issues and the pull requests. Each metric has one definition, one SQL query on the SQLite file of the data layers, its result on this repository, what the result says, and its limits. The metrics are independent from the user interface of Heidrun Code: every query runs with `sqlite3 -readonly ~/.config/heidrun_code/data_layer.sqlite`, or with the command `query` of a data layer. The links that the queries use, and their gaps, are in [inputs_links.md](inputs_links.md).

The results were taken on 16 October 2026 on the repository `heidrun-org/heidrun`: 306 chat sessions from 9 to 14 October 2026, 900 commits from 5 to 16 October 2026, 313 issues, and 248 pull requests. Every query filters on `repository = 'heidrun-org/heidrun'`, because the SQLite file holds the commits of three repositories.

The ten metrics follow the rules of [metrics_rules.md](metrics_rules.md): a metric joins the chat sessions with one other input, is one SQL query, says a number, and leaves the conclusion to the developer, or to the coding agent that reads the number.

## 1. The price of a line that survived

**Definition.** For one pull request: the output tokens of every chat session linked to the pull request, divided by the lines that the pull request adds. The tokens measure the thinking, the lines measure what was kept.

```sql
SELECT l.pullRequestNumber AS pr,
       json_extract(p.data, '$.additions') AS additions,
       count(DISTINCT cs.id) AS chats,
       sum(json_extract(t.value, '$.output')) AS output_tokens,
       round(sum(json_extract(t.value, '$.output')) * 1.0 / json_extract(p.data, '$.additions')) AS tokens_per_line
FROM chat_session_pull_requests AS l
JOIN chat_sessions AS cs ON cs.repository = l.repository AND cs.id = l.chatSessionId
JOIN pull_requests AS p ON p.repository = l.repository AND p.number = l.pullRequestNumber,
     json_each(cs.data, '$.tokens') AS t
WHERE l.repository = 'heidrun-org/heidrun' AND json_extract(p.data, '$.additions') >= 20
GROUP BY pr
ORDER BY tokens_per_line DESC;
```

**Result.** Over the 182 pull requests that have a chat session, 45 output tokens per added line. With a floor of 20 added lines, the most expensive pull requests are 460 (43 lines, 277,466 tokens, 6,453 tokens per line, a rename of a package), 222 (126 lines, 4,105 tokens per line), 236 (25 lines, 4,009 tokens per line), and 112 (51 lines, 3,983 tokens per line). The cheapest are 231 (24,633 lines, 0 tokens per line, a merge of `dev` into `main`), 363 (a release), and 408 (206,591 lines, 3 tokens per line, a copy of a documentation experiment). Without the floor, pull request 365 added 1 line for 494,971 tokens.

**What it says.** A rename and a layout change cost thousands of tokens per line because the coding agent reads much more than it writes. A merge, a release, and a copy cost nothing per line because no thinking went in. The ratio separates the hard thinking from the mechanical work, per pull request, per file, or per week.

**Limits.** A pull request of one line is a documentation fix or a one-word change, so the metric needs a floor on the lines. The link from a chat session to a pull request counts a chat session that only mentioned the pull request too.

## 2. The struggle index of an issue

**Definition.** For one issue: the number of chat sessions linked to the issue, multiplied by the number of messages that the developer typed in those chat sessions. An issue that needed many chat sessions and many human messages fought back.

```sql
SELECT l.issueNumber AS issue,
       count(DISTINCT cs.id) AS chats,
       sum(json_extract(cs.data, '$.userMessageCount')) AS developer_messages,
       count(DISTINCT cs.id) * sum(json_extract(cs.data, '$.userMessageCount')) AS struggle,
       json_extract(i.data, '$.title') AS title
FROM chat_session_issues AS l
JOIN chat_sessions AS cs ON cs.repository = l.repository AND cs.id = l.chatSessionId
JOIN issues AS i ON i.repository = l.repository AND i.number = l.issueNumber
WHERE l.repository = 'heidrun-org/heidrun'
GROUP BY issue
ORDER BY struggle DESC;
```

**Result.** Issue 265 (the clustered dynamic topics) leads with 9 chat sessions and 103 messages of the developer, a struggle of 927. Then issue 260 (9 chat sessions, 69 messages, 621), issue 250 (8 chat sessions, 73 messages, 584), and the issues 199 and 200 of the panel layout redesign (5 chat sessions, 107 messages, 535 each).

**What it says.** The three issues of the dynamic topics and the two issues of the layout redesign are the five hardest pieces of work of the week, and the data says it without anyone remembering it. On the files of a new issue, the same number from the past predicts the fight before it starts.

**Limits.** Issues 199 and 200 share the same 5 chat sessions, so they get the same struggle. The link counts a chat session that discussed the issue, not only one that fixed it (see [inputs_links.md](inputs_links.md)).

## 3. How much of you an issue took

**Definition.** The number of messages that the developer typed, which is the number of times a human had to step in. The tokens measure the machine, the messages of the developer measure the person. Per day, per issue, or per coding agent.

```sql
SELECT substr(json_extract(data, '$.firstRecordAt'), 1, 10) AS day,
       count(*) AS chats,
       sum(json_extract(data, '$.userMessageCount')) AS developer_messages
FROM chat_sessions
WHERE repository = 'heidrun-org/heidrun' AND json_extract(data, '$.firstRecordAt') IS NOT NULL
GROUP BY day
ORDER BY day;
```

**Result.** Over the six days, the developer typed 2,559 messages and the coding agents wrote 10,822,518 output tokens: 4,229 tokens of machine for one message of the person. The busiest day is 13 October, with 95 chat sessions and 638 messages. The quietest is 9 October, with 26 chat sessions and 167 messages.

**What it says.** The sentence "this week the coding agents wrote 10 million tokens and asked me 2,559 times" is the first sentence of a weekly report, and the ratio of tokens per message says how autonomous the coding agents were.

**Limits.** A message of the developer is counted whatever its length. A message of one word ("yes") and a message of a whole specification count one each.

## 4. The anatomy of the time of an issue

**Definition.** For one issue: the time from its creation to its first chat session (the wait), from its first chat session to its closing (the work), and from its creation to its closing (the life).

```sql
SELECT count(*) AS issues,
       round(avg(wait), 2) AS created_to_first_chat_days,
       round(avg(work), 2) AS first_chat_to_closed_days,
       round(avg(life), 2) AS created_to_closed_days
FROM (
  SELECT l.issueNumber,
         julianday(min(json_extract(cs.data, '$.firstRecordAt'))) - julianday(json_extract(i.data, '$.createdAt')) AS wait,
         julianday(json_extract(i.data, '$.closedAt')) - julianday(min(json_extract(cs.data, '$.firstRecordAt'))) AS work,
         julianday(json_extract(i.data, '$.closedAt')) - julianday(json_extract(i.data, '$.createdAt')) AS life
  FROM chat_session_issues AS l
  JOIN chat_sessions AS cs ON cs.repository = l.repository AND cs.id = l.chatSessionId
  JOIN issues AS i ON i.repository = l.repository AND i.number = l.issueNumber
  WHERE l.repository = 'heidrun-org/heidrun' AND json_extract(i.data, '$.closedAt') IS NOT NULL
  GROUP BY l.issueNumber
);
```

**Result.** Over the 222 closed issues that have a chat session: 0.04 days (one hour) from the creation to the first chat session, 0.28 days (seven hours) from the first chat session to the closing, 0.32 days in all. Over all the 276 closed issues, 0.26 days from the creation to the closing.

**What it says.** On this repository, an issue is started within the hour and closed within the day. Nothing waits. On a team, the same query shows where the time waits: before the first chat session, or between the last commit and the merge.

**Limits.** An issue whose chat session is older than the range of the chat sessions gets a negative wait or a wrong first chat session. The merge of the pull request is not in the query yet: the field `mergedAt` of the pull request that says `Fixes #N` gives it.

## 5. The work outside the tracker

**Definition.** The chat sessions that name no issue and no pull request, the issues that no chat session names, and the commits whose first line has no issue number.

```sql
SELECT (SELECT count(*) FROM chat_sessions AS cs
        WHERE cs.repository = 'heidrun-org/heidrun'
          AND NOT EXISTS (SELECT 1 FROM chat_session_issues AS l WHERE l.repository = cs.repository AND l.chatSessionId = cs.id)
          AND NOT EXISTS (SELECT 1 FROM chat_session_pull_requests AS l WHERE l.repository = cs.repository AND l.chatSessionId = cs.id)) AS chats_without_issue_or_pr,
       (SELECT count(*) FROM issues AS i
        WHERE i.repository = 'heidrun-org/heidrun'
          AND NOT EXISTS (SELECT 1 FROM chat_session_issues AS l WHERE l.repository = i.repository AND l.issueNumber = i.number)) AS issues_without_chat,
       (SELECT count(*) FROM commits
        WHERE repository = 'heidrun-org/heidrun' AND json_array_length(data, '$.parents') < 2
          AND NOT (json_extract(data, '$.subject') GLOB '*#[0-9]*')) AS commits_without_issue;
```

**Result.** 68 of 306 chat sessions (22%) name no issue and no pull request. 70 of 313 issues (22%) have no chat session. 121 of 618 commits that are not merges (20%) have no issue number in their first line.

**What it says.** One fifth of the work happens outside the tracker, in each of the three inputs. The 68 chat sessions cost 195,334 output tokens together, 1.8% of the total, so the untracked work is cheap: it is talk, documentation, and small fixes. The 121 commits are the ones that the Issue Fix Workflow did not cover.

**Limits.** An issue fixed by hand, with no coding agent, has no chat session and is not untracked work. The chat sessions cover six days, so an issue older than that may have had a chat session that the data layer never saw.

## 6. A fair comparison of the coding agents

**Definition.** For each coding agent: the chat sessions, the messages of the developer, the issues touched, and the output tokens, on the same repository and the same kind of work.

```sql
SELECT json_extract(cs.data, '$.codingAgent') AS coding_agent,
       count(DISTINCT cs.id) AS chats,
       sum(json_extract(cs.data, '$.userMessageCount')) AS developer_messages,
       (SELECT count(DISTINCT l.issueNumber) FROM chat_session_issues AS l
        JOIN chat_sessions AS c2 ON c2.repository = l.repository AND c2.id = l.chatSessionId
        WHERE l.repository = cs.repository AND json_extract(c2.data, '$.codingAgent') = json_extract(cs.data, '$.codingAgent')) AS issues,
       (SELECT sum(json_extract(t.value, '$.output')) FROM chat_sessions AS c3, json_each(c3.data, '$.tokens') AS t
        WHERE c3.repository = cs.repository AND json_extract(c3.data, '$.codingAgent') = json_extract(cs.data, '$.codingAgent')) AS output_tokens
FROM chat_sessions AS cs
WHERE cs.repository = 'heidrun-org/heidrun'
GROUP BY coding_agent;
```

**Result.** Claude Code: 266 chat sessions, 1,852 messages of the developer, 248 issues, 10,115,685 output tokens. Codex: 40 chat sessions, 436 messages, 41 issues, 706,833 output tokens. Per chat session: 7.0 messages and 38,029 output tokens for Claude Code, 10.9 messages and 17,671 output tokens for Codex.

**What it says.** On this repository, a chat session of Codex needs more messages of the developer and writes fewer tokens than a chat session of Claude Code. Whether that is the coding agent or the kind of work given to each one is the next question, and the join with the issues (their labels, their files) answers it.

**Limits.** This is not a benchmark. The two coding agents did not get the same issues. The tokens are not comparable in dollars without a price per model and per kind of token (see [inputs_links.md](inputs_links.md)).

## 7. Hot files

**Definition.** The files that the most chat sessions read or wrote. A file that comes back month after month is a file that is never finished.

```sql
SELECT path, count(DISTINCT chatSessionId) AS chats
FROM chat_session_files
WHERE repository = 'heidrun-org/heidrun'
GROUP BY path
ORDER BY chats DESC;
```

**Result.** The most linked file is the memory file of Claude Code, `MEMORY.md`, with 13 chat sessions. Then `AGENTS.md` with 7, `docs/agents_rules/user_interface.md` with 5, and `SplashScreen.test.ts` and `docs/architecture/README.md` with 3 each. 72 of the 141 chat sessions that name a file name at least one file outside the repository.

**What it says.** The two hottest files are the two files of instructions for the coding agents, which says that the rules of the project change more often than any file of code. The hot files of code come after.

**Limits.** The paths are absolute and include files outside the repository (the memory of Claude Code, the scratchpad folder). The metric needs the change of `data_layer_coding_agents` described in [inputs_links.md](inputs_links.md). The commits store no file path, so the join with the lines added and deleted of each file is not possible yet.

## 8. The fix that needed a fix

**Definition.** An issue that two or more pull requests say they fix (`Fixes #N` in the body), or a new issue that names the files of a pull request merged a few days before. A quality signal from the history alone, without any test.

```sql
SELECT issue, count(*) AS pull_requests, group_concat(number) AS pull_request_numbers
FROM (
  SELECT number,
         cast(substr(json_extract(data, '$.body'), instr(lower(json_extract(data, '$.body')), 'fixes #') + 7) AS INTEGER) AS issue
  FROM pull_requests
  WHERE repository = 'heidrun-org/heidrun' AND instr(lower(json_extract(data, '$.body')), 'fixes #') > 0
)
WHERE issue > 0
GROUP BY issue
HAVING count(*) > 1
ORDER BY pull_requests DESC;
```

**Result.** Zero. 163 of the 248 pull requests say `Fixes #N`, and no two of them name the same issue.

**What it says.** On this repository, a fix holds, or the second fix gets a new issue. The second form of the metric, a new issue on the files of a recent pull request, is the one to build next, and it needs the paths of the files relative to the repository.

**Limits.** The query reads the first `Fixes #N` of the body only. A pull request that fixes two issues is counted for the first one.

## 9. The cost of a feature, not of an issue

**Definition.** Issues linked by a shared chat session form a cluster. A cluster is a feature, and its cost is the sum of the costs of its issues.

```sql
SELECT a.issueNumber AS issue_a, b.issueNumber AS issue_b, count(*) AS shared_chats
FROM chat_session_issues AS a
JOIN chat_session_issues AS b
  ON a.repository = b.repository AND a.chatSessionId = b.chatSessionId AND a.issueNumber < b.issueNumber
WHERE a.repository = 'heidrun-org/heidrun'
GROUP BY issue_a, issue_b
ORDER BY shared_chats DESC;
```

**Result.** 224 of the 249 issues that have a chat session share at least one chat session with another issue. The strongest pairs are issues 260 and 266 (7 shared chat sessions, the dynamic topics), issues 34 and 131 (5), and the six issues 195 to 200 (5 shared chat sessions each, the panel layout redesign).

**What it says.** The issues 195 to 200 are one feature, and their cost is one sum. The package `multi_layer_graph` in `packages/experiments` already draws this graph.

**Limits.** A chat session that discussed two unrelated issues links them too. A cluster needs a threshold on the shared chat sessions, or the shared files as a second vote.

## 10. Waste

**Definition.** A chat session with many output tokens and no issue, no pull request, and no commit is a run that produced nothing that the tracker knows.

```sql
SELECT cs.id,
       json_extract(cs.data, '$.codingAgent') AS coding_agent,
       sum(json_extract(t.value, '$.output')) AS output_tokens,
       json_extract(cs.data, '$.userMessageCount') AS developer_messages,
       json_extract(cs.data, '$.title') AS title
FROM chat_sessions AS cs, json_each(cs.data, '$.tokens') AS t
WHERE cs.repository = 'heidrun-org/heidrun'
  AND NOT EXISTS (SELECT 1 FROM chat_session_issues AS l WHERE l.repository = cs.repository AND l.chatSessionId = cs.id)
  AND NOT EXISTS (SELECT 1 FROM chat_session_pull_requests AS l WHERE l.repository = cs.repository AND l.chatSessionId = cs.id)
GROUP BY cs.id
ORDER BY output_tokens DESC;
```

**Result.** 65 chat sessions, 195,334 output tokens together, 1.8% of the total. The largest is "Empty tab screen design" with 41,125 output tokens and 5 messages of the developer, then "Process documentation update" (16,874 tokens, 16 messages) and "Developer AI relations documentation" (14,266 tokens).

**What it says.** The waste is small here, and the largest untracked chat sessions are design and documentation talks, which is work, only work without an issue. A list of them each month is the cheapest review of the process.

**Limits.** "No issue and no pull request" is not "nothing produced": a chat session that wrote a document has no issue and is not waste. The commits are not in the query, because nothing links a chat session to a commit yet.

## What to do next

- Fix the links first, as [inputs_links.md](inputs_links.md) says: relative paths in `chat_session_files`, the chat sessions of the worktrees, and a link from a chat session to a commit. Every metric above inherits their gaps.
- Add the price per model and per kind of token, so that metrics 1, 3, 6, and 10 can be written in dollars.
- Give the ten queries to a coding agent through the command `heidrun_data` of [issue 564](https://github.com/heidrun-org/heidrun/issues/564), so that the coding agent answers "why" on top of the numbers.
