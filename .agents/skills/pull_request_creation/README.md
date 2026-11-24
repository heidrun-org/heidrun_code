# pull_request_creation

## Purpose

For people adopting shared coding-agent skills: Pull Request Creation answers how to obtain a useful pull request title and description that a reviewer can understand without reading the conversation.

## When to use

Use when preparing or revising pull request text, or creating a pull request at the publication stage allowed by the receiving repository. The same writing guidance applies to GitLab merge requests.

## Requirements

The coding agent needs the complete intended change, receiving-repository instructions and templates, relevant issues, and evidence of validation performed. Readable local files and Git history are sufficient to prepare text. Creating or updating a remote pull request also needs the receiving repository's authenticated tool or integration and appropriate access. No companion skill is required.

## Install

```bash
npx skills add jeromeetienne/coding_agent_plugin --skill pull_request_creation
```

See [shared installation options](../../README.md#install-the-skills). Installation supplies instructions; installation does not authorize publishing changes or replace receiving-project review requirements.

## Configuration

No configuration file is required. Keep repository-specific commands, branches, and approval rules in the receiving repository's instructions. For example, a receiving project that installs skills under `.agents/skills/` can add this pointer to its `AGENTS.md`:

```markdown
## Pull request writing

Before preparing or revising a pull request title or description, read
[pull_request_creation](.agents/skills/pull_request_creation/SKILL.md).
Follow this repository's existing review and publication workflow.
```

Adapt the path to the installed location. If a destination branch or required evidence is missing, the coding agent identifies the missing information rather than assuming a repository's values.

## Concrete example

Illustrative request and evidence:

> Prepare pull request text only. The complete change makes an empty project show the empty project view instead of an error and adds a regression test. The project-loading tests passed locally. Manual application review has not been performed. The change resolves issue https://github.com/example/project/issues/12.

Representative title: **Show the empty project view when no documents exist**.

Representative description:

```markdown
Opening a project with no documents previously showed an error. The project
loader now shows the empty project view, allowing users to add a first document.
A regression test covers opening an empty project.

Validation: project-loading tests passed locally. Manual application review
has not been performed.

Fixes https://github.com/example/project/issues/12.
```

The repository, issue, implementation, and test results in this example are illustrative. The closing reference assumes the receiving repository intends issue closure. A real description reports only evidence available for the actual change. The text-only request produces proposed text without publication.

## Results and review

The result is a proposed title and description, or an authorized created or updated pull request with a link. Review the text against the complete change, relevant issues, and actual validation evidence. Small changes receive short descriptions; complex changes receive enough detail to explain their scope and tradeoffs. Limitations and unfinished work remain visible.

## Approval boundaries

The receiving repository retains control of review and publication. Preparing text does not authorize commits, pushes, remote pull request changes, merges, deployment, issue closure, or cleanup. An existing publication request remains subject to that repository's required review stage.

## Related skills and guides

No companion skill is required. [Issue Creation](../issue_creation/README.md) complements Pull Request Creation by recording problems and requests. [Issue Fix Workflow](../issue_fix_workflow/README.md) and [Issue Batch Workflow](../issue_batch_workflow/README.md) can use Pull Request Creation at their respective publication stages; adopting Pull Request Creation does not change either workflow's review requirements.

See [How the skills work together](../../docs/using_skills/skills_together.md) for collection relationships.

## Instructions and references

- [SKILL.md](SKILL.md): authoritative writing and publication-stage instructions.
