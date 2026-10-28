# User interface of Heidrun Code: Git branch section of the status bar

- Created: 13 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [status_bar.md](status_bar.md)
- Related issue: [issue 350](https://github.com/heidrun-org/heidrun/issues/350), [issue 348](https://github.com/heidrun-org/heidrun/issues/348), [issue 432](https://github.com/heidrun-org/heidrun/issues/432), [issue 556](https://github.com/heidrun-org/heidrun/issues/556)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../glossary/index.md). The other status bar sections are in [status_bar.md](status_bar.md).

## Git branch section

- The Git branch status bar section has three click zones, from left to right. Each zone is a status bar section with its own rounded background ([issue #350](https://github.com/heidrun-org/heidrun/issues/350)).
  - The branch zone shows the Git icon, the branch name, and a star when the working folder has an uncommitted change. A click on it opens the branch picker.
  - The synchronize zone shows a turning-arrows icon (`arrow-repeat`), like "Synchronize Changes" of Visual Studio Code. See the section "Synchronize with the upstream branch" below.
  - The counts zone shows the commits to download, then the commits to upload. A click on it opens its information card, which lists the details of the Git repository. The counts are read from the local repository, and a fetch in the background keeps them true: see the section "Fetch in the background" below.
- The three zones touch each other. Their spaces and their corners are in [status_bar_appearance.md](../../web_styling/status_bar_appearance.md).
- The branch picker is a card above the branch zone, 408 pixels wide. At the top it has a search field with the text "Select a branch to check out". Under it, the local branches, the most recently committed first. Each row shows the Git icon, the name of the branch, a check mark for the current branch, and the time of the last commit on the first line, then the author, the short hash, and the subject of the last commit on the second line.
- The spaces of the card, of its list, and of its rows are in [status_bar_appearance.md](../../web_styling/status_bar_appearance.md). The list scrolls inside the card when it is longer than 560 pixels, and the list is at most 60 percent of the window height.
- On the first line of each row, at the right end, just after the time, a button that is only the icon of GitHub (or GitLab) is always visible. Its look is in [status_bar_appearance.md](../../web_styling/status_bar_appearance.md). It opens the page of the branch on the forge, in the web browser, and does not check out the branch. The button is absent when the repository has no remote. The button is disabled, with the title "This branch is only on your computer: push it to see its page", when the branch is only local: this computer has no remote-tracking branch of that name, and the list of the remote repository (`git ls-remote`, command `git_remote_branches`) does not have it. That list is kept for one day, in memory and in the local storage (key `heidrun.gitRemoteBranches`), and is asked again after one day. When the remote repository cannot answer, an older list is used, and while nothing is known the button stays enabled. The address is `<repository>/tree/<branch>` on GitHub and `<repository>/-/tree/<branch>` on GitLab. While the picker is open, the title of the zone does not show over it. The page does not exist for a branch that was never pushed.
- The search field keeps the branches whose name, author, hash, or subject contains every word typed. The key Enter checks out the first branch of the list. The key Escape closes the picker.
- A click on a branch checks it out with `git switch`, closes the picker, and reads the Git status again. A click on the current branch only closes the picker.
- When Git refuses the checkout, for example because an uncommitted change would be overwritten, a message shows the text of Git, and the current branch does not change.
- Nothing reacts to the pointer that only moves over a zone, except the background. Visual Studio Code does the same.

### Synchronize with the upstream branch

- The synchronize zone does what "Synchronize Changes" of Visual Studio Code does: it merges, then pushes. A click on it opens its information card and starts the synchronization ([issue #348](https://github.com/heidrun-org/heidrun/issues/348)). The next click, a click outside, or the key Escape closes the card. A click that closes the card does not start a second synchronization.
- The synchronization is the Tauri command `git_synchronize`. It fetches the upstream branch of the current branch (`git fetch --prune`), merges it into the current branch (`git merge --no-edit`), then pushes the commits that the upstream branch does not have, to the branch of the same name on its remote repository. The Git status is read again after it.
- When the merge stops on conflicts, nothing is pushed.
- The card is 408 pixels wide, like the cards of the usage of Claude and of Codex. In every sentence, the name of the upstream branch (for example `origin/dev_jerome`) is a link that opens the page of that branch on the forge, in the web browser, without the name of the remote in the address. When the repository has no known remote, the name is plain text.
- While the synchronization runs, a spinner replaces the icon, and the card says "Synchronizing with" and the name of the upstream branch. A second synchronization cannot start during this time.
- The card then shows, one under the other: "Merged" (new commits came in) or "Already up to date"; then "Sent N commits" when commits were pushed (nothing is said when no commit was pushed). With conflicts, the card shows instead the number of files in conflict with the list of these files and the advice to fix them in the Source control sidebar section, then commit. The merge then stays open, as it does in a terminal.
- When the push fails, for example because the remote repository refuses it, a red notice shows the message of Git after the sentence of the merge, which is done.
- When Git refuses before the push, for example because a change of the working folder would be overwritten, the card shows the message of Git in a red notice, and nothing changes.
- When the current branch has no upstream branch, the icon is faded to 35 percent, nothing starts, and the card says "This branch has no upstream branch. Push it first, so it has one."

### Fetch in the background

- The counts come from `git status --porcelain=v2 --branch --untracked-files=all`, which reads only the local repository and never contacts the remote repository. Heidrun Code reads it again every 10 seconds for the selected workspace, and every 60 seconds for the other workspaces. So the count to download changes only after a fetch ([issue #432](https://github.com/heidrun-org/heidrun/issues/432)).
- Heidrun Code runs `git fetch --prune` in the background for the Git repository of the selected workspace, with the Tauri command `git_sync` and the action `fetch` (`stores/git_background_fetch.ts`). The command never asks for a password (`GIT_TERMINAL_PROMPT=0`) and stops after 90 seconds. The Git status is read again after each fetch, so the counts change at once.
- The option is in the section "Sidebars" of the Settings window, under the heading "Source control", after the name "Fetch the remote repository in the background": a Bootstrap button group of five radio inputs, "Off", "1 minute", "5 minutes", "10 minutes", and "30 minutes". The default is "5 minutes". The option is the setting `gitFetchMinutes`, which holds 0 for "Off". A line in muted color under the group says that the fetch keeps the two counts true and that a fetch that fails shows nothing.
- A fetch starts each time the delay passes. When the developer changes the option, the old delay stops and the new delay starts at once, without a fetch. When the developer selects another workspace, and when the first Git status of the selected workspace arrives, Heidrun Code fetches its repository at once if the last fetch of that repository is older than the delay, or if there is none.
- Heidrun Code does not fetch when the option is "Off", when the selected workspace has no Git repository, when the branch has no upstream branch, and while a synchronization, a pull, a push, or another fetch runs.
- A fetch that fails shows nothing: no toast and no error line. The next delay tries again.
