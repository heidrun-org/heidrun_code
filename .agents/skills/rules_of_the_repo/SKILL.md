---
name: rules_of_the_repo
description: The one entry point for all the rules of a repository. Find which rule skills apply to a change, give each rule skill its configuration, check the change against each rule, and correct each violation or ask the human to approve a change of a rule. Use it before every change of the repository (a source file, a package, a dependency, the behavior of the product, the documentation, a folder), and when the developer asks to set up The Rules of the Repo in a new or an existing repository.
---

# The Rules of the Repo

The Rules of the Repo is the one entry point for the rules of a repository. It holds no rule itself. It knows which rule skills apply to a change and where the configuration of each rule skill is. Each rule skill knows how to enforce its own rules, and knows nothing about The Rules of the Repo. This skill names no detail of one repository, so the folder of this skill can be copied to another repository.

## The rules list

The rules list is one markdown file. It has one table, with one row for each rule skill that the repository uses. The columns are:

- Skill: the link to the file `SKILL.md` of the rule skill.
- When it applies: the changes that need the rule skill, in a few words.
- Rule type: one of the three rule types of the section "The rule types".
- Configuration: the link to the configuration file of the rule skill, or "none" when the rule skill needs no configuration.

The file `AGENTS.md` of the repository gives the path of the rules list, in the section "The Rules of the Repo". See the section "The template".

### When the rules list is missing

When the file `AGENTS.md` gives no path, or when the rules list does not exist, do these steps, in this order:

1. Do not change the repository.
2. Warn the developer in one short message: "The Rules of the Repo is not configured in this repository."
3. Show the templates in the section "The template", and offer to set up The Rules of the Repo, as the section "Set up The Rules of the Repo" says.
4. Stop, and wait for the developer.

## Before each change

Before each change of the repository, do these steps, in this order:

1. Read the rules list.
2. Find each row whose column "When it applies" matches the change. When you are not sure that a row matches, the row matches.
3. For each row that matches, read the file `SKILL.md` of the rule skill, and give the rule skill the path of its configuration file, from the column "Configuration".
4. The rule skill checks that its configuration is complete. A missing configuration file, or a missing value, is an error: stop, and say which configuration and which value are missing. Never skip a rule skill in silence.
5. Check the change against the rules of each rule skill, as the rule skill says.
6. When the change breaks a rule, correct the change. When the change needs a change of a rule, follow the section "The rule types".

A rule skill works the same way when a caller other than The Rules of the Repo gives its configuration, for example a section of the file `AGENTS.md`. The rule skill never needs to know who called it.

## The rule types

- Static rule: the coding agent obeys the rule, and corrects each violation. The coding agent never changes the rule. Example: a coding style.
- Living rule with human approval: the rule changes when the repository changes, but only after the approval of the human. The coding agent never changes the rule without that approval. Examples: the rules of the folders, the product specification.
- Living rule without human approval: the notes of the coding agent, for its own future use. The coding agent changes the rule without the approval of the human. Example: the `CONTEXT.md` files.

For a living rule with human approval, do these steps, in this order:

1. Do not change the rule.
2. Show the developer the rule as it is now, and the proposed rule, in a short table.
3. Ask the developer to choose one of three answers: Approve, Cancel, or Refine.
4. Approve: write the proposed rule, then continue the work.
5. Cancel: keep the rule as it is, and do not make the change that breaks the rule.
6. Refine: discuss with the developer, then show the new proposed rule, and ask again.

## The configuration files

- A configuration file is never inside the folder of a rule skill, so that the same rule skill can be used in another repository with another configuration.
- Each rule skill has its own configuration file, in its own folder, named after the rule skill.
- The configuration file gives the values that the rule skill asks for, with the names that the rule skill uses.
- The rule type of the configuration file is the rule type of its row in the rules list.

## Set up The Rules of the Repo

### Suggested configuration locations

During setup, suggest these paths relative to the receiving repository root:

- Rules list: `.agents/rules_of_the_repo/rules_list.md`.
- Configuration of each rule skill that needs configuration: `.agents/rules_of_the_repo/config/<skill-name>/config.md`.

Replace `<skill-name>` with the selected rule skill's name. Keep repository configuration outside installed skill folders. An explicit repository choice overrides these suggestions; preserve existing configured locations. Propose these values for human approval before writing the configuration.

The Rules of the Repo selects rule skills and supplies their configuration. Docs Agent Rules, provided by the obsolete `docs_folder_agents_rules_system`, is a separate system. Configuring The Rules of the Repo does not require adopting Docs Agent Rules or copying its original repository files. Do not request `docs_folder_agents_rules_system` as a setup requirement. Select only the rule skills needed by the receiving repository and chosen by the human.

### In a new repository

1. Ask the developer which rule skills the repository uses.
2. Create the rules list, and one configuration folder for each rule skill that needs a configuration.
3. Write each configuration file with the developer. Each value needs the approval of the developer.
4. Write the section "The Rules of the Repo" in the file `AGENTS.md`.
5. Obey the rules from the next change.

### In an existing repository

1. Read the folders, the packages, the conventions, and the dependencies of the repository.
2. Propose the rule skills that apply, and propose a value for each configuration from the files of the repository. Write each value only after the developer agrees.
3. Find the differences between the repository and the rules.
4. Propose a plan to remove the differences, and wait for the developer to approve the plan. A plan can be long: for example, a coding style applied to a large repository can change thousands of files and take hours. Split a long plan into steps that the developer can review one at a time.
5. Run the tests of the repository after each step.

## The template

Write this text in the file `AGENTS.md` of the repository. The first sentence is the pointer: the file `AGENTS.md` always loads, but a skill loads only when the coding agent decides that it matches, so the pointer makes sure that the skill is read.

```markdown
## The Rules of the Repo

Before every change of this repository, follow the skill [rules_of_the_repo](.agents/skills/rules_of_the_repo/SKILL.md): read the rules list, and obey each rule skill that applies to the change, with its configuration.

- Rules list: .agents/rules_of_the_repo/rules_list.md
```

Write the rules list from this template:

```markdown
# The Rules of the Repo

| Skill | When it applies | Rule type | Configuration |
|---|---|---|---|
| [<skill name>](<path of SKILL.md>) | <the changes that need the skill> | <rule type> | [config.md](<path of the configuration file>) or none |
```
