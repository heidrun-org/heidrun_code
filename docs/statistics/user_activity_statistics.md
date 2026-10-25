# User activity statistics

- Created: 15 October 2026
- Last updated: 25 October 2026
- Status: Maintained description of the statistic of the tab "User activity"
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: user activity](../agents_rules/glossary/user_activity.md), [Statistics window](../agents_rules/user_interface/window/statistics_window.md), [User activity sidebar section](../agents_rules/user_interface/sidebars/user_activity.md)
- Related issue: [issue 489](https://github.com/heidrun-org/heidrun/issues/489), [issue 440](https://github.com/heidrun-org/heidrun/issues/440), [issue 473](https://github.com/heidrun-org/heidrun/issues/473), [issue 474](https://github.com/heidrun-org/heidrun/issues/474), [issue 498](https://github.com/heidrun-org/heidrun/issues/498), [issue 552](https://github.com/heidrun-org/heidrun/issues/552)

This file describes the statistic of the tab "User activity" of the Statistics window, and the data layer that it reads. The words are defined in the [glossary of the user activity](../agents_rules/glossary/user_activity.md). The rules of the window are in [statistics_window.md](../agents_rules/user_interface/window/statistics_window.md). The data layers are explained in [the_four_data_layers.md](the_four_data_layers.md).

## What the statistic shows

One histogram of the user activity time: the time that the developer is in front of Heidrun Code. The developer chooses the last day (24 slots of one hour), the last week (7 slots of one day), or the last month (30 slots of one day). Each bar is the user activity time of one slot. The bar is stacked: it has one part of one color for each chosen workspace, and its height is the time of all the chosen workspaces together. A legend gives the name of each color, and a card beside the bar under the pointer, with an arrow that points to the bar, gives the slot, the total, and the time of each workspace.

## The data layer that it reads

The statistic reads only `data_layer_user_activity`, in the table `user_activity_records`. One row is one user activity record: one active period of the developer in one workspace. The columns are `workspaceFolder`, `startedAt`, `endedAt`, and `data`. The column `data` holds these fields:

| Field | Content |
| --- | --- |
| `workspaceFolder` | The folder of the workspace. |
| `startedAt` | The time of the first action of the active period, in UTC. |
| `lastActionAt` | The time of the last action, in UTC. |
| `endedAt` | The end of the active period, in UTC. |
| `keyboardActionCount`, `mouseActionCount` | The number of keyboard actions and of mouse actions. Numbers only. |
| `endReason` | `cool_down`, `window_behind`, `workspace_changed`, or `app_closed`. |

The statistic uses only `startedAt` and `endedAt`. The user activity time of a slot is the total length of the parts of the active periods that are inside the slot.

## The way of the data

1. The web frontend ends an active period and calls the command `user_activity_append`. The command adds one line to the file `~/.config/heidrun_code/user_activity.jsonl`. The folder `HEIDRUN_CODE_DIR` replaces `~/.config/heidrun_code` when the variable is set.
2. The developer opens the Statistics window. The window calls the command `user_activity_records_in_range` once, for the last month. It does not call it again while the window stays open.
3. The command takes the lock of the file, so that it never reads half a line. It takes the lock of the SQLite file too.
4. The command runs the mode `update` of `data_layer_user_activity`. The mode copies the lines of the file that are new into the table.
5. The command runs one read-only query. It keeps the records that overlap the time range:

   ```sql
   SELECT data FROM user_activity_records WHERE endedAt > '<since>' AND startedAt < '<until>' ORDER BY startedAt
   ```

6. The window cuts the same records into the slots of the three time ranges. The pure class `UserActivitySlots` does the calculation. The window adds the active period that runs now, because no record exists for it yet.

## Why the data layer exists for this statistic

- The file `user_activity.jsonl` is the only place that the web frontend writes. The command `user_activity_read` removes the lines that are older than 400 days from the file.
- The SQLite file keeps every record for ever, because `data_layer_user_activity` never deletes a row. A record that the file loses stays in the table.
- A query on the table is fast, because the index on `endedAt` answers "which records overlap this time range".

## What the statistic does not know

- The active period that runs now has no record. The window counts it from its start up to the current time, and the data layer never sees it.
- A record is lost when the application quits through the menu while an active period runs. The data layer cannot see this case.
- A record holds the folder of a workspace and not the name of a repository. The statistic therefore counts the time of every workspace, whatever its repository.

## Two queries on the real database

The number of active periods and the number of hours on each day, the newest day first:

```sh
pnpm --silent data_layer:user_activity query "SELECT substr(startedAt, 1, 10) AS day,
       count(*) AS periods,
       round(sum((julianday(endedAt) - julianday(startedAt)) * 24), 2) AS hours
FROM user_activity_records
GROUP BY day
ORDER BY day DESC
LIMIT 10"
```

The number of hours in each folder of a workspace:

```sh
pnpm --silent data_layer:user_activity query "SELECT workspaceFolder,
       round(sum((julianday(endedAt) - julianday(startedAt)) * 24), 2) AS hours
FROM user_activity_records
GROUP BY workspaceFolder
ORDER BY hours DESC"
```

The [file `README.md` of the package](../../submodules/heidrun_data/packages/data_layer_user_activity/README.md) has two more queries and the options of the command line tool.

## Where the code is

| Part | Place |
| --- | --- |
| The data layer | `submodules/heidrun_data/packages/data_layer_user_activity` |
| The commands `user_activity_append` and `user_activity_read` | `packages/apps/desktop_tauri/src/user_activity.rs` |
| The commands `user_activity_synchronize` and `user_activity_records_in_range` | `packages/apps/desktop_tauri/src/statistics/user_activity_records.rs` |
| The lock of the SQLite file | `submodules/heidrun_data/packages/heidrun_data/src/database_lock.rs` |
| The window and the chart | `packages/apps/web_frontend/src/components/StatisticsModal.vue` and `UserActivityHistogram.vue` |
| The calculation of the slots | `packages/apps/web_frontend/src/lib/user_activity_slots.ts` |

The tests are listed in [statistics_window.md](../agents_rules/user_interface/window/statistics_window.md), in the section "Tests". The tests of the data layer are in its own package: `cargo test --package data_layer_user_activity`.

## Open points

- A later issue can find the repository of a record from the remote `origin` of its folder, when the folder still exists ([issue 474](https://github.com/heidrun-org/heidrun/issues/474)).
- A later issue can move the writing of the file into the data layer. Today only the web frontend writes it.
