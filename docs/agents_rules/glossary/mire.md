# Glossary of Heidrun Code: Mire

- Created: 30 October 2026
- Last updated: 30 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md), [Mire data and statuses](../user_interface/mire/mire_data_and_statuses.md)
- Related issue: [issue 968](https://github.com/heidrun-org/heidrun_code/issues/968)

This document gives one short definition for each word of the Mire. The other words of Heidrun Code are in [index.md](index.md).

## The words

### Mire

The view of Heidrun Code that shows Heidrun at the centre, then every workspace, tab, coding agent, and subagent, with its status. It opens from the item "Mire" of the More menu, as a modal, in a separate window, or on a device of the local network. Every Mire view uses the same Mire model.

### Separate Mire window

The Tauri window with the label `mire` that shows the Mire on its own, for a second screen. It opens with the button "Open in a separate window" of the Mire modal. Only one exists at a time.

### Mire on the local network

The Mire shown in the web browser of a phone or a tablet of the same local network, as a second screen, read-only. The option "Show the Mire on the local network" of the section "Mire" of the Settings window turns it on, and the Mire server serves it. The rules are in [mire_local_network.md](../user_interface/mire/mire_local_network.md).

### Mire server

The small server of the package `mire_server` that serves the Mire on the local network, behind a pairing key. It is not the mobile server of Heidrun Code Mobile.

### Mire model

The data that every Mire view shows: the hierarchy, the facts, the visible statuses, the coverage, and the counters. The code builds it from the Herdr data and the live observations, in the folder `packages/apps/web_frontend/src/lib/mire`.

### Subagent in the Mire

One running Claude Code subagent, or one Codex child chat. It is not the configuration file that the word "Subagent" of [coding_agent_configuration.md](coding_agent_configuration.md) names.

### Live observation

What the Claude Code observer mod and the shared Codex server tell about a coding agent and its subagents: native statuses, pending questions and approvals, and messages. The collector of the desktop application reads them while a Mire view is open.

### Visible status

One of the four statuses that the Mire shows: Working, Blocked, Finished, or Idle, and "unknown" when the facts give none.

### Freshness

How fresh the live observation of a coding agent or a subagent is: fresh, stale, not observed, or unmatched. "Unmatched" means that no explicit identifier links the pane to its observation.

### Coverage

The number of items of a tab, a workspace, or the whole Mire, with how many are unknown, stale, unmatched, or not observed.

### Pending attention

A question or an approval that waits for an answer, with the requester. A pending attention does not always need the developer: an automatic reviewer can answer an approval of Codex.

## Rules

- In the Mire, the word "subagent" means a running subagent. Never use the data layer table `subagents` as the list of running subagents.
