---
name: docs_folder_system
description: Organize the documentation folder of a repository, the folder that the coding agents write and read. Give each file the metadata header after its title, give each folder the files README.md and index.md, and update index.md when a file or a folder is added, renamed, moved, or deleted. Use it before you add, change, rename, move, or delete a file or a folder in the documentation folder. The skill docs_folder_agents_rules_system needs this skill.
---

# Docs folder system

The documentation folder of a repository belongs to the coding agents: a coding agent writes its files, and a coding agent reads them. This skill gives the form of every file and of every folder in the documentation folder, at every depth. It never says what a rule says: the content of the agent rules is in the skill `docs_folder_agents_rules_system`, which needs this skill. This skill names no detail of one repository, so the folder of this skill can be copied to another repository.

## The values of the repository

Read the values of the repository before you change the documentation folder. The caller always gives the values to this skill, and the skill works the same way for each caller:

- With The Rules of the Repo: the configuration file of this skill, from the rules list of The Rules of the Repo.
- Without The Rules of the Repo: the section "Docs folder system values" of the file `AGENTS.md`. See the section "The template".

The values are:

- Documentation folder: the folder that holds the documentation, for example `docs`.
- Files with no metadata header: each file of the documentation folder that has no metadata header, with the reason. The value is "none" when every file has the header.

### When the values are missing

When no caller gives the values, or when one value is missing, do these steps, in this order:

1. Do not change the documentation folder.
2. Warn the developer in one short message: "The docs folder system is not configured in this repository." Then list the missing values, one value on each line.
3. Show the template in the section "The template", and offer to propose a value for each missing value from the files of the repository. Write the section only after the developer agrees to the proposed values.
4. Stop, and wait for the developer.

Never guess a value, and never use the value of another repository.

## The metadata header

Every file in the value "Documentation folder", and in all its subfolders, has a metadata header immediately after its title. Only the files of the value "Files with no metadata header" have no header.

- The header has these lines, in this order:
  - `Created`: the date on which the file was created.
  - `Last updated`: the date of the last change of the file.
  - `Status`: one short phrase that says what the file is, for example "Maintained index for agents and tools".
  - `Related framing`: a link to the document that sets the frame of this file, for example the project instructions.
  - `Related rules`: a link to each rule file that applies to this file. Add this line only when a rule file applies.
  - `Related issue`: a link to the issue that this file comes from. Add this line only when an issue exists.
- Write each date as day, month name, and year, for example `13 October 2026`.
- Update `Last updated` in every change of the file, and keep the date accurate.
- Write each link as a relative link that works from the folder of the file.

Example, for the file `docs/guides/index.md`:

```markdown
# Guides index

- Created: 4 October 2026
- Last updated: 8 October 2026
- Status: Maintained index for agents and tools
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Glossary](<relative link to the file index.md of the glossary folder>)

This file lists the files and the subfolders of this folder, for agents and tools.

- [README.md](README.md): the overview of this folder, for people.
- [setup.md](setup.md): the steps to set up the development environment.
```

## The two files of each folder

Every folder in the documentation folder, at every depth, has two files that describe the folder. The documentation folder itself has them too.

- `README.md` is for people. It says in plain words what the folder is for, and how to read the files of the folder. It has the metadata header, and its `Status` is "Maintained overview for people".
- `index.md` is for agents and tools. It has the metadata header, and its `Status` is "Maintained index for agents and tools". After the header, it has one introduction sentence, then one bullet for each file and each subfolder of the folder, in this form: a relative link, a colon, and one sentence that says what the file or the subfolder holds. When it helps a reader, one more sentence says when to read the file. The bullet for a subfolder links to the file `index.md` of that subfolder. The bullet for `README.md` is included. The file does not repeat the content of the files that it lists.

## Add, rename, move, or delete

- When you add, rename, move, or delete a file or a subfolder of the documentation folder, update the file `index.md` of its folder in the same change.
- When you create a new folder in the documentation folder, create its two files in the same change, and add a bullet for the new folder in the file `index.md` of its parent folder.

## The template

Write this text in the file `AGENTS.md` of the repository, when the repository has no The Rules of the Repo. The first two lines are the pointer: the file `AGENTS.md` always loads, but a skill loads only when the coding agent decides that it matches, so the pointer makes sure that the skill is read.

```markdown
## Docs folder

Every file and every folder in the folder `<documentation folder>` follows the skill [docs_folder_system](.agents/skills/docs_folder_system/SKILL.md). Read the skill before you add, change, rename, move, or delete a file or a folder in the folder `<documentation folder>`.
The skill names no detail of this repository: it reads the values of this repository in the section "Docs folder system values" below.

### Docs folder system values

- Documentation folder: <the folder that holds the documentation>
- Files with no metadata header: <each file with no metadata header and the reason, or "none">
```
