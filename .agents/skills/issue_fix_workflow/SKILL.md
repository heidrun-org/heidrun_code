---
name: issue_fix_workflow
description: Fix one issue of a repository in four parts, the Issue Fix Setup, the Issue Fix Implementation, the Issue Fix Review, and the Issue Fix Completion, in a temporary worktree. Use it when the developer asks to fix an issue, for example "fix the issue 35", and when the developer asks for a change or for more work during an issue fix. The values of the repository (the target branch, the commands) are in the section "Issue Fix Workflow values" of the file AGENTS.md of the repository.
---

# Issue Fix Workflow

This file gives the steps of the Issue Fix Workflow. The Issue Fix Workflow is the way that every issue fix is made. The steps are general: they name no branch, no tool, and no command of one repository. The values of one repository are in the section "Issue Fix Workflow values" of the file `AGENTS.md` of that repository. To use this skill in another repository, copy the folder of this skill, and write that section in the file `AGENTS.md` of the other repository, from the template in the section "The template" below. Without that section, the skill does not start an issue fix: it warns the developer, as the section "When the values are missing" says. Do not change this file for one repository.

## The values of the repository

Read the section "Issue Fix Workflow values" of the file `AGENTS.md` before step 1 of the Issue Fix Setup. The section gives these values:

- Target branch: the branch that receives the merge of the pull request (on GitLab, the merge request).
- Worktree creation command: the command that creates a temporary worktree.
- Worktree folder: the folder where the temporary worktree is.
- Launch command: the command that launches the application in the temporary worktree.
- Issue tracker commands: the commands that read an issue, comment on an issue, create an issue, create a pull request, merge a pull request, and close an issue.
- Chat rename: whether the chat can be renamed, and how.

### Suggested worktree location during setup

During setup, suggest `.agents/worktree/<branch>` as the worktree folder, relative to the receiving repository root, with this creation command run from that root:

```bash
git fetch origin <target-branch>
git worktree add -b <branch> .agents/worktree/<branch> origin/<target-branch>
```

Replace `<target-branch>` with the repository's target branch and `<branch>` with the temporary branch name. Propose the folder and command for human approval before writing the configuration. An explicit repository choice overrides this suggestion; preserve an existing configured location. This suggestion does not supply missing values automatically or allow the Issue Fix Setup to start without configuration. The Issue Batch Workflow reuses these same configured values.

### When the values are missing

A skill cannot warn the developer when its folder is copied, because a copied folder runs nothing. The warning comes the first time that the skill is used. When the section is missing, or when one value is missing, do these steps, in this order:

1. Do not start the Issue Fix Setup. Do not read the issue, do not create a worktree, and do not change any file.
2. Warn the developer in one short message: "The Issue Fix Workflow is not configured in this repository." Then list the missing values, one value on each line.
3. Show the template below, and tell the developer to write it in the file `AGENTS.md` with the real values.
4. Offer to propose a value for each missing value from the files of the repository. Write the section only after the developer agrees to the proposed values.
5. Stop, and wait for the developer.

Never guess or silently apply a value, and never use the value of another repository. During configuration, propose the suggested worktree location above for approval; during an issue fix, use only the configured values.

### The template

Write this text in the file `AGENTS.md` of the repository. The first two lines are the pointer: the file `AGENTS.md` always loads, but a skill loads only when the coding agent decides that it matches, so the pointer makes sure that the skill is read.

```markdown
## Issue Fix Workflow

Every issue fix in this repository follows the skill [issue_fix_workflow](.agents/skills/issue_fix_workflow/SKILL.md). Read the skill before you start an issue fix, each time that the developer asks to fix an issue.
The skill names no detail of this repository: it reads the values of this repository in the section "Issue Fix Workflow values" below.

### Issue Fix Workflow values

- Target branch: <the branch that receives the merge of the pull request>
- Worktree creation command: <the command that creates a temporary worktree>
- Worktree folder: <the folder where the temporary worktree is>
- Launch command: <the command that launches the application in the temporary worktree>
- Issue tracker commands: <the commands that read an issue, comment on an issue, create an issue, create a pull request, merge a pull request, and close an issue>
- Chat rename: <how to rename the chat, or "not available">
```

## The four parts

Every issue fix has four parts: the Issue Fix Setup, the Issue Fix Implementation, the Issue Fix Review, then the Issue Fix Completion. In the Issue Fix Setup, you prepare the work. In the Issue Fix Implementation, you make the change. In the Issue Fix Review, the developer tests the change. In the Issue Fix Completion, you commit, merge, and close the issue. Each time that the developer asks for a change in the Issue Fix Review, the work goes back to the Issue Fix Implementation. Every issue fix is made in a temporary worktree, always, and never in the main checkout. Write the name of each part in full, for example "Issue Fix Implementation", and never in a shorter form.

The Issue Fix Setup starts when the developer asks you to fix an issue, for example "fix the issue 35". The developer gives the number of the issue. If the developer does not give the number, ask for it. Creating an issue is not a step of the Issue Fix Workflow.

### Issue Fix Setup

