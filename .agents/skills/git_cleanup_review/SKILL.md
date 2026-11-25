---
name: git_cleanup_review
description: Review worktrees first, then local and remote Git branches, to identify redundant copies of work already preserved in the destination branch and propose an ordered cleanup plan. Use for cleanup audits and removal recommendations. This skill gives advice only and does not remove anything.
---

# Git Cleanup Review

Find every worktree and branch whose work is already preserved in the destination branch, usually `main`, so those redundant copies can be removed. A worktree is a separate working folder connected to the same Git repository. Review worktrees first, local branches second, and remote branches third. Explain which items can be removed and the required order.

This skill produces an assessment and a cleanup plan only. A later, separate request to remove named items is required before taking that action. Do not delete branches, remove worktrees, switch branches, fetch, prune, or run cleanup commands during the review.

## Choose the destination and collect the inventory

Read the repository instructions and identify the branch where completed work is expected to land. Use the developer's named destination when supplied; otherwise use the repository instructions or branch configuration. If there are several reasonable choices, ask which destination to use before judging whether work is included. State the exact destination reference in the report. Distinguish local `main` from the last recorded `origin/main` and from the live remote branch; do not silently substitute one for another.

Start with read-only Git commands:

```bash
git status --short --branch
git worktree list --porcelain
git branch --all --verbose --verbose --no-abbrev
```

Include the current branch, every local branch, every registered worktree, and the remote branches or tracking references that can be established. A symbolic reference such as `origin/HEAD` is not a separate branch.

## Exclude protected checkouts and branches

Always keep the main checkout of the repository, including when the review runs from a linked worktree. Identify the main checkout from `git worktree list --porcelain`; the main checkout is the first entry. Do not assume that the current working directory is the main checkout.

Always keep the destination branch and branches named `main`, `master`, or `dev`, including their remote counterparts such as `origin/main`. Read repository instructions for additional branches that must be kept. These protections apply even when all commits are included in the destination. Label protected items **Keep**, explain the protection, and exclude them from the cleanup plan.

Assess a worktree and its branch separately. Keeping a protected branch does not by itself require keeping an additional linked worktree. Keeping the main checkout always applies.

## 1. Assess worktrees first

For a worktree, inspect its full path with:

```bash
git -C <worktree-path> status --short --branch --untracked-files=all
git -C <worktree-path> diff --cached
git -C <worktree-path> diff
git -C <worktree-path> submodule status --recursive
```

Inspect staged changes, unstaged changes, new files that are not ignored, and submodules. Treat files that Git classifies as ignored as disposable for cleanup. Ignored files do not require content inspection or proof that they can be regenerated, and do not justify **Keep** or **Needs inspection** for a worktree or its branch. This includes ignored `.env` files, `content/` directories, dependencies, and build output.

Use Git's classification, rather than a filename or directory name alone, to distinguish ignored files from new files that have not been added to Git. A tracked file remains subject to review even if its name matches an ignore pattern. New files that are not ignored still require checking for work absent from the destination.

For each tracked change and new file that is not ignored, determine whether the local work is already preserved in the destination. Check staged and working file versions separately: a working file that matches the destination can still have a different staged version that needs preserving. A local change or a new file is not automatically unique work. If the change is confirmed missing from the destination, keep the worktree; if inclusion cannot be established, mark the worktree **Needs inspection**.

Compare the worktree's committed work with the destination using the commit comparison below, including detached worktrees. Inspect each submodule's working directory and commits as well. An inaccessible worktree or submodule is **Needs inspection**.

Mark an unprotected worktree **Deleteable** when its committed work, tracked changes, and new files that are not ignored are preserved in the destination. Any ignored files are disposable and do not block this recommendation. For example, a worktree whose commits are included and whose only local files are ignored `.env` and `content/` entries is **Deleteable**. Keep worktrees containing confirmed unique committed work, tracked changes, or new files that are not ignored. Record the worktree decision before deciding about its checked-out branch.

### Compare committed work with the destination

Use a branch reference or a detached worktree's commit as `<candidate>`. First check whether the candidate commit is already part of the destination's history. A successful ancestry check establishes that all commits reachable from that candidate are included. If the candidate is not an ancestor, inspect the differing commits and their changes:

```bash
git merge-base --is-ancestor <candidate> <destination>
git log --oneline --decorate <destination>..<candidate>
git cherry <destination> <candidate>
```

An unmerged commit list alone does not prove that work is missing: a change may have reached the destination through a squash (several commits combined into one) or another equivalent commit. In `git cherry` output, `-` means Git found an equivalent patch, and `+` means it did not. A `+` still requires inspection for combined or otherwise equivalent changes. `git cherry` omits merge commits, so inspect merge commits and any changes made while resolving merges separately before concluding that no unique work remains.

Compare the relevant changes and affected destination files. An older candidate missing later destination changes does not contain unique work for that reason alone. Report confirmed inclusion, confirmed missing work, or uncertain equivalence. Missing commits or Git command errors are missing evidence, not proof of inclusion.

