# Keep a Changelog Workflow

## Purpose

Generate and maintain a repository changelog in the [Keep a Changelog 1.1.0 format](https://keepachangelog.com/en/1.1.0/). Explain notable outcomes with evidence links, rather than copying commit subjects. The skill operates on the repository changelog.

## When to use

Choose one of seven operations; a complete history request can combine several operations:

| Operation | Result |
| --- | --- |
| Initialize changelog | Create an absent file with an empty Unreleased section. |
| Generate initial release | Describe the beginning of reachable history through the first version tag. |
| Add release | Insert one missing release using consecutive version tags. |
| Update release | Reconcile one existing release with evidence from its original range. |
| Update unreleased changes | Reconcile changes after the latest release through the selected revision. |
| Finalize release | Move only entries included in the supplied release tag out of Unreleased. |
| Validate changelog | Report structure, links, dates and content questions without editing. |

## Requirements

Provide readable Git history, version tags and merged pull requests with enough detail to establish delivered behaviour. The coding agent verifies inclusion in each selected range. Private repositories work with appropriate access; Git and a way to read pull requests are sufficient, such as an authenticated `gh` command for GitHub. Editing also needs write access to the changelog.

No companion skill, programming language, package manager, build system, commit-message convention, pull request labels or release automation is required. An existing changelog is optional. Missing pull request evidence is reported and a linked commit can support the change instead. Missing tags, unavailable history or incompatible release lines stop generation for that range.

## Install

```bash
npx skills add jeromeetienne/coding_agent_plugin --skill keep-a-changelog-workflow
```

See [shared installation options](../../README.md#install-the-skills). Installation does not configure the receiving project or approve release actions.

## Configuration

No configuration file is required. Resolve the repository, changelog path, exact version tags and target revision in the request. Use the existing changelog; otherwise the default is `CHANGELOG.md` at the repository root. An explicit path takes precedence. Several possible changelogs require clarification.

Dates need evidence: a supplied release date takes precedence, followed by an authoritative release record; preserve an existing valid date. A tag's commit date can be used as a proxy only with permission. Tags do not by themselves establish publication dates or a Semantic Versioning policy. Uncommitted changes are excluded unless requested.

## Concrete example

Illustrative request for a repository whose merged pull requests establish the changes below:

> Add the missing release from `0.1.0` to `0.2.0` in `CHANGELOG.md`. The confirmed release date is 9 November 2026. Preserve the other releases and manual wording.

A representative resulting section is shown below. The example repository and pull request numbers are placeholders for verified evidence in a real run.

```markdown
## [0.2.0] - 2026-11-09

### Release notes

People can now export a project as an archive. Empty projects also open reliably.

### Added

- Export a project as an archive. [Pull request 18](https://github.com/example/project/pull/18)

### Fixed

- Open an empty project without an error. [Pull request 19](https://github.com/example/project/pull/19)

[0.2.0]: https://github.com/example/project/compare/0.1.0...0.2.0
```

## Results and review

Every populated release starts with Release notes before the relevant standard categories. Empty Unreleased stays empty. Review the selected range, date source, narrative, detailed evidence links and comparison endpoints. Existing unrelated sections and manual descriptions remain intact; conflicting manual claims require a decision before material rewriting. Repeated reconciliation should not duplicate entries.

The completion report names the operation, tags or revision range, date evidence, changed path, checks and unresolved questions. A structural validation does not prove complete historical coverage. Local tags can be used, but hosted links may be unavailable; report link limitations separately from reader-facing release notes. Without an established public repository address, headings remain unlinked.

## Approval boundaries

Invoking the skill does not authorize creating or moving tags, changing package versions, committing, pushing or publishing releases. Those actions need separate instructions. Validation is read-only. Unsupported claims and unresolved release membership remain explicit.

## Related skills and guides

No companion skill is required. [issue_fix_workflow](../issue_fix_workflow/README.md) can manage a separately requested issue about a changelog. Follow receiving-project rules for the changed file.

## Instructions and references

- [SKILL.md](SKILL.md): authoritative operations, evidence, preservation and format rules.
- [Documentation conventions](../../docs/contributing/maintaining_skills.md#documentation-conventions): reader documentation conventions.
