# Glossary migration review

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Reviewed migration handoff
- Related framing: [Glossary migration inventory](glossary_migration_inventory.md)
- Related issue: [issue 1128](https://github.com/heidrun-org/heidrun_code/issues/1128)

## 0. Introduction

### 0.1. Scope

This record captures the developer's decisions during the 28 November 2026 glossary review. It is the input to [the glossary conversion](https://github.com/heidrun-org/heidrun_code/issues/1129). The review established definitions and destinations. The inventory remains the record of source passages and implementation evidence.

## 1. Agreed glossary definitions

| Glossary entry | Agreed definition or wording | Treatment of related passages |
| --- | --- | --- |
| Guard action | What Heidrun Code does when a Guard matches a command. Heidrun Code asks for confirmation or forbids the command. | Keep existing labels in the product. The available actions and their consequences belong in Behaviour. |
| User activity action | A keyboard or mouse event counted by User activity. | Keep existing labels in the product. The conditions under which an event counts belong in Behaviour. |
| Information card | An Information card shows details and may offer actions for an item in Heidrun Code. | Use one glossary definition. Describe where and how each Information card opens in User Interface. |
| Slot | A Slot is a time interval represented by one bar in a chart. | Use the same definition for Work of one person and User activity. The available lengths and how values are assigned to a Slot belong in each chart's Behaviour. |
| Pane | A Pane is an area within a Tab that holds content. A Tab can contain several Panes. A Pane can show a terminal, including a terminal running a coding agent, a file in a File view pane, or the changes to a file in a Diff pane. Each Pane has a Pane header with a title, information about the Pane, and controls. | Keep File view pane and Diff pane as separate entries that link to Pane. Describe the active Pane's highlighted Pane header and controls in User Interface. |
| Average per day | Average per day is the total divided by the number of days in the selected time range, including days with no activity. | Put the available time ranges in Behaviour. |
| Text detection | The section of the Settings window for web links, Information cards for terminal references, and Input image previews. | Use the current Settings window scope. Leave the older list of text detection families out of the glossary. |
| File explorer sidebar section | The File explorer sidebar section shows the files and folders of the selected Workspace and lets you open files in a File view pane. | Put the rules for ignored files and symbolic links in Behaviour. |
| Source control sidebar section | The Source control sidebar section shows changes in the selected Workspace's Git repository and provides controls for working with those changes. | Describe the List view and Tree view in User Interface. |
| Macro | Reusable text that Heidrun Code can insert into a Pane. | Click and Shift-click belong in Behaviour. The menu and its controls belong in User Interface. |
| User macro | A Macro available to the developer across projects on the same computer. | Keep storage details in technical documentation. |
| Project macro | A Macro shared with the developers of one project. | Keep storage details in technical documentation. |

The developer accepted the separate meanings of Action, the shared Information card and Slot definitions, and the revised Pane definition after explaining Pane content and the Pane header. The developer then accepted the definitions for Average per day, Text detection, File explorer sidebar section, Source control sidebar section, and the three Macro entries in sequence. These approvals cover the definitions and the stated destinations. They do not establish approval of every associated Behaviour or User Interface rule.

## 2. Straightforward definitions and links

The developer agreed to carry over established wording for straightforward definitions where the evidence supports approval. Workspace, Git worktree, and User activity time were examples discussed in the review. Apply the agreed rule to the clear matches in the inventory and preserve the scope of any earlier approval. Leave an entry pending when approval or current meaning is uncertain.

Converted Symbiospec pages must avoid links into `/docs/agents_rules`, which is planned for removal. Use links to Symbiospec pages, maintained tests, or the issues and decisions that support the wording. Use the inventory when reviewing the origin of a passage.

## 3. Deferred questions

The developer agreed to defer the remaining unclear entries. The [inventory by source topic](glossary_migration_inventory.md#2-inventory-by-source-topic) retains the individual questions. The following groups identify the unresolved work.

- **Coding agent configuration and support.** Memory file collection across coding agents, the configured and running meanings of Subagent, and the list of supported coding agents.
- **Product naming and terminology.** The technical alias Chat session, the wording of saved search levels, the Hardcoded label for Built-in guard, the approved exceptions to the full Heidrun Code Dashboard name, the meaning of Dashboard Coverage, the scope of device terms, and consistency with the official naming rules.
- **Mobile and voice input.** The boundary between Microphone button and push-to-talk button and the stated number of Whisper models.
- **Statistics and chart details.** AI cost and Estimated cost of a chat, the allowed Slot lengths for each chart, and the detailed distinctions between Chart information card and Information card tooltip.
- **Behaviour and engineering passages.** Approval of the specific Macro insertion rules and any other rules that rely on observed behavior alone. The inventory retains destinations for mixed passages, including repository rules and technical documentation.

Proceed with the agreed definitions and the straightforward definitions that have approval evidence. Keep the remaining questions and mixed passages available for later review.
