# Directory Context: `/packages/experiments/heidrun_code_dashboard_live_information`

## Purpose
Collects live coding agent information for the Heidrun Code Dashboard investigation without changing the desktop application.

## Key Exports & Entry Points
- `observe.py`: reads Claude Code observation files and explicitly selected Codex chats, then prints or saves a combined snapshot.
- `codex_reader.py`: reads the actual shared Codex server over its local WebSocket socket.
- `claude_mod/`: an optional session-local Claude Code observer mod; see its own CONTEXT.md.
- Command: `python3 packages/experiments/heidrun_code_dashboard_live_information/observe.py --help`.

## Rules
- Never send a turn, resume a chat, approve a request, or change settings from the collector.
- Read Codex only for explicit root chat identifiers and their descendants.
- Preserve native statuses, unavailable message content, and stale observations.
- No application package imports this experiment.

## Background
- https://github.com/heidrun-org/heidrun_code/issues/966
