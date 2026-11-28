# Coding agent configuration source material

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Transferred source material
- Related framing: [Glossary migration sources](README.md)
- Related issue: [issue 1135](https://github.com/heidrun-org/heidrun_code/issues/1135)

Original source `/docs/agents_rules/glossary/coding_agent_configuration.md` in the [pinned revision](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db). The headings identify original line numbers. Proposed destinations and inventory notes describe the transfer. Approval of a product rule is recorded with the resulting specification.

### Source line 10

This document gives one short definition for each word of the configuration of the coding agent, which the package `data_layer_coding_agents` reads. The other words of Heidrun Code are in [index.md](source_index.md).

### Source line 12

#### The words

### Source line 14

- Glossary entry: [Coding agent configuration](../../glossary/coding_agent_configuration.md#11-coding-agent-configuration).
- Proposed destinations: Glossary, Technical documentation.

#### Coding agent configuration

How the developer shaped the coding agent: the memory files, the subagents, and the skills. It changes over time, and each change says what the developer found missing or corrected. The package `data_layer_coding_agents` writes one row for each memory file, subagent, and skill, in the tables `memory_files`, `subagents`, and `skills`, with the date of the creation, of the last change, and of the removal. A configuration item is one memory file, one subagent, or one skill.

### Source line 18

- Glossary entry: [Memory file](../../glossary/coding_agent_configuration.md#12-memory-file).
- Proposed destinations: Glossary, Technical documentation, Platform Support.
- Inventory notes: Check supported sources in the data layer. The source claim about Codex could refer to collection support or to Codex itself.

#### Memory file

One file of the memory of Claude Code, in the folder `memory` of the project folder of Claude Code, for example `~/.claude/projects/<project folder>/memory/never-rebase.md`. Claude Code writes one memory file for each fact, with a name, a description, a type (`user`, `feedback`, `project`, or `reference`), and the id of the chat session that wrote it. The memory file `MEMORY.md` is the index of the others. A memory file of type `feedback` is a correction of the developer. Codex and Antigravity have no memory file.

### Source line 22

- Glossary entry: [Subagent](../../glossary/coding_agent_configuration.md#13-subagent).
- Proposed destinations: Glossary, Technical documentation.
- Inventory notes: Distinguish configured Subagent from a running Subagent in the Heidrun Code Dashboard.

#### Subagent

One file of a folder `.claude/agents`, in the repository or in the folder of Claude Code: a coding agent with its own prompt that the main coding agent can start. It is the word of Claude Code. Never call it an "agent", because "coding agent" is the official name of Claude Code, Codex, and Antigravity.

### Source line 26

- Glossary entry: [Skill](../../glossary/coding_agent_configuration.md#14-skill).
- Proposed destinations: Glossary, Technical documentation, Platform Support.

#### Skill

One folder with a file `SKILL.md`, which teaches a coding agent one task. A skill is in a folder `skills`: `.claude/skills` for Claude Code, `.agents/skills` for Codex and workspace skills, or `~/.gemini/antigravity-cli/skills` for Antigravity CLI user skills. A skill of the repository has the scope `PROJECT`, and a skill of the home folder of the developer has the scope `USER`.

### Source line 30

- Glossary entry: [Removed configuration item](../../glossary/coding_agent_configuration.md#15-removed-configuration-item).
- Proposed destinations: Glossary, Behaviour, Technical documentation.

#### Removed configuration item

A row of the table `memory_files`, `subagents`, or `skills` whose file is gone. The row stays, and its field `removedAt` holds the date of the first synchronization that did not find the file any more. It is the date when Heidrun Code saw the removal, not the exact date of the removal.
