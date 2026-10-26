# Glossary of Heidrun Code: the Issue Fix Workflow

- Created: 16 October 2026
- Last updated: 23 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md), [Skill: the Issue Fix Workflow](../../../.agents/skills/issue_fix_workflow/SKILL.md)
- Related issue: [issue 610](https://github.com/heidrun-org/heidrun/issues/610), [issue 656](https://github.com/heidrun-org/heidrun/issues/656)

This document gives one short definition for each word of the Issue Fix Workflow. The other words of Heidrun Code are in [index.md](index.md).

## The parts

### Issue Fix Workflow

The way that every issue fix is made in this repository, in the skill `issue_fix_workflow`, with the values of this repository in the section "Issue Fix Workflow values" of `AGENTS.md`. It has four parts: the Issue Fix Setup, the Issue Fix Implementation, the Issue Fix Review, and the Issue Fix Completion.

### Issue Fix Setup

The part where the agent reads the issue, renames the chat, and creates the temporary worktree.

### Issue Fix Implementation

The part where the agent makes the change in the temporary worktree. It starts after the Issue Fix Setup, and it starts again each time that the developer asks for a change in the Issue Fix Review.

### Issue Fix Review

The part where the developer runs the application in the temporary worktree and tests the change.

### Issue Fix Completion

The part where the agent makes the last commit, creates and merges the pull request (on GitLab, the merge request), removes the temporary worktree, and closes the issue.

## The added requests

### Added request

More work that the developer asks for after the issue was written, during the Issue Fix Implementation or the Issue Fix Review, and that the issue does not describe. There are two kinds: the related added request and the unrelated added request.

### Related added request

An added request in the same part of the application as the issue, that the developer reviews together with the fix, and that is not larger than the original fix. It stays in the same issue, in the same temporary worktree, and it gets a comment on the issue.

### Unrelated added request

An added request in a different part of the application, or that could ship alone, or that is larger than the original fix. It becomes a new issue, with its own temporary worktree, when the developer says yes.

## Rules

- Write "added request", "related added request", and "unrelated added request". Do not write "extra request", "scope creep", or "change request".
- Write the name of each part in full, for example "Issue Fix Implementation". Do not write a shorter name.
