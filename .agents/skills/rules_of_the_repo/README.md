# rules_of_the_repo

## Purpose

The skill `rules_of_the_repo` is The Rules of the Repo: one entry point that finds the rule skills applicable to a repository change and supplies each rule skill with its configuration. The skill holds no rule itself. The [shared guide](../../docs/using_skills/rules_of_the_repo.md) explains the rule types and ownership in detail.

## When to use

Use The Rules of the Repo before every repository change, or when adopting explicit rules in a new or existing repository. For example, adding a guide can require both documentation formatting and folder constraints. If applicability is uncertain, the coding agent includes the rule skill.

## Requirements

The receiving repository needs an `AGENTS.md` pointer, a rules list, and the individual rule skills selected by the human. Each selected rule skill must have complete configuration when configuration is required. No fixed companion skill or programming language is required.

## Install

For the documentation-only example below, install both selected skills:

```bash
npx skills add jeromeetienne/coding_agent_plugin --skill rules_of_the_repo --skill docs_folder_system
```

See the [collection installation options](../../README.md#install-the-skills). Installation supplies instructions; installation does not configure a receiving project or approve changes.

## Configuration

This complete small example assumes the human has chosen `docs` for documentation and no metadata exceptions. Paths in the following examples belong to an illustrative receiving repository with skills installed in `.agents/skills`.

In `AGENTS.md`:

```markdown
## The Rules of the Repo

Before every change of this repository, follow the skill [rules_of_the_repo](.agents/skills/rules_of_the_repo/SKILL.md): read the rules list, and obey each rule skill that applies to the change, with its configuration.

- Rules list: .agents/rules_of_the_repo/rules_list.md
```

In `.agents/rules_of_the_repo/rules_list.md`:

```markdown
# The Rules of the Repo

| Skill | When it applies | Rule type | Configuration |
| --- | --- | --- | --- |
| [docs_folder_system](../skills/docs_folder_system/SKILL.md) | Before any change in docs. | Static rule | [config.md](config/docs_folder_system/config.md) |
```

In `.agents/rules_of_the_repo/config/docs_folder_system/config.md`:

```markdown
# Docs folder system values

- Documentation folder: docs
- Files with no metadata header: none
```

Configuration belongs outside reusable skill folders, in a separate folder for each rule skill. Use `none` in the rules list when a rule skill needs no configuration. A missing rules-list path or file stops repository changes and prompts setup. An applicable rule skill with a missing configuration file or value also stops the change and reports the missing input.

For maintained repository-local examples, read this repository's [AGENTS.md](../../AGENTS.md), [rules list](../../.agents/rules_of_the_repo/rules_list.md), and [documentation configuration](../../.agents/rules_of_the_repo/config/docs_folder_system/config.md). This repository authors skills under `skills`; the receiving-project example above uses installed skills under `.agents/skills`.

## Concrete example

Request: “Add `docs/setup.md` explaining how to install the project's tools.” With the example configuration, the coding agent reads the rules list, selects `docs_folder_system`, supplies its configuration, and checks the guide's metadata and navigation. The coding agent adds the guide and updates `docs/index.md`; every documentation folder also needs `README.md` and `index.md`.

A change outside `docs` does not select that documentation row. In a project also using Repo Folders Constraints, adding the guide selects both rows: folder constraints check whether the guide belongs in `docs`, and documentation rules check the form. The [Repo Folders Constraints guide](../../docs/using_skills/repo_folders_constraints.md#setup-through-the-rules-of-the-repo) shows the additional row and its complete rules file.

## Results

Review the rules list, configuration files and changed files together. The expected result is a change checked against every applicable rule, or a specific missing-input report or rule-change proposal. The skill does not guarantee that installation, application tests or publication have succeeded.

## Approval boundaries

Static rules are obeyed and never changed by the coding agent. Living rules with human approval require a current/proposed comparison and Approve, Cancel or Refine before a rule change. Living rules without human approval permit agent-maintained notes to change directly.

During adoption, the human chooses rule skills and approves every configuration value. For an existing repository, the coding agent first inspects the repository, proposes configuration, identifies differences, and obtains approval for a correction plan. Large corrections are split into reviewable steps with repository tests after each step.

## Related skills and guides

Selected rule skills are required only when the receiving rules list calls for those skills:

- [docs_folder_system](../docs_folder_system/README.md): document form and folder navigation; used by the example above.
- [repo_folders_constraints](../repo_folders_constraints/README.md): human-owned folder and package boundaries.
- [context_md_system](../context_md_system/README.md): agent-maintained folder notes.
- [symbio_spec](../symbio_spec/README.md): product specification and its approval boundaries.
- [jerome-typescript-javascript-style](../jerome-typescript-javascript-style/README.md): personal coding style, when adopted by the project.
- [docs_folder_agents_rules_system](../docs_folder_agents_rules_system/README.md): **obsolete**, superseded by `symbio_spec`; retained for existing projects. New adoption should use `symbio_spec`. No automatic migration is implied.

## Instructions and references

- [SKILL.md](SKILL.md): authoritative selection procedure, rule types and setup templates.
- [The Rules of the Repo guide](../../docs/using_skills/rules_of_the_repo.md): shared explanation and adoption responsibilities.
