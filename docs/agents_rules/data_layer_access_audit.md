# Audit of the bypasses of the data layer

- Created: 26 October 2026
- Last updated: 26 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [data_layer_access.md](data_layer_access.md)
- Related issue: [issue 617](https://github.com/heidrun-org/heidrun/issues/617), [issue 790](https://github.com/heidrun-org/heidrun_code/issues/790)

This file gives the bypasses of the rule of [data_layer_access.md](data_layer_access.md) that existed before the rule, and what each one does now. It was split from that file when the file reached the maximum size.

These bypasses existed before [issue 617](https://github.com/heidrun-org/heidrun/issues/617).

| Where | What it did | What it does now |
| --- | --- | --- |
| Desktop `chats.rs` | Read the chat session files itself with its own scan cache, at each call. | `chats_synchronize` calls `refresh_chat_sessions`, and `chats_list` calls `find_chat_list`. |
| Desktop `chats_files.rs` | Read `.git` files and started `git` for the status of files and worktrees. | The three commands call `find_file_existence`, `find_existing_folders`, and `find_worktree_branches`. |
| Desktop `person_work.rs` | Built the Git reader and the GitHub reader of the packages, and ran `SELECT` statements. | `person_work_synchronize` calls `refresh_*`, and `person_work_in_range` calls `find_commits`, `find_pull_requests_opened_between`, and `find_issues_opened_between`. |
| Desktop `ai_cost.rs`, `model_prices.rs` | Opened the token usage database, the price database, and the scan cache of the package. | `ai_cost_synchronize` calls `refresh_ai_cost`, `ai_cost_in_range` calls `find_ai_cost`, and the prices refresh is `refresh_public_model_prices_when_due`. |
| Desktop `user_activity.rs` | Opened the user activity database of the package to read the records. | `user_activity_synchronize` calls `refresh_user_activity`, and `user_activity_records_in_range` calls `find_user_activity_records`. |
| Web page `chat_references.ts` | Started `gh` for the details of each issue and pull request of a chat. | GitHub: `chat_references_synchronize` then `chat_references_find`. GitLab: see the exceptions. |
