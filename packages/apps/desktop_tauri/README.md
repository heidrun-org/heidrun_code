# desktop_tauri

The macOS application of [Heidrun Code](../../../README.md): the Rust backend and the Tauri 2 shell that hosts the user interface.

## What it does

- Talks to the Herdr server of its own named session, `heidrun`, and starts the server in the background if it is not running. Heidrun Code Development in the main checkout uses `heidrun_development`; Heidrun Code Development from a worktree uses the session `heidrun_` followed by the name of the worktree, because Herdr allows one attach client for each terminal. Installed Heidrun Code accepts `HERDR_SESSION` and `HERDR_SOCKET_PATH`. Development ignores inherited session selectors; see [the installation guide](../../../docs/architecture/application_installations.md).
- Stops its session when the user quits, unless the setting "Keep agents running after quit" is on. The default Herdr session of a terminal is never stopped.
- Runs the terminals of the panes with `portable-pty`.
- Reads the git state, the project files, the job history, and the Claude and Codex usage.
- Runs the mobile access (a phone through an ngrok tunnel) with the package `mobile_server`, which serves the mobile website, opens the tunnel with the program `ngrok`, and hands each call of the phone to the window. It stops the tunnel when the developer turns the mobile access off, and when Heidrun Code quits.

## Commands

Run these commands from the root of the repository.

```sh
pnpm dev     # start Heidrun Code Development, with separate settings, data and Herdr session
pnpm build:development # build a separate Heidrun Code Development.app
pnpm build   # build Heidrun Code.app in packages/apps/desktop_tauri/target/release/bundle/macos/
```

## Related packages

- [`web_frontend`](../web_frontend): the user interface displayed in the window of this application.
