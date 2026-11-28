# Heidrun Code Dashboard source material

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Transferred source material
- Related framing: [Glossary migration sources](README.md)
- Related issue: [issue 1135](https://github.com/heidrun-org/heidrun_code/issues/1135)

Original source `/docs/agents_rules/glossary/heidrun_code_dashboard.md` in the [pinned revision](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db). The headings identify original line numbers. Proposed destinations and inventory notes describe the transfer. Approval of a product rule is recorded with the resulting specification.

### Source line 10

This document gives one short definition for each word of the Heidrun Code Dashboard. The other words of Heidrun Code are in [index.md](source_index.md).

### Source line 12

#### The words

### Source line 14

- Glossary entry: [Heidrun Code Dashboard](../../glossary/heidrun_code_dashboard.md#11-heidrun-code-dashboard).
- Proposed destinations: Glossary, User Interface, Platform Support, System Overview.

#### Heidrun Code Dashboard

The view of Heidrun Code that shows Heidrun at the centre, then every workspace, tab, coding agent, and subagent, with its status. It opens from the item "Dashboard" of the More menu, as a modal, in a separate window, or on a device of the local network. Every Heidrun Code Dashboard view uses the same Heidrun Code Dashboard model.

### Source line 18

- Proposed destinations: Glossary, Technical documentation.
- Inventory notes: Check the existing naming decision in issue 996 before recording approved wording.

Write "Heidrun Code Dashboard" in full, with spaces, in every text. The exceptions are the item "Dashboard" of the More menu, and the sidebar and the title of the section "Dashboard" of the Settings window, which the developer chose short ([issue 996](https://github.com/heidrun-org/heidrun_code/issues/996)). The identifier is `heidrun_code_dashboard`. Its former name is "Mire": the code still reads the old saved settings of the Mire once, and nothing else uses this name ([issue 989](https://github.com/heidrun-org/heidrun_code/issues/989)).

### Source line 20

- Glossary entry: [Separate Heidrun Code Dashboard window](../../glossary/heidrun_code_dashboard.md#12-separate-heidrun-code-dashboard-window).
- Proposed destinations: Glossary, User Interface, Behaviour, Technical documentation.

#### Separate Heidrun Code Dashboard window

The Tauri window with the label `heidrun_code_dashboard` that shows the Heidrun Code Dashboard on its own, for a second screen. It opens with the button "Open in a separate window" of the Heidrun Code Dashboard modal. Only one exists at a time.

### Source line 24

- Glossary entry: [Heidrun Code Dashboard on the local network](../../glossary/heidrun_code_dashboard.md#13-heidrun-code-dashboard-on-the-local-network).
- Proposed destinations: Glossary, User Interface, Platform Support, System Overview.

#### Heidrun Code Dashboard on the local network

The Heidrun Code Dashboard shown in the web browser of a phone or a tablet of the same local network, as a second screen, read-only. The option "Show the dashboard on the local network" of the section "Dashboard" of the Settings window turns it on, and the Heidrun Code Dashboard server serves it. The rules are in heidrun_code_dashboard_local_network.md (`/docs/agents_rules/user_interface/heidrun_code_dashboard/heidrun_code_dashboard_local_network.md` in the original documentation).

### Source line 28

- This passage is preserved as repository or technical terminology.
- Proposed destinations: System Overview · Dashboard server and its relationship to the mobile server, Technical documentation.

#### Heidrun Code Dashboard server

The small server of the package `heidrun_code_dashboard_server` that serves the Heidrun Code Dashboard on the local network, behind a pairing key. It is not the mobile server of Heidrun Code Mobile.

### Source line 32

- Glossary entry: [Heidrun Code Dashboard model](../../glossary/heidrun_code_dashboard.md#14-heidrun-code-dashboard-model).
- Proposed destinations: Glossary, System Overview, Technical documentation.

#### Heidrun Code Dashboard model

The data that every Heidrun Code Dashboard view shows: the hierarchy, the facts, the visible statuses, the coverage, and the counters. The code builds it from the Herdr data and the live observations, in the folder `packages/apps/web_frontend/src/lib/heidrun_code_dashboard`.

### Source line 36

- Glossary entry: [Subagent in the Heidrun Code Dashboard](../../glossary/heidrun_code_dashboard.md#15-subagent-in-the-heidrun-code-dashboard).
- Proposed destinations: Glossary.
- Inventory notes: Keep the running dashboard concept distinct from the configured Subagent.

#### Subagent in the Heidrun Code Dashboard

One running Claude Code subagent, or one Codex child chat. It is not the configuration file that the word "Subagent" of [coding_agent_configuration.md](coding_agent_configuration.md) names.

### Source line 40

- Glossary entry: [Live observation](../../glossary/heidrun_code_dashboard.md#16-live-observation).
- Proposed destinations: Glossary, System Overview.

#### Live observation

What the Claude Code observer mod and the shared Codex server tell about a coding agent and its subagents: native statuses, pending questions and approvals, and messages. The collector of the desktop application reads them while a Heidrun Code Dashboard view is open.

### Source line 44

- Glossary entry: [Visible status](../../glossary/heidrun_code_dashboard.md#17-visible-status).
- Proposed destinations: Glossary, Behaviour.

#### Visible status

One of the four statuses that the Heidrun Code Dashboard shows: Working, Blocked, Finished, or Idle, and "unknown" when the facts give none.

### Source line 48

- Glossary entry: [Freshness](../../glossary/heidrun_code_dashboard.md#18-freshness).
- Proposed destinations: Glossary, Behaviour.

#### Freshness

How fresh the live observation of a coding agent or a subagent is: fresh, stale, not observed, or unmatched. "Unmatched" means that no explicit identifier links the pane to its observation.

### Source line 52

- Glossary entry: [Coverage](../../glossary/heidrun_code_dashboard.md#19-coverage).
- Proposed destinations: Glossary · Dashboard coverage, Behaviour.
- Inventory notes: Distinguish the product term from Symbiospec Coverage.

#### Coverage

The number of items of a tab, a workspace, or the whole Heidrun Code Dashboard, with how many are unknown, stale, unmatched, or not observed.

### Source line 56

- Glossary entry: [Pending attention](../../glossary/heidrun_code_dashboard.md#110-pending-attention).
- Proposed destinations: Glossary, Behaviour.

#### Pending attention

A question or an approval that waits for an answer, with the requester. A pending attention does not always need the developer: an automatic reviewer can answer an approval of Codex.

### Source line 60

#### Rules

### Source line 62

- Proposed destinations: Glossary, Technical documentation.

- In the Heidrun Code Dashboard, the word "subagent" means a running subagent. Never use the data layer table `subagents` as the list of running subagents.
