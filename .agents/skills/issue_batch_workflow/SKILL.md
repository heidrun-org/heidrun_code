---
name: issue_batch_workflow
description: Fix a batch of related issues fast, from one parent issue and its sub-issues. Group and order the sub-issues, ask every question at once, run the independent groups in parallel in their own worktrees with helper agents, check and merge each group without a review of the developer, and end with one short final message. Use it when the developer gives a long description of several changes, or a parent issue with sub-issues, for example "fix #194" when issue 194 has sub-issues. The values of the repository (the target branch, the commands) are in the section "Issue Fix Workflow values" of the file AGENTS.md of the repository.
---

# Issue Batch Workflow

The Issue Batch Workflow fixes a batch of related issues with the least time and the least waiting for the developer. The developer speaks two times: at the start (the description and the answers), and at the end (the result). The steps are general: they name no branch, no tool, and no command of one repository. Do not change this file for one repository.

Use the [issue_fix_workflow](../issue_fix_workflow/SKILL.md) for one issue. Use the Issue Batch Workflow for one parent issue with two or more sub-issues.

## 1. The values of the repository

Read the section "Issue Fix Workflow values" of the file `AGENTS.md` before step 2.1. The Issue Batch Workflow uses the same values as the Issue Fix Workflow: the target branch, the worktree creation command, the worktree folder, the launch command, the issue tracker commands, and the chat rename. When the section or one value is missing, do what the section "When the values are missing" of the [issue_fix_workflow](../issue_fix_workflow/SKILL.md) says, and stop.

### 1.1. The pointer

Write this text in the file `AGENTS.md` of the repository, after the section "Issue Fix Workflow values". The file `AGENTS.md` always loads, but a skill loads only when the coding agent decides that it matches, so the pointer makes sure that the skill is read.

```markdown
## Issue Batch Workflow

A batch of related issues (one parent issue with two or more sub-issues) follows the skill [issue_batch_workflow](.agents/skills/issue_batch_workflow/SKILL.md), in place of the Issue Fix Workflow. Read the skill before you start, each time that the developer asks to fix such a batch. The skill uses the section "Issue Fix Workflow values" above.
```

## 2. The steps

### 2.1. Read or create the batch

1. When the developer gives an existing parent issue, read the parent issue, its sub-issues, and their comments, with the command "read an issue". Find the sub-issues in the parent issue (the links, and the sub-issues of the issue tracker).
2. When the developer gives a description in the chat, create one parent issue with the description, and one sub-issue for each change, with the command "create an issue" and the skill [issue_creation](../issue_creation/SKILL.md). Link each sub-issue to the parent issue.
3. Rename the chat, as the value "Chat rename" says.

### 2.2. Write the plan and ask every question at once

1. Investigate before you ask. Read the code, the tests, the specifications (for example Symbiospec, when the repository uses the skill [symbio_spec](../symbio_spec/SKILL.md)), and the comments that each sub-issue touches. Do not ask a question that an issue, a comment, or a specification already answers.
2. Group the sub-issues by area. A group is a set of sub-issues that change the same files, or that one person reviews together.
3. Order the groups by their dependencies. A group that changes a shape that another group uses goes first. Groups with no dependency between them run at the same time. Example: group A first, then the groups B and C at the same time.
4. Write the plan in one comment on the parent issue, with the command "comment on an issue": the groups, the sub-issues of each group, the order, and the open questions.
5. Ask every open question in one message to the developer. Give a recommended answer for each question. Then stop and wait.

### 2.3. Record the answers

1. Write the answers of the developer in one comment on the parent issue.
2. From here, nothing waits for the developer. When a new question comes during the work, take the recommended answer, write it in the parent issue, and report it in the final message.

### 2.4. Write one brief file for each group

Each helper agent starts empty. A brief file stops each helper agent from reading every rule file again. Write one brief file for each group, in the scratchpad directory, never in the repository. The brief file holds:

- The sub-issues of the group, with their links and the decisions of the developer.
- The worktree folder of the group, and the files and folders that the group may change.
- The rules that matter for the group, copied short from `AGENTS.md`, the nearest `CONTEXT.md` files, the agent rules, and the approved specifications that the group touches. Name the full file of each rule, so that the helper agent reads it only when the short rule is not enough.
- The test commands of the changed files, and the full test command of each package that the group changes.
- The tests that already fail on the target branch, with their names, so that the helper agent does not investigate them.
- What the helper agent must not do: no commit, no pull request, no merge, no question to the developer.

### 2.5. Do the work without the developer

1. For each group, create one temporary worktree with the value "Worktree creation command". Name the temporary branch after the group and the parent issue number, for example `settings-page-194`. Copy into the worktree the local files that the main checkout needs to run and that Git does not track, for example the file `.env`.
2. Start one helper agent for each group, with its brief file. Start the independent groups at the same time. Start a group only after the groups that it depends on are merged, and create its worktree from the target branch after that merge.
3. During the work, the helper agent runs only the tests of the changed files. The helper agent does not run a full test suite.
4. The helper agent updates the documents, the tests, the `CONTEXT.md` files, and the specifications of its change, as for any change.

### 2.6. Check and merge each group

When the helper agent of a group is done, the main session checks the group, one time:

1. Run one full test run for each package that the group changes. A test that fails and that is not in the list of the tests that already fail is a new problem: send it back to the helper agent, or fix it.
2. Launch the application in the worktree with the value "Launch command", and check each change of the group yourself, for example by opening the changed pages in a browser.
3. When the checks pass, commit with a message that names each sub-issue with `fixes #<number>`, create the pull request with the command "create a pull request", and merge it into the value "Target branch" with the command "merge a pull request". Do not wait for a review of the developer.
4. Delete the temporary branch, locally and on the remote repository, and remove the temporary worktree. Never delete the target branch.
5. Close the sub-issues of the group, with the command "close an issue".
6. When a check fails and you cannot fix it, do not merge the group. Keep its worktree, and report the group in the final message.

### 2.7. Send one short final message

When every group is merged or stopped:

1. Close the parent issue when all its sub-issues are closed.
2. Rename the chat, as the value "Chat rename" says.
3. Send one short message to the developer:
   - What is merged, with the pull requests and the places to look at, for example the website addresses.
   - The answers that you took without the developer (step 2.3).
   - Anything that failed, or that needs a decision of the developer.
