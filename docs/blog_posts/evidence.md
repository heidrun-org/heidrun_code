# Evidence for the Heidrun blog series

- Created: 17 October 2026
- Last updated: 25 October 2026
- Status: Verified source notes for draft blog articles
- Related framing: [Series plan](blog_series_plan.md)
- Related rules: [Project glossary](../agents_rules/glossary/index.md), [Data layer access](../agents_rules/data_layer_access.md)
- Related issue: [issue #642](https://github.com/heidrun-org/heidrun/issues/642)

## Scope and Freshness

Checked on 17 October 2026 through the heidrun_data command from the temporary worktree. Queries read the imported database without synchronizing it during this investigation. The newest stored timestamps were:

| Source | Newest stored timestamp, UTC |
| --- | --- |
| Git history | 2026-10-17T09:52:43Z |
| Code hosting | 2026-10-17T09:52:53Z |
| Coding agents | 2026-10-17T09:58:20.283Z |
| User activity | 2026-10-17T09:48:30.719Z |

These are the newest facts in each source, not a guarantee of complete collection. The token synchronization row for the Heidrun workspace was synchronized at 2026-10-17T09:58:20.283Z. The weekly window ends before those timestamps. Later imports or source corrections can change results.

Before querying, the table schema and the document schemas for commits, issues, pull requests, chat sessions, and user activity were inspected. All repository-bearing tables are scoped to `heidrun-org/heidrun`. The user activity table has workspace folders rather than a repository column.

## Verified Historical Investigation

The second article reconstructs the minute token-usage decision. The source chain is:

1. Original local conversation `01a14733-1314-70d3-91a3-6f28c85c5ebe`, titled “Review Heidrun data history.” At 2026-10-17T00:54:25.766Z (02:54 Paris), the developer asked why token usage could not be stored for each minute, with an index, and queried by both Heidrun and heidrun_data without rereading conversations. At 00:56 UTC the developer asked to create the issue. At 01:03–01:04 UTC the developer confirmed shared pricing near the data and requested an issue update.
2. [Issue #616](https://github.com/heidrun-org/heidrun/issues/616) records minute usage, indexed retrieval, shared pricing, import behavior, and performance requirements. The live issue body and discussion were read with heidrun_data.
3. Local implementation conversation `f26732ee-ed61-4483-8725-09d4b9146400` is linked to the issue. Its stored written-file references include token usage, pricing, statistics, and calendar-slot files. The link identifies a candidate conversation and does not independently prove authorship of every change.
4. [Pull request #624](https://github.com/heidrun-org/heidrun/pull/624) was read live through heidrun_data. The pull request records minute storage, versioned model prices, the shared cost view, and explicit import.
5. The [merge commit](https://github.com/heidrun-org/heidrun/commit/c3753808826dddfa552fb517fe73e5b21dd00b6b), read locally with heidrun_data, changes the minute-usage schema, token database, price database, usage grouping, command line, statistics interface, and documentation.

The article describes a reconstruction performed during preparation. The article does not claim an autonomous single-prompt retrieval benchmark or complete recovery of all history. No full private conversation transcript is included in these documents.

Read the original conversation from the repository root, replacing the folder with the actual checkout folder:

```bash
pnpm --silent data_layer:heidrun_data read chat_session 01a14733-1314-70d3-91a3-6f28c85c5ebe --folder /Users/jetienne/webwork/heidrun --format jsonl
```

The query for related conversations is:

```sql
SELECT c.id, json_extract(c.data, '$.title') AS title, l.issueNumber
FROM chat_sessions AS c
JOIN chat_session_issues AS l
  ON l.repository = c.repository AND l.chatSessionId = c.id
WHERE c.repository = 'heidrun-org/heidrun' AND l.issueNumber = 616
ORDER BY c.id;
```

The stored results include the original conversation and the implementation conversation above. Two other conversations also mention the issue; their presence illustrates why the original text needs to be read before concluding which conversation contains the decision.

## Measured Week

Period: 10–16 October 2026 inclusive in Europe/Paris, starting 9 October at 22:00 UTC and ending 16 October at 22:00 UTC. Paris stays at UTC+2 throughout this particular period. The fixed offset below is appropriate only for this period; use the usage command's time-zone grouping for periods crossing a clock change.

Identity: commits authored by `Jerome Etienne`, as stored after the repository author mapping, and issues or pull requests authored by `jeromeetienne`. The writer explicitly identifies both as the developer. Another GitHub account opened ten issues during the period; those issues are excluded from the developer's count.

| Measurement | Result |
| --- | ---: |
| Commits authored, excluding merges | 519 |
| Pull requests opened by the developer | 235 |
| Pull requests merged by the developer during the window | 235 |
| Issues opened by the developer | 288 |
| All four token categories combined | 3,835,847,761 |
| Cached input tokens | 3,749,366,426 |
| Known estimated cost, unrounded | 778.2977 US dollars |
| Rows with unknown cost | 0 |
| Usage rows outside the Heidrun folder and its descendants | 0 |

The opened and merged pull request populations are queried independently. Their equal totals are not used to assume they are the same population. Commits and pull requests are overlapping records and are not added as distinct delivered features. The interview estimates are not used as measurements.

Run each query from the Heidrun checkout with `pnpm --silent data_layer:heidrun_data query --format jsonl`, passing the SQL as its argument or through standard input with `-`.

### Commit Counts

```sql
SELECT substr(datetime(committedAt, '+2 hours'), 1, 10) AS day,
       json_extract(data, '$.authorName') AS author, count(*) AS commits
FROM commits
WHERE repository = 'heidrun-org/heidrun'
  AND committedAt >= '2026-10-09T22:00:00Z'
  AND committedAt < '2026-10-16T22:00:00Z'
  AND json_array_length(json_extract(data, '$.parents')) < 2
GROUP BY day, author ORDER BY day;
```

The returned author was `Jerome Etienne` for every day, with counts 78, 106, 34, 119, 38, 59, and 85 in day order.

### Opened Issues and Pull Requests

```sql
SELECT json_extract(data, '$.author') AS author, count(*) AS opened
FROM issues
WHERE repository = 'heidrun-org/heidrun'
  AND json_extract(data, '$.createdAt') >= '2026-10-09T22:00:00Z'
  AND json_extract(data, '$.createdAt') < '2026-10-16T22:00:00Z'
GROUP BY author;
```

```json
{"author":"edefiez","opened":10}
{"author":"jeromeetienne","opened":288}
```

Use the same query with `pull_requests` as the table for opened pull requests:

```json
{"author":"jeromeetienne","opened":235}
```

For daily results, group by `substr(datetime(json_extract(data, '$.createdAt'), '+2 hours'), 1, 10)` and filter the author to `jeromeetienne`. Daily issue counts are 45, 48, 26, 54, 35, 40, and 40. Daily opened pull request counts are 40, 43, 14, 40, 30, 39, and 29.

### Merged Pull Requests

```sql
SELECT json_extract(data, '$.mergedBy') AS mergedBy, count(*) AS merged
FROM pull_requests
WHERE repository = 'heidrun-org/heidrun'
  AND json_extract(data, '$.mergedAt') >= '2026-10-09T22:00:00Z'
  AND json_extract(data, '$.mergedAt') < '2026-10-16T22:00:00Z'
GROUP BY mergedBy;
```

```json
{"mergedBy":"jeromeetienne","merged":235}
```

### Tokens and Estimated Cost

```sql
SELECT codingAgent,
       sum(freshInputTokens) AS freshInput,
       sum(cachedInputTokens) AS cachedInput,
       sum(cacheWriteInputTokens) AS cacheWriteInput,
       sum(outputTokens) AS output,
       round(sum(costUsd), 4) AS knownCostUsd,
       count(*) - count(costUsd) AS unpricedRows
FROM token_usage_with_cost
WHERE repository = 'heidrun-org/heidrun'
  AND minuteAt >= '2026-10-09T22:00:00.000Z'
  AND minuteAt < '2026-10-16T22:00:00.000Z'
GROUP BY codingAgent;
```

```json
{"codingAgent":"CLAUDE_CODE","freshInput":241163,"cachedInput":3227067546,"cacheWriteInput":55559259,"output":16402949,"knownCostUsd":708.9957,"unpricedRows":0}
{"codingAgent":"CODEX","freshInput":12814814,"cachedInput":522298880,"cacheWriteInput":0,"output":1463150,"knownCostUsd":69.302,"unpricedRows":0}
```

The daily query uses the same filters, selects `substr(datetime(minuteAt, '+2 hours'), 1, 10) AS day`, and groups by day and coding agent. The exact known daily totals before rounding are 52.2705, 122.0366, 43.2983, 115.1778, 117.8673, 153.6867, and 173.9603 US dollars. Every daily coding-agent group returned zero unpriced rows.

Price version 1 was retrieved at 2026-10-17T02:10:08.894Z from the LiteLLM public price list, with the unit US dollars for one million tokens. The source list contains 169 model prices. The latest imported prices apply to all usage dates. These are token-price estimates, not invoices, subscription payments, or a measure of code quality. Unknown model prices must remain visible in later reruns.

The measurements describe one developer's collected history on one computer. Missing chat files, incomplete imports, and excluded approval-review chats limit the scope. Minute timestamps record when usage was reported; the timestamps do not continuously measure token generation.

## Recorded Active Time on 16 October

The query selected active periods overlapping the day for the Heidrun folder and its descendants, using `julianday` comparisons because the stored timestamps can contain offsets. The query returned 371 periods. Each period was clipped to 15 October 22:00 UTC through 16 October 22:00 UTC, the clipped intervals were sorted, and overlapping intervals were combined before summing. The result was 4926.372 seconds, or 82.11 minutes rounded to two decimals.

```sql
SELECT workspaceFolder, startedAt, endedAt
FROM user_activity_records
WHERE (workspaceFolder = '/Users/jetienne/webwork/heidrun'
       OR workspaceFolder LIKE '/Users/jetienne/webwork/heidrun/%')
  AND julianday(endedAt) > julianday('2026-10-15T22:00:00Z')
  AND julianday(startedAt) < julianday('2026-10-16T22:00:00Z')
ORDER BY startedAt;
```

The [user activity rules](../agents_rules/user_interface/sidebars/user_activity.md) define focus and the five-second cool down. These records measure interaction with Heidrun and do not establish total working time or complete recording coverage.

## Counting Definitions Can Change

[Issue #557](https://github.com/heidrun-org/heidrun/issues/557) and [pull request #577](https://github.com/heidrun-org/heidrun/pull/577) explain the exclusion of Codex approval-review chats. The stored issue body explains that the developer typed none of the review requests shown as user messages. The stored pull request records exclusion from Past chats, the database, and AI cost. Its merged timestamp is 2026-10-16T09:15:34Z. The local implementation conversation `ebe4dfe0-ecb8-461f-b3b3-41b1b8f7af2d` confirms the implementation and completion discussion. The [merge commit](https://github.com/heidrun-org/heidrun/commit/ffaacd8a2879399f3ffc38d4e070955002424cd6) was read locally.

This example illustrates a counting-policy decision; it does not establish the cause of the day's total token usage.

## Capabilities and Availability

The articles were checked against the temporary worktree based on `dev_jerome` on 17 October 2026. Sources include [the project README](../../README.md), [pane behavior](../agents_rules/user_interface/workspaces_tabs_and_panes/panes.md), [Past chats](../agents_rules/user_interface/sidebars/chats/chats_list.md), [token usage and cost](../statistics/token_usage_and_cost.md), and [the heidrun_data skill](../../submodules/heidrun_data/packages/heidrun_data/skills/heidrun-data/SKILL.md).

The latest public release checked through GitHub was [v0.2.7](https://github.com/heidrun-org/heidrun/releases/tag/v0.2.7), published on 15 October 2026. The minute-storage merge is not an ancestor of that release. The articles explicitly distinguish the development branch used in the investigation from the public release. Installation currently targets Apple silicon Macs and requires Herdr. Antigravity has no reader for its chat files in the token data layer, so the articles describe the history of Claude Code and Codex.

The first article's three-feature session is explicitly representative. No live product interaction or screenshot is claimed. The illustrations are generated artwork, with captions explaining that they are not screenshots or measured charts.
