# User interface of Heidrun Code: code hosting merge

- Created: 29 October 2026
- Last updated: 29 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [Glossary of Heidrun Code: code hosting](../../glossary/code_hosting.md), [User interface of Heidrun Code: code hosting](code_hosting.md), [GitHub and GitLab support](../../github_and_gitlab_support.md)
- Related issue: [issue 570](https://github.com/heidrun-org/heidrun_code/issues/570)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../glossary/index.md). It gives the approval state of a pull request (GitHub) or merge request (GitLab), and its merge from Heidrun Code. The rest of the Code hosting sidebar section is in [code_hosting.md](code_hosting.md).

## The approval state

- The second line of a row of a pull request or a merge request adds its approval state after the date, as it adds " · Draft": "Approved", "Changes requested", or "Review required". GitHub gives it in the list (`reviewDecision` of `gh pr list`). The list of GitLab gives only whether an approval is missing or whether changes are requested (`detailed_merge_status`), so a row of GitLab never says "Approved".
- The information card of an open pull request or merge request ends with the merge bar: the approval state in a pill, the people who approved it, and the button "Merge". On GitLab, the pill adds the number of approvals that are still needed, for example "Review required · 1 approval left". The issue preview window ("Open in Heidrun Code") shows the same merge bar under the author and the branches, for an item of the repository of the workspace only.
- The card reads the merge facts with its details, before it opens: `gh pr view --json` and `gh api repos/{owner}/{repo}` on GitHub, and `glab api` of the merge request, of its approvals, and of the project on GitLab.

## The button "Merge"

- The button "Merge" is disabled, with the reason in its title, when the hosting service refuses the merge now: not open, a draft, a conflict with the target branch, a branch to update first, a missing approval, a rule of the target branch (GitHub, `mergeStateStatus` `BLOCKED`), a required check that failed or still runs, or discussions that are not resolved (GitLab, `detailed_merge_status`). Another status of GitLab that refuses the merge shows its name. A status that the hosting service is still computing does not disable the button.
- The button opens the merge window, which reads the hosting service again, without the cache, so that it shows the state of now. Nothing is merged before the click on the button "Merge" of the window. The key Escape, a click outside, and the button "Cancel" close the window, except while the merge runs.

## The merge window

- It shows the two branches, the approval state, the people who approved, and the reason why the merge is not possible now, if any.
- GitHub: a list of the merge methods that the repository allows (`allow_merge_commit`, `allow_squash_merge`, `allow_rebase_merge`), in the order "Create a merge commit", "Squash and merge", "Rebase and merge". A field that the account cannot read counts as allowed. The window selects the last method of the developer in this repository (setting `mergeLastMethods`), else the first allowed method.
- GitLab: the method is a setting of the project (`merge_method`), shown as text. The check box "Squash the commits" follows `squash_option`: `default_on` and `always` check it, and `always` and `never` disable it.
- The check box "Delete the source branch {branch} after the merge" starts with the setting of the repository: `delete_branch_on_merge` on GitHub, and `force_remove_source_branch` of the merge request, else `remove_source_branch_after_merge` of the project, on GitLab.
- The window says which commit it merges. The hosting service refuses the merge when someone pushed since.
- After the merge, the window closes, a toast says "#12 merged into main", and the lists of the Code hosting sidebar section are read again from the hosting service, without the kept answers: the merged item leaves the list of the open items. The issue preview window shows the state "Merged". When the merge fails, the window stays open with the first line of the failure.

## The permanent branches

- The setting "Permanent branches, never deleted by a merge" (`mergePermanentBranches`, heading "Code hosting" of the section Sidebars of the Settings window) lists the branches that are never deleted, by default `main`, `master`, `dev`, and `dev_*`. A name that ends with `*` matches every branch that starts with the rest of the name.
- For such a branch, the check box of the deletion is off and disabled, and the Tauri command `forge_merge` refuses the deletion too.
- On GitLab, when the branch stays, `forge_merge` first clears the flag `force_remove_source_branch` of the merge request, because GitLab deletes the branch when this flag is set, whatever the merge call says.
- On GitHub, a repository with `delete_branch_on_merge` deletes the branch by itself after the merge. For a permanent branch of such a repository, the button "Merge" is disabled, and its reason says to merge on the web page.

## The calls that write

- The merge is the only call of the Code hosting sidebar section that writes. It goes through the Tauri command `forge_merge` of `git.rs`, never through `forge_cli_cached`, whose allowed calls only read.
- GitHub: `gh pr merge <number> --merge`, `--squash`, or `--rebase`, with `--match-head-commit <sha>`. Never `--delete-branch`, which would also delete the local branch and switch the working copy under a coding agent: the remote branch is deleted with `gh api -X DELETE repos/{owner}/{repo}/git/refs/heads/<branch>`.
- GitLab: `glab api -X PUT projects/:fullpath/merge_requests/<iid>/merge` with `squash`, `should_remove_source_branch`, and `sha` always given, so that the choice of the window wins over the defaults of the project.

## Where the code is

- `stores/pull_request_merge.ts`: the merge facts, the reasons, the defaults, and the merge window. `components/PullRequestMergeBar.vue` is the merge bar, and `components/MergeModal.vue` the merge window.
- `merge_calls`, `is_permanent_branch`, and `forge_merge` in `desktop_tauri/src/git.rs`.
- The tests are `pull_request_merge.test.ts`, `MergeModal.test.ts`, `PullRequestMergeBar.test.ts`, `issues_merge.test.ts`, `code_hosting_rows.test.ts`, and the Rust tests of `git.rs`.
