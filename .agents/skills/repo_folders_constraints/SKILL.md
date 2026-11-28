---
name: repo_folders_constraints
description: Read, obey, and propose changes to the Repo Folders Constraints of a repository, the one rules file, owned by the human, that says for each folder and each package what it does, what it never does, which packages it may import, which language and technologies it uses, and how its content is changed. Use it before you create, move, rename, or delete a folder or a package, before you add an import between packages, before you add a file in a folder, and when a folder or a package has no rule in the rules file.
---

# Repo Folders Constraints

The Repo Folders Constraints are the rules of the folders and of the packages of a repository, in one rules file, in one place. The human owns the rules file and reviews the rules file. The coding agent reads the rules file and obeys the rules file, but never changes the rules file without the approval of the human. This skill names no detail of one repository, so the folder of this skill can be copied to another repository.

The rules file is a living rule with human approval. The `CONTEXT.md` files are different: they are the notes of the coding agent, which the coding agent changes without the approval of the human. Both stay. When the rules file and a `CONTEXT.md` file disagree, the rules file wins, and the coding agent corrects the `CONTEXT.md` file.

## The path of the rules file

The caller always gives the path of the rules file to this skill. The skill never searches for the rules file, and never guesses a path. The skill works the same way for each caller.

- With The Rules of the Repo: The Rules of the Repo gives the path of the rules file, from its own configuration folder.
- Without The Rules of the Repo: the file `AGENTS.md` of the repository has a section "Repo Folders Constraints" that gives the path of the rules file. See the section "The template".

When no caller gives the path, do these steps, in this order:

1. Do not create, move, rename, or delete a folder or a package.
2. Warn the developer in one short message: "The Repo Folders Constraints are not configured in this repository."
3. Show the template in the section "The template", and ask for the path of the rules file.
4. Stop, and wait for the developer.

## Obey the rules

Before each of these changes, read the rules file, and find the rule of each folder and of each package that the change touches:

- Create, move, rename, or delete a folder or a package.
- Add a file in a folder.
- Add an import from one package into another package, or add a dependency in a `package.json` file.
- Change the language or a required technology of a package.
- Change the content of a folder that has its own workflow, for example a folder that only a command writes.

Then check the change against each rule:

1. "Does": the change agrees with what the folder does.
2. "Never does": the change does nothing that the folder never does.
3. "May import": each import and each dependency between packages is in the list of the package.
4. "Language and technologies": the change keeps the language and the required technologies.
5. "Workflow": the change follows the way that the content of the folder is changed.

When the change breaks a rule, correct the change so that it obeys the rule. When the change cannot obey the rule, stop and propose a change of the rule, as the section "Propose a change of a rule" says. Never break a rule in silence.

## Propose a change of a rule

Propose a change of the rules file in these cases:

- A folder or a package has no rule in the rules file, for example a new package.
- A rule says "not decided yet", and the change needs a decision, for example the first plugin of a plugins folder.
- A rule is wrong, or does not agree with the code any more.
- The developer asks for work that breaks a rule.

Do these steps, in this order:

1. Do not change the rules file.
2. Show the developer the rule as it is now, and the proposed rule, in a short table.
3. Ask the developer to choose one of three answers: Approve, Cancel, or Refine.
4. Approve: write the proposed rule in the rules file, then continue the work.
5. Cancel: keep the rule as it is, and do not make the change that breaks the rule.
6. Refine: discuss with the developer, then show the new proposed rule, and ask again.

## The form of the rules file

The rules file is one markdown file. It has one table for the packages and one table for the other folders. Each row is one folder or one package. The columns are:

- Folder: the path of the folder, from the root of the repository.
- Does: what the folder does, in a few words.
- Never does: what the folder must never do or hold.
- May import: the other packages that the package may import, or "no other package". Only for the table of the packages.
- Language and technologies: the required language and the required technologies.
- Workflow: the way that the content of the folder is changed, for example the skill to follow, or the command that writes the folder.

Write "not decided yet" in a cell when the human has not decided yet. Write "—" in a cell when the rule does not apply. Keep each cell short: the rules file is for a review by the human, so the reasons and the history stay in the issue tracker and in the `CONTEXT.md` files.

## The template

Write this text in the file `AGENTS.md` of the repository, when the repository has no The Rules of the Repo. The first sentence is the pointer: the file `AGENTS.md` always loads, but a skill loads only when the coding agent decides that it matches, so the pointer makes sure that the skill is read.

```markdown
## Repo Folders Constraints

Every folder and every package of this repository follows the skill [repo_folders_constraints](.agents/skills/repo_folders_constraints/SKILL.md). Read the skill before you create, move, rename, or delete a folder or a package, and before you add an import between packages.

- Rules file: <the path of the rules file>
```
