# Glossary migration inventory

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Proposal for joint review
- Related framing: [Heidrun Code Symbiospec](../README.md)
- Related issue: [issue 1127](https://github.com/heidrun-org/heidrun_code/issues/1127)

## 0. Introduction

### 0.1. Scope

This proposal inventories the [pinned /docs/agents_rules/glossary](https://github.com/heidrun-org/heidrun_code/tree/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary) for the [migration draft](https://github.com/heidrun-org/heidrun_code/issues/1124#issuecomment-7239190010). It covers 161 named entries across 20 topic files and includes the terminology rules and other substantive passages. The source [overview](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/README.md) and [index](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/index.md) provide navigation and terminology guidance. The [Symbiospec Glossary index](../glossary/index.md) is the destination for definitions.

### 0.2. How to read the inventory

Each topic lists clear Glossary matches first. Mixed entries have separate rows for each proposed destination. Multiple rows can link to the same source paragraph. A dash means this pass identified no specific question for that row. The proposed destination describes where the passage belongs. Product approval still depends on its evidence and the joint review. Repository rules and technical documentation remain proposed destinations until their maintained homes are agreed.

## 1. Questions for the joint review

| Question | Evidence and proposed treatment |
| --- | --- |
| How should the glossary distinguish different meanings of **Action**? | [Guards](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L24-L26) uses Action for a guard result. [User activity](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L18-L20) uses Action for an input event. [Sidebars](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L61) restricts the word more broadly. Preserve the source labels while reviewing whether qualified terms are needed. |
| What should **Information card** mean across the product? | [Status bar](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L26-L28) describes a card opened by clicking. [Terminal text detection](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/terminal_text_detection.md#L22-L24) describes a card shown on hover. [Card tests](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/packages/apps/web_frontend/src/components/InformationCard.test.ts#L38-L42) and [terminal placement tests](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/packages/apps/web_frontend/src/components/InformationCard.test.ts#L261) give separate evidence. Review whether the term should have an umbrella definition and named variants. |
| Should the two uses of **Slot** share a definition? | [Work of one person](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L58-L60) and [User activity](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L52-L54) both use time bins, with different lengths and aggregation rules. Keep those rules in Behaviour even if the term is shared. |
| Which wording for **Pane** covers **File view pane** and **Diff pane**? | [Pane](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L38-L40), [File view pane](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L42-L44), and [Diff pane](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L46-L48) use the word for both a terminal and views occupying the same place. Confirm the general definition and preserve the specialized terms. |
| Which Text detection terms remain current? | Use the [pinned terminal text detection glossary](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/terminal_text_detection.md#L10-L24). The [main snapshot checked for this inventory](https://github.com/heidrun-org/heidrun_code/blob/0c193f8460b5b13e7fb1998e43807eff48c99d45/docs/agents_rules/glossary/terminal_text_detection.md) described more detection families and a different Settings window. Use it only as historical context when those differences are reviewed. |
| Which date ranges belong in Work of one person averages? | [Average per day](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L70-L72) mentions seven and thirty days. [The implementation tests](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/packages/apps/web_frontend/src/components/PersonWorkTab.test.ts#L482-L490) also exercise three and fourteen days. Review the expected behavior before carrying over the old wording. |
| What should the glossary say about filesystem and Source control views? | The [File explorer rule](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/user_interface/sidebars/files_folders_read_from_disk.md) describes disk reads for ignored folders and symbolic links, while the [Source control tests](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/packages/apps/web_frontend/src/components/SourceControlPanel.test.ts#L165-L179) exercise Tree view. Review these alongside the [sidebar definitions](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L38-L48) before carrying over layout or scope claims. |
| Which Macro passages are ready for Glossary review? | The names and relationships are direct matches. Placement and presentation belong in User Interface and Styling. [Macro menu tests](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/packages/apps/web_frontend/src/components/MacroMenu.test.ts#L270-L278) exercise Shift-click insertion. Use that evidence for Behaviour while tracking approval separately. |

## 2. Inventory by source topic

### 2.1. Chats

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Chat](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/chats.md#L14-L16) | Glossary | — |
| [Chat — Workspace attribution and descendant worktrees in AI cost](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/chats.md#L14-L16) | Behaviour | — |
| [Chat — Coding-agent session storage](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/chats.md#L14-L16) | Technical documentation | — |
| [Chat session](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/chats.md#L18-L20) | Glossary · Alias for Chat | Use one product definition for Chat and confirm where the technical alias belongs. |
| [Chat session — Package and table terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/chats.md#L18-L20) | Technical documentation | — |
| [Estimated cost of a chat](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/chats.md#L22-L24) | Glossary | — |
| [Estimated cost of a chat — Token-price estimate and subscription distinction](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/chats.md#L22-L24) | Behaviour | — |
| [Estimated cost of a chat — Dates and messages card](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/chats.md#L22-L24) | User Interface | — |
| [Past chats sidebar section](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/chats.md#L26-L28) | Glossary | — |
| [Past chats sidebar section — Header, list, sort and view controls](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/chats.md#L26-L28) | User Interface | — |
| [Past chats sidebar section — Workspace filtering, summary length and list expansion](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/chats.md#L26-L28) | Behaviour | — |
| [Chats sort dropdown menu](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/chats.md#L30-L32) | Glossary | — |
| [Chats sort dropdown menu — Sort and Order controls, labels and position](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/chats.md#L30-L32) | User Interface | — |
| [Chats sort dropdown menu — Sort keys and direction](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/chats.md#L30-L32) | Behaviour | — |
| [Chat and Pane naming boundary](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/chats.md#L36) | Glossary | Cross-link the source definitions instead of creating a second Chat entry. |

### 2.2. Code hosting

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Saved search terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L51) | Glossary | — |
| [Search field terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L52) | Glossary | — |
| [Search line terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L53) | Glossary | — |
| [Merge window and merge bar terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L54) | Glossary | — |
| [Permanent branch terminology and hosting-service distinction](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L55) | Glossary | — |
| [Search line](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L12-L14) | Glossary | — |
| [Search line — Search field and three buttons for each list](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L12-L14) | User Interface | — |
| [Search field](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L16-L18) | Glossary | — |
| [Search field — Search field, Enter key and help control](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L16-L18) | User Interface | — |
| [Search field — Search results, separate lists and empty search](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L16-L18) | Behaviour | — |
| [Search field — GitHub search language and GitLab translation limits](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L16-L18) | Platform Support | — |
| [Saved search](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L20-L22) | Glossary | — |
| [Saved search — Saved search controls and windows](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L20-L22) | User Interface | — |
| [Saved search — Run, list ownership, levels and changes](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L20-L22) | Behaviour | — |
| [Saved search — Storage with other options](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L20-L22) | Technical documentation | — |
| [Level of a saved search](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L24-L26) | Glossary | — |
| [Level of a saved search — Level buttons and tooltip](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L24-L26) | User Interface | — |
| [Level of a saved search — Visibility and the default for older saved searches](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L24-L26) | Behaviour | — |
| [Approval state](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L28-L30) | Glossary | — |
| [Approval state — Displayed approval states and absence of a review requirement](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L28-L30) | Behaviour | — |
| [Approval state — GitLab approvals still needed](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L28-L30) | Platform Support | — |
| [Merge method](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L32-L34) | Glossary | — |
| [Merge method — Selection in the merge window](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L32-L34) | User Interface | — |
| [Merge method — GitHub and GitLab merge choices](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L32-L34) | Platform Support | — |
| [Merge bar](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L36-L38) | Glossary | — |
| [Merge bar — Approval display and Merge button](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L36-L38) | User Interface | — |
| [Merge window](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L40-L42) | Glossary | — |
| [Merge window — Merge window, fields and confirmation button](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L40-L42) | User Interface | — |
| [Merge window — Confirmation before merge](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L40-L42) | Behaviour | — |
| [Permanent branch](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L44-L46) | Glossary | — |
| [Permanent branch — Permanent branches setting](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L44-L46) | User Interface | — |
| [Permanent branch — Branches excluded from deletion](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L44-L46) | Behaviour | — |
| [Saved search level terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/code_hosting.md#L50) | Glossary | Apply the rule within Code hosting. |

### 2.3. Coding agent configuration

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Coding agent configuration](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/coding_agent_configuration.md#L14-L16) | Glossary | — |
| [Coding agent configuration — Package tables and synchronization dates](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/coding_agent_configuration.md#L14-L16) | Technical documentation | — |
| [Memory file](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/coding_agent_configuration.md#L18-L20) | Glossary | Check supported sources in the data layer. The source claim about Codex could refer to collection support or to Codex itself. |
| [Memory file — Claude Code memory paths, types, metadata and index](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/coding_agent_configuration.md#L18-L20) | Technical documentation | — |
| [Memory file — Product support for reading memory by coding agent](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/coding_agent_configuration.md#L18-L20) | Platform Support | — |
| [Subagent](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/coding_agent_configuration.md#L22-L24) | Glossary | Distinguish configured Subagent from a running Subagent in the Heidrun Code Dashboard. |
| [Subagent — Claude Code configuration file and discovery path](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/coding_agent_configuration.md#L22-L24) | Technical documentation | — |
| [Skill](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/coding_agent_configuration.md#L26-L28) | Glossary | — |
| [Skill — Skill discovery paths and scope identifiers](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/coding_agent_configuration.md#L26-L28) | Technical documentation | — |
| [Skill — Agent-specific skill discovery support](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/coding_agent_configuration.md#L26-L28) | Platform Support | — |
| [Removed configuration item](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/coding_agent_configuration.md#L30-L32) | Glossary | — |
| [Removed configuration item — Meaning of the observed removal date](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/coding_agent_configuration.md#L30-L32) | Behaviour | — |
| [Removed configuration item — Removed-row representation and removedAt field](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/coding_agent_configuration.md#L30-L32) | Technical documentation | — |

### 2.4. Dynamic topics

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Dynamic topic bar terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L42) | Glossary | — |
| [Dynamic topic source information terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L43) | Glossary | — |
| [Raw dynamic topic, clustered dynamic topic and translation table terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L44) | Glossary | — |
| [Dynamic topic](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L12-L14) | Glossary | — |
| [Dynamic topic — Counts, automatic computation and off state](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L12-L14) | Behaviour | — |
| [Dynamic topic — Settings control and display on a chat row](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L12-L14) | User Interface | — |
| [Raw dynamic topic](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L16-L18) | Glossary | — |
| [Raw dynamic topic — Method-specific inputs and unmerged topics](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L16-L18) | Behaviour | — |
| [Raw dynamic topic — Extraction implementation detail](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L16-L18) | Technical documentation | — |
| [Clustered dynamic topic](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L20-L22) | Glossary | — |
| [Clustered dynamic topic — Grouping and effect of turning clustering on](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L20-L22) | Behaviour | — |
| [Clustered dynamic topic — Settings control and displayed topics](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L20-L22) | User Interface | — |
| [Translation table](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L24-L26) | Glossary | — |
| [Translation table — When an existing entry changes](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L24-L26) | Behaviour | — |
| [Translation table — Saved file and batching by coding agent](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L24-L26) | Technical documentation | — |
| [Dynamic topic source information](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L28-L30) | Glossary | — |
| [Dynamic topic source information — Included and excluded inputs](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L28-L30) | Behaviour | — |
| [Dynamic topic extraction](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L32-L34) | Glossary | — |
| [Dynamic topic extraction — Extraction method control](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L32-L34) | User Interface | — |
| [Dynamic topic extraction — Inputs and behavior of each method](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L32-L34) | Behaviour | — |
| [Dynamic topic extraction — Supported installed coding agents](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L32-L34) | Platform Support | — |
| [Dynamic topic bar](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L36-L38) | Glossary | — |
| [Dynamic topic bar — Header placement, buttons and horizontal navigation](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L36-L38) | User Interface | — |
| [Dynamic topic bar — Default selection, ordering and arrow movement](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/dynamic_topics.md#L36-L38) | Behaviour | — |

### 2.5. Guards

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Guard](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L12-L14) | Glossary | — |
| [Guard — Match, confirmation and blocking](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L12-L14) | Behaviour | — |
| [Built-in guard](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L16-L18) | Glossary | Check the scope of the label Hardcoded against the official term Built-in guard. |
| [Built-in guard — Built-in action, disabling and edit restrictions](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L16-L18) | Behaviour | — |
| [Built-in guard — Labels in the settings and guard window](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L16-L18) | User Interface | — |
| [Built-in guard — Keys and saved configuration](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L16-L18) | Technical documentation | — |
| [Project guard](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L20-L22) | Glossary | — |
| [Project guard — Unique name and match-any condition](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L20-L22) | Behaviour | — |
| [Project guard — Project configuration location](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L20-L22) | Technical documentation | — |
| [Action](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L24-L26) | Glossary | Action also names an input event in User activity. Keep the two meanings separate pending review. |
| [Action — Confirmation and forbid outcomes](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L24-L26) | Behaviour | — |
| [Action — Run anyway control where permitted](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L24-L26) | User Interface | — |
| [Action — Stored action identifiers](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L24-L26) | Technical documentation | — |
| [Line](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L28-L30) | Glossary | — |
| [Line — Match conditions and case and whitespace handling](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L28-L30) | Behaviour | — |
| [Line — Regular-expression engine](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L28-L30) | Technical documentation | — |
| [Guard window](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L32-L34) | Glossary | — |
| [Guard window — Add, Edit and Try a command controls](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L32-L34) | User Interface | — |
| [Guard window — Built-in guard cannot be saved after editing](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L32-L34) | Behaviour | — |
| [Confirmation window](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L36-L38) | Glossary | — |
| [Confirmation window — Command details, buttons and navigation to settings](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L36-L38) | User Interface | — |
| [Confirmation window — What remains available for a forbidden command](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L36-L38) | Behaviour | — |
| [Guards section](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L40-L42) | Glossary | — |
| [Guards section — Ordering and settings controls](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L40-L42) | User Interface | — |
| [Guards section — Project and built-in guard permissions](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L40-L42) | Behaviour | — |
| [Guard terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/guards.md#L46) | Glossary | Reconcile the scope of Action with User activity and the terminology rule in Sidebars. |

### 2.6. Heidrun Code Dashboard

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Heidrun Code Dashboard](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L14-L16) | Glossary | — |
| [Heidrun Code Dashboard — Menu entry and display modes](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L14-L16) | User Interface | — |
| [Heidrun Code Dashboard — Viewing on the local network](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L14-L16) | Platform Support | — |
| [Heidrun Code Dashboard — Shared dashboard model](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L14-L16) | System Overview | — |
| [Official name, short labels and former name](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L18) | Glossary | Check the existing naming decision in issue 996 before recording approved wording. |
| [Official name, short labels and former name — Identifier and migration of former saved settings](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L18) | Technical documentation | — |
| [Separate Heidrun Code Dashboard window](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L20-L22) | Glossary | — |
| [Separate Heidrun Code Dashboard window — Open in a separate window control](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L20-L22) | User Interface | — |
| [Separate Heidrun Code Dashboard window — One window at a time](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L20-L22) | Behaviour | — |
| [Separate Heidrun Code Dashboard window — Window label and framework](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L20-L22) | Technical documentation | — |
| [Heidrun Code Dashboard on the local network](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L24-L26) | Glossary | — |
| [Heidrun Code Dashboard on the local network — Setting for viewing on the local network](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L24-L26) | User Interface | — |
| [Heidrun Code Dashboard on the local network — Supported devices and read-only access](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L24-L26) | Platform Support | — |
| [Heidrun Code Dashboard on the local network — Server responsibilities](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L24-L26) | System Overview | — |
| [Heidrun Code Dashboard server](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L28-L30) | System Overview · Dashboard server and its relationship to the mobile server | — |
| [Heidrun Code Dashboard server — Package name and pairing implementation](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L28-L30) | Technical documentation | — |
| [Heidrun Code Dashboard model](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L32-L34) | Glossary | — |
| [Heidrun Code Dashboard model — Model inputs and shared consumers](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L32-L34) | System Overview | — |
| [Heidrun Code Dashboard model — Source folder](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L32-L34) | Technical documentation | — |
| [Subagent in the Heidrun Code Dashboard](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L36-L38) | Glossary | Keep the running dashboard concept distinct from the configured Subagent. |
| [Live observation](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L40-L42) | Glossary | — |
| [Live observation — Observation sources and collector lifetime](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L40-L42) | System Overview | — |
| [Visible status](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L44-L46) | Glossary | — |
| [Visible status — Status values and what happens when status is unknown](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L44-L46) | Behaviour | — |
| [Freshness](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L48-L50) | Glossary | — |
| [Freshness — Freshness classes and unmatched condition](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L48-L50) | Behaviour | — |
| [Coverage](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L52-L54) | Glossary · Dashboard coverage | Distinguish the product term from Symbiospec Coverage. |
| [Coverage — Counts and aggregation scope](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L52-L54) | Behaviour | — |
| [Pending attention](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L56-L58) | Glossary | — |
| [Pending attention — Pending questions and approvals, including an automatic reviewer](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L56-L58) | Behaviour | — |
| [Running subagent terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L62) | Glossary | — |
| [Running subagent terminology — Restriction on using configuration rows for live status](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_dashboard.md#L62) | Technical documentation | — |

### 2.7. Heidrun Code Mobile

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Heidrun Code Mobile terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L46) | Glossary | — |
| [Heidrun Code Mobile](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L12-L14) | Glossary | — |
| [Heidrun Code Mobile — Relationship between mobile website and desktop application](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L12-L14) | System Overview | — |
| [Heidrun Code Mobile — Phone access](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L12-L14) | Platform Support | — |
| [Mobile website](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L16-L18) | Glossary | — |
| [Mobile website — Mobile website communicates through the mobile server](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L16-L18) | System Overview | — |
| [Mobile website — Package path](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L16-L18) | Technical documentation | — |
| [Mobile server](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L20-L22) | System Overview · Server responsibilities | — |
| [Mobile server — Pairing and allowed-method requirements](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L20-L22) | Behaviour | — |
| [Mobile server — Library and package](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L20-L22) | Technical documentation | — |
| [Pairing key](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L24-L26) | Glossary | — |
| [Pairing key — Pairing code as the way the phone receives the key](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L24-L26) | User Interface | — |
| [Pairing key — Key required for requests](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L24-L26) | Behaviour | — |
| [Bottom bar](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L28-L30) | Glossary | — |
| [Bottom bar — Four bottom-bar controls and order](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L28-L30) | User Interface | — |
| [Plain terminal on the phone](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L32-L34) | Glossary | — |
| [Plain terminal on the phone — Terminal badge, output and warning sheet](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L32-L34) | User Interface | — |
| [Plain terminal on the phone — Typing permission and guard behavior](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L32-L34) | Behaviour | — |
| [Plain terminal on the phone — Phone-specific access](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L32-L34) | Platform Support | — |
| [Macro button](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L36-L38) | Glossary | — |
| [Macro button — Macro button icon and placement](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L36-L38) | User Interface | — |
| [Macro button — Selecting a macro writes to the prompt field](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L36-L38) | Behaviour | — |
| [Microphone button](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L40-L42) | Glossary | Keep distinct from the desktop push-to-talk button. |
| [Microphone button — Microphone button placement](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L40-L42) | User Interface | — |
| [Microphone button — Start, write to the prompt field, and stop](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L40-L42) | Behaviour | — |
| [Microphone button — Phone speech recognition](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L40-L42) | Platform Support | — |
| [Device terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_code_mobile.md#L47) | Glossary | Preserve the source terminology guidance and review where the rule should apply. |

### 2.8. Heidrun names

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Heidrun Organization](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L12-L14) | Glossary | — |
| [Former name](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L32-L34) | Glossary · Former names and allowed historical use | — |
| [Former Heidrun Code name](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L36) | Glossary | — |
| [Former Heidrun Code Mobile name](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L37) | Glossary | — |
| [Former Heidrun Code Development name](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L38) | Glossary | — |
| [Heidrun Code](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L16-L18) | Glossary · Current identity and former name | — |
| [Heidrun Code — Repository identifier](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L16-L18) | Technical documentation | — |
| [Heidrun Notebook](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L20-L22) | Glossary · Related product identity | — |
| [Heidrun Notebook — Identifier and repository location](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L20-L22) | Technical documentation | — |
| [Official name](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L24-L26) | Glossary · Official-name convention | Keep the product naming rule consistent with AGENTS.md. |
| [Identifier](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L28-L30) | Glossary · Meaning of Identifier | — |
| [Identifier — Machine naming convention and macOS bundle identifier](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L28-L30) | Technical documentation | — |
| [Former control command name](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L39) | Technical documentation | — |
| [Data package and command rename history](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L40) | Technical documentation | — |
| [Environment variable compatibility](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L41) | Technical documentation | — |
| [First-start data-folder migration](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L42) | Behaviour | — |
| [First-start data-folder migration — Former and current data-folder paths](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L42) | Technical documentation | — |
| [Installed application and bundle identifier history](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L43) | Technical documentation | — |
| [Persisted name](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L45-L47) | Glossary · Meaning of Persisted name | — |
| [Persisted name — Compatibility and project-history preservation policy](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L45-L47) | Technical documentation | — |
| [Persisted Herdr session names](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L49) | Technical documentation | — |
| [Persisted web-view storage prefix](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L50) | Technical documentation | — |
| [Persisted project folder and origin file](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L51) | Technical documentation | — |
| [Persisted file view pane label](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L52) | Technical documentation | — |
| [Persisted stash text](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L53) | Technical documentation | — |
| [Persisted skill cache folder](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L54) | Technical documentation | — |
| [Preserved image names and labels](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L55) | Technical documentation | — |
| [Persisted code-hosting repository key](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L56) | Technical documentation | — |
| [Preserved organization and asset identities](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/heidrun_names.md#L57) | Technical documentation | — |

### 2.9. Issue Fix Workflow

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Issue Fix Workflow](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/issue_fix_workflow.md#L14-L16) | Repository rules · Issue Fix Workflow and its four parts | — |
| [Issue Fix Setup](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/issue_fix_workflow.md#L18-L20) | Repository rules | — |
| [Issue Fix Implementation](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/issue_fix_workflow.md#L22-L24) | Repository rules | — |
| [Issue Fix Review](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/issue_fix_workflow.md#L26-L28) | Repository rules | — |
| [Issue Fix Completion](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/issue_fix_workflow.md#L30-L32) | Repository rules | — |
| [Added request](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/issue_fix_workflow.md#L36-L38) | Repository rules · Added request and the two types | — |
| [Related added request](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/issue_fix_workflow.md#L40-L42) | Repository rules | — |
| [Unrelated added request](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/issue_fix_workflow.md#L44-L46) | Repository rules | — |
| [Added request terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/issue_fix_workflow.md#L50) | Repository rules | — |
| [Full names of the Issue Fix Workflow parts](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/issue_fix_workflow.md#L51) | Repository rules | — |

### 2.10. Macros

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Spelling of heidrun_code_ctrl](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L39) | Glossary | — |
| [Macro and Launcher naming boundary](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L40) | Glossary | — |
| [Macro](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L14-L16) | Glossary · Reusable text and user and project relationships | — |
| [Macro — Insertion into a pane](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L14-L16) | Behaviour | — |
| [User macro](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L18-L20) | Glossary · User macro scope | — |
| [User macro — User macro storage reference](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L18-L20) | Technical documentation | — |
| [User macro file](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L22-L24) | Technical documentation · User macro file, paths, format and readers and writers | — |
| [Project macro](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L26-L28) | Glossary · Project macro scope and sharing | — |
| [Project macro — Project file and persisted key](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L26-L28) | Technical documentation | — |
| [heidrun_code_ctrl](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L32-L34) | Glossary · Purpose of heidrun_code_ctrl | — |
| [heidrun_code_ctrl — Relationship to the desktop application and Herdr](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L32-L34) | System Overview | — |
| [heidrun_code_ctrl — Command groups, executable and watched files](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L32-L34) | Technical documentation | — |
| [User macro and Project macro terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L38) | Glossary | — |
| [User macro and Project macro terminology — Persisted personal identifier](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L38) | Technical documentation | — |
| [Macro row and View, Edit and Delete controls](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L42) | User Interface | — |
| [Macro row and View, Edit and Delete controls — View contents, confirmation, cancellation and no insertion](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L42) | Behaviour | — |
| [Action placement and title wrapping](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L43) | User Interface | — |
| [Action placement and title wrapping — Menu dimensions and borderless icon buttons](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L43) | Styling | — |
| [Create, Edit and Save forms and action placement](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L44) | User Interface | — |
| [Create, Edit and Save forms and action placement — Blank or prefilled form, saving and closing](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L44) | Behaviour | — |
| [Insertion and Shift+click behavior](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L45) | Behaviour | Implementation and test references support checking this passage. Record approval separately. |
| [Description field and Content label](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L47) | User Interface | — |
| [Description field and Content label — Multiline Markdown preservation and first-line display](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L47) | Behaviour | — |
| [Location control and placement](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L49) | User Interface | — |
| [Location control and placement — Move between User and Project while preserving identity and content](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L49) | Behaviour | — |
| [Project macro and User macro headings](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L51) | User Interface | — |
| [Project macro and User macro headings — Heading visibility for nonempty groups](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/macros.md#L51) | Behaviour | — |

### 2.11. Pane focus history

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Pane focus history, Back button and Forward button terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/pane_focus_history.md#L30) | Glossary | — |
| [Top bar](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/pane_focus_history.md#L12-L14) | Glossary | — |
| [Top bar — Top bar controls, order and workspace name](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/pane_focus_history.md#L12-L14) | User Interface | — |
| [Pane focus history](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/pane_focus_history.md#L16-L18) | Glossary | — |
| [Pane focus history — Shared order across workspaces and tabs, moves and long press](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/pane_focus_history.md#L16-L18) | Behaviour | — |
| [Pane focus history — Back and Forward history controls](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/pane_focus_history.md#L16-L18) | User Interface | — |
| [Back button](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/pane_focus_history.md#L20-L22) | Glossary | — |
| [Back button — Back button placement and arrow](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/pane_focus_history.md#L20-L22) | User Interface | — |
| [Back button — Focus moves to the previous entry](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/pane_focus_history.md#L20-L22) | Behaviour | — |
| [Forward button](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/pane_focus_history.md#L24-L26) | Glossary | — |
| [Forward button — Forward button placement and arrow](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/pane_focus_history.md#L24-L26) | User Interface | — |
| [Forward button — Focus moves to the next entry](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/pane_focus_history.md#L24-L26) | Behaviour | — |
| [Pane definition and focus-history entry boundary](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/pane_focus_history.md#L31) | Glossary | Reuse the Pane definition from Workspaces, tabs and panes. |

### 2.12. Work of one person

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Work of one person tab](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L14-L16) | Glossary | — |
| [Work of one person tab — Work of one person tab and its controls](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L14-L16) | User Interface | — |
| [Work of one person tab — What it shows and how it combines workspaces](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L14-L16) | Behaviour | — |
| [Source of the Work of one person tab](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L18-L20) | Glossary | — |
| [Source of the Work of one person tab — Source radio buttons](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L18-L20) | User Interface | — |
| [Source of the Work of one person tab — Default source](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L18-L20) | Behaviour | — |
| [Git history](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L22-L24) | Glossary | — |
| [Git history — Git history contribution counts](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L22-L24) | Behaviour | — |
| [Metric of the Git history](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L26-L28) | Glossary | — |
| [Metric of the Git history — Metric radio buttons and availability](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L26-L28) | User Interface | — |
| [Metric of the Git history — Initial metric and selections preserved when it changes](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L26-L28) | Behaviour | — |
| [AI cost](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L30-L32) | Glossary | Review the difference between AI cost here and Estimated cost of a chat in Past chats. |
| [AI cost — Hidden person chooser and Import the history button](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L30-L32) | User Interface | — |
| [AI cost — Units, supported observations, price and minute attribution](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L30-L32) | Behaviour | — |
| [AI cost — Stored token-usage input](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L30-L32) | Technical documentation | — |
| [Workspace selector of the Work of one person tab](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L34-L36) | Glossary | — |
| [Workspace selector of the Work of one person tab — Workspace controls](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L34-L36) | User Interface | — |
| [Workspace selector of the Work of one person tab — Selection, aggregation and the initial workspace](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L34-L36) | Behaviour | — |
| [Unit of the AI cost](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L38-L40) | Glossary | — |
| [Unit of the AI cost — Unit control and unknown-price message](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L38-L40) | User Interface | — |
| [Unit of the AI cost — Defaults, token units and treatment of unknown prices](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L38-L40) | Behaviour | — |
| [Person](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L42-L44) | Glossary | — |
| [Person — Matching a person across commits and hosted activity](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L42-L44) | Behaviour | — |
| [Person — Identifier normalization and special email handling](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L42-L44) | Technical documentation | — |
| [Person chooser](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L46-L48) | Glossary | — |
| [Person chooser — Person chooser placement and purpose](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L46-L48) | User Interface | — |
| [Person chooser — Eligibility window and ordering](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L46-L48) | Behaviour | — |
| [Time range of the Work of one person tab](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L50-L52) | Glossary | — |
| [Time range of the Work of one person tab — Available ranges and inclusion of today](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L50-L52) | Behaviour | — |
| [Day](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L54-L56) | Glossary | — |
| [Day — Time zone and attribution date](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L54-L56) | Behaviour | — |
| [Slot of the Work of one person tab](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L58-L60) | Glossary | Slot also appears in User activity with a different purpose. Review whether to use a shared definition or qualified terms. |
| [Slot of the Work of one person tab — Slot boundaries and contribution attribution](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L58-L60) | Behaviour | — |
| [Slot length of the Work of one person tab](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L62-L64) | Glossary | Check the phrase both time ranges against the four available ranges. |
| [Slot length of the Work of one person tab — Slot length control](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L62-L64) | User Interface | — |
| [Slot length of the Work of one person tab — Available lengths and default](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L62-L64) | Behaviour | — |
| [Totals](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L66-L68) | Glossary | — |
| [Totals — Totals placement](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L66-L68) | User Interface | — |
| [Totals — Counts, binary-file treatment and totals by source](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L66-L68) | Behaviour | — |
| [Average per day](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L70-L72) | Glossary | The source says seven or thirty days. Existing tests also cover three and fourteen days. |
| [Average per day — Average display under each total](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L70-L72) | User Interface | — |
| [Average per day — Calculation, rounding example and idle days](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L70-L72) | Behaviour | — |
| [Bar chart of the work of one person](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L74-L76) | Glossary | — |
| [Bar chart of the work of one person — Stacked bar chart, legend and information card](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L74-L76) | User Interface | — |
| [Bar chart of the work of one person — What each stack counts](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L74-L76) | Behaviour | — |
| [Bar chart of the work of one person — Shared chart colors and visual conventions](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/person_work.md#L74-L76) | Styling | — |

### 2.13. Sidebars

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Sidebar section and status bar section terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L60) | Glossary | — |
| [Left sidebar](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L14-L16) | Glossary | — |
| [Left sidebar — Left sidebar placement](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L14-L16) | User Interface | — |
| [Right sidebar](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L18-L20) | Glossary | — |
| [Right sidebar — Right sidebar placement](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L18-L20) | User Interface | — |
| [Sidebar section](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L22-L24) | Glossary | — |
| [Sidebar section — One visible sidebar section at a time](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L22-L24) | Behaviour | — |
| [Clipboard sidebar section](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L26-L28) | Glossary · Former Notes sidebar section and name Note | — |
| [Clipboard sidebar section — Header, switch, icon and Images of the chat](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L26-L28) | User Interface | — |
| [Clipboard sidebar section — Scope of notes and images shown](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L26-L28) | Behaviour | — |
| [Launchers sidebar section](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L30-L32) | Glossary · Former Scripts sidebar section | — |
| [Launchers sidebar section — Title and import and create buttons](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L30-L32) | User Interface | — |
| [Launchers sidebar section — Launcher scope for the selected workspace](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L30-L32) | Behaviour | — |
| [Launcher](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L34-L36) | Glossary · Launcher purpose, levels and former names | — |
| [Launcher — Visibility, execution in its own tab and import](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L34-L36) | Behaviour | — |
| [Launcher — Run button and Import launchers window](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L34-L36) | User Interface | — |
| [Launcher — User and workspace storage](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L34-L36) | Technical documentation | — |
| [Source control sidebar section](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L38-L40) | Glossary · Former Git sidebar section | Check the listed layout against the current Source control documentation and implementation. |
| [Source control sidebar section — Header, commit controls and change groups](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L38-L40) | User Interface | — |
| [Source control sidebar section — Local repository scope](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L38-L40) | Behaviour | — |
| [Code hosting sidebar section](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L42-L44) | Glossary | — |
| [Code hosting sidebar section — Lists, row layout and information card](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L42-L44) | User Interface | — |
| [Code hosting sidebar section — Open items for the selected workspace repository](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L42-L44) | Behaviour | — |
| [Code hosting sidebar section — Pull request and merge request names by hosting service](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L42-L44) | Platform Support | — |
| [File explorer sidebar section](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L46-L48) | Glossary | Check the Git repository wording against the rule that reads from disk. |
| [File explorer sidebar section — Tree, icon, menu and file controls](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L46-L48) | User Interface | — |
| [File explorer sidebar section — Opening files, ignored items and supported file changes](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L46-L48) | Behaviour | — |
| [Search in files sidebar section](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L50-L52) | Glossary | — |
| [Search in files sidebar section — Search options and result presentation](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L50-L52) | User Interface | — |
| [Search in files sidebar section — Search scope and opening a result at its line](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L50-L52) | Behaviour | — |
| [Sidebar icon bar](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L54-L56) | Glossary | — |
| [Sidebar icon bar — Icon placement and collapsed appearance](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L54-L56) | User Interface | — |
| [Sidebar icon bar — Switching sidebar sections](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L54-L56) | Behaviour | — |
| [Launcher, Script and Action terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/sidebars.md#L61) | Glossary | Reconcile the stated limits on Action with Guards and User activity. |

### 2.14. Statistics charts

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Chart legend](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/statistics_charts.md#L14-L16) | Glossary | — |
| [Chart legend — Legend position and stack order](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/statistics_charts.md#L14-L16) | User Interface | — |
| [Chart legend — Work of one person legend toggling exception](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/statistics_charts.md#L14-L16) | Behaviour | — |
| [Chart information card](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/statistics_charts.md#L18-L20) | Glossary | Keep distinct from Information card and Information card tooltip. Review shared card terminology with Terminal text detection. |
| [Chart information card — Hover, content and placement](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/statistics_charts.md#L18-L20) | User Interface | — |
| [Chart information card — Opening and closing and no pointer capture](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/statistics_charts.md#L18-L20) | Behaviour | — |
| [Chart information card — Card and arrow appearance](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/statistics_charts.md#L18-L20) | Styling | — |

### 2.15. Status bar

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Status bar](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L14-L16) | Glossary | — |
| [Status bar — Bottom-of-window placement](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L14-L16) | User Interface | — |
| [Status bar section](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L18-L20) | Glossary | — |
| [Status bar section — Status display and card trigger](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L18-L20) | User Interface | — |
| [Unspecified Claude quota](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L22-L24) | Glossary | — |
| [Unspecified Claude quota — Unspecified quota label](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L22-L24) | User Interface | — |
| [Unspecified Claude quota — Conditions for displaying unknown rather than zero](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L22-L24) | Behaviour | — |
| [Information card](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L26-L28) | Glossary | Terminal text detection calls a hover card an Information card. Review whether the glossary needs a shared term with variants. |
| [Information card — Locations, click trigger and controls](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L26-L28) | User Interface | — |
| [Information card — Close conditions](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L26-L28) | Behaviour | — |
| [Information card — Hover and open backgrounds](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L26-L28) | Styling | — |
| [Information card tooltip](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L30-L32) | Glossary | — |
| [Information card tooltip — Tooltip position and content shape](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L30-L32) | User Interface | — |
| [Information card tooltip — Delay, focus, dismissal and no pointer capture](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L30-L32) | Behaviour | — |
| [Information card tooltip — Shared tooltip appearance](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L30-L32) | Styling | — |
| [Information card tooltip — HTML body placement and attributes](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L30-L32) | Technical documentation | — |
| [Workspace status bar section](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L34-L36) | Glossary | — |
| [Workspace status bar section — Workspace status dot, name and actions](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L34-L36) | User Interface | — |
| [Workspace status bar section — Workspace operations available from the card](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/status_bar.md#L34-L36) | Behaviour | — |

### 2.16. Terminal text detection

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Text detection](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/terminal_text_detection.md#L10-L12) | Glossary · Settings-section identity | — |
| [Text detection — Text detection settings scope](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/terminal_text_detection.md#L10-L12) | User Interface | — |
| [Input image previews](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/terminal_text_detection.md#L14-L16) | Glossary | — |
| [Input image previews — Terminal attachment label and hover preview](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/terminal_text_detection.md#L14-L16) | User Interface | — |
| [Input image previews — Preview trigger](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/terminal_text_detection.md#L14-L16) | Behaviour | — |
| [Terminal reference](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/terminal_text_detection.md#L18-L20) | Glossary | — |
| [Terminal reference — Resolving shorthand and full addresses to repositories](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/terminal_text_detection.md#L18-L20) | Behaviour | — |
| [Terminal reference — Supported reference types by hosting service](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/terminal_text_detection.md#L18-L20) | Platform Support | — |
| [Information card](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/terminal_text_detection.md#L22-L24) | Glossary | Review with the click-only Information card definition in Status bar. Compare the pinned Text detection description with the earlier main version before carrying over older terminology. |
| [Information card — Hover card and shared merge controls](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/terminal_text_detection.md#L22-L24) | User Interface | — |

### 2.17. Test levels

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Fast tests](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/test_levels.md#L14-L16) | Repository rules · Fast tests and their commands | — |
| [Slow tests](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/test_levels.md#L18-L20) | Repository rules · Slow tests, when to run them, and classification | — |
| [Full tests](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/test_levels.md#L22-L24) | Repository rules · Full tests and the release requirement | — |
| [Test-level terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/test_levels.md#L28) | Repository rules | — |
| [Meaning of all the tests and scope of pnpm test](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/test_levels.md#L29) | Repository rules | — |

### 2.18. User activity

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [User activity time](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L14-L16) | Glossary | — |
| [Action](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L18-L20) | Glossary | Action also names a project guard result. Review both definitions and the Sidebars terminology rule. |
| [Action — Which input events count, including window focus](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L18-L20) | Behaviour | — |
| [Cool down](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L22-L24) | Glossary | — |
| [Cool down — Five-second threshold](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L22-L24) | Behaviour | — |
| [Active period](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L26-L28) | Glossary | — |
| [Active period — Start, end and workspace rules](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L26-L28) | Behaviour | — |
| [User activity record](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L30-L32) | Glossary | — |
| [User activity record — Information excluded from activity records](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L30-L32) | Behaviour | — |
| [User activity record — Storage path and record format](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L30-L32) | Technical documentation | — |
| [User activity sidebar section](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L34-L36) | Glossary | — |
| [User activity sidebar section — Sidebar placement and icon](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L34-L36) | User Interface | — |
| [User activity sidebar section — Current-day records](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L34-L36) | Behaviour | — |
| [Statistics window](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L40-L42) | Glossary | — |
| [Statistics window — More menu entry, title bar and default tab](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L40-L42) | User Interface | — |
| [User activity tab](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L44-L46) | Glossary | — |
| [User activity tab — Histogram and selectors](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L44-L46) | User Interface | — |
| [Histogram of the user activity time](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L48-L50) | Glossary | — |
| [Histogram of the user activity time — Chart presentation and legend](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L48-L50) | User Interface | — |
| [Histogram of the user activity time — Workspace contributions and aggregation](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L48-L50) | Behaviour | — |
| [Slot](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L52-L54) | Glossary | Compare Slot in Work of one person. Preserve differences in aggregation period and available lengths. |
| [Slot — Available slot lengths, defaults, alignment and incomplete current slot](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/user_activity.md#L52-L54) | Behaviour | — |

### 2.19. Voice input

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Voice input, push-to-talk button and level bars terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L56) | Glossary | — |
| [Mobile Microphone button and desktop push-to-talk button naming boundary](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L57) | Glossary | — |
| [Replacement list and field terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L58) | Glossary | — |
| [Voice input](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L14-L16) | Glossary | — |
| [Voice input — Start and stop controls](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L14-L16) | User Interface | — |
| [Voice input — Recording boundaries, transcription destination, queue and initial setting](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L14-L16) | Behaviour | — |
| [Voice input — On-computer speech processing](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L14-L16) | Platform Support | — |
| [Push-to-talk button](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L18-L20) | Glossary | — |
| [Push-to-talk button — Composition bar position and button icon](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L18-L20) | User Interface | — |
| [Push-to-talk button — Long and short press behavior](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L18-L20) | Behaviour | — |
| [Push-to-talk button — Desktop and phone speech recognition distinction](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L18-L20) | Platform Support | — |
| [Level bars](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L22-L24) | Glossary | — |
| [Level bars — Input placement, elapsed time and cancel control](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L22-L24) | User Interface | — |
| [Level bars — Level, waiting and transcription states](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L22-L24) | Behaviour | — |
| [Level bars — Dot, wave and state colors](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L22-L24) | Styling | — |
| [Waiting for transcription](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L26-L28) | Glossary | — |
| [Waiting for transcription — Transcription queue order](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L26-L28) | Behaviour | — |
| [Recording icon](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L30-L32) | Glossary | — |
| [Recording icon — Tab and workspace icons](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L30-L32) | User Interface | — |
| [Recording icon — When recording status is visible](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L30-L32) | Behaviour | — |
| [Whisper model](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L34-L36) | Glossary | Check the stated model count before carrying it into Behaviour. |
| [Whisper model — Model selection and download](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L34-L36) | Behaviour | — |
| [Whisper model — Engine, model inventory and storage path](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L34-L36) | Technical documentation | — |
| [Voice input section](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L38-L40) | Glossary | — |
| [Voice input section — Voice input controls and download state](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L38-L40) | User Interface | — |
| [Word replacement list](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L42-L44) | Glossary | — |
| [Word replacement list — Location in settings and field labels](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L42-L44) | User Interface | — |
| [Word replacement list — Replacement before writing text](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L42-L44) | Behaviour | — |
| [Word replacement list — File and command-line access](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L42-L44) | Technical documentation | — |
| [Whisper writes](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L46-L48) | Glossary | — |
| [Whisper writes — Space preservation and nonempty input](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L46-L48) | Behaviour | — |
| [Heidrun Code writes instead](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L50-L52) | Glossary | — |
| [Heidrun Code writes instead — Space preservation and deletion by empty replacement](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/voice_input.md#L50-L52) | Behaviour | — |

### 2.20. Workspaces, tabs and panes

| Source entry | Proposed destination | Anything that needs a decision |
| --- | --- | --- |
| [Workspace, Tab and Pane hierarchy](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L14-L20) | Glossary | — |
| [Workspace](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L22-L24) | Glossary | — |
| [Git worktree](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L30-L32) | Glossary | — |
| [Tab naming boundary](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L122) | Glossary | — |
| [Coding agent terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L124) | Glossary | — |
| [Pinned pane and column terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L125) | Glossary | — |
| [Composition bar and Big view terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L126) | Glossary | — |
| [Pane move terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L127) | Glossary | — |
| [Usage wheel terminology](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L128) | Glossary | — |
| [Workspace folder](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L26-L28) | Glossary | — |
| [Workspace folder — Fixed folder, launch directory and selecting another folder](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L26-L28) | Behaviour | — |
| [Workspace folder — Workspace card and status bar association](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L26-L28) | User Interface | — |
| [Tab](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L34-L36) | Glossary | — |
| [Tab — Tab bar representation](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L34-L36) | User Interface | — |
| [Pane](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L38-L40) | Glossary | Check whether terminal describes the underlying implementation or every user-visible Pane, given File view pane and Diff pane. |
| [File view pane](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L42-L44) | Glossary | — |
| [File view pane — Ways to open and save a file in a pane](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L42-L44) | User Interface | — |
| [File view pane — File viewing and editing](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L42-L44) | Behaviour | — |
| [File view pane — Path-bearing label and waiting terminal](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L42-L44) | Technical documentation | — |
| [Diff pane](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L46-L48) | Glossary | — |
| [Diff pane — Opening from Source control](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L46-L48) | User Interface | — |
| [Diff pane — Read-only comparison](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L46-L48) | Behaviour | — |
| [Diff pane — Path-bearing label and waiting terminal](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L46-L48) | Technical documentation | — |
| [Front matter](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L50-L52) | Glossary | — |
| [Front matter — Display behavior and parsing scope](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L50-L52) | Behaviour | — |
| [Front matter card](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L54-L56) | Glossary | — |
| [Front matter card — Card placement in the preview](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L54-L56) | User Interface | — |
| [Coding agent](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L60-L62) | Glossary | Keep the official term and verify the supported list before recording a support expectation. |
| [Coding agent — Supported coding agents](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L60-L62) | Platform Support | — |
| [Tab bar](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L66-L68) | Glossary | — |
| [Tab bar — Tab bar placement and selected workspace](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L66-L68) | User Interface | — |
| [Viewport](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L70-L72) | Glossary | — |
| [Viewport — Viewport placement and contents](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L70-L72) | User Interface | — |
| [Viewport — Viewport border](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L70-L72) | Styling | — |
| [Pinned pane](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L74-L76) | Glossary | — |
| [Pinned pane — Pin control](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L74-L76) | User Interface | — |
| [Pinned pane — Persistence across tabs and workspaces](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L74-L76) | Behaviour | — |
| [Pinned pane — Fixed width across selection changes](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L74-L76) | Styling | — |
| [Column of pinned panes](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L78-L80) | Glossary | — |
| [Column of pinned panes — Pinned pane column position and ordering](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L78-L80) | User Interface | — |
| [Column of pinned panes — Availability across tabs](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L78-L80) | Behaviour | — |
| [Usage wheel](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L84-L86) | Glossary | — |
| [Usage wheel — Usage wheel location, hover and information card](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L84-L86) | User Interface | — |
| [Usage wheel — Usage figures shown in the card](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L84-L86) | Behaviour | — |
| [Usage wheel — Ring and status colors](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L84-L86) | Styling | — |
| [Composition bar](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L88-L90) | Glossary | — |
| [Composition bar — Composition bar layout, controls and opening actions](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L88-L90) | User Interface | — |
| [Composition bar — Send order, draft persistence and initial state](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L88-L90) | Behaviour | — |
| [Big view](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L92-L94) | Glossary | — |
| [Big view — Image preview and previous and next buttons](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L92-L94) | User Interface | — |
| [Zen Mode](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L96-L98) | Glossary | — |
| [Zen Mode — Pane header entry and visible controls](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L96-L98) | User Interface | — |
| [Zen Mode — Temporary visibility of the selected pane](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L96-L98) | Behaviour | — |
| [Dragged pane](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L104-L106) | Glossary | — |
| [Dragged pane — Drag action that identifies the pane](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L104-L106) | User Interface | — |
| [Destination pane](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L108-L110) | Glossary | — |
| [Destination pane — Which pane becomes the destination and where the dragged pane goes](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L108-L110) | Behaviour | — |
| [Drop triangle](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L112-L114) | Glossary | — |
| [Drop triangle — Four drop regions](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L112-L114) | User Interface | — |
| [Drop triangle — Drop side selection](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L112-L114) | Behaviour | — |
| [Move preview](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L116-L118) | Glossary | — |
| [Move preview — Preview location and size](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L116-L118) | User Interface | — |
| [Move preview — Preview visibility before release](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L116-L118) | Behaviour | — |
| [Pane naming boundary](https://github.com/heidrun-org/heidrun_code/blob/9d7989928bdc5d2499b1e7236e6c20fe0ae125db/docs/agents_rules/glossary/workspaces_tabs_and_panes.md#L123) | Glossary | Resolve alongside File view pane and Diff pane. |

## 3. Handoff to review

Review the clear matches together and the questions individually in [issue 1128](https://github.com/heidrun-org/heidrun_code/issues/1128). Keep the passages routed to other areas visible for later review. Retain the source text in /docs/agents_rules during this step.
