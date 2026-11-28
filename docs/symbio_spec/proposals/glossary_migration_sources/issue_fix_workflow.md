# Issue Fix Workflow source material

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Transferred source material
- Related framing: [Glossary migration sources](README.md)
- Related issue: [issue 1135](https://github.com/heidrun-org/heidrun_code/issues/1135)

Original source `/docs/agents_rules/glossary/issue_fix_workflow.md` in the [pinned revision](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db). The headings identify original line numbers. Proposed destinations and inventory notes describe the transfer. Approval of a product rule is recorded with the resulting specification.

### Source line 10

This document gives one short definition for each word of the Issue Fix Workflow. The other words of Heidrun Code are in [index.md](source_index.md).

### Source line 12

#### The parts

### Source line 14

- This passage is preserved as repository or technical terminology.
- Proposed destinations: Repository rules · Issue Fix Workflow and its four parts.

#### Issue Fix Workflow

The way that every issue fix is made in this repository, in the skill `issue_fix_workflow`, with the values of this repository in the section "Issue Fix Workflow values" of `AGENTS.md`. It has four parts: the Issue Fix Setup, the Issue Fix Implementation, the Issue Fix Review, and the Issue Fix Completion.

### Source line 18

- This passage is preserved as repository or technical terminology.
- Proposed destinations: Repository rules.

#### Issue Fix Setup

The part where the agent reads the issue, renames the chat, and creates the temporary worktree.

### Source line 22

- This passage is preserved as repository or technical terminology.
- Proposed destinations: Repository rules.

#### Issue Fix Implementation

The part where the agent makes the change in the temporary worktree. It starts after the Issue Fix Setup, and it starts again each time that the developer asks for a change in the Issue Fix Review.

### Source line 26

- This passage is preserved as repository or technical terminology.
- Proposed destinations: Repository rules.

#### Issue Fix Review

The part where the developer runs the application in the temporary worktree and tests the change.

### Source line 30

- This passage is preserved as repository or technical terminology.
- Proposed destinations: Repository rules.

#### Issue Fix Completion

The part where the agent makes the last commit, creates and merges the pull request (on GitLab, the merge request), removes the temporary worktree, and closes the issue.

### Source line 34

#### The added requests

### Source line 36

- This passage is preserved as repository or technical terminology.
- Proposed destinations: Repository rules · Added request and the two types.

#### Added request

More work that the developer asks for after the issue was written, during the Issue Fix Implementation or the Issue Fix Review, and that the issue does not describe. There are two kinds: the related added request and the unrelated added request.

### Source line 40

- This passage is preserved as repository or technical terminology.
- Proposed destinations: Repository rules.

#### Related added request

An added request in the same part of the application as the issue, that the developer reviews together with the fix, and that is not larger than the original fix. It stays in the same issue, in the same temporary worktree, and it gets a comment on the issue.

### Source line 44

- This passage is preserved as repository or technical terminology.
- Proposed destinations: Repository rules.

#### Unrelated added request

An added request in a different part of the application, or that could ship alone, or that is larger than the original fix. It becomes a new issue, with its own temporary worktree, when the developer says yes.

### Source line 48

#### Rules

### Source line 50

- Proposed destinations: Repository rules.

- Write "added request", "related added request", and "unrelated added request". Do not write "extra request", "scope creep", or "change request".

### Source line 51

- Proposed destinations: Repository rules.

- Write the name of each part in full, for example "Issue Fix Implementation". Do not write a shorter name.
