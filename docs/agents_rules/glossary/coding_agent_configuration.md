# Glossary of Heidrun Code: coding agent configuration

- Created: 16 October 2026
- Last updated: 23 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md), [Glossary of Heidrun Code: chats](chats.md)
- Related issue: [issue 569](https://github.com/heidrun-org/heidrun/issues/569), [issue 605](https://github.com/heidrun-org/heidrun/issues/605)

This document gives one short definition for each word of the configuration of the coding agent, which the package `data_layer_coding_agents` reads. The other words of Heidrun Code are in [index.md](index.md).

## The words

### Coding agent configuration

How the developer shaped the coding agent: the memory files, the subagents, and the skills. It changes over time, and each change says what the developer found missing or corrected. The package `data_layer_coding_agents` writes one row for each memory file, subagent, and skill, in the tables `memory_files`, `subagents`, and `skills`, with the date of the creation, of the last change, and of the removal. A configuration item is one memory file, one subagent, or one skill.

### Memory file

One file of the memory of Claude Code, in the folder `memory` of the project folder of Claude Code, for example `~/.claude/projects/<project folder>/memory/never-rebase.md`. Claude Code writes one memory file for each fact, with a name, a description, a type (`user`, `feedback`, `project`, or `reference`), and the id of the chat session that wrote it. The memory file `MEMORY.md` is the index of the others. A memory file of type `feedback` is a correction of the developer. Codex and Antigravity have no memory file.

### Subagent

One file of a folder `.claude/agents`, in the repository or in the folder of Claude Code: a coding agent with its own prompt that the main coding agent can start. It is the word of Claude Code. Never call it an "agent", because "coding agent" is the official name of Claude Code, Codex, and Antigravity.

### Skill

One folder with a file `SKILL.md`, which teaches a coding agent one task. A skill is in a folder `skills`: `.claude/skills` for Claude Code, `.agents/skills` for Codex and workspace skills, or `~/.gemini/antigravity-cli/skills` for Antigravity CLI user skills. A skill of the repository has the scope `PROJECT`, and a skill of the home folder of the developer has the scope `USER`.

### Removed configuration item

A row of the table `memory_files`, `subagents`, or `skills` whose file is gone. The row stays, and its field `removedAt` holds the date of the first synchronization that did not find the file any more. It is the date when Heidrun Code saw the removal, not the exact date of the removal.
