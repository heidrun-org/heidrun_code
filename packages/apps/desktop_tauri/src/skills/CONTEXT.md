# Directory Context: `/packages/apps/desktop_tauri/src/skills`

## Purpose
Expose skill management to the Installed skill and Find new skills windows. Install the skills and command lines bundled with Heidrun Code.

## Key Exports & Entry Points
- `mod.rs` exposes the Tauri commands registered by the desktop application.
- `bundled.rs` installs the bundled skills, links the bundled command lines in `~/.local/bin`, and removes former installations verified as belonging to Heidrun Code.

## Rules
- Use the [shared skill operations](../../../../auxiliary/heidrun_code_ctrl/src/skills/CONTEXT.md) in Heidrun Code Control.
- Keep the desktop command names, argument names, result formats, and error codes in sync with the frontend.

## Background
- Bundled command and skill cleanup follows [issue #850](https://github.com/heidrun-org/heidrun_code/issues/850).
- Sharing the skill operations with Heidrun Code Control follows [issue #1097](https://github.com/heidrun-org/heidrun_code/issues/1097).
