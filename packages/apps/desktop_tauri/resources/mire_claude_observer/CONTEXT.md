# Directory Context: `/packages/apps/desktop_tauri/resources/mire_claude_observer`

## Purpose
The Claude Code observer mod that Heidrun Code includes in its bundle. It writes one snapshot file for each Claude Code session, which the Mire collector of `src/mire` reads.

## Key Exports & Entry Points
- `hooks/`: the pass-through observer module, with its own CONTEXT.md.
- `.claude-plugin/plugin.json`: the Claude Code plugin manifest.
- Command to check this folder: `claude plugin validate packages/apps/desktop_tauri/resources/mire_claude_observer`.

## Rules
- Heidrun Code loads the mod only when the Settings option is on, with `HEIDRUN_MIRE_OBSERVATION_DIR=<folder> claude --plugin-dir <copy of this folder>`. Nothing is installed globally.
- Heidrun Code gives Claude Code a copy of this folder in the folder of its data, never the folder in the application bundle, because Claude Code writes type files beside a mod that it loads.
- `src/mire/claude_observer_mod.rs` names the files that are copied. A new file of the mod goes into that list.
- The snapshot file is the input of `src/mire/claude_snapshots.rs`: change both in the same change.

## Background
- Issues: https://github.com/heidrun-org/heidrun_code/issues/968 and https://github.com/heidrun-org/heidrun_code/issues/969
