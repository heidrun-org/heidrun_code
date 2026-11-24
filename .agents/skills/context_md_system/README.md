# context_md_system

## Purpose

The skill `context_md_system` maintains the CONTEXT.md system: short folder notes explaining purpose, public exports and boundaries. The notes help a coding agent understand a folder before changing files, without repeatedly reconstructing the folder's responsibilities.

## When to use

Use the skill before editing or adding files, when creating a source-code or component folder, when adding a core file or changing a folder's exports or responsibility, when a `CONTEXT.md` file exceeds 5500 bytes, or when adding checks for context files.

The coding agent reads the nearest `CONTEXT.md` first, then parent context files up to the repository root. A subfolder's notes override or narrow parent notes for that subfolder. Each context file covers its own folder and descendants without their own context file.

## Requirements

The coding agent needs access to repository files and parent context files. No companion skill, configuration file or particular programming language is required. Tests become useful when there are too many context files to review by hand.

## Install

```bash
npx skills add jeromeetienne/coding_agent_plugin --skill context_md_system
```

See the [collection installation options](../../README.md#install-the-skills). Installation does not rewrite repository notes or approve product changes.

## Configuration

No configuration values are needed. A receiving project can require the skill through `AGENTS.md`, for example:

```markdown
Before editing or adding files, follow the skill [context_md_system](.agents/skills/context_md_system/SKILL.md). Maintain affected CONTEXT.md files in the same change.
```

The skill can also be registered in The Rules of the Repo with rule type `Living rule without human approval` and configuration `none`.

## Concrete example

Illustrative folder `packages/totals` exports `calculateTotal` through `index.ts`. The folder's `CONTEXT.md` can read:

```markdown
# Directory Context: `/packages/totals`

## Purpose
Calculate invoice totals from supplied prices and quantities.

## Key Exports & Entry Points
- `index.ts`: exports calculateTotal.

## Rules
- This package never imports the user interface package.

## Background
The caller supplies prices so calculations remain independent of service access.
```

Request: “Add an exported `calculateDiscount` operation.” After reading the nearest and parent context files, the coding agent changes the implementation and updates the export description in the same change to “`index.ts`: exports calculateTotal and calculateDiscount.” The context file describes the public interface rather than listing every implementation file.

If a later change introduces a distinct `packages/totals/discounts` source folder, the coding agent creates that folder's own `CONTEXT.md` immediately. The parent notes name the discounts subfolder and its purpose on one line, without listing the files inside the discounts subfolder.

## Results

Review the context file alongside the implementation change. Each context file has Purpose, Key Exports & Entry Points, Rules and Background sections, in that order. Each context file stays under 5500 bytes; a file that grows over 5500 bytes is reduced to 4500 bytes. Keep rules in present tense, link history, and link facts maintained elsewhere instead of copying facts.

At larger scale, verification checks package/workspace coverage, heading paths, section order and the byte limit. The skill's context-file test does not check Markdown link destinations. Link checking is a separate check.

## Approval boundaries

Context files are agent-maintained notes and can be updated without human approval. Updating notes does not authorize changing human-owned rules or product decisions. When [Repo Folders Constraints](../repo_folders_constraints/README.md) disagrees with a context file, the human-owned rules file takes precedence and the coding agent corrects the context file.

## Related skills and guides

- [repo_folders_constraints](../repo_folders_constraints/README.md): optional human-owned boundaries complementing context notes.
- [rules_of_the_repo](../rules_of_the_repo/README.md): optional coordination of applicable rule skills.
- [Repo Folders Constraints guide](../../docs/using_skills/repo_folders_constraints.md): ownership and conflict examples.

## Instructions and references

[SKILL.md](SKILL.md) gives the authoritative reading order, maintenance triggers, verification rules and context-file template.
