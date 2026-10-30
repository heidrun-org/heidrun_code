# Directory Context: `/packages/experiments/mire_live_information/claude_mod`

## Purpose
Provides an optional Claude Code mod that exports live subagent states and message events to local observation files.

## Key Exports & Entry Points
- `hooks/`: the pass-through observer module, with its own CONTEXT.md.
- `.claude-plugin/plugin.json`: the Claude Code plugin manifest.

## Rules
- Load explicitly with `--plugin-dir`; do not install or change user settings automatically.
- The collector creates the output directory before the mod starts.

## Background
- https://github.com/heidrun-org/heidrun_code/issues/966