1. Read the issue and its comments, with the command "read an issue" of the value "Issue tracker commands".
2. Rename the chat according to its content, as the value "Chat rename" says. When the value says that the rename is not available, skip this step and say so in one line. Never tell the developer that the rename is not possible before you tried the way that the value gives.
3. Create a temporary worktree for the fix, with the value "Worktree creation command". Always create it. Never make the change in the main checkout, and never create only a temporary branch without a worktree. Never create the worktree with another command. Name the temporary branch after the fix and the issue number, for example `remove-unused-folder-35`.
4. Work only in the folder of the temporary worktree, the value "Worktree folder". Read, edit, write, build, test, and run every file there, and never in the main checkout.

### Issue Fix Implementation

The Issue Fix Implementation starts when the Issue Fix Setup is done. It starts again each time that the developer asks for a change in the Issue Fix Review.

1. Make the change in the temporary worktree. Update the documents and the tests of the change, as for any change.
2. Do not make a commit. Leave the changes uncommitted until the Issue Fix Completion, so that the developer reads them with the status and the difference of Git. A commit before the Issue Fix Review hides the difference from the developer. When a commit is needed for another reason, its message mentions the issue number.
3. When the developer asks for more work that the issue does not describe, this work is an added request. Follow the section "The added requests" below.
4. When the change is done, start the Issue Fix Review.

### Issue Fix Review

The Issue Fix Review starts when the Issue Fix Implementation is done. Without it, the developer cannot run the application, cannot observe the result, and cannot validate the change. The Issue Fix Review has two separate messages. Never put the two messages in one message.

The first message asks the developer to review. Always do these steps, in this order:

1. Tell the developer to look at the result.
2. Give the value "Launch command", with the path of the temporary worktree, in its own `bash` code block.
3. Say in one or two short lines what to look at, so that the developer can validate the change.
4. Stop. The first message has no question and no button, and it says nothing about the pull request (on GitLab, the merge request) or about the merge. Write the launch command in the closing text of the message, never before a question box, so that the developer always sees it.

The developer runs the application, then says that the result is reviewed. The second message comes only after that. Explain that Issue Fix Completion includes committing the reviewed changes, creating and merging the pull request, and closing the issue. Then ask exactly: "Do you approve the reviewed issue fix for completion?"

- Each time that the developer asks for a change, go back to the Issue Fix Implementation. Then give the launch command again, and start again with the first message.
- Never start the Issue Fix Completion (the commit, the pull request, the merge, and the closing of the issue) before the developer approves the reviewed issue fix for completion.

### Issue Fix Completion

The Issue Fix Completion starts when the developer approves the reviewed issue fix for completion.

1. Make the commit. Its message mentions the issue number and uses `fixes #<issue number>`.
2. Create a pull request (on GitLab, a merge request) from the temporary branch. Its description lists each added request, as the section "The pull request" below says.
3. Merge the pull request (on GitLab, the merge request) into the value "Target branch".
4. Delete the temporary branch, locally and on the remote repository. Delete only the temporary branch, never the target branch. Remove the temporary worktree.
5. Close the issue.
6. Rename the chat according to its content, as the value "Chat rename" says.

## The added requests

An added request is more work that the developer asks for after the issue was written, during the Issue Fix Implementation or the Issue Fix Review, and that the issue does not describe. When the developer asks for such work, the issue, the pull request, and the real change do not agree. These rules keep the three in agreement.

The agent decides which kind an added request is, and says it in one line, for example "This is a related added request of issue 607."

- A related added request is in the same part of the application as the issue, and the developer reviews it together with the fix, and it is not larger than the original fix.
- An unrelated added request is any added request that is in a different part of the application, or that could ship alone, or that is larger than the original fix.
- When the agent is not sure, the added request is unrelated.

### A related added request

1. Do the work in the same temporary worktree.
2. Update the documents and the tests of the added work, as for any change.
3. When the work is done, and before the next first message of the Issue Fix Review, add one comment to the issue for this added request, with the command "comment on an issue" of the value "Issue tracker commands". Never edit the first text of the issue: the comments keep the history.
4. Write the comment as the section "The comment" below says.

### An unrelated added request

1. Do not do the work in this temporary worktree.
2. Ask the developer one question: whether to create a new issue for this work. Do not create the new issue before the developer says yes.
3. When the developer says yes, create the new issue with the command "create an issue" of the value "Issue tracker commands". The new issue gets its own Issue Fix Workflow, with its own temporary worktree.
4. Add a line to the new issue with the plain address of the original issue as its own bullet. Add a comment to the original issue with the plain address of the new issue as its own bullet.

### The comment

One comment for each related added request. The comment has these three parts, in this order, each as a bullet:

- What the developer asked, in the words of the developer, in one or two lines.
- What changed, in one or two lines.
- Which files changed. Write each file name as a link to the file.

When the file `AGENTS.md` of the repository has rules for the text of an issue, follow them for the comment and for every other text that you write in an issue.

### The pull request

In the Issue Fix Completion, the description of the pull request lists each related added request, in the same three parts as the comment, and each new issue of an unrelated added request as its own bullet with the plain address of the issue.
