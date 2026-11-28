# Glossary migration inventory

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Proposal for joint review
- Related framing: [Heidrun Code Symbiospec](../README.md)
- Related issue: [issue 1127](https://github.com/heidrun-org/heidrun_code/issues/1127)

## 0. Introduction

### 0.1. Scope

This proposal inventories the [pinned /docs/agents_rules/glossary](glossary_migration_sources/index.md) for the [migration draft](https://github.com/heidrun-org/heidrun_code/issues/1124#issuecomment-7239190010). It covers 161 named entries across 20 topic files and includes the terminology rules and other substantive passages. The source [overview](glossary_migration_sources/source_overview.md) and [index](glossary_migration_sources/source_index.md) provide navigation and terminology guidance. The [Symbiospec Glossary index](../glossary/index.md) is the destination for definitions.

### 0.2. How to read the inventory

Each topic lists clear Glossary matches first. Mixed entries have separate rows for each proposed destination. Multiple rows can link to the same source paragraph. A dash means this pass identified no specific question for that row. The proposed destination describes where the passage belongs. Product approval still depends on its evidence and the joint review. Repository rules and technical documentation remain proposed destinations until their maintained homes are agreed.

## 1. Questions for the joint review

| Question | Evidence and proposed treatment |
| --- | --- |
| How should the glossary distinguish different meanings of **Action**? | [Guards](glossary_migration_sources/guards.md#source-line-24) uses Action for a guard result. [User activity](glossary_migration_sources/user_activity.md#source-line-18) uses Action for an input event. [Sidebars](glossary_migration_sources/sidebars.md#source-line-61) restricts the word more broadly. Preserve the source labels while reviewing whether qualified terms are needed. |
| What should **Information card** mean across the product? | [Status bar](glossary_migration_sources/status_bar.md#source-line-26) describes a card opened by clicking. [Terminal text detection](glossary_migration_sources/terminal_text_detection.md#source-line-22) describes a card shown on hover. [Card tests](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/packages/apps/web_frontend/src/components/InformationCard.test.ts#L38-L42) and [terminal placement tests](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/packages/apps/web_frontend/src/components/InformationCard.test.ts#L261) give separate evidence. Review whether the term should have an umbrella definition and named variants. |
| Should the two uses of **Slot** share a definition? | [Work of one person](glossary_migration_sources/person_work.md#source-line-58) and [User activity](glossary_migration_sources/user_activity.md#source-line-52) both use time bins, with different lengths and aggregation rules. Keep those rules in Behaviour even if the term is shared. |
| Which wording for **Pane** covers **File view pane** and **Diff pane**? | [Pane](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-38), [File view pane](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-42), and [Diff pane](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-46) use the word for both a terminal and views occupying the same place. Confirm the general definition and preserve the specialized terms. |
| Which Text detection terms remain current? | Use the [pinned terminal text detection glossary](glossary_migration_sources/terminal_text_detection.md#source-line-10). The [main snapshot checked for this inventory](https://github.com/heidrun-org/heidrun_code/commit/0c193f8460b5b13e7fb1998e43807eff48c99d45) described more detection families and a different Settings window. Use it only as historical context when those differences are reviewed. |
| Which date ranges belong in Work of one person averages? | [Average per day](glossary_migration_sources/person_work.md#source-line-70) mentions seven and thirty days. [The implementation tests](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/packages/apps/web_frontend/src/components/PersonWorkTab.test.ts#L482-L490) also exercise three and fourteen days. Review the expected behavior before carrying over the old wording. |
| What should the glossary say about filesystem and Source control views? | The [File explorer rule](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db) describes disk reads for ignored folders and symbolic links, while the [Source control tests](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/packages/apps/web_frontend/src/components/SourceControlPanel.test.ts#L165-L179) exercise Tree view. Review these alongside the [sidebar definitions](glossary_migration_sources/sidebars.md#source-line-38) before carrying over layout or scope claims. |
| Which Macro passages are ready for Glossary review? | The names and relationships are direct matches. Placement and presentation belong in User Interface and Styling. [Macro menu tests](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/packages/apps/web_frontend/src/components/MacroMenu.test.ts#L270-L278) exercise Shift-click insertion. Use that evidence for Behaviour while tracking approval separately. |

## 2. Inventory by source topic

### 2.1. Chats

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Chat](glossary_migration_sources/chats.md#source-line-14) | Glossary | — |
| [Chat — Workspace attribution and descendant worktrees in AI cost](glossary_migration_sources/chats.md#source-line-14) | Behaviour | — |
| [Chat — Coding-agent session storage](glossary_migration_sources/chats.md#source-line-14) | Technical documentation | — |
| [Chat session](glossary_migration_sources/chats.md#source-line-18) | Glossary · Alias for Chat | Use one product definition for Chat and confirm where the technical alias belongs. |
| [Chat session — Package and table terminology](glossary_migration_sources/chats.md#source-line-18) | Technical documentation | — |
| [Estimated cost of a chat](glossary_migration_sources/chats.md#source-line-22) | Glossary | — |
| [Estimated cost of a chat — Token-price estimate and subscription distinction](glossary_migration_sources/chats.md#source-line-22) | Behaviour | — |
| [Estimated cost of a chat — Dates and messages card](glossary_migration_sources/chats.md#source-line-22) | User Interface | — |
| [Past chats sidebar section](glossary_migration_sources/chats.md#source-line-26) | Glossary | — |
| [Past chats sidebar section — Header, list, sort and view controls](glossary_migration_sources/chats.md#source-line-26) | User Interface | — |
| [Past chats sidebar section — Workspace filtering, summary length and list expansion](glossary_migration_sources/chats.md#source-line-26) | Behaviour | — |
| [Chats sort dropdown menu](glossary_migration_sources/chats.md#source-line-30) | Glossary | — |
| [Chats sort dropdown menu — Sort and Order controls, labels and position](glossary_migration_sources/chats.md#source-line-30) | User Interface | — |
| [Chats sort dropdown menu — Sort keys and direction](glossary_migration_sources/chats.md#source-line-30) | Behaviour | — |
| [Chat and Pane naming boundary](glossary_migration_sources/chats.md#source-line-36) | Glossary | Cross-link the source definitions instead of creating a second Chat entry. |

### 2.2. Code hosting

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Saved search terminology](glossary_migration_sources/code_hosting.md#source-line-51) | Glossary | — |
| [Search field terminology](glossary_migration_sources/code_hosting.md#source-line-52) | Glossary | — |
| [Search line terminology](glossary_migration_sources/code_hosting.md#source-line-53) | Glossary | — |
| [Merge window and merge bar terminology](glossary_migration_sources/code_hosting.md#source-line-54) | Glossary | — |
| [Permanent branch terminology and hosting-service distinction](glossary_migration_sources/code_hosting.md#source-line-55) | Glossary | — |
| [Search line](glossary_migration_sources/code_hosting.md#source-line-12) | Glossary | — |
| [Search line — Search field and three buttons for each list](glossary_migration_sources/code_hosting.md#source-line-12) | User Interface | — |
| [Search field](glossary_migration_sources/code_hosting.md#source-line-16) | Glossary | — |
| [Search field — Search field, Enter key and help control](glossary_migration_sources/code_hosting.md#source-line-16) | User Interface | — |
| [Search field — Search results, separate lists and empty search](glossary_migration_sources/code_hosting.md#source-line-16) | Behaviour | — |
| [Search field — GitHub search language and GitLab translation limits](glossary_migration_sources/code_hosting.md#source-line-16) | Platform Support | — |
| [Saved search](glossary_migration_sources/code_hosting.md#source-line-20) | Glossary | — |
| [Saved search — Saved search controls and windows](glossary_migration_sources/code_hosting.md#source-line-20) | User Interface | — |
| [Saved search — Run, list ownership, levels and changes](glossary_migration_sources/code_hosting.md#source-line-20) | Behaviour | — |
| [Saved search — Storage with other options](glossary_migration_sources/code_hosting.md#source-line-20) | Technical documentation | — |
| [Level of a saved search](glossary_migration_sources/code_hosting.md#source-line-24) | Glossary | — |
| [Level of a saved search — Level buttons and tooltip](glossary_migration_sources/code_hosting.md#source-line-24) | User Interface | — |
| [Level of a saved search — Visibility and the default for older saved searches](glossary_migration_sources/code_hosting.md#source-line-24) | Behaviour | — |
| [Approval state](glossary_migration_sources/code_hosting.md#source-line-28) | Glossary | — |
| [Approval state — Displayed approval states and absence of a review requirement](glossary_migration_sources/code_hosting.md#source-line-28) | Behaviour | — |
| [Approval state — GitLab approvals still needed](glossary_migration_sources/code_hosting.md#source-line-28) | Platform Support | — |
| [Merge method](glossary_migration_sources/code_hosting.md#source-line-32) | Glossary | — |
| [Merge method — Selection in the merge window](glossary_migration_sources/code_hosting.md#source-line-32) | User Interface | — |
| [Merge method — GitHub and GitLab merge choices](glossary_migration_sources/code_hosting.md#source-line-32) | Platform Support | — |
| [Merge bar](glossary_migration_sources/code_hosting.md#source-line-36) | Glossary | — |
| [Merge bar — Approval display and Merge button](glossary_migration_sources/code_hosting.md#source-line-36) | User Interface | — |
| [Merge window](glossary_migration_sources/code_hosting.md#source-line-40) | Glossary | — |
| [Merge window — Merge window, fields and confirmation button](glossary_migration_sources/code_hosting.md#source-line-40) | User Interface | — |
| [Merge window — Confirmation before merge](glossary_migration_sources/code_hosting.md#source-line-40) | Behaviour | — |
| [Permanent branch](glossary_migration_sources/code_hosting.md#source-line-44) | Glossary | — |
| [Permanent branch — Permanent branches setting](glossary_migration_sources/code_hosting.md#source-line-44) | User Interface | — |
| [Permanent branch — Branches excluded from deletion](glossary_migration_sources/code_hosting.md#source-line-44) | Behaviour | — |
| [Saved search level terminology](glossary_migration_sources/code_hosting.md#source-line-50) | Glossary | Apply the rule within Code hosting. |

### 2.3. Coding agent configuration

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Coding agent configuration](glossary_migration_sources/coding_agent_configuration.md#source-line-14) | Glossary | — |
| [Coding agent configuration — Package tables and synchronization dates](glossary_migration_sources/coding_agent_configuration.md#source-line-14) | Technical documentation | — |
| [Memory file](glossary_migration_sources/coding_agent_configuration.md#source-line-18) | Glossary | Check supported sources in the data layer. The source claim about Codex could refer to collection support or to Codex itself. |
| [Memory file — Claude Code memory paths, types, metadata and index](glossary_migration_sources/coding_agent_configuration.md#source-line-18) | Technical documentation | — |
| [Memory file — Product support for reading memory by coding agent](glossary_migration_sources/coding_agent_configuration.md#source-line-18) | Platform Support | — |
| [Subagent](glossary_migration_sources/coding_agent_configuration.md#source-line-22) | Glossary | Distinguish configured Subagent from a running Subagent in the Heidrun Code Dashboard. |
| [Subagent — Claude Code configuration file and discovery path](glossary_migration_sources/coding_agent_configuration.md#source-line-22) | Technical documentation | — |
| [Skill](glossary_migration_sources/coding_agent_configuration.md#source-line-26) | Glossary | — |
| [Skill — Skill discovery paths and scope identifiers](glossary_migration_sources/coding_agent_configuration.md#source-line-26) | Technical documentation | — |
| [Skill — Agent-specific skill discovery support](glossary_migration_sources/coding_agent_configuration.md#source-line-26) | Platform Support | — |
| [Removed configuration item](glossary_migration_sources/coding_agent_configuration.md#source-line-30) | Glossary | — |
| [Removed configuration item — Meaning of the observed removal date](glossary_migration_sources/coding_agent_configuration.md#source-line-30) | Behaviour | — |
| [Removed configuration item — Removed-row representation and removedAt field](glossary_migration_sources/coding_agent_configuration.md#source-line-30) | Technical documentation | — |

### 2.4. Dynamic topics

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Dynamic topic bar terminology](glossary_migration_sources/dynamic_topics.md#source-line-42) | Glossary | — |
| [Dynamic topic source information terminology](glossary_migration_sources/dynamic_topics.md#source-line-43) | Glossary | — |
| [Raw dynamic topic, clustered dynamic topic and translation table terminology](glossary_migration_sources/dynamic_topics.md#source-line-44) | Glossary | — |
| [Dynamic topic](glossary_migration_sources/dynamic_topics.md#source-line-12) | Glossary | — |
| [Dynamic topic — Counts, automatic computation and off state](glossary_migration_sources/dynamic_topics.md#source-line-12) | Behaviour | — |
| [Dynamic topic — Settings control and display on a chat row](glossary_migration_sources/dynamic_topics.md#source-line-12) | User Interface | — |
| [Raw dynamic topic](glossary_migration_sources/dynamic_topics.md#source-line-16) | Glossary | — |
| [Raw dynamic topic — Method-specific inputs and unmerged topics](glossary_migration_sources/dynamic_topics.md#source-line-16) | Behaviour | — |
| [Raw dynamic topic — Extraction implementation detail](glossary_migration_sources/dynamic_topics.md#source-line-16) | Technical documentation | — |
| [Clustered dynamic topic](glossary_migration_sources/dynamic_topics.md#source-line-20) | Glossary | — |
| [Clustered dynamic topic — Grouping and effect of turning clustering on](glossary_migration_sources/dynamic_topics.md#source-line-20) | Behaviour | — |
| [Clustered dynamic topic — Settings control and displayed topics](glossary_migration_sources/dynamic_topics.md#source-line-20) | User Interface | — |
| [Translation table](glossary_migration_sources/dynamic_topics.md#source-line-24) | Glossary | — |
| [Translation table — When an existing entry changes](glossary_migration_sources/dynamic_topics.md#source-line-24) | Behaviour | — |
| [Translation table — Saved file and batching by coding agent](glossary_migration_sources/dynamic_topics.md#source-line-24) | Technical documentation | — |
| [Dynamic topic source information](glossary_migration_sources/dynamic_topics.md#source-line-28) | Glossary | — |
| [Dynamic topic source information — Included and excluded inputs](glossary_migration_sources/dynamic_topics.md#source-line-28) | Behaviour | — |
| [Dynamic topic extraction](glossary_migration_sources/dynamic_topics.md#source-line-32) | Glossary | — |
| [Dynamic topic extraction — Extraction method control](glossary_migration_sources/dynamic_topics.md#source-line-32) | User Interface | — |
| [Dynamic topic extraction — Inputs and behavior of each method](glossary_migration_sources/dynamic_topics.md#source-line-32) | Behaviour | — |
| [Dynamic topic extraction — Supported installed coding agents](glossary_migration_sources/dynamic_topics.md#source-line-32) | Platform Support | — |
| [Dynamic topic bar](glossary_migration_sources/dynamic_topics.md#source-line-36) | Glossary | — |
| [Dynamic topic bar — Header placement, buttons and horizontal navigation](glossary_migration_sources/dynamic_topics.md#source-line-36) | User Interface | — |
| [Dynamic topic bar — Default selection, ordering and arrow movement](glossary_migration_sources/dynamic_topics.md#source-line-36) | Behaviour | — |

### 2.5. Guards

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Guard](glossary_migration_sources/guards.md#source-line-12) | Glossary | — |
| [Guard — Match, confirmation and blocking](glossary_migration_sources/guards.md#source-line-12) | Behaviour | — |
| [Built-in guard](glossary_migration_sources/guards.md#source-line-16) | Glossary | Check the scope of the label Hardcoded against the official term Built-in guard. |
| [Built-in guard — Built-in action, disabling and edit restrictions](glossary_migration_sources/guards.md#source-line-16) | Behaviour | — |
| [Built-in guard — Labels in the settings and guard window](glossary_migration_sources/guards.md#source-line-16) | User Interface | — |
| [Built-in guard — Keys and saved configuration](glossary_migration_sources/guards.md#source-line-16) | Technical documentation | — |
| [Project guard](glossary_migration_sources/guards.md#source-line-20) | Glossary | — |
| [Project guard — Unique name and match-any condition](glossary_migration_sources/guards.md#source-line-20) | Behaviour | — |
| [Project guard — Project configuration location](glossary_migration_sources/guards.md#source-line-20) | Technical documentation | — |
| [Action](glossary_migration_sources/guards.md#source-line-24) | Glossary | Action also names an input event in User activity. Keep the two meanings separate pending review. |
| [Action — Confirmation and forbid outcomes](glossary_migration_sources/guards.md#source-line-24) | Behaviour | — |
| [Action — Run anyway control where permitted](glossary_migration_sources/guards.md#source-line-24) | User Interface | — |
| [Action — Stored action identifiers](glossary_migration_sources/guards.md#source-line-24) | Technical documentation | — |
| [Line](glossary_migration_sources/guards.md#source-line-28) | Glossary | — |
| [Line — Match conditions and case and whitespace handling](glossary_migration_sources/guards.md#source-line-28) | Behaviour | — |
| [Line — Regular-expression engine](glossary_migration_sources/guards.md#source-line-28) | Technical documentation | — |
| [Guard window](glossary_migration_sources/guards.md#source-line-32) | Glossary | — |
| [Guard window — Add, Edit and Try a command controls](glossary_migration_sources/guards.md#source-line-32) | User Interface | — |
| [Guard window — Built-in guard cannot be saved after editing](glossary_migration_sources/guards.md#source-line-32) | Behaviour | — |
| [Confirmation window](glossary_migration_sources/guards.md#source-line-36) | Glossary | — |
| [Confirmation window — Command details, buttons and navigation to settings](glossary_migration_sources/guards.md#source-line-36) | User Interface | — |
| [Confirmation window — What remains available for a forbidden command](glossary_migration_sources/guards.md#source-line-36) | Behaviour | — |
| [Guards section](glossary_migration_sources/guards.md#source-line-40) | Glossary | — |
| [Guards section — Ordering and settings controls](glossary_migration_sources/guards.md#source-line-40) | User Interface | — |
| [Guards section — Project and built-in guard permissions](glossary_migration_sources/guards.md#source-line-40) | Behaviour | — |
| [Guard terminology](glossary_migration_sources/guards.md#source-line-46) | Glossary | Reconcile the scope of Action with User activity and the terminology rule in Sidebars. |

### 2.6. Heidrun Code Dashboard

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Heidrun Code Dashboard](glossary_migration_sources/heidrun_code_dashboard.md#source-line-14) | Glossary | — |
| [Heidrun Code Dashboard — Menu entry and display modes](glossary_migration_sources/heidrun_code_dashboard.md#source-line-14) | User Interface | — |
| [Heidrun Code Dashboard — Viewing on the local network](glossary_migration_sources/heidrun_code_dashboard.md#source-line-14) | Platform Support | — |
| [Heidrun Code Dashboard — Shared dashboard model](glossary_migration_sources/heidrun_code_dashboard.md#source-line-14) | System Overview | — |
| [Official name, short labels and former name](glossary_migration_sources/heidrun_code_dashboard.md#source-line-18) | Glossary | Check the existing naming decision in issue 996 before recording approved wording. |
| [Official name, short labels and former name — Identifier and migration of former saved settings](glossary_migration_sources/heidrun_code_dashboard.md#source-line-18) | Technical documentation | — |
| [Separate Heidrun Code Dashboard window](glossary_migration_sources/heidrun_code_dashboard.md#source-line-20) | Glossary | — |
| [Separate Heidrun Code Dashboard window — Open in a separate window control](glossary_migration_sources/heidrun_code_dashboard.md#source-line-20) | User Interface | — |
| [Separate Heidrun Code Dashboard window — One window at a time](glossary_migration_sources/heidrun_code_dashboard.md#source-line-20) | Behaviour | — |
| [Separate Heidrun Code Dashboard window — Window label and framework](glossary_migration_sources/heidrun_code_dashboard.md#source-line-20) | Technical documentation | — |
| [Heidrun Code Dashboard on the local network](glossary_migration_sources/heidrun_code_dashboard.md#source-line-24) | Glossary | — |
| [Heidrun Code Dashboard on the local network — Setting for viewing on the local network](glossary_migration_sources/heidrun_code_dashboard.md#source-line-24) | User Interface | — |
| [Heidrun Code Dashboard on the local network — Supported devices and read-only access](glossary_migration_sources/heidrun_code_dashboard.md#source-line-24) | Platform Support | — |
| [Heidrun Code Dashboard on the local network — Server responsibilities](glossary_migration_sources/heidrun_code_dashboard.md#source-line-24) | System Overview | — |
| [Heidrun Code Dashboard server](glossary_migration_sources/heidrun_code_dashboard.md#source-line-28) | System Overview · Dashboard server and its relationship to the mobile server | — |
| [Heidrun Code Dashboard server — Package name and pairing implementation](glossary_migration_sources/heidrun_code_dashboard.md#source-line-28) | Technical documentation | — |
| [Heidrun Code Dashboard model](glossary_migration_sources/heidrun_code_dashboard.md#source-line-32) | Glossary | — |
| [Heidrun Code Dashboard model — Model inputs and shared consumers](glossary_migration_sources/heidrun_code_dashboard.md#source-line-32) | System Overview | — |
| [Heidrun Code Dashboard model — Source folder](glossary_migration_sources/heidrun_code_dashboard.md#source-line-32) | Technical documentation | — |
| [Subagent in the Heidrun Code Dashboard](glossary_migration_sources/heidrun_code_dashboard.md#source-line-36) | Glossary | Keep the running dashboard concept distinct from the configured Subagent. |
| [Live observation](glossary_migration_sources/heidrun_code_dashboard.md#source-line-40) | Glossary | — |
| [Live observation — Observation sources and collector lifetime](glossary_migration_sources/heidrun_code_dashboard.md#source-line-40) | System Overview | — |
| [Visible status](glossary_migration_sources/heidrun_code_dashboard.md#source-line-44) | Glossary | — |
| [Visible status — Status values and what happens when status is unknown](glossary_migration_sources/heidrun_code_dashboard.md#source-line-44) | Behaviour | — |
| [Freshness](glossary_migration_sources/heidrun_code_dashboard.md#source-line-48) | Glossary | — |
| [Freshness — Freshness classes and unmatched condition](glossary_migration_sources/heidrun_code_dashboard.md#source-line-48) | Behaviour | — |
| [Coverage](glossary_migration_sources/heidrun_code_dashboard.md#source-line-52) | Glossary · Dashboard coverage | Distinguish the product term from Symbiospec Coverage. |
| [Coverage — Counts and aggregation scope](glossary_migration_sources/heidrun_code_dashboard.md#source-line-52) | Behaviour | — |
| [Pending attention](glossary_migration_sources/heidrun_code_dashboard.md#source-line-56) | Glossary | — |
| [Pending attention — Pending questions and approvals, including an automatic reviewer](glossary_migration_sources/heidrun_code_dashboard.md#source-line-56) | Behaviour | — |
| [Running subagent terminology](glossary_migration_sources/heidrun_code_dashboard.md#source-line-62) | Glossary | — |
| [Running subagent terminology — Restriction on using configuration rows for live status](glossary_migration_sources/heidrun_code_dashboard.md#source-line-62) | Technical documentation | — |

### 2.7. Heidrun Code Mobile

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Heidrun Code Mobile terminology](glossary_migration_sources/heidrun_code_mobile.md#source-line-46) | Glossary | — |
| [Heidrun Code Mobile](glossary_migration_sources/heidrun_code_mobile.md#source-line-12) | Glossary | — |
| [Heidrun Code Mobile — Relationship between mobile website and desktop application](glossary_migration_sources/heidrun_code_mobile.md#source-line-12) | System Overview | — |
| [Heidrun Code Mobile — Phone access](glossary_migration_sources/heidrun_code_mobile.md#source-line-12) | Platform Support | — |
| [Mobile website](glossary_migration_sources/heidrun_code_mobile.md#source-line-16) | Glossary | — |
| [Mobile website — Mobile website communicates through the mobile server](glossary_migration_sources/heidrun_code_mobile.md#source-line-16) | System Overview | — |
| [Mobile website — Package path](glossary_migration_sources/heidrun_code_mobile.md#source-line-16) | Technical documentation | — |
| [Mobile server](glossary_migration_sources/heidrun_code_mobile.md#source-line-20) | System Overview · Server responsibilities | — |
| [Mobile server — Pairing and allowed-method requirements](glossary_migration_sources/heidrun_code_mobile.md#source-line-20) | Behaviour | — |
| [Mobile server — Library and package](glossary_migration_sources/heidrun_code_mobile.md#source-line-20) | Technical documentation | — |
| [Pairing key](glossary_migration_sources/heidrun_code_mobile.md#source-line-24) | Glossary | — |
| [Pairing key — Pairing code as the way the phone receives the key](glossary_migration_sources/heidrun_code_mobile.md#source-line-24) | User Interface | — |
| [Pairing key — Key required for requests](glossary_migration_sources/heidrun_code_mobile.md#source-line-24) | Behaviour | — |
| [Bottom bar](glossary_migration_sources/heidrun_code_mobile.md#source-line-28) | Glossary | — |
| [Bottom bar — Four bottom-bar controls and order](glossary_migration_sources/heidrun_code_mobile.md#source-line-28) | User Interface | — |
| [Plain terminal on the phone](glossary_migration_sources/heidrun_code_mobile.md#source-line-32) | Glossary | — |
| [Plain terminal on the phone — Terminal badge, output and warning sheet](glossary_migration_sources/heidrun_code_mobile.md#source-line-32) | User Interface | — |
| [Plain terminal on the phone — Typing permission and guard behavior](glossary_migration_sources/heidrun_code_mobile.md#source-line-32) | Behaviour | — |
| [Plain terminal on the phone — Phone-specific access](glossary_migration_sources/heidrun_code_mobile.md#source-line-32) | Platform Support | — |
| [Macro button](glossary_migration_sources/heidrun_code_mobile.md#source-line-36) | Glossary | — |
| [Macro button — Macro button icon and placement](glossary_migration_sources/heidrun_code_mobile.md#source-line-36) | User Interface | — |
| [Macro button — Selecting a macro writes to the prompt field](glossary_migration_sources/heidrun_code_mobile.md#source-line-36) | Behaviour | — |
| [Microphone button](glossary_migration_sources/heidrun_code_mobile.md#source-line-40) | Glossary | Keep distinct from the desktop push-to-talk button. |
| [Microphone button — Microphone button placement](glossary_migration_sources/heidrun_code_mobile.md#source-line-40) | User Interface | — |
| [Microphone button — Start, write to the prompt field, and stop](glossary_migration_sources/heidrun_code_mobile.md#source-line-40) | Behaviour | — |
| [Microphone button — Phone speech recognition](glossary_migration_sources/heidrun_code_mobile.md#source-line-40) | Platform Support | — |
| [Device terminology](glossary_migration_sources/heidrun_code_mobile.md#source-line-47) | Glossary | Preserve the source terminology guidance and review where the rule should apply. |

### 2.8. Heidrun names

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Heidrun Organization](glossary_migration_sources/heidrun_names.md#source-line-12) | Glossary | — |
| [Former name](glossary_migration_sources/heidrun_names.md#source-line-32) | Glossary · Former names and allowed historical use | — |
| [Former Heidrun Code name](glossary_migration_sources/heidrun_names.md#source-line-36) | Glossary | — |
| [Former Heidrun Code Mobile name](glossary_migration_sources/heidrun_names.md#source-line-37) | Glossary | — |
| [Former Heidrun Code Development name](glossary_migration_sources/heidrun_names.md#source-line-38) | Glossary | — |
| [Heidrun Code](glossary_migration_sources/heidrun_names.md#source-line-16) | Glossary · Current identity and former name | — |
| [Heidrun Code — Repository identifier](glossary_migration_sources/heidrun_names.md#source-line-16) | Technical documentation | — |
| [Heidrun Notebook](glossary_migration_sources/heidrun_names.md#source-line-20) | Glossary · Related product identity | — |
| [Heidrun Notebook — Identifier and repository location](glossary_migration_sources/heidrun_names.md#source-line-20) | Technical documentation | — |
| [Official name](glossary_migration_sources/heidrun_names.md#source-line-24) | Glossary · Official-name convention | Keep the product naming rule consistent with AGENTS.md. |
| [Identifier](glossary_migration_sources/heidrun_names.md#source-line-28) | Glossary · Meaning of Identifier | — |
| [Identifier — Machine naming convention and macOS bundle identifier](glossary_migration_sources/heidrun_names.md#source-line-28) | Technical documentation | — |
| [Former control command name](glossary_migration_sources/heidrun_names.md#source-line-39) | Technical documentation | — |
| [Data package and command rename history](glossary_migration_sources/heidrun_names.md#source-line-40) | Technical documentation | — |
| [Environment variable compatibility](glossary_migration_sources/heidrun_names.md#source-line-41) | Technical documentation | — |
| [First-start data-folder migration](glossary_migration_sources/heidrun_names.md#source-line-42) | Behaviour | — |
| [First-start data-folder migration — Former and current data-folder paths](glossary_migration_sources/heidrun_names.md#source-line-42) | Technical documentation | — |
| [Installed application and bundle identifier history](glossary_migration_sources/heidrun_names.md#source-line-43) | Technical documentation | — |
| [Persisted name](glossary_migration_sources/heidrun_names.md#source-line-45) | Glossary · Meaning of Persisted name | — |
| [Persisted name — Compatibility and project-history preservation policy](glossary_migration_sources/heidrun_names.md#source-line-45) | Technical documentation | — |
| [Persisted Herdr session names](glossary_migration_sources/heidrun_names.md#source-line-49) | Technical documentation | — |
| [Persisted web-view storage prefix](glossary_migration_sources/heidrun_names.md#source-line-50) | Technical documentation | — |
| [Persisted project folder and origin file](glossary_migration_sources/heidrun_names.md#source-line-51) | Technical documentation | — |
| [Persisted file view pane label](glossary_migration_sources/heidrun_names.md#source-line-52) | Technical documentation | — |
| [Persisted stash text](glossary_migration_sources/heidrun_names.md#source-line-53) | Technical documentation | — |
| [Persisted skill cache folder](glossary_migration_sources/heidrun_names.md#source-line-54) | Technical documentation | — |
| [Preserved image names and labels](glossary_migration_sources/heidrun_names.md#source-line-55) | Technical documentation | — |
| [Persisted code-hosting repository key](glossary_migration_sources/heidrun_names.md#source-line-56) | Technical documentation | — |
| [Preserved organization and asset identities](glossary_migration_sources/heidrun_names.md#source-line-57) | Technical documentation | — |

### 2.9. Issue Fix Workflow

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Issue Fix Workflow](glossary_migration_sources/issue_fix_workflow.md#source-line-14) | Repository rules · Issue Fix Workflow and its four parts | — |
| [Issue Fix Setup](glossary_migration_sources/issue_fix_workflow.md#source-line-18) | Repository rules | — |
| [Issue Fix Implementation](glossary_migration_sources/issue_fix_workflow.md#source-line-22) | Repository rules | — |
| [Issue Fix Review](glossary_migration_sources/issue_fix_workflow.md#source-line-26) | Repository rules | — |
| [Issue Fix Completion](glossary_migration_sources/issue_fix_workflow.md#source-line-30) | Repository rules | — |
| [Added request](glossary_migration_sources/issue_fix_workflow.md#source-line-36) | Repository rules · Added request and the two types | — |
| [Related added request](glossary_migration_sources/issue_fix_workflow.md#source-line-40) | Repository rules | — |
| [Unrelated added request](glossary_migration_sources/issue_fix_workflow.md#source-line-44) | Repository rules | — |
| [Added request terminology](glossary_migration_sources/issue_fix_workflow.md#source-line-50) | Repository rules | — |
| [Full names of the Issue Fix Workflow parts](glossary_migration_sources/issue_fix_workflow.md#source-line-51) | Repository rules | — |

### 2.10. Macros

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Spelling of heidrun_code_ctrl](glossary_migration_sources/macros.md#source-line-39) | Glossary | — |
| [Macro and Launcher naming boundary](glossary_migration_sources/macros.md#source-line-40) | Glossary | — |
| [Macro](glossary_migration_sources/macros.md#source-line-14) | Glossary · Reusable text and user and project relationships | — |
| [Macro — Insertion into a pane](glossary_migration_sources/macros.md#source-line-14) | Behaviour | — |
| [User macro](glossary_migration_sources/macros.md#source-line-18) | Glossary · User macro scope | — |
| [User macro — User macro storage reference](glossary_migration_sources/macros.md#source-line-18) | Technical documentation | — |
| [User macro file](glossary_migration_sources/macros.md#source-line-22) | Technical documentation · User macro file, paths, format and readers and writers | — |
| [Project macro](glossary_migration_sources/macros.md#source-line-26) | Glossary · Project macro scope and sharing | — |
| [Project macro — Project file and persisted key](glossary_migration_sources/macros.md#source-line-26) | Technical documentation | — |
| [heidrun_code_ctrl](glossary_migration_sources/macros.md#source-line-32) | Glossary · Purpose of heidrun_code_ctrl | — |
| [heidrun_code_ctrl — Relationship to the desktop application and Herdr](glossary_migration_sources/macros.md#source-line-32) | System Overview | — |
| [heidrun_code_ctrl — Command groups, executable and watched files](glossary_migration_sources/macros.md#source-line-32) | Technical documentation | — |
| [User macro and Project macro terminology](glossary_migration_sources/macros.md#source-line-38) | Glossary | — |
| [User macro and Project macro terminology — Persisted personal identifier](glossary_migration_sources/macros.md#source-line-38) | Technical documentation | — |
| [Macro row and View, Edit and Delete controls](glossary_migration_sources/macros.md#source-line-42) | User Interface | — |
| [Macro row and View, Edit and Delete controls — View contents, confirmation, cancellation and no insertion](glossary_migration_sources/macros.md#source-line-42) | Behaviour | — |
| [Action placement and title wrapping](glossary_migration_sources/macros.md#source-line-43) | User Interface | — |
| [Action placement and title wrapping — Menu dimensions and borderless icon buttons](glossary_migration_sources/macros.md#source-line-43) | Styling | — |
| [Create, Edit and Save forms and action placement](glossary_migration_sources/macros.md#source-line-44) | User Interface | — |
| [Create, Edit and Save forms and action placement — Blank or prefilled form, saving and closing](glossary_migration_sources/macros.md#source-line-44) | Behaviour | — |
| [Insertion and Shift+click behavior](glossary_migration_sources/macros.md#source-line-45) | Behaviour | Implementation and test references support checking this passage. Record approval separately. |
| [Description field and Content label](glossary_migration_sources/macros.md#source-line-47) | User Interface | — |
| [Description field and Content label — Multiline Markdown preservation and first-line display](glossary_migration_sources/macros.md#source-line-47) | Behaviour | — |
| [Location control and placement](glossary_migration_sources/macros.md#source-line-49) | User Interface | — |
| [Location control and placement — Move between User and Project while preserving identity and content](glossary_migration_sources/macros.md#source-line-49) | Behaviour | — |
| [Project macro and User macro headings](glossary_migration_sources/macros.md#source-line-51) | User Interface | — |
| [Project macro and User macro headings — Heading visibility for nonempty groups](glossary_migration_sources/macros.md#source-line-51) | Behaviour | — |

### 2.11. Pane focus history

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Pane focus history, Back button and Forward button terminology](glossary_migration_sources/pane_focus_history.md#source-line-30) | Glossary | — |
| [Top bar](glossary_migration_sources/pane_focus_history.md#source-line-12) | Glossary | — |
| [Top bar — Top bar controls, order and workspace name](glossary_migration_sources/pane_focus_history.md#source-line-12) | User Interface | — |
| [Pane focus history](glossary_migration_sources/pane_focus_history.md#source-line-16) | Glossary | — |
| [Pane focus history — Shared order across workspaces and tabs, moves and long press](glossary_migration_sources/pane_focus_history.md#source-line-16) | Behaviour | — |
| [Pane focus history — Back and Forward history controls](glossary_migration_sources/pane_focus_history.md#source-line-16) | User Interface | — |
| [Back button](glossary_migration_sources/pane_focus_history.md#source-line-20) | Glossary | — |
| [Back button — Back button placement and arrow](glossary_migration_sources/pane_focus_history.md#source-line-20) | User Interface | — |
| [Back button — Focus moves to the previous entry](glossary_migration_sources/pane_focus_history.md#source-line-20) | Behaviour | — |
| [Forward button](glossary_migration_sources/pane_focus_history.md#source-line-24) | Glossary | — |
| [Forward button — Forward button placement and arrow](glossary_migration_sources/pane_focus_history.md#source-line-24) | User Interface | — |
| [Forward button — Focus moves to the next entry](glossary_migration_sources/pane_focus_history.md#source-line-24) | Behaviour | — |
| [Pane definition and focus-history entry boundary](glossary_migration_sources/pane_focus_history.md#source-line-31) | Glossary | Reuse the Pane definition from Workspaces, tabs and panes. |

### 2.12. Work of one person

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Work of one person tab](glossary_migration_sources/person_work.md#source-line-14) | Glossary | — |
| [Work of one person tab — Work of one person tab and its controls](glossary_migration_sources/person_work.md#source-line-14) | User Interface | — |
| [Work of one person tab — What it shows and how it combines workspaces](glossary_migration_sources/person_work.md#source-line-14) | Behaviour | — |
| [Source of the Work of one person tab](glossary_migration_sources/person_work.md#source-line-18) | Glossary | — |
| [Source of the Work of one person tab — Source radio buttons](glossary_migration_sources/person_work.md#source-line-18) | User Interface | — |
| [Source of the Work of one person tab — Default source](glossary_migration_sources/person_work.md#source-line-18) | Behaviour | — |
| [Git history](glossary_migration_sources/person_work.md#source-line-22) | Glossary | — |
| [Git history — Git history contribution counts](glossary_migration_sources/person_work.md#source-line-22) | Behaviour | — |
| [Metric of the Git history](glossary_migration_sources/person_work.md#source-line-26) | Glossary | — |
| [Metric of the Git history — Metric radio buttons and availability](glossary_migration_sources/person_work.md#source-line-26) | User Interface | — |
| [Metric of the Git history — Initial metric and selections preserved when it changes](glossary_migration_sources/person_work.md#source-line-26) | Behaviour | — |
| [AI cost](glossary_migration_sources/person_work.md#source-line-30) | Glossary | Review the difference between AI cost here and Estimated cost of a chat in Past chats. |
| [AI cost — Hidden person chooser and Import the history button](glossary_migration_sources/person_work.md#source-line-30) | User Interface | — |
| [AI cost — Units, supported observations, price and minute attribution](glossary_migration_sources/person_work.md#source-line-30) | Behaviour | — |
| [AI cost — Stored token-usage input](glossary_migration_sources/person_work.md#source-line-30) | Technical documentation | — |
| [Workspace selector of the Work of one person tab](glossary_migration_sources/person_work.md#source-line-34) | Glossary | — |
| [Workspace selector of the Work of one person tab — Workspace controls](glossary_migration_sources/person_work.md#source-line-34) | User Interface | — |
| [Workspace selector of the Work of one person tab — Selection, aggregation and the initial workspace](glossary_migration_sources/person_work.md#source-line-34) | Behaviour | — |
| [Unit of the AI cost](glossary_migration_sources/person_work.md#source-line-38) | Glossary | — |
| [Unit of the AI cost — Unit control and unknown-price message](glossary_migration_sources/person_work.md#source-line-38) | User Interface | — |
| [Unit of the AI cost — Defaults, token units and treatment of unknown prices](glossary_migration_sources/person_work.md#source-line-38) | Behaviour | — |
| [Person](glossary_migration_sources/person_work.md#source-line-42) | Glossary | — |
| [Person — Matching a person across commits and hosted activity](glossary_migration_sources/person_work.md#source-line-42) | Behaviour | — |
| [Person — Identifier normalization and special email handling](glossary_migration_sources/person_work.md#source-line-42) | Technical documentation | — |
| [Person chooser](glossary_migration_sources/person_work.md#source-line-46) | Glossary | — |
| [Person chooser — Person chooser placement and purpose](glossary_migration_sources/person_work.md#source-line-46) | User Interface | — |
| [Person chooser — Eligibility window and ordering](glossary_migration_sources/person_work.md#source-line-46) | Behaviour | — |
| [Time range of the Work of one person tab](glossary_migration_sources/person_work.md#source-line-50) | Glossary | — |
| [Time range of the Work of one person tab — Available ranges and inclusion of today](glossary_migration_sources/person_work.md#source-line-50) | Behaviour | — |
| [Day](glossary_migration_sources/person_work.md#source-line-54) | Glossary | — |
| [Day — Time zone and attribution date](glossary_migration_sources/person_work.md#source-line-54) | Behaviour | — |
| [Slot of the Work of one person tab](glossary_migration_sources/person_work.md#source-line-58) | Glossary | Slot also appears in User activity with a different purpose. Review whether to use a shared definition or qualified terms. |
| [Slot of the Work of one person tab — Slot boundaries and contribution attribution](glossary_migration_sources/person_work.md#source-line-58) | Behaviour | — |
| [Slot length of the Work of one person tab](glossary_migration_sources/person_work.md#source-line-62) | Glossary | Check the phrase both time ranges against the four available ranges. |
| [Slot length of the Work of one person tab — Slot length control](glossary_migration_sources/person_work.md#source-line-62) | User Interface | — |
| [Slot length of the Work of one person tab — Available lengths and default](glossary_migration_sources/person_work.md#source-line-62) | Behaviour | — |
| [Totals](glossary_migration_sources/person_work.md#source-line-66) | Glossary | — |
| [Totals — Totals placement](glossary_migration_sources/person_work.md#source-line-66) | User Interface | — |
| [Totals — Counts, binary-file treatment and totals by source](glossary_migration_sources/person_work.md#source-line-66) | Behaviour | — |
| [Average per day](glossary_migration_sources/person_work.md#source-line-70) | Glossary | The source says seven or thirty days. Existing tests also cover three and fourteen days. |
| [Average per day — Average display under each total](glossary_migration_sources/person_work.md#source-line-70) | User Interface | — |
| [Average per day — Calculation, rounding example and idle days](glossary_migration_sources/person_work.md#source-line-70) | Behaviour | — |
| [Bar chart of the work of one person](glossary_migration_sources/person_work.md#source-line-74) | Glossary | — |
| [Bar chart of the work of one person — Stacked bar chart, legend and information card](glossary_migration_sources/person_work.md#source-line-74) | User Interface | — |
| [Bar chart of the work of one person — What each stack counts](glossary_migration_sources/person_work.md#source-line-74) | Behaviour | — |
| [Bar chart of the work of one person — Shared chart colors and visual conventions](glossary_migration_sources/person_work.md#source-line-74) | Styling | — |

### 2.13. Sidebars

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Sidebar section and status bar section terminology](glossary_migration_sources/sidebars.md#source-line-60) | Glossary | — |
| [Left sidebar](glossary_migration_sources/sidebars.md#source-line-14) | Glossary | — |
| [Left sidebar — Left sidebar placement](glossary_migration_sources/sidebars.md#source-line-14) | User Interface | — |
| [Right sidebar](glossary_migration_sources/sidebars.md#source-line-18) | Glossary | — |
| [Right sidebar — Right sidebar placement](glossary_migration_sources/sidebars.md#source-line-18) | User Interface | — |
| [Sidebar section](glossary_migration_sources/sidebars.md#source-line-22) | Glossary | — |
| [Sidebar section — One visible sidebar section at a time](glossary_migration_sources/sidebars.md#source-line-22) | Behaviour | — |
| [Clipboard sidebar section](glossary_migration_sources/sidebars.md#source-line-26) | Glossary · Former Notes sidebar section and name Note | — |
| [Clipboard sidebar section — Header, switch, icon and Images of the chat](glossary_migration_sources/sidebars.md#source-line-26) | User Interface | — |
| [Clipboard sidebar section — Scope of notes and images shown](glossary_migration_sources/sidebars.md#source-line-26) | Behaviour | — |
| [Launchers sidebar section](glossary_migration_sources/sidebars.md#source-line-30) | Glossary · Former Scripts sidebar section | — |
| [Launchers sidebar section — Title and import and create buttons](glossary_migration_sources/sidebars.md#source-line-30) | User Interface | — |
| [Launchers sidebar section — Launcher scope for the selected workspace](glossary_migration_sources/sidebars.md#source-line-30) | Behaviour | — |
| [Launcher](glossary_migration_sources/sidebars.md#source-line-34) | Glossary · Launcher purpose, levels and former names | — |
| [Launcher — Visibility, execution in its own tab and import](glossary_migration_sources/sidebars.md#source-line-34) | Behaviour | — |
| [Launcher — Run button and Import launchers window](glossary_migration_sources/sidebars.md#source-line-34) | User Interface | — |
| [Launcher — User and workspace storage](glossary_migration_sources/sidebars.md#source-line-34) | Technical documentation | — |
| [Source control sidebar section](glossary_migration_sources/sidebars.md#source-line-38) | Glossary · Former Git sidebar section | Check the listed layout against the current Source control documentation and implementation. |
| [Source control sidebar section — Header, commit controls and change groups](glossary_migration_sources/sidebars.md#source-line-38) | User Interface | — |
| [Source control sidebar section — Local repository scope](glossary_migration_sources/sidebars.md#source-line-38) | Behaviour | — |
| [Code hosting sidebar section](glossary_migration_sources/sidebars.md#source-line-42) | Glossary | — |
| [Code hosting sidebar section — Lists, row layout and information card](glossary_migration_sources/sidebars.md#source-line-42) | User Interface | — |
| [Code hosting sidebar section — Open items for the selected workspace repository](glossary_migration_sources/sidebars.md#source-line-42) | Behaviour | — |
| [Code hosting sidebar section — Pull request and merge request names by hosting service](glossary_migration_sources/sidebars.md#source-line-42) | Platform Support | — |
| [File explorer sidebar section](glossary_migration_sources/sidebars.md#source-line-46) | Glossary | Check the Git repository wording against the rule that reads from disk. |
| [File explorer sidebar section — Tree, icon, menu and file controls](glossary_migration_sources/sidebars.md#source-line-46) | User Interface | — |
| [File explorer sidebar section — Opening files, ignored items and supported file changes](glossary_migration_sources/sidebars.md#source-line-46) | Behaviour | — |
| [Search in files sidebar section](glossary_migration_sources/sidebars.md#source-line-50) | Glossary | — |
| [Search in files sidebar section — Search options and result presentation](glossary_migration_sources/sidebars.md#source-line-50) | User Interface | — |
| [Search in files sidebar section — Search scope and opening a result at its line](glossary_migration_sources/sidebars.md#source-line-50) | Behaviour | — |
| [Sidebar icon bar](glossary_migration_sources/sidebars.md#source-line-54) | Glossary | — |
| [Sidebar icon bar — Icon placement and collapsed appearance](glossary_migration_sources/sidebars.md#source-line-54) | User Interface | — |
| [Sidebar icon bar — Switching sidebar sections](glossary_migration_sources/sidebars.md#source-line-54) | Behaviour | — |
| [Launcher, Script and Action terminology](glossary_migration_sources/sidebars.md#source-line-61) | Glossary | Reconcile the stated limits on Action with Guards and User activity. |

### 2.14. Statistics charts

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Chart legend](glossary_migration_sources/statistics_charts.md#source-line-14) | Glossary | — |
| [Chart legend — Legend position and stack order](glossary_migration_sources/statistics_charts.md#source-line-14) | User Interface | — |
| [Chart legend — Work of one person legend toggling exception](glossary_migration_sources/statistics_charts.md#source-line-14) | Behaviour | — |
| [Chart information card](glossary_migration_sources/statistics_charts.md#source-line-18) | Glossary | Keep distinct from Information card and Information card tooltip. Review shared card terminology with Terminal text detection. |
| [Chart information card — Hover, content and placement](glossary_migration_sources/statistics_charts.md#source-line-18) | User Interface | — |
| [Chart information card — Opening and closing and no pointer capture](glossary_migration_sources/statistics_charts.md#source-line-18) | Behaviour | — |
| [Chart information card — Card and arrow appearance](glossary_migration_sources/statistics_charts.md#source-line-18) | Styling | — |

### 2.15. Status bar

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Status bar](glossary_migration_sources/status_bar.md#source-line-14) | Glossary | — |
| [Status bar — Bottom-of-window placement](glossary_migration_sources/status_bar.md#source-line-14) | User Interface | — |
| [Status bar section](glossary_migration_sources/status_bar.md#source-line-18) | Glossary | — |
| [Status bar section — Status display and card trigger](glossary_migration_sources/status_bar.md#source-line-18) | User Interface | — |
| [Unspecified Claude quota](glossary_migration_sources/status_bar.md#source-line-22) | Glossary | — |
| [Unspecified Claude quota — Unspecified quota label](glossary_migration_sources/status_bar.md#source-line-22) | User Interface | — |
| [Unspecified Claude quota — Conditions for displaying unknown rather than zero](glossary_migration_sources/status_bar.md#source-line-22) | Behaviour | — |
| [Information card](glossary_migration_sources/status_bar.md#source-line-26) | Glossary | Terminal text detection calls a hover card an Information card. Review whether the glossary needs a shared term with variants. |
| [Information card — Locations, click trigger and controls](glossary_migration_sources/status_bar.md#source-line-26) | User Interface | — |
| [Information card — Close conditions](glossary_migration_sources/status_bar.md#source-line-26) | Behaviour | — |
| [Information card — Hover and open backgrounds](glossary_migration_sources/status_bar.md#source-line-26) | Styling | — |
| [Information card tooltip](glossary_migration_sources/status_bar.md#source-line-30) | Glossary | — |
| [Information card tooltip — Tooltip position and content shape](glossary_migration_sources/status_bar.md#source-line-30) | User Interface | — |
| [Information card tooltip — Delay, focus, dismissal and no pointer capture](glossary_migration_sources/status_bar.md#source-line-30) | Behaviour | — |
| [Information card tooltip — Shared tooltip appearance](glossary_migration_sources/status_bar.md#source-line-30) | Styling | — |
| [Information card tooltip — HTML body placement and attributes](glossary_migration_sources/status_bar.md#source-line-30) | Technical documentation | — |
| [Workspace status bar section](glossary_migration_sources/status_bar.md#source-line-34) | Glossary | — |
| [Workspace status bar section — Workspace status dot, name and actions](glossary_migration_sources/status_bar.md#source-line-34) | User Interface | — |
| [Workspace status bar section — Workspace operations available from the card](glossary_migration_sources/status_bar.md#source-line-34) | Behaviour | — |

### 2.16. Terminal text detection

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Text detection](glossary_migration_sources/terminal_text_detection.md#source-line-10) | Glossary · Settings-section identity | — |
| [Text detection — Text detection settings scope](glossary_migration_sources/terminal_text_detection.md#source-line-10) | User Interface | — |
| [Input image previews](glossary_migration_sources/terminal_text_detection.md#source-line-14) | Glossary | — |
| [Input image previews — Terminal attachment label and hover preview](glossary_migration_sources/terminal_text_detection.md#source-line-14) | User Interface | — |
| [Input image previews — Preview trigger](glossary_migration_sources/terminal_text_detection.md#source-line-14) | Behaviour | — |
| [Terminal reference](glossary_migration_sources/terminal_text_detection.md#source-line-18) | Glossary | — |
| [Terminal reference — Resolving shorthand and full addresses to repositories](glossary_migration_sources/terminal_text_detection.md#source-line-18) | Behaviour | — |
| [Terminal reference — Supported reference types by hosting service](glossary_migration_sources/terminal_text_detection.md#source-line-18) | Platform Support | — |
| [Information card](glossary_migration_sources/terminal_text_detection.md#source-line-22) | Glossary | Review with the click-only Information card definition in Status bar. Compare the pinned Text detection description with the earlier main version before carrying over older terminology. |
| [Information card — Hover card and shared merge controls](glossary_migration_sources/terminal_text_detection.md#source-line-22) | User Interface | — |

### 2.17. Test levels

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Fast tests](glossary_migration_sources/test_levels.md#source-line-14) | Repository rules · Fast tests and their commands | — |
| [Slow tests](glossary_migration_sources/test_levels.md#source-line-18) | Repository rules · Slow tests, when to run them, and classification | — |
| [Full tests](glossary_migration_sources/test_levels.md#source-line-22) | Repository rules · Full tests and the release requirement | — |
| [Test-level terminology](glossary_migration_sources/test_levels.md#source-line-28) | Repository rules | — |
| [Meaning of all the tests and scope of pnpm test](glossary_migration_sources/test_levels.md#source-line-29) | Repository rules | — |

### 2.18. User activity

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [User activity time](glossary_migration_sources/user_activity.md#source-line-14) | Glossary | — |
| [Action](glossary_migration_sources/user_activity.md#source-line-18) | Glossary | Action also names a project guard result. Review both definitions and the Sidebars terminology rule. |
| [Action — Which input events count, including window focus](glossary_migration_sources/user_activity.md#source-line-18) | Behaviour | — |
| [Cool down](glossary_migration_sources/user_activity.md#source-line-22) | Glossary | — |
| [Cool down — Five-second threshold](glossary_migration_sources/user_activity.md#source-line-22) | Behaviour | — |
| [Active period](glossary_migration_sources/user_activity.md#source-line-26) | Glossary | — |
| [Active period — Start, end and workspace rules](glossary_migration_sources/user_activity.md#source-line-26) | Behaviour | — |
| [User activity record](glossary_migration_sources/user_activity.md#source-line-30) | Glossary | — |
| [User activity record — Information excluded from activity records](glossary_migration_sources/user_activity.md#source-line-30) | Behaviour | — |
| [User activity record — Storage path and record format](glossary_migration_sources/user_activity.md#source-line-30) | Technical documentation | — |
| [User activity sidebar section](glossary_migration_sources/user_activity.md#source-line-34) | Glossary | — |
| [User activity sidebar section — Sidebar placement and icon](glossary_migration_sources/user_activity.md#source-line-34) | User Interface | — |
| [User activity sidebar section — Current-day records](glossary_migration_sources/user_activity.md#source-line-34) | Behaviour | — |
| [Statistics window](glossary_migration_sources/user_activity.md#source-line-40) | Glossary | — |
| [Statistics window — More menu entry, title bar and default tab](glossary_migration_sources/user_activity.md#source-line-40) | User Interface | — |
| [User activity tab](glossary_migration_sources/user_activity.md#source-line-44) | Glossary | — |
| [User activity tab — Histogram and selectors](glossary_migration_sources/user_activity.md#source-line-44) | User Interface | — |
| [Histogram of the user activity time](glossary_migration_sources/user_activity.md#source-line-48) | Glossary | — |
| [Histogram of the user activity time — Chart presentation and legend](glossary_migration_sources/user_activity.md#source-line-48) | User Interface | — |
| [Histogram of the user activity time — Workspace contributions and aggregation](glossary_migration_sources/user_activity.md#source-line-48) | Behaviour | — |
| [Slot](glossary_migration_sources/user_activity.md#source-line-52) | Glossary | Compare Slot in Work of one person. Preserve differences in aggregation period and available lengths. |
| [Slot — Available slot lengths, defaults, alignment and incomplete current slot](glossary_migration_sources/user_activity.md#source-line-52) | Behaviour | — |

### 2.19. Voice input

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Voice input, push-to-talk button and level bars terminology](glossary_migration_sources/voice_input.md#source-line-56) | Glossary | — |
| [Mobile Microphone button and desktop push-to-talk button naming boundary](glossary_migration_sources/voice_input.md#source-line-57) | Glossary | — |
| [Replacement list and field terminology](glossary_migration_sources/voice_input.md#source-line-58) | Glossary | — |
| [Voice input](glossary_migration_sources/voice_input.md#source-line-14) | Glossary | — |
| [Voice input — Start and stop controls](glossary_migration_sources/voice_input.md#source-line-14) | User Interface | — |
| [Voice input — Recording boundaries, transcription destination, queue and initial setting](glossary_migration_sources/voice_input.md#source-line-14) | Behaviour | — |
| [Voice input — On-computer speech processing](glossary_migration_sources/voice_input.md#source-line-14) | Platform Support | — |
| [Push-to-talk button](glossary_migration_sources/voice_input.md#source-line-18) | Glossary | — |
| [Push-to-talk button — Composition bar position and button icon](glossary_migration_sources/voice_input.md#source-line-18) | User Interface | — |
| [Push-to-talk button — Long and short press behavior](glossary_migration_sources/voice_input.md#source-line-18) | Behaviour | — |
| [Push-to-talk button — Desktop and phone speech recognition distinction](glossary_migration_sources/voice_input.md#source-line-18) | Platform Support | — |
| [Level bars](glossary_migration_sources/voice_input.md#source-line-22) | Glossary | — |
| [Level bars — Input placement, elapsed time and cancel control](glossary_migration_sources/voice_input.md#source-line-22) | User Interface | — |
| [Level bars — Level, waiting and transcription states](glossary_migration_sources/voice_input.md#source-line-22) | Behaviour | — |
| [Level bars — Dot, wave and state colors](glossary_migration_sources/voice_input.md#source-line-22) | Styling | — |
| [Waiting for transcription](glossary_migration_sources/voice_input.md#source-line-26) | Glossary | — |
| [Waiting for transcription — Transcription queue order](glossary_migration_sources/voice_input.md#source-line-26) | Behaviour | — |
| [Recording icon](glossary_migration_sources/voice_input.md#source-line-30) | Glossary | — |
| [Recording icon — Tab and workspace icons](glossary_migration_sources/voice_input.md#source-line-30) | User Interface | — |
| [Recording icon — When recording status is visible](glossary_migration_sources/voice_input.md#source-line-30) | Behaviour | — |
| [Whisper model](glossary_migration_sources/voice_input.md#source-line-34) | Glossary | Check the stated model count before carrying it into Behaviour. |
| [Whisper model — Model selection and download](glossary_migration_sources/voice_input.md#source-line-34) | Behaviour | — |
| [Whisper model — Engine, model inventory and storage path](glossary_migration_sources/voice_input.md#source-line-34) | Technical documentation | — |
| [Voice input section](glossary_migration_sources/voice_input.md#source-line-38) | Glossary | — |
| [Voice input section — Voice input controls and download state](glossary_migration_sources/voice_input.md#source-line-38) | User Interface | — |
| [Word replacement list](glossary_migration_sources/voice_input.md#source-line-42) | Glossary | — |
| [Word replacement list — Location in settings and field labels](glossary_migration_sources/voice_input.md#source-line-42) | User Interface | — |
| [Word replacement list — Replacement before writing text](glossary_migration_sources/voice_input.md#source-line-42) | Behaviour | — |
| [Word replacement list — File and command-line access](glossary_migration_sources/voice_input.md#source-line-42) | Technical documentation | — |
| [Whisper writes](glossary_migration_sources/voice_input.md#source-line-46) | Glossary | — |
| [Whisper writes — Space preservation and nonempty input](glossary_migration_sources/voice_input.md#source-line-46) | Behaviour | — |
| [Heidrun Code writes instead](glossary_migration_sources/voice_input.md#source-line-50) | Glossary | — |
| [Heidrun Code writes instead — Space preservation and deletion by empty replacement](glossary_migration_sources/voice_input.md#source-line-50) | Behaviour | — |

### 2.20. Workspaces, tabs and panes

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Workspace, Tab and Pane hierarchy](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-14) | Glossary | — |
| [Workspace](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-22) | Glossary | — |
| [Git worktree](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-30) | Glossary | — |
| [Tab naming boundary](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-122) | Glossary | — |
| [Coding agent terminology](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-124) | Glossary | — |
| [Pinned pane and column terminology](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-125) | Glossary | — |
| [Composition bar and Big view terminology](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-126) | Glossary | — |
| [Pane move terminology](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-127) | Glossary | — |
| [Usage wheel terminology](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-128) | Glossary | — |
| [Workspace folder](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-26) | Glossary | — |
| [Workspace folder — Fixed folder, launch directory and selecting another folder](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-26) | Behaviour | — |
| [Workspace folder — Workspace card and status bar association](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-26) | User Interface | — |
| [Tab](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-34) | Glossary | — |
| [Tab — Tab bar representation](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-34) | User Interface | — |
| [Pane](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-38) | Glossary | Check whether terminal describes the underlying implementation or every user-visible Pane, given File view pane and Diff pane. |
| [File view pane](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-42) | Glossary | — |
| [File view pane — Ways to open and save a file in a pane](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-42) | User Interface | — |
| [File view pane — File viewing and editing](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-42) | Behaviour | — |
| [File view pane — Path-bearing label and waiting terminal](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-42) | Technical documentation | — |
| [Diff pane](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-46) | Glossary | — |
| [Diff pane — Opening from Source control](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-46) | User Interface | — |
| [Diff pane — Read-only comparison](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-46) | Behaviour | — |
| [Diff pane — Path-bearing label and waiting terminal](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-46) | Technical documentation | — |
| [Front matter](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-50) | Glossary | — |
| [Front matter — Display behavior and parsing scope](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-50) | Behaviour | — |
| [Front matter card](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-54) | Glossary | — |
| [Front matter card — Card placement in the preview](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-54) | User Interface | — |
| [Coding agent](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-60) | Glossary | Keep the official term and verify the supported list before recording a support expectation. |
| [Coding agent — Supported coding agents](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-60) | Platform Support | — |
| [Tab bar](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-66) | Glossary | — |
| [Tab bar — Tab bar placement and selected workspace](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-66) | User Interface | — |
| [Viewport](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-70) | Glossary | — |
| [Viewport — Viewport placement and contents](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-70) | User Interface | — |
| [Viewport — Viewport border](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-70) | Styling | — |
| [Pinned pane](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-74) | Glossary | — |
| [Pinned pane — Pin control](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-74) | User Interface | — |
| [Pinned pane — Persistence across tabs and workspaces](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-74) | Behaviour | — |
| [Pinned pane — Fixed width across selection changes](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-74) | Styling | — |
| [Column of pinned panes](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-78) | Glossary | — |
| [Column of pinned panes — Pinned pane column position and ordering](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-78) | User Interface | — |
| [Column of pinned panes — Availability across tabs](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-78) | Behaviour | — |
| [Usage wheel](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-84) | Glossary | — |
| [Usage wheel — Usage wheel location, hover and information card](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-84) | User Interface | — |
| [Usage wheel — Usage figures shown in the card](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-84) | Behaviour | — |
| [Usage wheel — Ring and status colors](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-84) | Styling | — |
| [Composition bar](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-88) | Glossary | — |
| [Composition bar — Composition bar layout, controls and opening actions](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-88) | User Interface | — |
| [Composition bar — Send order, draft persistence and initial state](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-88) | Behaviour | — |
| [Big view](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-92) | Glossary | — |
| [Big view — Image preview and previous and next buttons](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-92) | User Interface | — |
| [Zen Mode](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-96) | Glossary | — |
| [Zen Mode — Pane header entry and visible controls](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-96) | User Interface | — |
| [Zen Mode — Temporary visibility of the selected pane](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-96) | Behaviour | — |
| [Dragged pane](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-104) | Glossary | — |
| [Dragged pane — Drag action that identifies the pane](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-104) | User Interface | — |
| [Destination pane](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-108) | Glossary | — |
| [Destination pane — Which pane becomes the destination and where the dragged pane goes](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-108) | Behaviour | — |
| [Drop triangle](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-112) | Glossary | — |
| [Drop triangle — Four drop regions](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-112) | User Interface | — |
| [Drop triangle — Drop side selection](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-112) | Behaviour | — |
| [Move preview](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-116) | Glossary | — |
| [Move preview — Preview location and size](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-116) | User Interface | — |
| [Move preview — Preview visibility before release](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-116) | Behaviour | — |
| [Pane naming boundary](glossary_migration_sources/workspaces_tabs_and_panes.md#source-line-123) | Glossary | Resolve alongside File view pane and Diff pane. |

## 3. Handoff to review

The [transferred source material](glossary_migration_sources/index.md) now preserves the original passages. Inventory links lead to the copied passages and retain the pinned revision as provenance.

Review the clear matches together and the questions individually in [issue 1128](https://github.com/heidrun-org/heidrun_code/issues/1128). Keep the passages routed to other areas visible for later review. Retain the source text in /docs/agents_rules during this step.
