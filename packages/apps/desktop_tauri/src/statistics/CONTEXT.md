# Directory Context: `/packages/apps/desktop_tauri/src/statistics`

## Purpose
The commands that the Statistics window calls: the records of the activity of the user, the work of one person from the Git history, and the AI cost. Every command gets its data from the packages of the data layer.

## Key Exports & Entry Points
- `user_activity_records.rs`: `user_activity_synchronize` and `user_activity_records_in_range`, with the package `data_layer_user_activity`.
- `person_work.rs`: `person_work_synchronize` and `person_work_in_range`, with the packages `data_layer_source_control` and `data_layer_code_hosting`. `person_work_synchronize` sends a `PersonWorkProgress` for each stage of the update through its Tauri channel `onProgress` ([rule](../../../../../docs/agents_rules/user_interface/window/statistics_update_stages.md)).
- `ai_cost.rs`: `ai_cost_synchronize` and `ai_cost_in_range`, with the package `data_layer_coding_agents`.

## Rules
- A file here never opens a chat session file or the file of the records, never runs `git`, `gh`, or `glab`, never makes a network request, and never runs SQL. The test of the package `data_layer_boundary_checker` fails when a file here does.
- A command that reads is separate from a command that synchronizes. A read command opens the SQLite file only, and gives an empty answer when nothing was synchronized yet.
- Every command that writes the SQLite file takes `heidrun_data::lock_database` first.
- Every call to a function of a data layer package runs inside `crate::application_log::data_layer_call`, so the application log holds its start, its end, and its duration ([issue #883](https://github.com/heidrun-org/heidrun_code/issues/883)).
- The file of the records of the activity of the user belongs to `../user_activity.rs`. It writes the file, and this folder never reads it.

## Background
- The rule, the audit of the bypasses, and the allowed exceptions are in [data_layer_access.md](../../../../../docs/agents_rules/data_layer_access.md).
- Issue: https://github.com/heidrun-org/heidrun/issues/617
