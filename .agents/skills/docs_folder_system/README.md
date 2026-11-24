# docs_folder_system

## Purpose

The skill `docs_folder_system` gives every documentation file a consistent metadata header and every documentation folder predictable navigation. The Docs folder system helps people and coding agents find maintained documents without reading every document.

The skill governs document form and organization. The skill does not decide the meaning of product rules or approve changes to product decisions.

## When to use

Use the skill before adding, changing, renaming, moving or deleting a file or folder inside the configured documentation folder, at every depth.

## Requirements

The caller must supply the documentation folder and the files exempt from metadata, including a reason for each exemption or `none`. No companion skill or build tool is required. The Rules of the Repo is an optional caller.

## Install

```bash
npx skills add jeromeetienne/coding_agent_plugin --skill docs_folder_system
```

See the [collection installation options](../../README.md#install-the-skills). Installation supplies instructions; installation does not choose a documentation folder, approve content or publish a website.

## Configuration

For standalone use, this complete receiving-project example assumes the human selected `docs` and no metadata exceptions. In `AGENTS.md`:

```markdown
## Docs folder

Every file and every folder in the folder docs follows the skill [docs_folder_system](.agents/skills/docs_folder_system/SKILL.md). Read the skill before you add, change, rename, move, or delete a file or a folder in the folder docs.
The skill names no detail of this repository: it reads the values of this repository in the section "Docs folder system values" below.

### Docs folder system values

- Documentation folder: docs
- Files with no metadata header: none
```

With The Rules of the Repo, the caller instead supplies a configuration file with those same two values. See the [complete coordinated example](../rules_of_the_repo/README.md#configuration), or this repository's actual [rules list](../../.agents/rules_of_the_repo/rules_list.md) and [configuration](../../.agents/rules_of_the_repo/config/docs_folder_system/config.md).

When a caller supplies no values or a value is missing, the coding agent stops documentation changes, reports the missing values and shows the setup template. The coding agent may offer proposed values, but writes configuration only after the developer agrees. The coding agent never guesses values or borrows values from another project.

## Concrete example

Assume `docs/README.md` and `docs/index.md` already exist. Request: “Add a setup guide in `docs/setup.md`.” The resulting illustrative folder is:

```text
docs/
  README.md
  index.md
  setup.md
```

The start of `docs/setup.md` can read:

```markdown
# Setup

- Created: 9 November 2026
- Last updated: 9 November 2026
- Status: Maintained setup guide
- Related framing: [Project instructions](../AGENTS.md)

Install the project's required tools before running the project.
```

Add `Related rules` after `Related framing` when a rule file applies, and `Related issue` after that when an issue exists. Use working relative links for repository documents. Keep the original Created date and update Last updated on every edit.

The illustrative `docs/index.md` contains:

```markdown
# Documentation index

- Created: 9 November 2026
- Last updated: 9 November 2026
- Status: Maintained index for agents and tools
- Related framing: [Project instructions](../AGENTS.md)

This file lists the documentation files for agents and tools.

- [README.md](README.md): the documentation overview for people.
- [setup.md](setup.md): the steps for preparing the project tools.
```

The `docs/README.md` has the same metadata form with Status `Maintained overview for people`, and explains the folder's purpose and how to read the documents. Each new subfolder needs its own `README.md` and `index.md` in the same change, plus a parent index entry linking to the subfolder's `index.md`.

## Results

Review the guide, metadata and index changes together. Adding, renaming, moving or deleting a document requires the corresponding local index update in the same change. The index has one introductory sentence and one relative-link bullet per file or subfolder, including `README.md`. The index does not repeat the documents' content.

## Approval boundaries

Following an agreed document form does not approve the document's meaning. Human-owned rules and product decisions retain their own review requirements. The skill does not authorize publication or changing the supplied repository values without agreement.

## Related skills and guides

- [rules_of_the_repo](../rules_of_the_repo/README.md): optional coordination and configuration delivery.
- [symbio_spec](../symbio_spec/README.md): product specification content; follow Docs folder system when the project requires the form.
- [docs_folder_agents_rules_system](../docs_folder_agents_rules_system/README.md): **obsolete**, superseded by `symbio_spec`, and retained for existing projects. The obsolete skill requires `docs_folder_system`; `docs_folder_system` does not require the obsolete skill. New adoption should use `symbio_spec`, with migration handled separately.

## Instructions and references

[SKILL.md](SKILL.md) is authoritative for metadata order, folder navigation, missing-value handling and the standalone configuration template.
