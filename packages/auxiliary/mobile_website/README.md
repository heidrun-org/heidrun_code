# mobile_website

The mobile website of [Heidrun Code](../../../README.md): the page that a phone opens to see the coding agents, answer them, and send them a prompt. The package `mobile_server` serves the built page from the computer, and the page talks only to that server.

## Run the website while you work on it

Run these commands from the root of the repository, or of the worktree. In both ways, the page reloads by itself when you change a file of `src`, and it stays on the same screen.

### Way 1: made-up coding agents (no Heidrun Code needed)

Use this way to work on the layout, the colors, and the buttons. The development server pretends to be four coding agents with fixed sample data. Nothing real runs: a prompt only appears in the fake output.

```bash
pnpm --filter mobile_website dev
```

Open the address that the command prints (`http://127.0.0.1:5183/#t=...`).

### Way 2: your real coding agents (Heidrun Code must run)

Use this way to see your real coding agents. You need two terminals.

Terminal 1: start Heidrun Code, and keep it running. Then open the Settings window, and turn on the section "Mobile access". The program `ngrok` must be installed and signed in. After a few seconds, the section shows the address of the tunnel, for example `https://words-of-the-tunnel.ngrok-free.dev/`. Copy its host name, which is the text between `https://` and the last `/`. Heidrun Code restarts only when the calls between the page and the application change.

```bash
pnpm dev -- -- --no-splash-screen
```

Terminal 2: start the website, and send its calls to the mobile server inside Heidrun Code. The mobile server answers only the host name of its tunnel, so give that host name in `MOBILE_API_HOST`. The host name is fixed for your ngrok account, so you can keep this command.

```bash
MOBILE_API_TARGET=http://127.0.0.1:47823 MOBILE_API_HOST=words-of-the-tunnel.ngrok-free.dev pnpm --filter mobile_website dev
```

Open the address that the second command prints (port 5183, with the pairing key). Do not open port 47823 to work on the page: that port refuses every request that does not come from the tunnel.

### Open the page on your phone

Add `--host` to the command of either way. Your phone must be on the same Wi-Fi network as the computer, and not on a guest network.

```bash
pnpm --filter mobile_website dev --host
```

Vite then prints one line for each address, with the pairing key after the sign "#". Open the line with the address of the network (for example `http://192.168.1.160:5183/#t=...`) on the phone once. The phone keeps the key, so a later visit needs no key. This address uses plain HTTP, so the browser of the phone does not give the microphone to the page.

## Other commands

```bash
pnpm --filter mobile_website build   # type check, then build the website into dist
pnpm --filter mobile_website test    # the Vitest tests
```

The development server sends no `Content-Security-Policy` header. Before you finish a change, build the website and open it from port 47823, where the mobile server applies the strict policy.

The rules of this package are in [CONTEXT.md](CONTEXT.md), and the rules of the development server are in [dev/CONTEXT.md](dev/CONTEXT.md).
