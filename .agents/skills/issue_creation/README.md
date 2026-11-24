# issue_creation

## Purpose

Issue Creation gives a coding agent a consistent way to create GitHub or GitLab issues, attach screenshots and videos, and write issue bodies and comments. Linked files and full issue references help readers understand the request later.

## When to use

Use whenever creating an issue, attaching an image or video, or writing an issue body or comment. The skill describes issue writing; implementing the requested change is a separate task.

## Requirements

Use an installed, authenticated `gh` command for GitHub or `glab` for GitLab, with access to the target project. Attachments require readable local files. No companion skill is required. Receiving-project instructions can specify the repository and how to pass multiline text.

## Install

```bash
npx skills add jeromeetienne/coding_agent_plugin --skill issue_creation
```

See [shared installation options](../../README.md#install-the-skills). Installation does not log in to the issue tracker or authorize writing issues.

## Configuration

No configuration file is required. Establish the target repository and requested writing action. In this repository, use `gh` with `--repo jeromeetienne/coding_agent_plugin`, write multiline bodies or comments to temporary files and pass `--body-file`.

The instructions describe `--attach` for uploading images and videos, repeated for multiple attachments. For GitHub the described path can include alternative text after `#`; the described GitLab option is experimental and takes a path without alternative text. These are documented commands from SKILL.md, not commands live-tested during this documentation update. Check the installed command's attachment support before relying on an upload.

## Concrete example

Illustrative request for the example repository below:

> Create an issue about the empty project error. Link the affected file and the existing project-loading issue. Do not implement a fix.

Representative resulting issue title: **Opening an empty project shows an error**.

```markdown
Opening an empty project shows an error instead of the empty project view.

Steps to reproduce:

1. Create a project with no documents.
2. Open the project.

Expected result: the empty project view appears without an error.
Observed result: an error appears.

The affected code is [project_loader.ts](https://github.com/example/project/blob/main/src/project_loader.ts).

Related project-loading work:

- https://github.com/example/project/issues/12
```

The example repository, file and issue number are illustrative. In a real request, use the actual repository and the branch containing the file. On GitLab, file links have the form `https://<host>/<group>/<project>/-/blob/main/<path>`; the described issue-reference bullet is `- #12+`.

## Results and review

The result is an issue, updated body or comment in the selected project, with readable file links and issue references. Each repository file mentioned in issue text is a link. Each related issue gets its own bullet containing only the plain issue address on GitHub; explanatory text goes above the list. These writing rules apply to comments too.

Upload requested screenshots and videos directly to the issue using the documented attachment mechanism. Never commit or push an image solely to display the image in an issue. The instructions describe a Markdown image reference for positioning an uploaded image in the body; the attachment flag rewrites the local image reference after upload. Review the resulting issue text, links and attachment display; a sample command alone does not establish that an upload worked.

## Approval boundaries

Write only the requested issue or comment in the intended repository. Attachments must be within the authorized scope; an instruction to describe a problem does not itself select a private screenshot for publication. Issue creation does not authorize implementation, commits or merges.

## Related skills and guides

No companion skill is required. [issue_fix_workflow](../issue_fix_workflow/README.md) uses Issue Creation for added-request comments. [issue_batch_workflow](../issue_batch_workflow/README.md) uses Issue Creation for parent issues, sub-issues and decisions.

## Instructions and references

- [SKILL.md](SKILL.md): authoritative creation, attachment and issue-text conventions.
