# The four data layers

- Created: 15 October 2026
- Last updated: 25 October 2026
- Status: Maintained description of the four data layers
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: chats](../agents_rules/glossary/chats.md), [Rule for GitHub and GitLab support](../agents_rules/github_and_gitlab_support.md), [Data layer access](../agents_rules/data_layer_access.md)
- Related issue: [issue 489](https://github.com/heidrun-org/heidrun/issues/489), [issue 452](https://github.com/heidrun-org/heidrun/issues/452), [issue 464](https://github.com/heidrun-org/heidrun/issues/464), [issue 564](https://github.com/heidrun-org/heidrun/issues/564), [issue 569](https://github.com/heidrun-org/heidrun/issues/569), [issue 616](https://github.com/heidrun-org/heidrun/issues/616), [issue 617](https://github.com/heidrun-org/heidrun/issues/617), [issue 618](https://github.com/heidrun-org/heidrun/issues/618)

This file says what we mean by a data layer, and describes the four data layers of Heidrun Code. The two files [user_activity_statistics.md](user_activity_statistics.md) and [work_of_one_person_statistics.md](work_of_one_person_statistics.md) describe the statistics that read them.

## What we mean by a data layer

A data layer is one package in the folder `submodules/heidrun_data/packages`. It reads the facts of one source of information, and writes them in tables of one SQLite file. Heidrun Code has four data layers, one for each source. [Issue 452](https://github.com/heidrun-org/heidrun/issues/452) uses the words "the data layer" for the four together: one SQLite file with the facts of four sources. In this folder, "a data layer" is one package, and "the SQLite file" is the file that the four packages share.

The statistics read the facts from the SQLite file. They do not ask GitHub, Git, or the files of the coding agents each time. The SQLite file also keeps facts that the source loses: the web frontend removes the lines of the file `user_activity.jsonl` that are older than 400 days, and a commit that no branch reaches any more stays in the table.

## The four data layers

| Data layer | Source | What it reads | Tables |
| --- | --- | --- | --- |
| [`data_layer_source_control`](../../submodules/heidrun_data/packages/data_layer_source_control/README.md) | Source control (Git) | Every commit of a Git repository, merges included, with the command `git log`. | `commits` |
| [`data_layer_code_hosting`](../../submodules/heidrun_data/packages/data_layer_code_hosting/README.md) | Code hosting (GitHub) | Every issue and every pull request of a GitHub repository, with the command `gh api graphql`. | `issues`, `pull_requests` |
| [`data_layer_coding_agents`](../../submodules/heidrun_data/packages/data_layer_coding_agents/README.md) | Coding agents | The chat session files that Claude Code and Codex save on this computer for the repository, and the coding agent configuration: the memory files, the subagents, and the skills ([issue 569](https://github.com/heidrun-org/heidrun/issues/569)). | `chat_sessions`, `chat_session_folders`, `chat_session_issues`, `chat_session_pull_requests`, `chat_session_files`, `memory_files`, `subagents`, `skills`, and for the tokens `token_usage_minutes`, `token_usage_synchronizations`, `model_price_versions`, `model_prices`, with the views `latest_model_prices` and `token_usage_with_cost` ([token_usage_and_cost.md](token_usage_and_cost.md)) |
| [`data_layer_user_activity`](../../submodules/heidrun_data/packages/data_layer_user_activity/README.md) | User activity | The file `~/.config/heidrun_code/user_activity.jsonl`, which the web frontend writes. | `user_activity_records` |

The mode `update` of each data layer reads only what is new:

| Data layer | Primary key | What `update` reads |
| --- | --- | --- |
| `data_layer_source_control` | `repository`, `hash` | The commits whose hash is not in the table. |
| `data_layer_code_hosting` | `repository`, `number` | The items that changed after the largest `updatedAt` of the table. |
| `data_layer_coding_agents` | `repository`, `id` | The chat session files that changed at the largest `updatedAt` or later. Every memory file, subagent, and skill, each time. The token usage of the chat sessions that changed since the last read of the workspace; the rows of a chat session are replaced in one transaction. |
| `data_layer_user_activity` | `workspaceFolder`, `startedAt` | The records whose `endedAt` is later than the largest `endedAt` of the table. |

## The SQLite file

- The default path is `~/.config/heidrun_code/data_layer.sqlite`. The option `--database` of each command line tool replaces it.
- Each data layer creates and writes only its own tables.
- The tables join each other in one way only. The columns `repository` and `issueNumber` of `chat_session_issues` join the columns `repository` and `number` of `issues`. The table `chat_session_pull_requests` joins `pull_requests` the same way. The column `id` of `memory_files`, `subagents`, and `skills` is an absolute path, and joins the column `path` of `chat_session_files`: the chat sessions that wrote the file. The text `Fixes #N` in the field `body` of a pull request is the only link from a pull request to its issue, because the field `closingIssuesReferences` of GitHub is empty here.
- A user activity record holds the folder of a workspace and not the name of a repository, so `user_activity_records` joins no other table.
- The data layers set no waiting time on the file, so two writes at the same time fail with the error "database is locked". The desktop application and the command `heidrun_data update` take one lock before each write of the file: `lock_database` in `submodules/heidrun_data/packages/heidrun_data/src/database_lock.rs`. The lock holds for the threads of one program, and for the programs of the computer through the lock file `data_layer.sqlite.lock` next to the SQLite file ([issue 564](https://github.com/heidrun-org/heidrun/issues/564)).

## The rules that the four data layers share

- A data layer stores facts only, with fixed rules, and never uses a language model.
- Each table has a few key columns and one column `data`. The column `data` holds one JSON text. The JSON text follows a JSON schema in the folder `schemas` of the package, and that file is the only place that says which fields the package stores. The package checks each row against its schema before it writes the row, and a wrong row writes nothing.
- Each data layer has the modes `initialize` and `update`, and the read-only command `query`. A mode can run again and again, and never writes a row two times. The command `query` opens the file read only, so it never changes the file and never creates it.
- Each data layer is a Rust library and a command line tool. The script `pnpm --silent data_layer:<name>` at the root of the repository runs the command line tool, and the script `pnpm --filter <package> test` runs the tests. The calls of the library are blocking.
- No data layer imports another data layer. They share the SQLite file only.
- Each data layer offers the desktop application two kinds of function: `refresh_*` reads the source and writes the SQLite file, and `find_*` reads the SQLite file only and gives typed rows. The Past chats sidebar section and the Statistics window call only these functions, as [data_layer_access.md](../agents_rules/data_layer_access.md) says.
- The package [`heidrun_data`](../../submodules/heidrun_data/packages/heidrun_data/README.md) is not a data layer. It is one command line for a coding agent that calls the four libraries: `update` and `initialize` of every source or of the sources given, `query` with a default `LIMIT`, `sources`, `schema`, `usage`, `requests` (the request log), and `read` (the content of a chat session, a commit, an issue, or a pull request, which the tables do not store), with the output formats `jsonl`, `json`, and `table`. Its [SKILL.md](../../submodules/heidrun_data/packages/heidrun_data/SKILL.md) teaches a coding agent to use it. The script `pnpm --silent data_layer:heidrun_data` runs it. It is the only package that imports more than one data layer ([issue 564](https://github.com/heidrun-org/heidrun/issues/564)).
- Every data layer imports the library `data_layer_operation_log`, and nothing else from the repository. Every public function of the four packages and of `heidrun_data` is recorded in the operation log, with the library [`data_layer_operation_log`](../../submodules/heidrun_data/packages/data_layer_operation_log/README.md). It is the one package that the data layer packages import, and it records who asked, what, with which parameters, how long it took, and how it ended. The log, the command `heidrun_data operations`, and the replay are described in [data_layer_operation_log.md](data_layer_operation_log.md) ([issue 618](https://github.com/heidrun-org/heidrun/issues/618)).
- Every data layer has the same folders: `src/model`, `src/storage`, the folder that reads the source, `src/synchronization.rs`, `schemas`, and `tests`.

## How Heidrun Code uses the four data layers

| Use in Heidrun Code | Data layers | Reads the SQLite file |
| --- | --- | --- |
| Statistics window, tab "User activity" | `data_layer_user_activity` | Yes. See [user_activity_statistics.md](user_activity_statistics.md). |
| Statistics window, tab "Work of one person", source "Git history" | `data_layer_source_control`, `data_layer_code_hosting` | Yes. See [work_of_one_person_statistics.md](work_of_one_person_statistics.md). |
| Statistics window, tab "Work of one person", source "AI cost" | `data_layer_coding_agents` | Yes. It reads the stored token usage and updates it with the library and the scan cache `~/.config/heidrun_code/chats_cache.json`. See [token_usage_and_cost.md](token_usage_and_cost.md). |
| Past chats sidebar section | `data_layer_coding_agents`, `data_layer_source_control`, `data_layer_code_hosting` | Yes. The list reads the stored chats, the references line reads the stored issues and pull requests of GitHub, and the files line and the worktrees line ask typed functions of `data_layer_source_control`. |

The Past chats sidebar section and the Statistics window get all their data from these packages. The desktop application and the web page never read a chat session file, never start `git`, `gh`, or `glab`, never make a network request, and never run SQL for this data. The rule, the table of the commands, the exceptions, and the check are in [data_layer_access.md](../agents_rules/data_layer_access.md). The time that it costs is in [data_layer_access_timing.md](data_layer_access_timing.md).

The program refreshes a data layer when a part needs it: each part calls its synchronize command first, then its read command. The Past chats sidebar section also synchronizes after a delay while it is on the screen. No other timer refreshes the SQLite file.

## Open points

- GitHub only: `data_layer_code_hosting` reads GitHub. The rule of GitHub and GitLab support requires the same support for GitLab, and it is not written yet ([comment of issue 455](https://github.com/heidrun-org/heidrun/issues/455)).
- The package `data_layer_chat_sessions` became `data_layer_coding_agents`, and the source `chat_sessions` of `heidrun_data` became `coding_agents`, when the package began to read the coding agent configuration too ([issue 569](https://github.com/heidrun-org/heidrun/issues/569)). [Issue 452](https://github.com/heidrun-org/heidrun/issues/452) calls this source "Chat sessions".
- Two meanings of the word "source": a data layer reads a source of information, and the tab "Work of one person" has a source, "Git history" or "AI cost". These are two different things.
- The master issue [issue 464](https://github.com/heidrun-org/heidrun/issues/464) says that no issue exists yet for the source "User activity". [Issue 474](https://github.com/heidrun-org/heidrun/issues/474) is merged.
- `data_layer_coding_agents` stores no relation to people, because no signal in a chat session tells that it mentions a person. The tables of the chat sessions hold the chat sessions of the root of the repository only. The tokens hold the chat sessions of the root and of the folders below it, such as a worktree.
- The space of the statistics, with the cost in time or in money and the human or the AI, is in [issue 451](https://github.com/heidrun-org/heidrun/issues/451). The definition of a segment is not decided yet.
