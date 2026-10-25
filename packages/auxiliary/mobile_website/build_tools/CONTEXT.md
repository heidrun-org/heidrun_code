# Directory Context: `/packages/auxiliary/mobile_website/build_tools`

## Purpose
The code that runs inside the Vite build of the mobile website, not inside the page.

## Key Exports & Entry Points
- `dist_sync_plugin.ts`: `DistSyncPlugin`, the Vite plugin that builds into the folder `dist_staging`, then copies into `dist` only the files whose content changed, and deletes the files that are gone.
- Command to test this folder: `pnpm --filter mobile_website test`.

## Rules
- Nothing here is imported by the code of the page in `src`.
- A file of `dist` with unchanged content keeps its date, so Cargo does not compile `mobile_server` again.

## Background
- The synchronization comes from [issue #864](https://github.com/heidrun-org/heidrun_code/issues/864): a new date on an unchanged file of `dist` made Cargo compile `mobile_server` and `desktop_tauri` again.
