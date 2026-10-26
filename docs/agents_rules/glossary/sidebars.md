# Glossary of Heidrun Code: sidebars

- Created: 14 October 2026
- Last updated: 24 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md), [User interface of Heidrun Code: sidebars](../user_interface/sidebars/index.md)
- Related issue: [issue 405](https://github.com/heidrun-org/heidrun/issues/405), [issue 425](https://github.com/heidrun-org/heidrun/issues/425), [issue 430](https://github.com/heidrun-org/heidrun/issues/430), [issue 435](https://github.com/heidrun-org/heidrun/issues/435), [issue 446](https://github.com/heidrun-org/heidrun/issues/446), [issue 714](https://github.com/heidrun-org/heidrun/issues/714), [issue 853](https://github.com/heidrun-org/heidrun_code/issues/853)

This document gives one short definition for each word of the sidebars and their sidebar sections. The other words of Heidrun Code are in [index.md](index.md).

## The sidebars

### Left sidebar

The panel on the left of the viewport. It holds sidebar sections.

### Right sidebar

The panel on the right of the viewport. It holds sidebar sections.

### Sidebar section

One part of a sidebar, for example the Needs you, the Clipboard, the Launchers, the Source control, or the File explorer sidebar section. A sidebar holds several sidebar sections, and shows one sidebar section at a time.

### Clipboard sidebar section

The sidebar section of the right sidebar that lists the notes that the developer pinned from the text of a terminal, with the icon `sticky`. It replaces the Notes sidebar section. Its header has the title "Clipboard" and a Bootstrap switch "All workspaces". The word "note" stays for one item of the list.

### Launchers sidebar section

The sidebar section of the left sidebar that lists the launchers of the selected workspace, with the icon `play-circle`. It replaces the Scripts sidebar section. Its header has the title "Launchers", a button to import launchers, and a button to create a custom launcher.

### Launcher

One item of the Launchers sidebar section: a name, a command line, and an optional folder. A launcher has one of two levels: the user level, shown in every workspace and saved in the file `launchers.json` of the folder of the data of Heidrun Code, and the workspace level, shown only in one workspace and saved in the list `launchers` of the file `.heidrun/config.json`. The rules are in [launchers.md](../user_interface/sidebars/launchers.md). A click on its button "Run" runs its command line in its own tab. A launcher is not a `script` of a file `package.json`: the window "Import launchers" reads those `scripts`, and it makes launchers from them. It replaces the word "script" and the word "action" for this item.

### Source control sidebar section

The sidebar section of the left sidebar that shows the Git changes of the selected workspace, as the source control view of VS Code does. From the top: a header with the title "Source Control" and its buttons, the commit message box, the commit button, the group "Staged Changes", and the group "Changes". It shows only the local Git repository, nothing of GitHub or GitLab. It replaces the Git sidebar section.

### Code hosting sidebar section

The sidebar section of the left sidebar that shows what lives on GitHub or on GitLab for the repository of the selected workspace: a list of the open issues, and a list of the open pull requests (GitHub) or merge requests (GitLab). A row has three lines and no button. A click on a row opens an information card. The words for its search, such as "saved search", are in [code_hosting.md](code_hosting.md).

### File explorer sidebar section

The sidebar section of the left sidebar that shows the whole folder tree of the Git repository of the selected workspace, with the icon `folder2`. Its menu has an option "Ignored files" that shows or hides the files and the folders that Git ignores. A click on a folder folds or unfolds it. A click on a file opens the file in a file view pane, read only. A right click on a file opens a context menu that copies the path of the file. It only reads files.

### Sidebar icon bar

The narrow vertical bar of icons at the outer edge of each sidebar, like the bar of icons of Visual Studio Code. It shows one icon for each sidebar section of that sidebar. A click on an icon shows that sidebar section. When the sidebar is collapsed, the sidebar icon bar is the only part of the sidebar that stays visible.

### Files window

The window that shows a file in a tab, the file viewer. The developer can edit the file there. It opens with the shortcut ⌘P, from a file name in a terminal, and from a click on a file in the File explorer sidebar section when no pane can show the file in a file view pane. It is not the large Git window.

### Large Git window

The window that shows the local Git changes of the selected workspace as a diff, with the open pull requests (on GitLab, merge requests) in a side list. It opens from the Source control sidebar section. It only reads files.

### Left sidebar enable disable button

The small arrow button at the left end of the title bar of the large Git window. A click on it hides the file list at the left of the large Git window, and a second click shows the file list again. In this name, "left sidebar" means the file list of the large Git window, not the left sidebar of the application.

## Rules

- The word "section" is never alone. Write "sidebar section" or "status bar section".
- Write "launcher" for an item of the Launchers sidebar section, never "script" and never "action". Write "script" only for a `script` of a file `package.json`, and "action" only for a Git action of the Source control sidebar section, a GitHub Action, or an action of the phone access.
