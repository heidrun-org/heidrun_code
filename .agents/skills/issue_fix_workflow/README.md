# issue_fix_workflow

## Purpose

The Issue Fix Workflow takes one existing issue through Issue Fix Setup, Issue Fix Implementation, Issue Fix Review and Issue Fix Completion. A temporary worktree keeps the change separate from the main checkout, and uncommitted changes remain visible for developer review.

## When to use

Use for a request such as “Fix issue 35,” or further changes during that issue fix. An issue number is required; creating the initial issue is a separate task. Use [issue_batch_workflow](../issue_batch_workflow/README.md) for a parent issue with two or more sub-issues.

## Requirements

The receiving project needs Git worktrees, access to the issue and comments, configured issue tracker commands, and the capabilities needed to check and launch the project. The skill uses [issue_creation](../issue_creation/README.md) when writing issue comments; install that skill for those operations. Project rules and specifications still apply.

## Install

```bash
npx skills add jeromeetienne/coding_agent_plugin --skill issue_fix_workflow --skill issue_creation
```

See [shared installation options](../../README.md#install-the-skills). Installation does not supply receiving-project commands or authorize completion before review.

## Configuration

Add the pointer and complete “Issue Fix Workflow values” section from [the instruction template](SKILL.md#the-template) to the receiving project's `AGENTS.md`. Missing values stop the workflow before reading the issue, creating a worktree or changing files. The coding agent reports the missing values and offers to propose values; approved values are never guessed.

The following complete values example assumes an illustrative GitHub project `example/project`, a `main` target branch, `pnpm dev` for launch and no chat rename capability. Replace the example with approved commands for the receiving project.

```markdown
### Issue Fix Workflow values

- Target branch: `main`.
- Worktree creation command: from the main checkout, run `git fetch origin main`, then `git worktree add -b <branch-name> .agents/worktrees/<branch-name> origin/main`.
- Worktree folder: `.agents/worktrees/<branch-name>` in the main checkout.
- Launch command: from the temporary worktree, run `pnpm dev`.
- Issue tracker commands: use `--repo example/project` for each command below. Write multiline bodies to temporary files.
  - Read an issue: `gh issue view <number> --json title,body,comments,state,url`.
  - Comment on an issue: `gh issue comment <number> --body-file <file>`.
  - Create an issue: `gh issue create --title <title> --body-file <file>`.
  - Create a pull request: push with `git push -u origin <branch-name>`, then `gh pr create --base main --head <branch-name> --title <title> --body-file <file>`.
  - Merge a pull request: `gh pr merge <number> --squash`.
  - Close an issue: `gh issue close <number>`.
- Chat rename: not available.
```

Keep these values in the receiving project, outside the reusable skill folder.

## Concrete example

Illustrative issue 35 says that opening an empty project shows an error and requires the empty project to open normally. Request:

> Fix issue 35 using the Issue Fix Workflow.

1. **Issue Fix Setup:** read issue 35 and its comments, attempt the configured chat rename, and create `.agents/worktrees/open-empty-project-35` using the configured command.
2. **Issue Fix Implementation:** correct the empty-project behaviour and update relevant documents and tests in that worktree. Leave the change uncommitted.
3. **Issue Fix Review:** give the worktree path, launch command and the check “Open an empty project and confirm that no error appears.” Stop for the developer to run the application. Only after the developer reports reviewing the result, explain the completion actions in a separate message and ask “Do you approve the reviewed issue fix for completion?” Requested corrections return to Issue Fix Implementation and restart Issue Fix Review.
4. **Issue Fix Completion:** after the developer approves the reviewed issue fix for completion, commit with `fixes #35`, create and merge the pull request, delete the temporary local and remote branch, remove the temporary worktree and close the issue.

A representative review handoff names the changed files, verification already performed and the exact worktree launch command. That handoff represents implemented work awaiting review; completion follows acceptance.

## Results and added requests

The result progresses from an uncommitted, reviewable fix to a merged pull request and closed issue after acceptance. The target branch is retained.

Related added requests stay in the same worktree, with one issue comment per request recording the developer's words, the change and linked files. The pull request repeats that record. An unrelated request needs permission to create a new issue and receives its own workflow and worktree; cross-link the issues. Uncertain requests are treated as unrelated.

## Approval boundaries

Do not commit during Issue Fix Implementation. Developer acceptance of Issue Fix Review precedes Issue Fix Completion. A request for further changes restarts implementation and review. This acceptance requirement differs from the initial-decision approval followed by automatic group completion in Issue Batch Workflow.

## Related skills and guides

- [issue_creation](../issue_creation/README.md): required when writing issue comments or new issues.
- [issue_batch_workflow](../issue_batch_workflow/README.md): related alternative for a parent issue with multiple sub-issues.
- [rules_of_the_repo](../rules_of_the_repo/README.md): applies when the receiving project uses that rule system.

## Instructions and references

- [SKILL.md](SKILL.md): exact configuration template, four parts, review messages and added-request rules.
