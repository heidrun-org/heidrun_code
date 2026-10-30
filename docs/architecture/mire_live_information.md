# Live information for the Mire

- Created: 30 October 2026
- Last updated: 30 October 2026
- Status: Live investigation, and the desktop integration of the observation sources
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Workspace glossary](../agents_rules/glossary/workspaces_tabs_and_panes.md), [Chat glossary](../agents_rules/glossary/chats.md), [Status dot](status_dot.md), [Application installations](application_installations.md)
- Related issue: [issue 966](https://github.com/heidrun-org/heidrun_code/issues/966), [issue 968](https://github.com/heidrun-org/heidrun_code/issues/968), [issue 969](https://github.com/heidrun-org/heidrun_code/issues/969)

## Result

Claude Code mods provide a working live source for subagent identity, native status, pending questions and approvals, and plaintext message events. A separate reader connected to the actual shared Codex server provides explicit child relationships, runtime statuses, attention flags, and interaction records. Both were exercised with real coding agents and subagents in Heidrun Code Development.

The [runnable collector](../../packages/experiments/mire_live_information/README.md) retains these sources as one snapshot. The [evidence](mire_live_information_evidence.md) includes the original investigation and the follow-up live tests. The desktop application does not import the experiment.

Codex message content has a specific source limit: tested Codex message bodies are already encrypted at `PreToolUse`. The shared server's history returns interaction metadata without plaintext. The collector therefore shows content as unavailable for that source. This is an observed upstream limitation, not a missing transcript parser.

These findings inform the Mire design:

- https://github.com/heidrun-org/heidrun_code/issues/955

## What is available

“Existing application” means Heidrun Code already reads the source. “Collector” means the retained experiment reads the source successfully, but the desktop application still needs integration. Native statuses are retained rather than forcing every lifecycle outcome into four pane statuses.

| Information | Claude Code | Codex | Limits |
| --- | --- | --- | --- |
| Workspace, tab, pane, coding agent kind, real terminal | Existing application; verified live | Existing application; verified live | Herdr snapshot/events and `pane.read`. A tab may have several coding agent panes, or no coding agent. |
| Fixed workspace folder | Existing application | Existing application | Heidrun Code enriches Herdr snapshots from its saved folder records. A pane's current working folder is not a replacement. Raw command-line workspace creation did not validate folder enrichment. |
| Parent pane-to-chat link | Explicit `tokens.hd_sid` verified | Explicit `agent_session` verified after resuming a known chat; absent in the initial fresh-chat test | Prefer the explicit identifier. The current title/folder fallback can confuse same-title chats in the same folder. |
| Subagent identity and parent | Collector: `$.agent.list()` IDs and parent IDs, within an explicit session | Collector: `thread/list` with `ancestorThreadId`, explicit child/parent IDs | Names and descriptions are labels, not identity. Do not connect matching names across workspaces. |
| Live subagent status | Collector: native `pending`, `running`, `waiting`, `idle`, `completed`, `failed`, `killed`; real running/completed and a child permission wait verified | Collector: native thread status and active flags; real active, idle, not-loaded, and a child-specific `waitingOnApproval` verified | Preserve native status alongside any display mapping. The full set of cancellation, failure, team, and nested-child cases was not exercised. |
| Pending child approval | Collector: `tool.check` decision `ask`, linked by `agentId` and tool-use ID, cleared when the tool returns | Collector: the actual child thread's `waitingOnApproval` flag | The observed Claude Code native status remained running during its approval; the collector adds Blocked from the identified request. A Codex flag alone does not provide the complete request or an Approve action. |
| Pending question and options | Collector: typed `AskUserQuestion` request, distinct from an approval; resolution clears it | Existing terminal parsing; structured question history can also be read, but history does not establish that a question remains pending | A real Codex asynchronous question briefly caused Blocked, then Finished while still displayed. Attention and pane status are separate facts. |
| Parent/child message content | Collector: real plaintext `session.send` and `session.receive`, with identities and send/receive observations | Collector: interaction metadata and explicit recipient; message text unavailable in tested hooks/history | Claude Code queueing does not prove that the child read the message. Codex hook inputs already contain an encrypted value. |
| Messages between separate coding agents | Explicit Herdr submission was verified within/across workspaces. Native mod message observation is also supported; see follow-up evidence for the tested address form | Explicit Herdr submission to a Codex pane was verified within/across workspaces | The receiving transcript alone treats a Herdr submission as a user message and cannot establish its sender. There is no generic observer for arbitrary files or other transports. |
| Current task | Initial subagent task and description are available | Task path/nickname and initial conversation are available where exposed | Initial instructions and the last prompt do not prove the current task. Label them accurately. |
| Subagent terminal | Child transcript available; separate real Herdr terminal not established | Child transcript available; separate real Herdr terminal not established | A transcript view must not be presented as a live terminal. |

## Runnable collection

Start the collector from the worktree root. This creates the local observation directory:

```sh
python3 packages/experiments/mire_live_information/observe.py
```

Start a test Claude Code session with its optional observer mod:

```sh
claude --plugin-dir "$PWD/packages/experiments/mire_live_information/claude_mod"
```

To include an explicitly identified Codex root chat and its descendants, use:

```sh
python3 packages/experiments/mire_live_information/observe.py \
  --codex-root <root-chat-uuid> --output /tmp/mire-live.json
```

The collector never starts/resumes a chat, submits a turn, answers a question, approves a command, or changes settings. It reads only the selected Codex roots and descendants. The mod is loaded explicitly per Claude Code session, without global installation. Message retention, child enumeration, and recent history reads are bounded and documented in the experiment README.

Claude Code observations older than five seconds become stale; observed status becomes unknown. On a Codex connection failure, continuous collection retains the previous observation as stale and changes observed status to unknown. Native statuses and original timestamps remain available for inspection. The collector replaces its output file atomically and retries partial mod-file reads.

## Identity and status rules for the design

Use the Herdr session/socket together with workspace, tab, pane, and terminal identifiers. A verified move changed a pane from `w1:p2` to `w2:p2`, with a different tab/workspace, while preserving its terminal ID. A terminal can also outlive a coding agent process. Refresh the relationship after moves and process replacement.

For Claude Code, the observer mod records `HERDR_PANE_ID` and `HERDR_SOCKET_PATH` of the Claude Code process in each snapshot file. A session belongs to a pane only through this pane identifier on the same Herdr socket, or through the pane's `hd_sid`. Then use the mod's subagent IDs and parent IDs. After `/clear` or `/resume`, the session identifier changes: the mod marks the file of the former session as ended, and writes a new file for the new session.

For Codex, use only Herdr's explicit `agent_session` reference. A fresh `codex` has no `agent_session`. Heidrun Code therefore creates the chat of each new Codex pane first: `thread/start` with the workspace folder, `thread/name/set` with the tab name (the name saves the empty chat), then `codex resume <chat identifier>` in the pane. Herdr reads the chat identifier from the command line only for a coding agent that Herdr starts itself (`herdr agent start`). Heidrun Code types the command into the shell of the pane, so Heidrun Code then reports the chat to Herdr with the socket method `pane.report_agent_session` (`pane_id`, `source: "herdr:codex"`, `agent: "codex"`, an increasing `seq` in nanoseconds, `agent_session_id`). Herdr then gives the correct `agent_session`, before any prompt ([live test](https://github.com/heidrun-org/heidrun_code/issues/968#issuecomment-6516752765)). Herdr silently ignores another source, for example `heidrun:codex`. The Herdr Codex `SessionStart` hook is rejected: with the shared Codex server, the hook runs in the server process and reads the pane of another session. When the shared Codex server is not available, the pane starts plain `codex` and stays unmatched. Never match a pane by a title or a folder.

After `/clear` or `/resume` in a Codex pane, Herdr keeps the old chat identifier. About 60 seconds after `/clear`, the shared Codex server shows the old chat as `notLoaded`, while a chat that stays open in a pane stays loaded, even without activity ([live test](https://github.com/heidrun-org/heidrun_code/issues/969#issuecomment-6516846140)). A root chat that is `notLoaded` while a pane still names it is therefore a stale identifier. The signal comes about 60 seconds late, and it does not give the new chat. The collector reads with `thread/read` and never subscribes to a chat, because a subscription can keep the chat loaded and hide this signal.

Separate current runtime status from the outcome of a turn. Codex can leave a completed child idle. The collector retains the last subagent activity separately, including completion, and does not call idle a failed task. Failed and killed are also distinct outcomes. A permission wait may be handled by an automatic reviewer; only the actual request and reviewer context can establish whether the developer must act.

The real child-blocking test needed a Codex parent created with user review from the start. Earlier attempts to change routing on existing parent/child chats still completed the harmless command automatically; those attempts are not counted as proof of a pending approval. A direct `turn/start` against a multi-agent v2 child was refused by the server. The read-only collector does not attempt these control operations.

## Freshness and feasibility evidence

The initial critical assumption was whether a real child could be linked to its parent and pane. File inspection established child relationships, but did not establish a complete runtime source. The follow-up then exercised a Claude Code mod inside the real coding agent and a separate WebSocket reader against the actual shared Codex daemon. The tests used active children, nonempty conversations, real messages, questions, and approvals.

Claude Code native child states were polled every 250 milliseconds in the initial mod probe; the retained mod publishes every 500 milliseconds. The retained collector defaults to one-second reads. These are collection intervals, not guarantees about model or network delay. The initial pane-status observations arrived roughly 0.198 seconds after the retained Claude Code question timestamp and 0.399 seconds after the Codex question timestamp in those individual runs.

The Codex `--dangerously-bypass-hook-trust` attempt explicitly switched to embedded mode. That attempt is excluded from shared-server proof. The successful hook test configured and trusted only the exact reviewed hook hashes in a disposable chat's runtime configuration on the existing server. A shell baseline confirmed that hooks ran; the actual message hook still received encrypted content.

## What to design now

The first Mire can include the real workspace/tab/pane hierarchy, coding agent kind and detected pane status, subagent identities and native statuses from instrumented sessions, questions/approval attention where established, terminal previews, and actions to open the real pane.

For Claude Code, include observed plaintext messages with the actual destination and queue/receive state. For Codex, show a confirmed interaction and an explicit indication that content is unavailable. Do not draw a complete communication network from name matches or assume that every visible interaction has readable content.

Native peer events expose transport addresses rather than a complete workspace join. Establish the address-to-session relationship before drawing a general cross-workspace graph; do not infer the relationship from a peer display name.

Keep an unknown or stale state, and support sessions without the optional collector. A mod loaded after work starts or reloaded during an existing approval cannot reconstruct every earlier pending request. The current experiment requires starting observation before work, and restarting the observer session for `/clear` or `/resume`. These limits must remain visible in any desktop integration until lifecycle recovery is implemented and tested.

## Code and next integration work

The experiment is in [mire_live_information](../../packages/experiments/mire_live_information/CONTEXT.md). Existing application sources to reuse are the [Herdr client](../../packages/apps/desktop_tauri/src/herdr.rs), [session store](../../packages/apps/web_frontend/src/stores/session.ts), [workspace folder storage](../../packages/apps/desktop_tauri/src/workspace_folders.rs), [Claude Code transcript reader](../../packages/apps/desktop_tauri/src/claude.rs), and [Codex chat finder](../../submodules/heidrun_data/packages/data_layer_coding_agents/src/coding_agents/codex_chat_finder.rs).

The data layer `subagents` table holds configuration files, not running instances. Do not use it as the live registry. The existing transcript modal's recent-file heuristic is also not a runtime status source.

The desktop integration is in [src/mire](../../packages/apps/desktop_tauri/src/mire/CONTEXT.md), with the observer mod in [resources/mire_claude_observer](../../packages/apps/desktop_tauri/resources/mire_claude_observer/CONTEXT.md):

- The Settings option "Observe Claude Code for the Mire" is off by default. When it is on, each Claude Code that Heidrun Code starts gets `HEIDRUN_MIRE_OBSERVATION_DIR=<folder> claude --plugin-dir <mod folder>`. The mod folder is a copy of the bundled mod in the data folder of Heidrun Code, because Claude Code writes type files beside a mod that it loads. Nothing is installed globally.
- Each Codex pane that Heidrun Code starts (a free agent pane, a new tab or split, a launcher that starts Codex) goes through the Tauri command `codex_prepare_chat`, then `codex resume <chat identifier>` with the other arguments, then `pane.report_agent_session` for that pane. A failed report does not stop the start; the pane then stays unmatched. A missing server, an error, or 3 seconds without an answer gives the plain command.
- One shared collector in Rust runs while at least one Mire view is registered, every 2 seconds, and emits `mire://observations`. It reads the newest 200 snapshot files, the Codex panes of the Herdr session of Heidrun Code, and at most 100 descendants for each root chat, with read-only methods only. An unavailable server gives the coverage `unavailable`.
- A Claude Code snapshot is stale when it is older than 30 seconds, in the future, or ended. The mod writes again every 500 milliseconds while its session runs, so an old file means that the observer stopped.
- Still not tested: a mod reload during an open request (the request is lost; `observerStartedAtMs` shows when the observation started), nested and team cases, and `/resume` of another chat in a Codex pane.

Official references: [Claude Code mods](https://code.claude.com/docs/en/plugins/mods/overview), [mod reference](https://code.claude.com/docs/en/plugins/mods/reference), [Codex App Server](https://learn.chatgpt.com/docs/app-server), and [Codex hooks](https://learn.chatgpt.com/docs/hooks). These references guided the probes; the live evidence establishes what actually worked here.

## Validation

Both initial development application builds passed. The retained mod passed `claude plugin validate` and JavaScript type checking against the installed Claude Code declarations. Both Python files passed compilation, and the collector read the real mod files and shared Codex server with no reported errors. Live checks covered plaintext parent/child messages, child-specific permission attribution, typed questions, runtime child status changes, and unavailable Codex message content.

All testing used Heidrun Code Development from the issue worktree. The installed Heidrun Code application and its Herdr session were not controlled. The application needed a process-only `HERDR_BIN_PATH` override because the checkout's environment file pointed at a missing executable. No global coding agent configuration was changed.
