# Directory Context: `/tmp/web_doc_by_ai/workspace/packages/apps`

## Purpose
The packages that produce the application Heidrun Code. Nothing else lives here.

## Key Exports & Entry Points
- `desktop_tauri/`: the macOS application, the Rust backend and the Tauri shell. See its own README.md.
- `web_frontend/`: the user interface, written with Vue 3 and TypeScript. The window of `desktop_tauri` displays it. See its own README.md.

## Rules
- A package that only supports the application, such as a website or a library for the scripts, goes in `packages/auxiliary`, never here.
- A package that is only a tool for the developers of Heidrun Code goes in `packages/dev_tools`, never here.
- The package `desktop_tauri` builds the package `web_frontend` through the relative path `../web_frontend/dist`, so both packages stay in this folder.

## Background
- The folder `packages` was split into `apps` and `auxiliary` in [issue #120](https://github.com/heidrun-org/heidrun/issues/120).
