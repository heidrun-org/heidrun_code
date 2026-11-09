# issue_batch_workflow

The skill `issue_batch_workflow` gives a coding agent one fixed way to fix a batch of related issues: one parent issue and its sub-issues. This fixed way is the Issue Batch Workflow.

## Purpose

When a developer fixes several related issues one by one with the [issue_fix_workflow](../issue_fix_workflow/README.md), the developer waits for each question and reviews each fix. The Issue Batch Workflow makes the batch fast, so that:

- The developer speaks two times: at the start (the description and the answers), and at the end (the result).
- The coding agent asks every open question in one message, with a recommended answer for each question.
- The independent groups of sub-issues run at the same time, each in its own temporary worktree, with its own helper agent.
- The coding agent checks, merges, and closes each group without a review of the developer.

## The steps

1. Read or create the batch: the coding agent reads the parent issue and its sub-issues, or creates them from the description of the developer.
2. Write the plan and ask every question at once: the coding agent groups the sub-issues by area, orders the groups by their dependencies, writes the plan in the parent issue, and asks every open question.
3. Record the answers: the coding agent writes the answers in the parent issue. From here, nothing waits for the developer.
4. Write one brief file for each group: the sub-issues, the decisions, the rules, and the test commands of the group.
5. Do the work without the developer: one temporary worktree and one helper agent for each group.
6. Check and merge each group: one full test run for each changed package, a check of the running application, then the commit, the pull request, the merge, and the close of the sub-issues.
7. Send one short final message: what is merged, the answers taken without the developer, and anything that failed.

## When the coding agent uses the skill

- The developer gives a long description of several changes.
- The developer gives a parent issue with sub-issues, for example "fix #194" when issue 194 has sub-issues.

## Configuration

The skill `issue_batch_workflow` names no branch, no tool, and no command of one repository. The skill uses the section "Issue Fix Workflow values" of the file `AGENTS.md` of the receiving project, as the [issue_fix_workflow](../issue_fix_workflow/README.md) does. The section "The pointer" of [SKILL.md](SKILL.md) gives the text to add to the file `AGENTS.md`.

The skill also uses the skills `issue_fix_workflow` and `issue_creation`. Install them together.

## Install

```bash
npx skills add jeromeetienne/coding_agent_plugin --skill issue_batch_workflow --skill issue_fix_workflow --skill issue_creation
```

## Files

- [SKILL.md](SKILL.md): the instructions for the coding agent.
