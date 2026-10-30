# Heidrun Code Dashboard on the local network

- Created: 30 October 2026
- Last updated: 30 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Heidrun Code Dashboard display modes](heidrun_code_dashboard_display_modes.md), [Heidrun Code Dashboard graph and sidebar](heidrun_code_dashboard_graph_and_sidebar.md), [Application log](../../application_log.md)
- Related issue: [issue 978](https://github.com/heidrun-org/heidrun_code/issues/978)

This file gives the rules of the Heidrun Code Dashboard on a phone or a tablet of the local network, used as a second screen next to the computer. The device opens the same Heidrun Code Dashboard page in its web browser, read-only.

## Settings

- The section "Heidrun Code Dashboard" of the Settings window comes just after the section "Coding agents". It holds the option "Show the Heidrun Code Dashboard on the local network" (`data-option="heidrunCodeDashboardLocalNetwork"`), off by default.
- While the server listens, the section shows the address of the page in two forms: a QR code, and the address as text with the label "Address of the page" and a copy button. The button "Make a new pairing key" refuses the old key at once.
- The section says that the page uses plain HTTP, so the device cannot keep its screen on by itself, and that macOS can ask to accept incoming connections the first time.
- The errors are `cannotListen` (the port is in use) and `noNetwork` (the computer has no address on a local network).

## Server

- The package `packages/auxiliary/heidrun_code_dashboard_server` is the server. It is separate from the mobile server, which listens only on the loopback address behind an ngrok tunnel.
- Plain HTTP, no tunnel, no service on the internet. The server listens on every address of the computer only while the option is on, and stops when the option is off or when Heidrun Code quits.
- The file `heidrun_code_dashboard_local_network.json` in the data folder of Heidrun Code keeps the option, the pairing key, and the port, readable by this user only. The first start takes a free port from the system and saves it, so the QR code stays valid after a restart, and the installed Heidrun Code and Heidrun Code Development never share a port.
- The address is `http://<address of the computer>:<port>/heidrun_code_dashboard?key=<pairing key>`. The address of the computer is the address of the interface that the system uses for the outside, usually the Wi-Fi.
- Every request needs the pairing key: from the address on `/heidrun_code_dashboard`, then from the cookie `heidrun_code_dashboard_key` (HttpOnly, SameSite=Strict) that the page sets. A request without the right key gets only a short text that holds nothing of the Heidrun Code Dashboard. Ten bad keys in a row lock the wrong keys for one minute; the right key always passes.
- The old names of the Mire still work once ([issue 989](https://github.com/heidrun-org/heidrun_code/issues/989)): the file `mire_local_network.json` moves to the new file when the new file does not exist, the address `/mire` sends the device to `/heidrun_code_dashboard` with the same query, and the page copies the old cookie `heidrun_mire_key` to the new cookie.
- The header Host must be an IPv4 address with the port of the server, so a host name (DNS rebinding) is refused even with the right key. A header Origin must be the same host.
- Only GET and HEAD: no route sends text to a pane, starts a coding agent, or changes anything.
- The refused requests and the lock go to the application log, never with a key or an address.

## Page

- `main.ts` starts `start_heidrun_code_dashboard_local_network.ts` when the path is `/heidrun_code_dashboard`. The page has no Tauri bridge, and the Tauri mock of the development server never installs there, so a fake answer never shows.
- The page reads `/heidrun_code_dashboard/api/state` every second, and every three seconds after a failure, with a message that the connection is lost. The state is the Herdr snapshot, the latest observations of the one shared collector, and the Herdr socket.
- The page mounts the same `HeidrunCodeDashboardView.vue` with the display mode `localNetwork`. It hides "Open in Heidrun Code", the terminal preview, and the transcript preview, and calls no Tauri command.
- The button of full screen shows only when the web browser allows full screen. The page asks the web browser to keep the screen on; the web browser allows it only on HTTPS.
- Below 760 pixels of width, the sidebar goes below the graph.
- A release build serves the files that it holds, the same files as its windows. A development build asks the development server of the page; its live reload connection fails on the device, and nothing else.

## One collector

- The devices register one view, `heidrun_code_dashboard_local_network`, in the shared collector at their first request, and the view leaves the collector after 15 seconds with no request. No second collector and no second reading of the sources exist.
- Several devices read the same Herdr snapshot for one second.

## Tests

- `pnpm --filter heidrun_code_dashboard_server test`: the key, the cookie, the lock, the Host and the Origin, the routes that only read, the address, the QR code, the port in use, and the configuration file.
- `cargo test --package heidrun_code heidrun_code_dashboard`: the log lines, the first key and port, and the end of the view of the devices.
- `pnpm --dir packages/apps/web_frontend exec vitest run src/components/settings/SettingsHeidrunCodeDashboardSection.test.ts src/components/heidrun_code_dashboard/HeidrunCodeDashboardLocalNetworkRoot.test.ts src/stores/heidrun_code_dashboard/heidrun_code_dashboard_local_network_session.test.ts`.
