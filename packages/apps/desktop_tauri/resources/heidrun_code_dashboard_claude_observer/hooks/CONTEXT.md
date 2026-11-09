# Directory Context: `/packages/apps/desktop_tauri/resources/heidrun_code_dashboard_claude_observer/hooks`

## Purpose
Observes the Claude Code runtime events and writes one bounded snapshot file for each session.

## Key Exports & Entry Points
- `register.js`: the `register` export required by Claude Code.

## Rules
- Pass events, permission decisions, and tool results through unchanged. A failed write changes nothing else.
- The folder of the snapshot files comes from `HEIDRUN_CODE_DASHBOARD_OBSERVATION_DIR`, else `~/.config/heidrun_code/heidrun_code_dashboard_claude_observations`. The folder has the permissions 700 and each file 600.
- Record `HERDR_PANE_ID` and `HERDR_SOCKET_PATH` of the Claude Code process: they are the only link between a session and a pane.
- After `/clear` or `/resume`, the session identifier changes: write a new file and mark the file of the former session as ended. Never write the new session into the old file.
- The mod compiler requires a direct function export and statically traceable top-level helpers; these required entry points are an exception to the static-class JavaScript organization of the repository.
- Type-check the module against the declarations of the installed Claude Code, as the README of `packages/experiments/heidrun_code_dashboard_live_information` says, and validate it before a change is merged.

## Background
- Issues: https://github.com/heidrun-org/heidrun_code/issues/966 and https://github.com/heidrun-org/heidrun_code/issues/969
