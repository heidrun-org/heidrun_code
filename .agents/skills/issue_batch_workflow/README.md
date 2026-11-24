# issue_batch_workflow

## Purpose

The Issue Batch Workflow completes related issues through one parent issue, grouped sub-issues and helper agents working in separate temporary worktrees. The developer resolves initial questions together; the main session then checks and merges each group without a separate developer review of each group.

## When to use

Use for a parent issue with two or more sub-issues, or a long request containing several related changes. The workflow can create a parent issue and sub-issues from the description. A single issue uses [issue_fix_workflow](../issue_fix_workflow/README.md).

## Requirements

Install both required companions: [issue_fix_workflow](../issue_fix_workflow/README.md) supplies the shared configuration contract and [issue_creation](../issue_creation/README.md) governs issue writing. The coding agent environment must support helper agents and Git worktrees. Provide authenticated issue tracker access, relevant specifications and tests, and the receiving project's check and launch capabilities.

## Install

```bash
npx skills add jeromeetienne/coding_agent_plugin --skill issue_batch_workflow --skill issue_fix_workflow --skill issue_creation
```

See [shared installation options](../../README.md#install-the-skills). Installation does not configure a project or provide the developer's initial decisions.

## Configuration

Use the receiving project's `AGENTS.md` section “Issue Fix Workflow values”: target branch, worktree creation command, worktree folder, launch command, issue tracker commands and chat rename. The [complete receiving-project example](../issue_fix_workflow/README.md#configuration) shows all values. Add the [Issue Batch Workflow pointer](SKILL.md#11-the-pointer) after that section. Keep project-specific commands outside the reusable skill.

Missing sections or values stop the workflow as specified by issue_fix_workflow; the coding agent reports missing values and does not guess. Repository specifications, such as Symbiospec when adopted, also govern the work.

## Concrete example

Illustrative request: “Fix parent issue 194: make project exports easier to use.” The parent has these sub-issues:

| Group | Sub-issues | Dependency |
| --- | --- | --- |
| A: export format | 195: define archive contents; 196: include project settings | First, because other groups consume the format. |
| B: export interface | 197: expose archive download | After A. |
| C: export documentation | 198: describe archive contents and download | After A; can run alongside B if the files are independent. |

The coding agent investigates the issues, comments and specifications, writes the grouping and order in the parent issue, then asks all open questions together with recommended answers. For example: “Should archives include project settings? Recommended: include project settings and exclude credentials.” The developer's answers are recorded in the parent issue before implementation proceeds.

The main session creates one scratch brief and one temporary worktree per group. Each brief names allowed paths, decisions, relevant rules, focused checks, existing failures and the limits on the helper agent: no commit, pull request, merge or developer questions. Group A runs first. After A passes checks and merges, fresh worktrees for B and C start from the updated target branch.

## Results and checks

Each helper agent returns changed files and focused check results. The main session runs a full test run for each changed package and checks the running application with the configured launch command. Passing groups receive commits naming each sub-issue with `fixes #<number>`, pull requests, merges, temporary branch/worktree cleanup and closed sub-issues. The target branch remains.

A representative final report says which groups merged, links their pull requests, names decisions taken during work, and lists failed or stopped groups. A group whose checks cannot be repaired keeps its worktree and is not merged. The parent closes only when all sub-issues are closed.

## Approval boundaries

Initial approval covers the prepared questions and plan. After the answers are recorded, the workflow does not wait for developer review of each group: the main session checks and merges passing groups automatically. New questions take the recommended answer, are recorded in the parent issue and are reported at the end.

This differs from Issue Fix Workflow, which waits for acceptance during Issue Fix Review before completion. Helper agents never perform group completion; the main session owns group checks and merges. A narrower task instruction, such as an assigned documentation brief forbidding commits, limits the assigned work accordingly.

## Related skills and guides

- [issue_fix_workflow](../issue_fix_workflow/README.md): required shared configuration and single-issue alternative.
- [issue_creation](../issue_creation/README.md): required for parent issues, sub-issues and comments.
- [symbio_spec](../symbio_spec/README.md): relevant specification input when used by the receiving project.

## Instructions and references

- [SKILL.md](SKILL.md): authoritative sequence, helper briefs and main-session responsibilities.
