# Directory Context: `/packages/experiments/heidrun_code_dashboard_live_information/claude_mod/hooks`

## Purpose
Observes Claude Code runtime events and publishes one bounded snapshot for each session.

## Key Exports & Entry Points
- `register.js`: the `register` export required by Claude Code.

## Rules
- Pass events, permission decisions, and tool results through unchanged.
- Catch observation write errors without replaying a tool call.
- The mod compiler requires a direct function export and statically traceable top-level helpers; these required entry points are an exception to the repository's static-class JavaScript organization.
- Use the installed Claude Code declarations and validate the module before loading it.

## Background
- https://github.com/heidrun-org/heidrun_code/issues/966
