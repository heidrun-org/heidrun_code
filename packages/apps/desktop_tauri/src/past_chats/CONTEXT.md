# Directory Context: `/packages/apps/desktop_tauri/src/past_chats`

## Purpose
The commands that the Past chats sidebar section calls: the list of chats, the state of the files and the worktrees that a chat names, and the issues and pull requests that a chat mentions. Every command gets its data from the packages of the data layer.

## Key Exports & Entry Points
- `chats.rs`: `chats_synchronize` copies the chat session files of the workspace into the SQLite file. `chats_list` reads the stored chats.
- `chats_files.rs`: `chats_files_exist`, `chats_worktrees_exist`, and `chats_worktrees_branches` call the package `data_layer_source_control`.
- `chat_references.rs`: `chat_references_synchronize` copies the issues and pull requests of the GitHub repository. `chat_references_find` reads the stored rows.
- The action that opens a worktree in VS Code is in `../worktree_actions.rs`, outside this folder, because it shows no data.

## Rules
- A file here never opens a chat session file, never runs `git`, `gh`, or `glab`, never makes a network request, and never runs SQL. Only the packages `data_layer_coding_agents`, `data_layer_source_control`, and `data_layer_code_hosting` do that. The test of the package `data_layer_boundary_checker` fails when a file here does.
- A command that reads is separate from a command that synchronizes. A read command opens the SQLite file only and gives an empty answer when nothing was synchronized yet.
- Every command that writes the SQLite file takes `heidrun_data::lock_database` first.
- A file here may call only the functions named `refresh_*` and `find_*` of the packages, and the helpers that the checker lists.

## Background
- The rule, the audit of the bypasses, and the allowed exceptions are in [data_layer_access.md](../../../../../docs/agents_rules/data_layer_access.md).
- Issue: https://github.com/heidrun-org/heidrun/issues/617
