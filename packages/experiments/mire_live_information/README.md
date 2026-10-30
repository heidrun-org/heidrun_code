# Mire live information collector

This investigation includes a runnable collector and an optional Claude Code observer mod. The collector reads the actual shared Codex server and local files written by the mod. The collector does not send prompts, resume chats, answer requests, or change settings.

Start the collector from the repository root with Python 3. The command creates the Claude Code observation directory and prints a combined snapshot once per second:

```sh
python3 packages/experiments/mire_live_information/observe.py
```

In a disposable Heidrun Code Development pane, start Claude Code with the mod explicitly loaded for that session:

```sh
claude --plugin-dir "$PWD/packages/experiments/mire_live_information/claude_mod"
```

The mod writes one snapshot per Claude Code session under `/tmp/heidrun_mire_live`. The directory must be owned by the current user with permissions 700; the collector creates a new directory with those permissions. Combined output files use permissions 600. It records native subagent statuses, pending questions and approvals with their coding agent or subagent identifier, and the last 200 message send/receive events. Native statuses are retained: a pending request adds an observed Blocked state. A queued send does not mean the recipient read the message.

Add an explicit Codex root chat identifier to observe that chat and its descendants on the real shared server:

```sh
python3 packages/experiments/mire_live_information/observe.py \
  --codex-root <root-chat-uuid> --output /tmp/mire-live.json
```

Repeat `--codex-root` for several roots. The collector uses `thread/read`, `thread/list`, and `thread/items/list` only. Its default socket is `~/.codex/app-server-control/app-server-control.sock`; `--codex-socket` selects another explicit socket. It never starts a replacement server. The latest 100 items per observed chat supply interaction records; `childrenLimitReached` says when the requested child limit prevented a full enumeration.

Use `--once` for one snapshot. Claude Code observations older than five seconds become stale, and their observed subagent status becomes unknown. On a Codex connection failure, continuous collection retains the previous snapshot as stale with unknown observed statuses. The output file is replaced atomically. Claude Code's own file writes can be partial, so the collector retries reads.

Codex native statuses and attention flags are available, including a child-specific `waitingOnApproval` flag verified live. Normal child completion can leave the native thread idle; idle is not a failed task. Codex interaction records identify the recipient but do not expose message text in this tested version. The collector returns `text: null` and `contentAvailability: not_exposed` rather than displaying encrypted values as messages. The separate hook probe confirmed the same limitation even before the tool runs.

The mod writes only local observation files and passes tool calls, results, messages, and permission decisions through unchanged. Load the mod only in the test sessions you want to observe. It does not install itself globally. After a mod reload, a request already open before the reload cannot be reconstructed from the event stream; run the observation before starting work. On `/clear` or `/resume`, restart the observer session in this experiment rather than assuming continuity. These lifecycle cases remain outside the demonstrated integration.

Validation uses the actual coding agents and shared server, not a simulated transport. See the [investigation](../../../docs/architecture/mire_live_information.md) and [live evidence](../../../docs/architecture/mire_live_information_evidence.md). To check the mod against the installed Claude Code version:

```sh
claude plugin validate packages/experiments/mire_live_information/claude_mod
```

Loading the mod generates version-specific type declarations. Type-check the JavaScript with the TypeScript executable already supplied by `web_frontend`:

```sh
pnpm --filter web_frontend exec tsc -p "$PWD/packages/experiments/mire_live_information/claude_mod/tsconfig.json" --allowJs --checkJs --noEmit
python3 -m py_compile packages/experiments/mire_live_information/observe.py packages/experiments/mire_live_information/codex_reader.py
```

Stop the collector with Control-C and quit the disposable coding agent sessions after testing. Old observation files remain useful as recorded data but become stale. No desktop application package imports this experiment, and no data layer database is written.
