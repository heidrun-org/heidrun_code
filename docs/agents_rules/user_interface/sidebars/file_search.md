# User interface of Heidrun Code: Search in files

- Created: 26 October 2026
- Last updated: 26 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [Files](files.md), [Opening a file view pane](../workspaces_tabs_and_panes/file_view_pane_opening.md)
- Related issue: [issue 900](https://github.com/heidrun-org/heidrun_code/issues/900)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../glossary/index.md).

## Search in files

The Search in files sidebar section searches a text in all the files of the Git repository of the selected workspace ([issue 900](https://github.com/heidrun-org/heidrun_code/issues/900)).

- Its icon `search` is the second icon of the sidebar icon bar of the left sidebar, after the File explorer icon. It shows no number.
- It has the title "Search in files", then the text box with the visible label "Text to search in the files of the project", then two check boxes with visible labels: "Match case" and "Regular expression". The choices are saved in the settings `fileSearchMatchCase` and `fileSearchRegularExpression`.
- The search starts 350 milliseconds after the last key, at once with Enter, and again when an option changes. A text shorter than 2 characters searches nothing, and the section says "Type at least 2 characters.".
- The backend uses `git grep` with the files that Git does not track yet, so the files of `.gitignore` are not searched. It skips the binary files, keeps at most 200 lines for each file, and stops after 2,000 lines. Then the section says "More than 2,000 results: make the search more precise.". A search that takes more than 15 seconds stops with an error.
- A line under the options says "Searching…" during a search, then the number of results and of files, for example "3 results in 2 files". A search with no result says "No result.". An error of the backend, for example a regular expression that is not valid, shows in the color of an error.
- The results are grouped by file: a row with the arrow, the icon of the kind of the file, the name, the folder, and the number of lines. A click on the row folds or unfolds the lines of the file.
- Each line shows its number and its text, with the first match highlighted. A click on a line opens the file in a file view pane at that line, as [file_view_pane_opening.md](../workspaces_tabs_and_panes/file_view_pane_opening.md) says.
- The text, the results, and the folds stay when the developer shows another sidebar section and comes back. When the selected workspace has another repository, the search runs again in it.

## Where the code is

- `FileSearchPanel.vue` is the sidebar section, and `FileSearch` in `stores/file_search.ts` runs the search, groups the lines, and splits a line around the match.
- The Rust command is `files_grep` in `files.rs`. The repository must be known to the backend, which the Git status of the workspace does.
- The tests are `FileSearchPanel.test.ts`, `file_search.test.ts`, `Sidebar.test.ts`, and the Rust tests of `parse_grep`.
