# Sidebar sections source material

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Transferred source material
- Related framing: [Glossary migration sources](README.md)
- Related issue: [issue 1135](https://github.com/heidrun-org/heidrun_code/issues/1135)

Original source `/docs/agents_rules/glossary/sidebars.md` in the [pinned revision](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db). The headings identify original line numbers. Proposed destinations and inventory notes describe the transfer. Approval of a product rule is recorded with the resulting specification.

### Source line 10

This document gives one short definition for each word of the sidebars and their sidebar sections. The other words of Heidrun Code are in [index.md](source_index.md).

### Source line 12

#### The sidebars

### Source line 14

- Glossary entry: [Left sidebar](../../glossary/sidebars.md#21-left-sidebar).
- Proposed destinations: Glossary, User Interface.

#### Left sidebar

The panel on the left of the viewport. It holds sidebar sections.

### Source line 18

- Glossary entry: [Right sidebar](../../glossary/sidebars.md#22-right-sidebar).
- Proposed destinations: Glossary, User Interface.

#### Right sidebar

The panel on the right of the viewport. It holds sidebar sections.

### Source line 22

- Glossary entry: [Sidebar section](../../glossary/sidebars.md#23-sidebar-section).
- Proposed destinations: Glossary, Behaviour.

#### Sidebar section

One part of a sidebar, for example the Needs you, the Clipboard, the Launchers, the Source control, or the File explorer sidebar section. A sidebar holds several sidebar sections, and shows one sidebar section at a time.

### Source line 26

- Glossary entry: [Clipboard sidebar section](../../glossary/sidebars.md#24-clipboard-sidebar-section).
- Proposed destinations: Glossary · Former Notes sidebar section and name Note, User Interface, Behaviour.

#### Clipboard sidebar section

The sidebar section of the right sidebar that lists the notes that the developer pinned from the text of a terminal, with the icon `sticky`. It replaces the Notes sidebar section. Its header has the title "Clipboard" and a Bootstrap switch "All workspaces". The word "note" stays for one item of the list. Its bottom part, "Images of the chat", shows the image behind each text `[Image #N]` of the chat of the selected pane.

### Source line 30

- Glossary entry: [Launchers sidebar section](../../glossary/sidebars.md#25-launchers-sidebar-section).
- Proposed destinations: Glossary · Former Scripts sidebar section, User Interface, Behaviour.

#### Launchers sidebar section

The sidebar section of the left sidebar that lists the launchers of the selected workspace, with the icon `play-circle`. It replaces the Scripts sidebar section. Its header has the title "Launchers", a button to import launchers, and a button to create a custom launcher.

### Source line 34

- Glossary entry: [Launcher](../../glossary/sidebars.md#26-launcher).
- Proposed destinations: Glossary · Launcher purpose, levels and former names, Behaviour, User Interface, Technical documentation.

#### Launcher

One item of the Launchers sidebar section: a name, a command line, and an optional folder. A launcher has one of two levels: the user level, shown in every workspace and saved in the file `launchers.json` of the folder of the data of Heidrun Code, and the workspace level, shown only in one workspace and saved in the list `launchers` of the file `.heidrun/config.json`. The rules are in launchers.md (`/docs/agents_rules/user_interface/sidebars/launchers.md` in the original documentation). A click on its button "Run" runs its command line in its own tab. A launcher is not a `script` of a file `package.json`: the window "Import launchers" reads those `scripts`, and it makes launchers from them. It replaces the word "script" and the word "action" for this item.

### Source line 38

- Glossary entry: [Source control sidebar section](../../glossary/sidebars.md#12-source-control-sidebar-section).
- Proposed destinations: Glossary · Former Git sidebar section, User Interface, Behaviour.
- Inventory notes: Check the listed layout against the current Source control documentation and implementation.

#### Source control sidebar section

The sidebar section of the left sidebar that shows the Git changes of the selected workspace, as the source control view of VS Code does. From the top: a header with the title "Source Control" and its buttons, the commit message box, the commit button, the group "Staged Changes", and the group "Changes". It shows only the local Git repository, nothing of GitHub or GitLab. It replaces the Git sidebar section.

### Source line 42

- Glossary entry: [Code hosting sidebar section](../../glossary/sidebars.md#27-code-hosting-sidebar-section).
- Proposed destinations: Glossary, User Interface, Behaviour, Platform Support.

#### Code hosting sidebar section

The sidebar section of the left sidebar that shows what lives on GitHub or on GitLab for the repository of the selected workspace: a list of the open issues, and a list of the open pull requests (GitHub) or merge requests (GitLab). A row has three lines and no button. A click on a row opens an information card. The words for its search, such as "saved search", are in [code_hosting.md](code_hosting.md).

### Source line 46

- Glossary entry: [File explorer sidebar section](../../glossary/sidebars.md#11-file-explorer-sidebar-section).
- Proposed destinations: Glossary, User Interface, Behaviour.
- Inventory notes: Check the Git repository wording against the rule that reads from disk.

#### File explorer sidebar section

The sidebar section of the left sidebar that shows the whole folder tree of the Git repository of the selected workspace, with the icon `folder2`. Its menu has an option "Ignored files" that shows or hides the files and the folders that Git ignores. A click on a folder folds or unfolds it. A click on a file opens the file in a file view pane. A right click on a file opens a context menu that copies the path of the file. It changes no file, except the new empty file and the new empty folder that the developer asks for.

### Source line 50

- Glossary entry: [Search in files sidebar section](../../glossary/sidebars.md#28-search-in-files-sidebar-section).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Search in files sidebar section

The sidebar section of the left sidebar that searches a text in all the files of the Git repository of the selected workspace, with the icon `search`. It has the options "Match case" and "Regular expression", and groups the results by file. A click on a line opens the file at that line in a file view pane. The rules are in file_search.md (`/docs/agents_rules/user_interface/sidebars/file_search.md` in the original documentation).

### Source line 54

- Glossary entry: [Sidebar icon bar](../../glossary/sidebars.md#29-sidebar-icon-bar).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Sidebar icon bar

The narrow vertical bar of icons at the outer edge of each sidebar, like the bar of icons of Visual Studio Code. It shows one icon for each sidebar section of that sidebar. A click on an icon shows that sidebar section. When the sidebar is collapsed, the sidebar icon bar is the only part of the sidebar that stays visible.

### Source line 58

#### Rules

### Source line 60

- Proposed destinations: Glossary.

- The word "section" is never alone. Write "sidebar section" or "status bar section".

### Source line 61

- Proposed destinations: Glossary.
- Inventory notes: Reconcile the stated limits on Action with Guards and User activity.

- Write "launcher" for an item of the Launchers sidebar section, never "script" and never "action". Write "script" only for a `script` of a file `package.json`, and "action" only for a Git action of the Source control sidebar section, a GitHub Action, or an action of the phone access.
