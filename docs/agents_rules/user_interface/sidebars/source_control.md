# User interface of Heidrun Code: source control

- Created: 13 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md)
- Related issue: [issue 305](https://github.com/heidrun-org/heidrun/issues/305), [issue 446](https://github.com/heidrun-org/heidrun/issues/446), [issue 613](https://github.com/heidrun-org/heidrun/issues/613)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../glossary/index.md).

## Source control

The Source control sidebar section copies the source control view of VS Code ([issue #305](https://github.com/heidrun-org/heidrun/issues/305)).

- The Source control sidebar section shows only the local Git repository. It shows nothing of GitHub or GitLab.
- The header holds the title "Source Control" and three buttons that show only an icon: "Commit" (a check mark), "Refresh", and "More actions" (three vertical dots: Pull, Push, Fetch, and the large Git window). Each of the three buttons is an icon button (`btn icon`) of the [shared design rules](../../web_styling/shared_design.md).
- The commit message box fills the full width. Its placeholder text names the current branch: `Message (⌘Enter to commit on "dev_jerome")`. The keys ⌘Enter make the commit. The sparkle button sits beside the text box, at its right and outside of it, so that it never covers the text or the scroll bar of the text box ([issue #613](https://github.com/heidrun-org/heidrun/issues/613)). It asks a coding agent (`codex`, else `claude`) to write the message from the diff of the staged files, or of every change when nothing is staged.
- The commit button uses the shared primary action appearance, fills the full width, and centers its label "Commit" with the check mark. The arrow at its right opens a dropdown menu: "Commit", "Commit and push", and "Commit (amend the last commit)". When no file is staged, the commit button stages every change and then commits it, with no question ([issue #613](https://github.com/heidrun-org/heidrun/issues/613)); when there is no change at all, it commits nothing and says so. After a commit, the message box is empty.
- The group "Staged Changes" and the group "Changes" always show, in this order, even when a group holds 0 files ([issue #613](https://github.com/heidrun-org/heidrun/issues/613)). The group "Changes" holds the files that are not staged, the new files, and the files in conflict. A file staged then changed again is in the two groups. Each group header has an arrow, the title, and a badge with the number of files. A click anywhere on the header line folds or unfolds the group, but a click on a button of the header line does not.
- The buttons of a group header and of a file line show only while the pointer is over the header or the line. On "Staged Changes": Stash, View the changes, Unstage all. On "Changes": Stash, View the changes, Discard all, Stage all. On a file line of "Changes": Open the file, Discard, Stage. On a file line of "Staged Changes": Open the file, Unstage.
- A file line shows the icon of the kind of the file, the file name, its folders in grey (nothing for a file at the root of the repository), and a colored status letter at the right: M modified, A added, D deleted, R renamed, U untracked, ! conflict. Its tooltip gives the full path and the status in words. A click on the line opens the diff of the file in the large Git window.
- The buttons "Discard all" and "Discard" use the Bootstrap Icons Arrow 90deg left icon (`arrow-90deg-left`). The button "Refresh" keeps its circular arrow (`arrow-clockwise`).
- A discard asks for a confirmation first, because the changes cannot come back. A file that Git does not know is deleted.
- The icon of the Source control sidebar section in the sidebar icon bar shows the number of changed files.
- The title bar of the large Git window holds all the controls of the window, on one line ([issue #446](https://github.com/heidrun-org/heidrun/issues/446)). At the left, it has the Left sidebar enable disable button, the name of the repository as plain text (no link and no icon), the branch, and the continuous integration result. At the right, in this order, it has a Bootstrap radio button group with "Diff", "Side by side", "File", and, for a Markdown file, "Preview", a second Bootstrap radio button group with "Centered" and "Full width" while the preview shows, the Bootstrap switch "Wrap lines", the button "Refresh", and the close button. Every control of the title bar has a title, the tooltip that shows when the pointer rests on it. When the window is too narrow for one line, the controls of the right go to a second line.
- The bar of the viewer, under the title bar, holds only the path of the file and the numbers of added and removed lines. It has no button.

