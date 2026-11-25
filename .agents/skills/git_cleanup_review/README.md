# git_cleanup_review

## Purpose

Git Cleanup Review identifies worktrees and Git branches whose work is already preserved in the destination branch and proposes an ordered cleanup plan. A worktree is a separate working folder connected to the same Git repository. The skill gives advice only.

## When to use

Ask which worktrees or branches can be removed, or request a cleanup audit. The review examines worktrees first, local branches second and remote branches third.

## Requirements

Provide read access to Git history, branch references, registered worktrees and repository instructions. The coding agent also inspects worktree files, staged and unstaged changes, new files that are not ignored, and submodules. Remote access and repository-host access support live branch, protection and pull request checks; missing access is reported explicitly. No companion skill is required.

## Install

```bash
npx skills add jeromeetienne/coding_agent_plugin --skill git_cleanup_review
```

See [shared installation options](../../README.md#install-the-skills). Installation does not authorize removal.

## Configuration

No configuration file is required. Name the destination or let the coding agent establish the destination from repository instructions or branch configuration. Ambiguous destinations require clarification before judging inclusion.

Local `main`, the last recorded `origin/main` and live remote `main` are separate evidence. A comparison with local `main` cannot prove inclusion in live remote `main`. The review can check live remote branch names and tips with `git ls-remote` without fetching or changing local references.

## Concrete example

Illustrative request:

> Review all worktrees and branches against local `main`. Give an ordered cleanup recommendation and distinguish live remote evidence. Do not remove anything.

Suppose the main checkout is `/work/project`; a second worktree contains a completed documentation change. A compact representative report follows. Dates and findings are illustrative.

Observation time: 9 November 2026, 15:00:00 UTC. Destination: local `main`. All listed worktrees have no staged or unstaged changes, no new files needing preservation and no submodules. The documentation worktree has ignored build output, which is disposable. Committed documentation changes were checked against destination files and confirmed included.

| Item | Last modification | Evidence and recommendation |
| --- | --- | --- |
| Worktree `/work/project`, branch `main` | 9 November 2026, 14:20:00 UTC; worktree files | **Keep**: main checkout is protected. |
| Worktree `/work/project/.worktrees/docs-35`, branch `docs-35` | 9 November 2026, 13:40:00 UTC; worktree files | **Deleteable**: committed work included; only ignored build output remains. |
| Local branch `main` | 9 November 2026, 14:00:00 UTC; latest commit | **Keep**: destination and protected branch; checked out in main checkout. |
| Local branch `docs-35` | 9 November 2026, 13:30:00 UTC; latest commit | **Deleteable**: work included; after removing `/work/project/.worktrees/docs-35`. |
| Remote branch `origin/main` | Unknown | **Keep**: protected; live tip could not be checked. Local tracking data does not establish live state. |
| Remote branch `origin/docs-35` | Unknown | **Needs inspection**: live tip and protection unavailable; local tracking data alone is insufficient. |

Proposed order:

1. Remove `/work/project/.worktrees/docs-35`.
2. Remove local branch `docs-35` after the worktree is removed.

No remote removal is recommended with the example's missing evidence. A real report lists every discovered item and explains any unknown date or incomplete inspection. Local recommendations can remain valid when remote access fails, provided inclusion in the named local destination is confirmed.

## Results and evidence

Every item receives **Deleteable**, **Keep** or **Needs inspection**, with reasons and prerequisites. Branch dates measure the latest commit's committer date. Worktree dates measure the latest observed file or directory modification time, including ignored files, excluding Git administration entries and without following symbolic link targets. Dates do not establish safe removal or a complete edit history.

The review always keeps the main checkout, destination branch, local and remote branches named `main`, `master` or `dev`, and additional repository-protected branches. A protected branch does not automatically protect an extra linked worktree. A checked-out branch can be Deleteable after a Deleteable worktree is removed.

Tracked files remain subject to review even when their names match ignore patterns. Git-ignored files, including ignored `.env` and `content/` entries, are disposable under this skill. New files that are not ignored require preservation checks. Check staged and working versions separately. An unmerged commit list, request closure or a matching commit subject alone cannot establish missing or preserved work; equivalent squash changes and merge-resolution changes need inspection.

## Approval boundaries

The review never fetches, prunes, switches branches, deletes branches or removes worktrees. The ordered plan is advice. A later, separate request naming the items is required for removal. Unknown remote protection or unavailable commits remain missing evidence.

## Related skills and guides

No companion skill is required. [issue_fix_workflow](../issue_fix_workflow/README.md) and [issue_batch_workflow](../issue_batch_workflow/README.md) create temporary worktrees that can be subjects of a later review.

## Instructions and references

- [SKILL.md](SKILL.md): complete inventory, comparison, protection, timestamp and reporting requirements.
