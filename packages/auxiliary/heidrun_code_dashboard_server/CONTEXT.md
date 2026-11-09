# Directory Context: `/packages/auxiliary/heidrun_code_dashboard_server`

## Purpose
The Heidrun Code Dashboard server of Heidrun Code: it serves the Heidrun Code Dashboard page to a phone or a tablet of the local network, used as a second screen, over plain HTTP and behind a pairing key. It only reads, and knows nothing about coding agents and Tauri.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface: `HeidrunCodeDashboardServer` with its status and error types, `HeidrunCodeDashboardServerConfig` with `load_config`, `save_config`, `new_key`, and `free_port`, `HeidrunCodeDashboardServerHandler` with `HeidrunCodeDashboardAsset` and `HeidrunCodeDashboardServerEvent`, `local_network_address`, `page_address`, `PAGE_PATH`, and `STATE_PATH`.
- `src/handler.rs`: the trait `HeidrunCodeDashboardServerHandler`, which the desktop application implements: the state of the Heidrun Code Dashboard, the files of the page, and the events for the application log.
- `src/router.rs`: the routes `/heidrun_code_dashboard` (the page, which keeps the key of the address in the cookie `heidrun_code_dashboard_key`), `/heidrun_code_dashboard/api/state`, the old address `/mire` that sends the device to the page, and the other files of the page.
- `src/access.rs`: the checks of the header Host, the header Origin, the pairing key, and the lock after ten bad keys.
- Command to test this folder: `pnpm --filter heidrun_code_dashboard_server test`.

## Rules
- This package imports nothing from Tauri and nothing from another package of the repository, the mobile server included.
- The server listens on every address only while `start` runs; `stop` ends it at once and refuses every key.
- Every route needs the pairing key, and only GET and HEAD exist: no route sends text to a pane or changes anything.
- Only an IPv4 address with the port of the server passes in the header Host: a host name is refused even with the right key.
- No `HeidrunCodeDashboardServerEvent` holds a pairing key or an address.
- The file `heidrun_code_dashboard_local_network.json` is readable by this user only; its port is given once by the system and then kept.
- `HeidrunCodeDashboardServer::start` returns a future and listens only when the caller spawns it, because this package owns no async runtime.
- The package is a member of the Cargo workspace at the root, and its compiled files go in the target folder of `desktop_tauri`.

## Background
- The rules are in [heidrun_code_dashboard_local_network.md](../../../docs/agents_rules/user_interface/heidrun_code_dashboard/heidrun_code_dashboard_local_network.md), from [issue 978](https://github.com/heidrun-org/heidrun_code/issues/978).
