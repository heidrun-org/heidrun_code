# repo_folders_constraints

## Purpose

The skill `repo_folders_constraints` reads, obeys and proposes changes to Repo Folders Constraints: one human-owned rules file defining the responsibilities and boundaries of repository folders and packages. Written constraints prevent a requested change from silently changing the repository's organization.

## When to use

Use the skill before creating, moving, renaming or deleting a folder or package; adding a file; adding imports or dependencies between packages; changing required language or technologies; or changing content with a prescribed workflow. A missing folder rule also requires the skill.

## Requirements

The caller must supply the path of the human-owned rules file. The rules file has separate tables for packages and other folders. No companion skill or particular programming language is required. The Rules of the Repo is an optional caller.

## Install

```bash
npx skills add jeromeetienne/coding_agent_plugin --skill repo_folders_constraints
```

See the [collection installation options](../../README.md#install-the-skills). Installation supplies the instructions; installation does not choose rules or approve changes.

## Configuration

For standalone use, this complete example section in a receiving project's `AGENTS.md` points to an illustrative rules file:

```markdown
## Repo Folders Constraints

Every folder and every package of this repository follows the skill [repo_folders_constraints](.agents/skills/repo_folders_constraints/SKILL.md). Read the skill before you create, move, rename, or delete a folder or a package, and before you add an import between packages.

- Rules file: .agents/repo_folders_constraints.md
```

Put the rules below in `.agents/repo_folders_constraints.md`, after human approval. The [dedicated guide](../../docs/using_skills/repo_folders_constraints.md) expands the example and supplies coordinated setup through The Rules of the Repo. The caller always supplies the path; the skill never searches for or guesses the path. Without the path, the coding agent warns, shows the template, asks for the path and stops folder/package changes.

## Concrete example

Illustrative rules file:

```markdown
# Repo Folders Constraints

## Packages

| Folder | Does | Never does | May import | Language and technologies | Workflow |
| --- | --- | --- | --- | --- | --- |
| packages/core | Calculate totals. | Read files or call services. | no other package | TypeScript | Change with relevant tests. |

## Other folders

| Folder | Does | Never does | Language and technologies | Workflow |
| --- | --- | --- | --- | --- |
| docs | Explain installation and use. | Hold implementation files. | Markdown | Follow docs_folder_system. |
```

Request: “Add a live price lookup in `packages/core`.” The coding agent first looks for a solution that respects the existing boundary. If the request requires service access from `packages/core`, the coding agent presents this review before editing the rules or making the conflicting change:

| Current rule | Proposed rule |
| --- | --- |
| packages/core never reads files or calls services. | packages/core never reads files; packages/core may call the price service. |

The human chooses Approve, Cancel or Refine. Approve permits the proposed rule to be written before continuing. Cancel preserves the rule and prevents the conflicting change. Refine produces a revised proposal for review. These sample rules are illustrative; the sample does not adopt constraints for this repository.

## Results

The expected result is a change checked against the affected folder/package rows, or a proposal showing the current and proposed rules. Review the changed files and any approved rules-file changes together. A folder without a rule, or a needed decision marked `not decided yet`, requires a proposal rather than an invented rule.

## Approval boundaries

The human owns the rules file. The coding agent never changes the rules file without human approval. A rule that disagrees with the code requires a proposal; the code does not automatically determine the intended rule.

## Related skills and guides

- [Repo Folders Constraints guide](../../docs/using_skills/repo_folders_constraints.md): complete rule columns, setup alternatives, missing decisions and review examples.
- [rules_of_the_repo](../rules_of_the_repo/README.md): optional coordination with other rule skills.
- [context_md_system](../context_md_system/README.md): optional agent-maintained folder notes. When notes disagree with Repo Folders Constraints, the human-owned rules file wins and the coding agent corrects the notes.
- [docs_folder_system](../docs_folder_system/README.md): required by the illustrative `docs` workflow above, rather than by Repo Folders Constraints itself.

## Instructions and references

[SKILL.md](SKILL.md) is authoritative for the rules-file format, caller-supplied path and proposal procedure.
