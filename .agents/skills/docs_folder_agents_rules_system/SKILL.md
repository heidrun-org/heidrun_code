---
name: docs_folder_agents_rules_system
description: Obsolete; superseded by Symbiospec. Retained for existing projects. Read, obey, and keep up to date the agent rules of a repository, the rule files in the documentation folder that every coding agent follows, with the glossary of the words of the project. Use it before you change the code, to read the glossary and the rule files that match the part that you change, when a rule or a word of the project changes, and when a rule file grows over the maximum size. It needs the skill docs_folder_system for the form of the files.
---

# Docs folder agents rules system

**Obsolete:** [Symbiospec](../symbio_spec/SKILL.md) supersedes the Docs folder agents rules system. This skill remains available for existing projects.

The agent rules are the files that every coding agent obeys. They sit in the agent rules folder, a subfolder of the documentation folder. The glossary is a subfolder of the agent rules folder: it gives the definition of each word that the project uses for one of its parts. This skill gives what you do with the content of the agent rules: read them, obey them, and keep them up to date. This skill names no detail of one repository, so the folder of this skill can be copied to another repository.

## This skill needs the skill docs_folder_system

The agent rules folder is inside the documentation folder, so every file and every folder of the agent rules follows the skill `docs_folder_system`: the metadata header, the files `README.md` and `index.md` of each folder, and the update of `index.md`. Read the skill `docs_folder_system` before you add, rename, move, or delete a file or a folder of the agent rules. This skill never repeats those rules. The name of this skill starts with `docs_folder_` to show this dependency.

## The values of the repository

Read the values of the repository before you read or change the agent rules. The caller always gives the values to this skill, and the skill works the same way for each caller:

- With The Rules of the Repo: the configuration file of this skill, from the rules list of The Rules of the Repo.
- Without The Rules of the Repo: the section "Docs folder agents rules system values" of the file `AGENTS.md`. See the section "The template".

The values are:

- Agent rules folder: the folder that holds the agent rules, inside the documentation folder.
- Glossary folder: the folder of the glossary, inside the agent rules folder.
- Maximum size of a file: the maximum size, in bytes, of a file in the agent rules folder and in all its subfolders.
- Size test command: the command that runs the test that fails when a file of the agent rules is larger than the maximum size.

### When the values are missing

When no caller gives the values, or when one value is missing, do these steps, in this order:

1. Do not change the agent rules.
2. Warn the developer in one short message: "The docs folder agents rules system is not configured in this repository." Then list the missing values, one value on each line.
3. Show the template in the section "The template", and offer to propose a value for each missing value from the files of the repository. Write the section only after the developer agrees to the proposed values.
4. Stop, and wait for the developer.

Never guess a value, and never use the value of another repository.

## Read the rules

1. Before you change the code, read the file `index.md` of the value "Glossary folder", then read the glossary files that match the part that you change.
2. Then read the file `index.md` of the value "Agent rules folder". Follow the file `index.md` of each subfolder down to the rule files that match the part that you change, and read only these rule files.
3. Obey the rules that you read, in the code, in the documents, and in the conversations.

## Use the words of the glossary

- Use the words of the glossary, and no other word, in the code, in the documents, and in the conversations. One word means one thing, and one thing has one word.
- When a word changes, or when a new part of the project gets a name, update the glossary in the same change.

## Keep the rules up to date

- When a change makes a rule false, update the rule file in the same change.
- When you add a part that has rules, add the rules to the rule file of its topic, or create a new rule file for a new topic.
- The bullet of a rule file in the file `index.md` of its folder says what the file holds, then when to read it, for example "Read it each time that you change the command line options." The bullet is the only place that says when to read the file, so keep it accurate.

## Keep each file small

- No file in the value "Agent rules folder", or in its subfolders, is larger than the value "Maximum size of a file".
- When a file is larger, split it by topic into smaller files, and list the new files in the file `index.md` of their folder.
- Run the value "Size test command" after each change of the agent rules. The test fails when a file is larger than the maximum size.

## The template

Write this text in the file `AGENTS.md` of the repository, when the repository has no The Rules of the Repo. The first two lines are the pointer: the file `AGENTS.md` always loads, but a skill loads only when the coding agent decides that it matches, so the pointer makes sure that the skill is read.

```markdown
## Agent rules

The folder `<agent rules folder>` holds all the rules that every coding agent obeys. Before you change the code, read the glossary and the rule files that match the part that you change, as the skill [docs_folder_agents_rules_system](.agents/skills/docs_folder_agents_rules_system/SKILL.md) says. This skill needs the skill [docs_folder_system](.agents/skills/docs_folder_system/SKILL.md).
The skill names no detail of this repository: it reads the values of this repository in the section "Docs folder agents rules system values" below.

### Docs folder agents rules system values

- Agent rules folder: <the folder that holds the agent rules>
- Glossary folder: <the folder of the glossary>
- Maximum size of a file: <number> bytes.
- Size test command: <the command that runs the test of the maximum size>
```
