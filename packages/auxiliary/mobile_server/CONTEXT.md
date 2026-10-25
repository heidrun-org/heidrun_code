# Directory Context: `/packages/auxiliary/mobile_server`

## Purpose
The mobile server of Heidrun Code Mobile. It serves the mobile website on the loopback address, behind an `ngrok` tunnel with a fixed public HTTPS address, checks the host name of the tunnel and the pairing key of every request, and hands each call of the phone to the desktop application. It knows nothing about coding agents and Tauri.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface of the library: `MobileServer`, its status and error types, `MobileConfig` with `load_config`, `save_config`, and `new_token`, `MobileCallHandler`, `CallFuture`, and the module `push`.
- `src/handler.rs`: the trait `MobileCallHandler`, which the desktop application implements. `src/router.rs`: the route `/api` with the closed list of methods, and the files of the website for every other address.
- `src/embedded.rs` and `build.rs`: the files of the folder `dist` of `mobile_website`, held inside the program, and the `Content-Type` of each file. `build.rs` copies `dist` into `OUT_DIR` and gives Cargo only relative paths, so a cloned target folder stays valid ([issue #864](https://github.com/heidrun-org/heidrun_code/issues/864)).
- `src/push.rs`: the file `mobile_push.json` (readable by this user only), and `send_all`, which wakes each phone with a request that has no body.
- `src/leftover_tunnel.rs`: the folder `mobile_ngrok`, and the kill of an `ngrok` that an earlier Heidrun Code left running.
- Command to test this folder: `pnpm --filter mobile_server test`. The command builds `mobile_website` first. The tests `live_...` use a real tunnel or the real phones, so they run only by hand: `cargo test live_ -- --ignored --nocapture`.

## Rules
- A new mobile configuration uses `HEIDRUN_CODE_MOBILE_PORT` when the variable holds a valid port; an existing saved port takes precedence.
- This package imports nothing from Tauri and nothing from another package. The only thing that it reads from another package is the folder `dist` of `mobile_website`, at build time.
- The server listens only on `127.0.0.1`, never on `0.0.0.0`, and no variable changes this.
- Only the host name of the tunnel passes, with the Origin `https://<host name>`; every other name, the loopback address included, is refused even with the right key, and so is every request before the tunnel has an address. The host name comes only from the record `started tunnel` of the log of `ngrok`.
- `ngrok` runs with `--inspect=false`, so it never remembers a request and its pairing key.
- `ERR_NGROK_4018` and `ERR_NGROK_334` give the errors `ngrokNotSignedIn` and `ngrokAddressInUse`; after `ngrokNotSignedIn`, the next try waits three times longer.
- `stop` and a new run kill the program `ngrok` at once. A task of an older run changes nothing, because every change checks the number of its run.
- Each Heidrun Code kills only an `ngrok` recorded in `mobile_ngrok`: at a start when its parent is process 1, and with the button "Stop the old ngrok" when it is not its own ([issue #583](https://github.com/heidrun-org/heidrun/issues/583), [issue #585](https://github.com/heidrun-org/heidrun/issues/585)).
- `HEIDRUN_CODE_NGROK` gives the path of `ngrok`; without it the usual folders are searched, because the Finder gives no `PATH`.
- Every method needs the pairing key. A method outside `METHODS` in `src/router.rs`, and `pushKey`, `subscribe`, and `unsubscribe`, never reach the handler.
- A new key (`replace_token`, or a new run) cuts off open connections at once, and the right key is never locked out. `replace_token` keeps the tunnel and its address.
- The server serves only the embedded files. The header `Content-Security-Policy` allows only files of the server itself, and a test refuses `unsafe-inline` and `unsafe-eval`.
- `MobileServer::start` returns a future and listens only when the caller spawns it, because this package owns no async runtime.
- The package is a member of the Cargo workspace at the root, and its compiled files go in the target folder of `desktop_tauri`.

## Background
- The package comes from [issue #525](https://github.com/heidrun-org/heidrun/issues/525), the plan of [issue #524](https://github.com/heidrun-org/heidrun/issues/524).
- The tunnel comes from [issue #542](https://github.com/heidrun-org/heidrun/issues/542).
- The choice of ngrok, for a fixed address and a QR code that is scanned once, is in [issue #549](https://github.com/heidrun-org/heidrun/issues/549).
