# Glossary of Heidrun Code: code hosting

- Created: 13 October 2026
- Last updated: 23 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md), [User interface of Heidrun Code: code hosting](../user_interface/sidebars/code_hosting.md), [User interface of Heidrun Code: code hosting search](../user_interface/sidebars/code_hosting_search.md), [User interface of Heidrun Code: code hosting saved searches](../user_interface/sidebars/code_hosting_saved_searches.md)
- Related issue: [issue 374](https://github.com/heidrun-org/heidrun/issues/374), [issue 378](https://github.com/heidrun-org/heidrun/issues/378), [issue 405](https://github.com/heidrun-org/heidrun/issues/405), [issue 607](https://github.com/heidrun-org/heidrun/issues/607), [issue 822](https://github.com/heidrun-org/heidrun/issues/822)

This document gives one short definition for each word of the search in the Code hosting sidebar section. Each list of the section, "Issues" and "Pull requests" (or "Merge requests"), has its own search. The other words of Heidrun Code are in [index.md](index.md).

### Search line

The line under the title of a list of the Code hosting sidebar section. It holds the search field, then three buttons that show only an icon, on the same line: "Search", "Save this search", and "Edit the saved search". Each list has its own search line.

### Search field

The text field of a search line. The developer writes a search supported by the hosting service, and presses the key Enter. GitHub accepts its full search language; Heidrun Code translates a limited set of expressions for GitLab. The small circled question mark after the list title opens search help. The list of this search line then shows the items that match the search, and the other list does not change. An empty search shows all the open items of the list.

### Saved search

A search that the developer keeps under a name, for example "Mine" for `author:@me`, or "Mentions me" for `mentions:@me`. The Code hosting sidebar section shows each saved search as a small button under the search line of its list. A click on the button fills the search field of this list and runs the search in this list. A saved search belongs to one list: a saved search of the list "Issues" never shows in the list "Pull requests". A saved search has a level: it is at the user level or at the workspace level. Heidrun Code keeps it with the other options. A saved search is saved in the window "Save this search", and renamed, changed, moved to the other level, or deleted in the window "Edit the saved search".

### Level of a saved search

The place where a saved search shows: "User" or "Workspace". A saved search of the user level shows in every workspace, and it is the level of every saved search that was saved before the levels existed. A saved search of the workspace level shows only in the workspace where the developer saved it. The developer chooses the level with the buttons "User" and "Workspace" of the windows "Save this search" and "Edit the saved search". The information card tooltip of the button of a saved search tells the name, the search, the level, and the list.

## Rules

- Write "level of a saved search", "user level", and "workspace level" in full. Do not write "scope", "global", or "local" for them.
- Write "saved search" in full. Do not write "bookmark", "favorite", "preset", "filter", or "view" for it.
- Write "search field" in full. Do not write "search box" or "query box" for it.
- Write "search line" in full. Do not write "toolbar", "search bar", or "search row" for it.
