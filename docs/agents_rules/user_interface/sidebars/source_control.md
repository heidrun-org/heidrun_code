# User interface of Heidrun Code: source control

- Created: 13 October 2026
- Last updated: 28 November 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md)
- Related issue: [issue 305](https://github.com/heidrun-org/heidrun/issues/305), [issue 446](https://github.com/heidrun-org/heidrun/issues/446), [issue 613](https://github.com/heidrun-org/heidrun/issues/613), [issue 885](https://github.com/heidrun-org/heidrun_code/issues/885), [issue 886](https://github.com/heidrun-org/heidrun_code/issues/886), [issue 1032](https://github.com/heidrun-org/heidrun_code/issues/1032), [issue 1074](https://github.com/heidrun-org/heidrun_code/issues/1074), [issue 1120](https://github.com/heidrun-org/heidrun_code/issues/1120)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../glossary/index.md).

## Source control

The Source control sidebar section copies the source control view of VS Code ([issue #305](https://github.com/heidrun-org/heidrun/issues/305)).

- The Source control sidebar section shows only the local Git repository. It shows nothing of GitHub or GitLab.
- The header holds the title "Source Control" and four buttons that show only an icon: "Commit" (a check mark), "Refresh", "View changes", and "More actions" (three vertical dots: Pull, Push, and Fetch). Each button is an icon button (`btn icon`) of the [shared design rules](../../web_styling/shared_design.md).
- The commit message box fills the full width. Its placeholder text names the current branch: `Message (⌘Enter to commit on "dev_jerome")`. The keys ⌘Enter make the commit. The sparkle button sits beside the text box, at its right and outside of it, so that it never covers the text or the scroll bar of the text box ([issue #613](https://github.com/heidrun-org/heidrun/issues/613)). It asks a coding agent (`codex`, else `claude`) to write the message from the diff of the staged files, or of every change when nothing is staged.
- The commit button uses the shared primary action appearance, fills the full width, and centers its label "Commit" with the check mark. The arrow at its right opens a dropdown menu: "Commit", "Commit and push", and "Commit (amend the last commit)". When no file is staged, the commit button stages every change and then commits it, with no question ([issue #613](https://github.com/heidrun-org/heidrun/issues/613)); when there is no change at all, it commits nothing and says so. During a commit, both commit buttons show a spinning indicator, and the main button says “Committing…” or “Pushing commit…”. The commit stays tied to the workspace where it started, and the buttons stay disabled until Git status has refreshed. A successful commit clears its message. If the commit succeeds and the push fails, the notification reports both results.
- The group "Staged Changes" and the group "Changes" always show, in this order, even when a group holds 0 files ([issue #613](https://github.com/heidrun-org/heidrun/issues/613)). The group "Changes" holds the files that are not staged, the new files, and the files in conflict. A file staged then changed again is in the two groups. Each group header has an arrow, the title, and a badge with the number of files. A click anywhere on the header line folds or unfolds the group, but a click on a button of the header line does not.
- The buttons of a group header and of a file line show only while the pointer is over the header or the line. On "Staged Changes": Stash, Unstage all. On "Changes": Stash, Discard all, Stage all. On a file line of "Changes": Open the file, Discard, Stage. On a file line of "Staged Changes": Open the file, Unstage.
- The "View changes" menu offers "List" and "Tree". Heidrun Code saves the selected view in preferences and restores it at the next start. List is the default and shows each file name followed by its containing folder path in grey, when there is one. Tree groups the changed files by folder within each change group and follows File explorer order. Folders start open and each folder can be opened or closed separately. "Expand All" and "Collapse All" open or close the folders in both change groups in Tree view.
- A file line shows the icon of the kind of the file, the file name, and a colored status letter at the right: M modified, A added, D deleted, R renamed, U untracked, ! conflict. Its tooltip gives the full path and the status in words. A left-click on the line opens the diff of the file in a new focused tab. A right-click opens a menu with "Open diff" and "Open file". The button "Open the file" opens the file in a file view pane. The rules are in [diff_pane.md](../workspaces_tabs_and_panes/diff_pane.md).
- The buttons "Discard all" and "Discard" use the Bootstrap Icons Arrow 90deg left icon (`arrow-90deg-left`). The button "Refresh" keeps its circular arrow (`arrow-clockwise`).
- A discard asks for a confirmation first, because the changes cannot come back. A file that Git does not know is deleted.
- The icon of the Source control sidebar section in the sidebar icon bar shows the number of changed files.
- Heidrun Code has no large Git window: a diff shows only in a diff pane ([issue 886](https://github.com/heidrun-org/heidrun_code/issues/886)).

