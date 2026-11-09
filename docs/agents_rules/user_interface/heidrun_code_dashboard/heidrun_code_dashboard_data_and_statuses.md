# Heidrun Code Dashboard data and statuses

- Created: 30 October 2026
- Last updated: 30 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: Heidrun Code Dashboard](../../glossary/heidrun_code_dashboard.md), [Glossary of Heidrun Code: workspaces, tabs, and panes](../../glossary/workspaces_tabs_and_panes.md), [Live information for the Heidrun Code Dashboard](../../../architecture/heidrun_code_dashboard_live_information.md)
- Related issue: [issue 968](https://github.com/heidrun-org/heidrun_code/issues/968), [issue 970](https://github.com/heidrun-org/heidrun_code/issues/970)

This file gives the rules of the data of the Heidrun Code Dashboard: the hierarchy, the identities, the statuses, the aggregation, the coverage, the counters, and the messages. The code is in the folder `packages/apps/web_frontend/src/lib/heidrun_code_dashboard`. It draws nothing and calls no Tauri command. Every Heidrun Code Dashboard view (the modal and the separate window) uses this one model.

## Hierarchy

- The Heidrun Code Dashboard model has Heidrun at the top, then the workspaces by number, the tabs by number, the coding agents, and the subagents.
- A coding agent is one pane where Herdr detects a coding agent (the field `agent` of the pane is not empty). A tab with several such panes has several coding agents. A tab with no such pane has no coding agent.
- A subagent is a Claude Code subagent or a Codex child chat. The Codex child chats are nested by their parent chat. A child whose parent is not observed goes under the coding agent, with the notice `parent_not_observed`.
- The workspace keeps its saved workspace folder. The current working folder of a pane never replaces it.
- Never use the data layer table `subagents`: it holds configuration files, not running subagents.

## Identities

- Each identity uses its own identifier: the Herdr session for the whole model, the workspace identifier, the tab identifier, the pane identifier, the terminal identifier, the chat identifier, and the subagent identifier.
- The node of a coding agent uses the terminal identifier and the kind of coding agent. A pane move changes the pane, the tab, and the workspace identifiers, and keeps the terminal identifier: the model follows the current Herdr data, and the node keeps its identifier.
- A terminal can outlive its coding agent. When the coding agent stops, the pane is no longer a coding agent. When another kind of coding agent starts in the same terminal, it is a new node.
- The node of a Claude Code subagent uses the session identifier and the subagent identifier, because a subagent identifier is unique only in its session. The node of a Codex child chat uses its chat identifier.
- A name, a description, a nickname, a title, or a folder is a label, never an identity. Two tabs or two subagents with the same name in different workspaces stay separate.

## Matching a pane to its observation

- Claude Code: the session belongs to the pane through the pane token `hd_sid`. When the pane has no `hd_sid`, the session belongs to the pane only when the mod saw the same pane identifier and the same Herdr socket. With no observed session, the pane is "not observed": the option is off, or the mod is not loaded in this session.
- Codex: the root chat belongs to the pane only through the `agent_session` of the pane. A Codex pane with no `agent_session` is "unmatched". When the shared Codex server is connected and the root chat is not observed, the pane is "unmatched". When the server is not available, the pane is "not observed".
- A Codex root chat with the native status `notLoaded` while the pane still names it: the chat identifier is "stale" (the pane left this chat, for example after `/clear`). Its descendants are not shown under the pane.
- The observations that no pane claims stay in the list `unmatchedObservations`. They are never drawn as a link.

## Separate facts

Each coding agent and each subagent keeps four separate facts:

1. The native runtime status, exactly as its source writes it (Herdr, the Claude Code observer mod, or the shared Codex server), with the Codex active flags.
2. The outcome of the last turn or of the run: completed, failed, killed, interrupted, in progress, or unknown.
3. The pending attention: each question and each approval that waits, with its requester. When a subagent asks, the context of the reviewer gives the parent node and the role of the requester.
4. The freshness of the observation: fresh, stale, not observed, or unmatched.

A wait is not always a request for the developer. A typed Claude Code request asks the developer (`required`). A Codex flag `waitingOnApproval` alone does not say who answers, because an automatic reviewer can answer it (`unknown`). A Codex flag `waitingOnUserInput` asks the developer.

## Visible statuses

The four visible statuses are Working, Blocked, Finished, and Idle. The status `unknown` is shown when the facts do not give one.

- Coding agent: the status of Herdr stays the main source. `working` is Working, `blocked` is Blocked, `done` is Finished, `idle` is Idle, and `unknown` stays unknown. The observations add the subagents and the pending attention, and do not change this status.
- Claude Code subagent: `running` is Working, or Blocked when one of its requests waits. `completed`, `failed`, and `killed` are Finished, and the outcome keeps failed or killed. `unknown` stays unknown.
- Codex child chat: `active` is Working, or Blocked with the flag `waitingOnApproval` or `waitingOnUserInput`. `idle` or `notLoaded` after a completed or failed turn is Finished. `idle` with no turn or after an interrupted turn is Idle. A completed child that becomes idle is never a failure. `systemError` and `unknown` are unknown.
- A stale observation gives unknown to a subagent, and keeps its native status as a fact.
- An observation is stale when the collector says so, or when it is older than 10 seconds (the collector sends one every 2 seconds).
- Each node has a list of notices so that the visible status never hides a fact: `failed`, `killed`, `interrupted`, `system_error`, `unknown_status`, `stale`, `stale_chat`, `not_observed`, `unmatched`, `children_truncated`, and `parent_not_observed`.

## Aggregation and coverage

- A tab, a workspace, and Heidrun take the first status found among their coding agents and subagents, in this order: Blocked, Working, Finished, Idle. An unknown status does not win over a known status. A group with items and no known status is unknown. An empty group is Idle.
- Each group also has a coverage: the number of items, and how many are unknown, stale, unmatched, or not observed. A view shows the coverage next to the status, so that an incomplete observation stays visible.

## Counters

- The counters count the coding agents and the subagents separately, by visible status, with a total.
- Each node counts once, by its node identifier.
- The counters use the whole model, and never the active filter.

## Messages

- A message record keeps its identifier, the sender and the destination, the time, the delivery (`queued`, `received`, `failed`, or `unknown`), and whether the text is available. Queued does not prove that the destination read the message.
- A message identifier is unique in its session or chat, so the record identifier holds the source, the session or chat, and the message identifier. Two records with the same identifier make one record, with the latest step of the delivery.
- An end links to a node only through an explicit identifier: a session identifier, a Codex chat identifier, or a subagent identifier in the same session. An unknown or ambiguous identifier stays explicitly unmatched.
- Codex message text is not available in the tested version: the record keeps the text null and the availability `not_exposed`. Never show an invented text.
- The new messages are the records whose identifier was not seen before. At the first opening of a view, or after a reconnection with no seen identifiers, no message is new, so that old messages are never shown as new.

## Task texts

- The initial instructions of a subagent are labelled `initial_instructions`. The last readable message sent to a node is labelled `last_prompt`.
- Neither text proves the current task. Never call either text the current task.

## Tests

- `pnpm --dir packages/apps/web_frontend exec vitest run src/lib/heidrun_code_dashboard` runs the tests of the model: identity, pane moves, split panes, duplicate names, status mapping, runtime and outcome, completion, pending attention, stale and unmatched observations, aggregation, counters, and message deduplication.
- The test fixtures stay in the tests. The application never shows a fixture as a real observation.
