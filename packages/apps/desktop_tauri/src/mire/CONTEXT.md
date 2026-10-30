# Directory Context: `/packages/apps/desktop_tauri/src/mire`

## Purpose
The live observation sources of the Mire: the one shared collector that reads the Claude Code observer mod files, the Codex panes of the Herdr session of Heidrun Code, and their chats on the shared Codex server, the start of the chat of a new Codex pane, and the separate Mire window.

## Key Exports & Entry Points
- `collector.rs`: the Tauri commands `mire_subscribe` and `mire_unsubscribe`, the event `mire://observations`, and `forget_window`, which removes the views of a closed window.
- `mire_window.rs`: the Tauri commands `mire_window_open` (one window with the label `mire`, or focus) and `mire_open_in_main_window` (the event `mire://open-pane` to the main window only), and `on_window_destroyed`, which `lib.rs` calls.
- `claude_observer_mod.rs`: the Tauri commands `mire_claude_observer_mod_path` (the copy of the bundled mod, ready for `claude --plugin-dir`) and `mire_claude_observation_folder` (the folder for the variable `HEIDRUN_MIRE_OBSERVATION_DIR`).
- `codex_chat_preparation.rs`: the Tauri command `codex_prepare_chat`, `thread/start` then `thread/name/set`, which gives null when the shared Codex server is not available.
- `local_network.rs`: the Tauri commands `mire_local_network_status`, `mire_local_network_enable`, `mire_local_network_disable`, and `mire_local_network_new_key`, `start_if_enabled` and `stop_on_quit`, and the handler of the package `mire_server`: the state of the Mire and the files of the page.
- `contract.rs`: the shape of the observations. The shape is the observation contract of issue 968; never change it on one side only.
- Command to run the tests of this folder: `cargo test --package heidrun_code mire`, at the root of the repository. The live test runs by hand only: `cargo test --package heidrun_code live_ -- --ignored`.

## Rules
- The collector reads only: the connection of the collector accepts only `thread/read`, `thread/list`, `thread/items/list`, and `thread/turns/list`. It never starts, resumes, or answers a chat, and never sends input to a pane.
- Only `codex_chat_preparation.rs` opens a connection with `thread/start` and `thread/name/set`, and only for a new pane that Heidrun Code starts.
- Nothing here starts a Codex server. A missing socket, an error, or a timeout gives the coverage `unavailable`, never fictional data.
- The Codex panes come from the Herdr session that `crate::herdr` already uses, through `crate::herdr::request`. Never open another Herdr session.
- A Codex root chat comes only from the `agent_session` of a pane; a Claude Code session belongs to a pane only through `herdrPaneId` and its Herdr socket. Never match by a title or a folder.
- Every reading is bounded: at most 200 snapshot files (the newest), 200 messages per session, 100 descendants per root chat, and 100 items per chat.
- No reading runs while no Mire view is registered. The devices of the local network register one view, `mire_local_network`, which leaves after 15 seconds with no request.
- `local_network.rs` gives the Mire server only reads: the Herdr snapshot, the latest observations, the Herdr socket, and the files of the page. A release build gives its embedded files; a development build asks the development server of the page.
- The collector records the window of each view, and `lib.rs` calls `forget_window` when a window is destroyed. The separate Mire window has its own capability, `capabilities/mire_window.json`, with only the permissions that its page uses.
- The tests never touch `~/.codex`: they use the fake server of `codex_connection.rs` on a temporary socket.

## Background
- The sources, the identity rules, and the limits: [mire_live_information.md](../../../../../docs/architecture/mire_live_information.md).
- The display modes: [mire_display_modes.md](../../../../../docs/agents_rules/user_interface/mire/mire_display_modes.md).
- The Mire on the local network: [mire_local_network.md](../../../../../docs/agents_rules/user_interface/mire/mire_local_network.md).
- Issues: https://github.com/heidrun-org/heidrun_code/issues/968, https://github.com/heidrun-org/heidrun_code/issues/969, https://github.com/heidrun-org/heidrun_code/issues/973, and https://github.com/heidrun-org/heidrun_code/issues/978
