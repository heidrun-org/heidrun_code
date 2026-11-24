# docs_folder_agents_rules_system

**Obsolete:** [Symbiospec](../symbio_spec/SKILL.md) supersedes the Docs folder agents rules system. This skill remains available for existing projects.

The skill `docs_folder_agents_rules_system` tells a coding agent to read, obey, and keep up to date the agent rules and the glossary of a project. This system is the Docs folder agents rules system. The agent rules are the rule files that every coding agent obeys. The glossary gives the definition of each word that the project uses for one of its parts.

## Purpose

A project has rules that every coding agent must obey, and words that have one exact meaning. When these rules live only in the memory of the developer, or in old chats, each new coding agent breaks the same rules again, and each new chat uses different words for the same thing. The developer then gives the same correction many times.

The Docs folder agents rules system puts these rules and the glossary in files, in a folder of the documentation folder, so that every coding agent reads the same rules and uses the same words. The coding agent reads only the rule files that match the part that the coding agent changes, so the coding agent does not load all the rules each time.

## What the coding agent does

- Read: before the coding agent changes the code, the coding agent reads the glossary, then follows the `index.md` files down to the rule files that match the part that the coding agent changes.
- Obey: the coding agent obeys these rules in the code, in the documents, and in the conversations.
- Use the words of the glossary: one word means one thing, and one thing has one word.
- Keep up to date: when a change makes a rule false, or changes a word, the coding agent updates the rule file or the glossary in the same change.
- Keep each file small: no rule file is larger than the maximum size. A larger file is split by topic. The coding agent runs the size test command after each change of the agent rules.

## When the coding agent uses the skill

- Before the coding agent changes the code.
- When a rule or a word of the project changes.
- When a rule file grows over the maximum size.

## Configuration

The skill `docs_folder_agents_rules_system` names no detail of one repository. The caller gives the values: the configuration file of the skill in The Rules of the Repo, or, without The Rules of the Repo, the section "Docs folder agents rules system values" of the file `AGENTS.md` of the receiving project. The values are:

- Agent rules folder
- Glossary folder
- Maximum size of a file
- Size test command

The section "The template" of [SKILL.md](SKILL.md) gives the text to copy. When a value is missing, the coding agent does not change the agent rules: the coding agent warns the developer, shows the template, and offers to propose the values.

## Related skill

The skill `docs_folder_agents_rules_system` needs the skill [docs_folder_system](../docs_folder_system/README.md), because the agent rules folder is inside the documentation folder. The skill `docs_folder_system` gives the form of each file and each folder: the metadata header, the files `README.md` and `index.md`, and the update of `index.md`. Install the two skills together.

## Install

```bash
npx skills add jeromeetienne/coding_agent_plugin --skill docs_folder_system --skill docs_folder_agents_rules_system
```

## Files

- [SKILL.md](SKILL.md): the instructions for the coding agent.
