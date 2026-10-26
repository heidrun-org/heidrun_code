# mobile_server

The mobile server of [Heidrun Code](../../../README.md): a Rust library that serves the built mobile website on the loopback address `127.0.0.1`, behind an ngrok tunnel that gives it a fixed public HTTPS address. It checks the host name of the tunnel and the pairing key of every request, and hands each call on `/api` to the desktop application. The application `desktop_tauri` starts it.

## Run it

The server has no command line of its own. It runs inside Heidrun Code, when the section "Mobile access" of the Settings window is on. The program `ngrok` must be installed (`brew install ngrok`) and signed in: create a free account at ngrok.com, then run `ngrok config add-authtoken <your token>` once. The variable `HEIDRUN_CODE_NGROK` gives its path when it is in an unusual folder.

```bash
pnpm dev -- -- --no-splash-screen
```

The server listens on `http://127.0.0.1:47823` and answers only a request that comes through the tunnel, so open the address that the Settings window shows. The server serves the copy of the website that was built when Heidrun Code started, with no reload.

## Work on the website while the server runs

To see a change of the website at once, without starting Heidrun Code again, use the development server of the package `mobile_website`, with the made-up coding agents or with the running Heidrun Code. The two commands are in the file [README.md](../mobile_website/README.md) of that package.

## Test

```bash
pnpm --filter mobile_server test   # builds mobile_website, then runs cargo test
```

One more test opens a real tunnel on the Internet for a few seconds, so it runs only by hand, with `ngrok` installed and signed in. It also proves that a second start gives the same address:

```bash
cargo test live_ -- --ignored --nocapture
```

The rules of this package are in [CONTEXT.md](CONTEXT.md).
