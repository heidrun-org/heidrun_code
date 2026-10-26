# Rule: the Past chats sidebar section and the Statistics window get all their data through the data layer

- Created: 17 October 2026
- Last updated: 26 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Chats list](user_interface/sidebars/chats/chats_list.md), [Statistics window](user_interface/window/statistics_window.md), [Glossary of Heidrun Code](glossary/index.md)
- Related issue: [issue 617](https://github.com/heidrun-org/heidrun/issues/617), [issue 790](https://github.com/heidrun-org/heidrun_code/issues/790)

This file gives the rule for every agent that changes the Past chats sidebar section, the Statistics window, or a package of the folder `submodules/heidrun_data/packages`. The description of the four packages is in [the_four_data_layers.md](../statistics/the_four_data_layers.md).

## The rule

- The Past chats sidebar section and the Statistics window get all their data from the packages `data_layer_coding_agents`, `data_layer_source_control`, `data_layer_code_hosting`, and `data_layer_user_activity`.
- "Data" is everything that these two parts show about the world outside Heidrun Code: the list of chats, the information cards, the summaries, the counts, the details of an issue or of a pull request, the status of a referenced file or of a worktree, the totals of tokens and of dollars, and the data of the dynamic topics.
- The images of a chat at the bottom of the Clipboard sidebar section follow the same rule ([issue 790](https://github.com/heidrun-org/heidrun_code/issues/790)).
- The desktop application (`packages/apps/desktop_tauri`) and the web page never read a chat session file, never start `git`, `gh`, or `glab`, never make a network request, and never run SQL for this data. Only a package of the data layer does these things.
- An action is not data. To resume a chat, to open a worktree in VS Code, and to open a file are actions. They stay in the desktop application, and they show no data.

## Two kinds of command

- A synchronize command copies new data into the SQLite file. It takes `heidrun_data::lock_database` first. It calls only functions `refresh_*` of a package.
- A read command reads the SQLite file only. It calls only functions `find_*` of a package. It starts no program, reads no source, and makes no request, so it works when the source is gone. Before the first synchronization it answers with empty data, and it creates no file.
- The web page calls the synchronize command, then the read command. It reads the stored data first when it has none to show. A change of the sort order, a click on "Show more", and a change of the slot length call the read command only.

| Part | Synchronize command | Read command | Package |
| --- | --- | --- | --- |
| Past chats: the list | `chats_synchronize` | `chats_list` | `data_layer_coding_agents` |
| Past chats: issues and pull requests (GitHub) | `chat_references_synchronize` | `chat_references_find` | `data_layer_code_hosting` |
| Past chats: files and worktrees | none | `chats_files_exist`, `chats_worktrees_exist`, `chats_worktrees_branches` | `data_layer_source_control` |
| Statistics: User activity | `user_activity_synchronize` | `user_activity_records_in_range` | `data_layer_user_activity` |
| Statistics: Git history | `person_work_synchronize` | `person_work_in_range` | `data_layer_source_control`, `data_layer_code_hosting` |
| Statistics: AI cost | `ai_cost_synchronize` | `ai_cost_in_range` | `data_layer_coding_agents` |
| Clipboard: the images of a chat | none | `chat_images_find` | `data_layer_coding_agents` |

The commands are in the folders `past_chats`, `statistics`, and `chat_images` of `packages/apps/desktop_tauri/src`.

## The exceptions

Each exception has a reason, and is written in `boundary_rules.ts` of the package `data_layer_boundary_checker`. Add a new exception there, with its reason, and add it here.

- The three commands for files and worktrees ask a typed function of `data_layer_source_control` whether a file or a folder exists on the disk, and which branch a worktree holds. This status changes outside Heidrun Code, so it is not stored.
- GitLab: `data_layer_code_hosting` reads GitHub only ([issue 455](https://github.com/heidrun-org/heidrun/issues/455)). The details of an issue or of a merge request of GitLab stay live in `stores/forge_reference_details.ts`, read through `stores/chat_references.ts`. The Code hosting sidebar section is not part of this rule: it stays live.
- The translation table of the clustered dynamic topics is a file that Heidrun Code writes itself, and the language model call is an action. The data of the dynamic topics comes from the stored chats.
- The files `claude.rs` and `usage.rs` take the folder names `claude_dir` and `codex_home` from `data_layer_coding_agents`. A folder name is not data.
- `ChatsPanel.vue` asks `project_refs` (`refContext`) for the forge and the address of the repository. They come from the configuration of the project and from the remote `origin`, they choose GitHub or GitLab and build web links, and they are not data of a chat. A later issue can move them to `data_layer_source_control`.
- `project::find_root` walks up from a folder to the folder that holds `.git` or `.heidrun`. It names the root of a workspace and reads no data.
- `chat_images_find` calls `find_chat_images`, which reads the chat session file at each call. The images are not copied into the SQLite file: the package stores no message content, and a copy would double the disk space of the images.

## The check

The package `data_layer_boundary_checker` fails when the rule is broken. `pnpm test` at the root runs it, and so does `pnpm --filter data_layer_boundary_checker test`. It reads the text of the files, so it finds a bypass that is written in the code, also in a helper.

- In the folders `past_chats` and `statistics` of the desktop application, outside the tests: no program started, no SQLite library, no database type or collection type of a package, no file access, no network, and no text of an SQL statement.
- A file of these two folders may call only a function of a package that starts with `refresh_` or `find_`, or one of the few functions of `ALLOWED_PACKAGE_FUNCTIONS`. It may use a helper of the desktop application only when `ALLOWED_CRATE_PATHS` lists it, so a helper cannot hide a bypass.
- A file outside these folders may take only `claude_dir` and `codex_home` from a package, and may not define a command with the name of a command of the two parts.
- The file `Cargo.toml` of the desktop application has no SQLite library.
- In the web page files of the two parts: only the Tauri commands of `ALLOWED_FRONTEND_COMMANDS`, no `fetch`, no shell or file plugin, and no live reader of a forge outside the exception.
- The tests of the package add each kind of bypass to a copy of the files and prove that the check fails. A rule with no such proof fails a test.

The check cannot prove that a command which calls `find_*` reads only the SQLite file. The code review keeps this boundary: a read command calls no function `refresh_*` and no `find_repository`.

## The integration tests

These Rust tests in `packages/apps/desktop_tauri/src` run a command on a real SQLite file, synchronize, then delete the source, and read again. The test of the package `data_layer_boundary_checker` fails when one of them does not exist.

| File | Test |
| --- | --- |
| `past_chats/chats.rs` | `a_synchronization_then_a_list_gives_the_chats_even_when_the_chat_files_are_gone` |
| `past_chats/chats.rs` | `a_list_with_a_limit_tells_when_there_are_more_and_reads_the_next_page_without_a_synchronization` |
| `past_chats/chats.rs` | `a_list_before_the_first_synchronization_is_empty_and_creates_nothing` |
| `past_chats/chat_references.rs` | `reads_the_stored_issues_and_pull_requests_of_the_numbers_asked_and_nothing_else` |
| `statistics/ai_cost.rs` | `a_synchronization_then_a_read_gives_the_tokens_even_when_the_chat_files_are_gone` |
| `statistics/person_work.rs` | `a_synchronization_then_a_read_gives_the_work_even_when_git_and_github_are_unavailable` |
| `statistics/user_activity_records.rs` | `the_records_are_read_from_the_stored_rows_after_the_file_of_the_records_is_gone` |

## The audit of the bypasses

The bypasses that existed before [issue 617](https://github.com/heidrun-org/heidrun/issues/617), and what replaced each one, are in [data_layer_access_audit.md](data_layer_access_audit.md).

## Freshness

A read shows what the last synchronization stored. The web page synchronizes when the part opens, after a delay while the Past chats sidebar section is on the screen, and for the issues and pull requests at most once in ten minutes for each folder. The stored data shows first, and it still shows when a source fails. The time that the collection and the display queries cost is in [data_layer_access_timing.md](../statistics/data_layer_access_timing.md).
