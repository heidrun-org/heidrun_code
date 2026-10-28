# Directory Context: `/packages/apps/desktop_tauri/src/chat_images`

## Purpose
The command that the Clipboard sidebar section calls to show the image behind each text `[Image #N]` of the chat of the selected pane. The command gets the images from the package `data_layer_coding_agents`.

## Key Exports & Entry Points
- `chat_images.rs`: `chat_images_find` gives the key of every image of a chat of Claude Code or of Codex, and the images above the key that the web page already has. `chat_images_find_codex_chat` gives the chat of a Codex pane, from the title of its terminal.

## Rules
- A file here never opens a chat session file, never runs a program, never makes a network request, and never runs SQL. Only the package `data_layer_coding_agents` reads the chat session file. The test of the package `data_layer_boundary_checker` checks this folder as it checks the folder `past_chats`.
- A file here calls only the functions named `find_*` of the package.
- Every call to a function of the package runs inside `crate::application_log::data_layer_value`, so the application log holds its start, its end, and its duration.

## Background
- The images are read from the chat session file at each call, and never copied into the SQLite file. The exception and its reason are in [data_layer_access.md](../../../../../docs/agents_rules/data_layer_access.md).
- Issues: https://github.com/heidrun-org/heidrun_code/issues/790 and https://github.com/heidrun-org/heidrun_code/issues/924