## 2. Assess local branches using the worktree decisions

For each local branch, check protection, compare its committed work with the destination, and identify every worktree using the branch.

- An unprotected branch whose work is included and which is not checked out is **Deleteable**.
- If an unprotected branch's work is included and every worktree using the branch is **Deleteable**, mark the branch **Deleteable** with the prerequisite: "After removing <worktree-path>." List every required worktree. Being checked out determines the order of removal; it does not by itself justify **Keep**.
- If a worktree using the branch must remain, retain the branch while that worktree uses it. Explain the worktree's reason for remaining. If the worktree decision is uncertain, mark the dependent branch **Needs inspection**.
- Keep protected branches and branches with confirmed unique work. Uncertain commit equivalence is **Needs inspection**.

For example, a clean worktree with all work included in `main` can be **Deleteable**, and its unprotected branch can also be **Deleteable**, with removal of that worktree as the branch's prerequisite. Do not recommend **Keep** for the branch merely because the same cleanup plan has not yet removed the worktree.

Decide about local branches from local evidence and the applicable local protections. Failure to reach a remote does not by itself block a local branch or worktree recommendation when their work is confirmed preserved in the chosen destination. Remote branch protection governs removal of the remote branch.

## 3. Assess remote branches

Distinguish the branch on the remote server from the local tracking reference, which may be stale. Use `git ls-remote --heads <remote>` to check the live branch names and tips without updating local references. Compare the returned commit, rather than assuming the local tracking reference is current. Include newly discovered remote branches. If a tracking reference names a branch absent from the remote, report that the remote branch is already absent; any local tracking reference is a separate item and this review does not prune it.

Check remote branch protection and open pull requests or merge requests when access permits. A closed or merged request alone does not prove that every branch change is included. An open request alone does not establish that unique work remains; inspect its current branch and purpose.

A live remote branch is **Deleteable** when its current work is included in the destination and no applicable protection or other established reason requires keeping it. Keep protected branches. If the remote cannot be checked, the live commit is unavailable locally, protection is unknown, or equivalence is uncertain, mark that remote item **Needs inspection** and say exactly what is missing. Do not claim that work is included in live remote `main` based only on a comparison with local `main`.

## Collect last modification dates

Always include a last modification date for every branch and every worktree listed in the results, including items marked **Keep**. Use a full date and time with a time zone, and explain what each date measures.

For each branch, collect the committer date of the latest commit with:

```bash
git log -1 --format=%cI <branch>
```

Label this value "Last modification (latest commit)". Git does not provide a reliable last branch-reference modification date for every local and remote branch; the latest commit date does not establish when the branch was created, reset, or updated on the remote. If the commit is unavailable, show "Unknown" and explain the missing evidence rather than omitting the date.

For each worktree, inspect filesystem modification times of the worktree's files and directories, including untracked and ignored files. Include the worktree root and exclude Git administrative entries such as `.git`. Read symbolic link timestamps without following their targets. Report the latest observed modification time as "Last modification (worktree files)". The root directory's timestamp alone does not capture edits to existing files. Record unreadable paths rather than silently skipping them. If part of the worktree cannot be inspected, label the date incomplete; if no date can be established, show "Unknown" with the reason. Explain that filesystem timestamps do not establish a complete history of edits or deletions.

Do not use either date alone as evidence that removal is safe.

## Report the decisions and ordered cleanup plan

Present worktrees first, local branches second, and remote branches third, with a separate row for each item. Apply these recommendations consistently:

- **Deleteable**: committed work, tracked changes, and new files that are not ignored are preserved in the destination, no protection requires retention, and any required earlier action is named explicitly. Ignored files are disposable. A branch may have a prerequisite to remove a worktree already marked **Deleteable**.
- **Keep**: confirmed unique committed work, tracked changes or new files that are not ignored, a protected checkout or branch, a retained worktree using the branch, or another established reason requires retention. Explain the actual reason; ignored files and checked-out state alone are not sufficient.
- **Needs inspection**: evidence is missing, remote information may be stale, a worktree cannot be inspected, or commit equivalence is uncertain.

For every worktree, report the full path, branch or detached state, last modification date, staged and unstaged changes, new files that are not ignored and need preservation, submodule findings, and whether committed work is included. If ignored files are mentioned, label them disposable rather than files needing preservation. For every branch, report its last modification date, inclusion evidence, checked-out state, applicable protection, remote verification status, and any removal prerequisite. State shared findings once when the scope is clear.

Give the complete proposed cleanup order using exact paths and branch names: redundant worktrees first, then their local branches once no remaining worktree uses those branches, then verified redundant remote branches. Include **Deleteable** items only; separate protected items, confirmed unique work, and missing evidence. Do not use age, a familiar commit message, or request closure as proof that removal is safe.

Finish with the observation time and the limits of the evidence. The proposed cleanup order is advice; this review does not execute any removal.
