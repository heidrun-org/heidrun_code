---
name: pull_request_creation
description: Write or revise pull request titles and descriptions from the complete change and actual validation. Use when preparing a pull request or publishing one through the receiving repository's workflow; also applies to GitLab merge requests.
---

# Pull Request Creation

Prepare a title and description that let a reviewer understand and assess the change without reading the conversation. The receiving repository decides when and how a pull request may be published.

## Establish the change and the publication stage

Read the receiving repository's instructions, pull request template, and review and publication workflow. Establish the target repository, source branch, destination branch, and whether the request is to prepare text, revise an existing pull request, or publish a pull request. Use the repository's configured tools and commands. Do not assume a branch name or introduce a configuration requirement for writing text.

Inspect the complete change against the intended destination, including the changed files and relevant history. During preparation, also inspect staged, unstaged, and relevant untracked files so the description covers the intended final change. Distinguish local changes from the changes that a published pull request would actually contain. Read related issues, accepted added requests, and available validation results. If required evidence is unavailable, identify the gap and qualify the draft instead of inventing facts.

## Write the title

Name the actual change with a concrete verb and the affected behavior or capability. Follow the repository's title conventions. A title such as "Show the empty project view when no documents exist" tells a reviewer more than "Fix project issue". An issue number alone does not describe the change.

Choose wording that covers the complete change. When the scope changes, rewrite the title around the final implementation rather than preserving the original request's wording.

## Write the description

Lead with the problem and resulting behavior, then explain what changed and why. Give a concrete trigger and before/after example when useful. Explain decisions or tradeoffs that help a reviewer assess the result; omit the conversation history and abandoned approaches unless the history explains a remaining constraint.

Match the length to the complexity. A small correction usually needs one or two sentences plus relevant validation. A change across several areas may need separate paragraphs or a short list covering each material part, interactions, and risks. Use headings when helpful or required by a template; do not expand a small change into a long report merely to fill sections.

Use Markdown formatting to make the description easier to read. Use headings to separate topics, lists for related items or steps, emphasis for important points, links for references, and inline code or fenced code blocks for commands and code, as appropriate. Keep formatting proportional to the content and follow the receiving repository's templates and file-link and issue-reference rules. Leave a blank line before lists and between headings and their content.

Report validation actually performed: the relevant checks or commands, their results, and the behavior or environment exercised. Distinguish source inspection, automated checks, manual use, and live verification where the distinction affects confidence. State relevant failures, skipped checks, unavailable environments, limitations, and unfinished work. Do not describe a planned check as passed, or imply that a successful local check proves deployment or live behavior.

Link relevant issues in a form supported by the receiving repository. Use a closing reference only when the change resolves the issue and the repository intends closure on merge; use a related reference for partial work. Describe material work beyond the original issue so the description agrees with the whole change.

## Check consistency and hand off

Read the proposed title and description alongside the complete final change, issue scope, and validation evidence. Correct stale claims, omitted material changes, and overstated completion. If implementation is still changing, keep the description provisional and repeat this comparison before publication.

For a text-only request, return the proposed title and description. Creating or editing a remote pull request, committing, pushing, merging, deploying, closing issues, and cleanup follow the receiving repository's workflow and the user's authorization. This skill does not move work past a required review or authorize those actions by itself.

When publication is authorized and the workflow is ready, use the receiving repository's command or integration. Preserve actual newlines in multiline descriptions; when using a command line, write the body to a temporary file and pass the supported body-file option. Check the resulting pull request's destination, source, title, and body. Report the pull request link and any incomplete action accurately. If publication fails, report the failure and retain the prepared text; do not claim publication succeeded.

## Relationship to Issue Creation

Issue Creation records problems, requests, and issue comments. Pull Request Creation explains an implementation for review. No companion skill is required to write a pull request. When an authorized task also requires writing an issue or issue comment, use the receiving repository's issue-writing rules and `issue_creation` when available. Do not copy issue-specific formatting requirements into pull requests unless the receiving repository requires them.
