# Glossary of Heidrun Code: Heidrun Code Dashboard

- Created: 30 October 2026
- Last updated: 30 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md), [Heidrun Code Dashboard data and statuses](../user_interface/heidrun_code_dashboard/heidrun_code_dashboard_data_and_statuses.md)
- Related issue: [issue 968](https://github.com/heidrun-org/heidrun_code/issues/968), [issue 989](https://github.com/heidrun-org/heidrun_code/issues/989)

This document gives one short definition for each word of the Heidrun Code Dashboard. The other words of Heidrun Code are in [index.md](index.md).

## The words

### Heidrun Code Dashboard

The view of Heidrun Code that shows Heidrun at the centre, then every workspace, tab, coding agent, and subagent, with its status. It opens from the item "Dashboard" of the More menu, as a modal, in a separate window, or on a device of the local network. Every Heidrun Code Dashboard view uses the same Heidrun Code Dashboard model.

Write "Heidrun Code Dashboard" in full, with spaces, in every text. The one exception is the item "Dashboard" of the More menu, which the developer chose short. The identifier is `heidrun_code_dashboard`. Its former name is "Mire": the code still reads the old saved settings of the Mire once, and nothing else uses this name ([issue 989](https://github.com/heidrun-org/heidrun_code/issues/989)).

### Separate Heidrun Code Dashboard window

The Tauri window with the label `heidrun_code_dashboard` that shows the Heidrun Code Dashboard on its own, for a second screen. It opens with the button "Open in a separate window" of the Heidrun Code Dashboard modal. Only one exists at a time.

### Heidrun Code Dashboard on the local network

The Heidrun Code Dashboard shown in the web browser of a phone or a tablet of the same local network, as a second screen, read-only. The option "Show the dashboard on the local network" of the section "Heidrun Code Dashboard" of the Settings window turns it on, and the Heidrun Code Dashboard server serves it. The rules are in [heidrun_code_dashboard_local_network.md](../user_interface/heidrun_code_dashboard/heidrun_code_dashboard_local_network.md).

### Heidrun Code Dashboard server

The small server of the package `heidrun_code_dashboard_server` that serves the Heidrun Code Dashboard on the local network, behind a pairing key. It is not the mobile server of Heidrun Code Mobile.

### Heidrun Code Dashboard model

The data that every Heidrun Code Dashboard view shows: the hierarchy, the facts, the visible statuses, the coverage, and the counters. The code builds it from the Herdr data and the live observations, in the folder `packages/apps/web_frontend/src/lib/heidrun_code_dashboard`.

### Subagent in the Heidrun Code Dashboard

One running Claude Code subagent, or one Codex child chat. It is not the configuration file that the word "Subagent" of [coding_agent_configuration.md](coding_agent_configuration.md) names.

### Live observation

What the Claude Code observer mod and the shared Codex server tell about a coding agent and its subagents: native statuses, pending questions and approvals, and messages. The collector of the desktop application reads them while a Heidrun Code Dashboard view is open.

### Visible status

One of the four statuses that the Heidrun Code Dashboard shows: Working, Blocked, Finished, or Idle, and "unknown" when the facts give none.

### Freshness

How fresh the live observation of a coding agent or a subagent is: fresh, stale, not observed, or unmatched. "Unmatched" means that no explicit identifier links the pane to its observation.

### Coverage

The number of items of a tab, a workspace, or the whole Heidrun Code Dashboard, with how many are unknown, stale, unmatched, or not observed.

### Pending attention

A question or an approval that waits for an answer, with the requester. A pending attention does not always need the developer: an automatic reviewer can answer an approval of Codex.

## Rules

- In the Heidrun Code Dashboard, the word "subagent" means a running subagent. Never use the data layer table `subagents` as the list of running subagents.
