# Code hosting source material

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Transferred source material
- Related framing: [Glossary migration sources](README.md)
- Related issue: [issue 1135](https://github.com/heidrun-org/heidrun_code/issues/1135)

Original source `/docs/agents_rules/glossary/code_hosting.md` in the [pinned revision](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db). The headings identify original line numbers. Proposed destinations and inventory notes describe the transfer. Approval of a product rule is recorded with the resulting specification.

### Source line 10

This document gives one short definition for each word of the search and of the merge in the Code hosting sidebar section. Each list of the section, "Issues" and "Pull requests" (or "Merge requests"), has its own search. The other words of Heidrun Code are in [index.md](source_index.md).

### Source line 12

- Glossary entry: [Search line](../../glossary/code_hosting.md#11-search-line).
- Proposed destinations: Glossary, User Interface.

#### Search line

The line under the title of a list of the Code hosting sidebar section. It holds the search field, then three buttons that show only an icon, on the same line: "Search", "Save this search", and "Edit the saved search". Each list has its own search line.

### Source line 16

- Glossary entry: [Search field](../../glossary/code_hosting.md#12-search-field).
- Proposed destinations: Glossary, User Interface, Behaviour, Platform Support.

#### Search field

The text field of a search line. The developer writes a search supported by the hosting service, and presses the key Enter. GitHub accepts its full search language; Heidrun Code translates a limited set of expressions for GitLab. The small circled question mark after the list title opens search help. The list of this search line then shows the items that match the search, and the other list does not change. An empty search shows all the open items of the list.

### Source line 20

- Glossary entry: [Saved search](../../glossary/code_hosting.md#13-saved-search).
- Proposed destinations: Glossary, User Interface, Behaviour, Technical documentation.

#### Saved search

A search that the developer keeps under a name, for example "Mine" for `author:@me`, or "Mentions me" for `mentions:@me`. The Code hosting sidebar section shows each saved search as a small button under the search line of its list. A click on the button fills the search field of this list and runs the search in this list. A saved search belongs to one list: a saved search of the list "Issues" never shows in the list "Pull requests". A saved search has a level: it is at the user level or at the workspace level. Heidrun Code keeps it with the other options. A saved search is saved in the window "Save this search", and renamed, changed, moved to the other level, or deleted in the window "Edit the saved search".

### Source line 24

- Glossary entry: [Level of a saved search](../../glossary/code_hosting.md#14-level-of-a-saved-search).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Level of a saved search

The place where a saved search shows: "User" or "Workspace". A saved search of the user level shows in every workspace, and it is the level of every saved search that was saved before the levels existed. A saved search of the workspace level shows only in the workspace where the developer saved it. The developer chooses the level with the buttons "User" and "Workspace" of the windows "Save this search" and "Edit the saved search". The information card tooltip of the button of a saved search tells the name, the search, the level, and the list.

### Source line 28

- Glossary entry: [Approval state](../../glossary/code_hosting.md#15-approval-state).
- Proposed destinations: Glossary, Behaviour, Platform Support.

#### Approval state

What the reviewers decided about a pull request or a merge request: "Approved", "Changes requested", or "Review required". On GitLab, it also gives the number of approvals that are still needed. A repository that asks for no review gives no approval state.

### Source line 32

- Glossary entry: [Merge method](../../glossary/code_hosting.md#16-merge-method).
- Proposed destinations: Glossary, User Interface, Platform Support.

#### Merge method

How the hosting service merges a pull request or a merge request: "Create a merge commit", "Squash and merge", or "Rebase and merge". On GitHub, the developer chooses it in the merge window, among the methods that the repository allows. On GitLab, it is a setting of the project, and the developer chooses only whether the commits are squashed.

### Source line 36

- Glossary entry: [Merge bar](../../glossary/code_hosting.md#17-merge-bar).
- Proposed destinations: Glossary, User Interface.

#### Merge bar

The line at the end of the information card of an open pull request or merge request: the approval state, the people who approved, and the button "Merge".

### Source line 40

- Glossary entry: [Merge window](../../glossary/code_hosting.md#18-merge-window).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Merge window

The window that the button "Merge" opens. It shows the state of now, the merge method, and the deletion of the source branch, and it merges only after the click on its own button "Merge".

### Source line 44

- Glossary entry: [Permanent branch](../../glossary/code_hosting.md#19-permanent-branch).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Permanent branch

A branch that a merge never deletes, such as `main`, `dev`, or a personal development branch such as `dev_eric`. The setting "Permanent branches, never deleted by a merge" lists them.

### Source line 48

#### Rules

### Source line 50

- Proposed destinations: Glossary.
- Inventory notes: Apply the rule within Code hosting.

- Write "level of a saved search", "user level", and "workspace level" in full. Do not write "scope", "global", or "local" for them.

### Source line 51

- Proposed destinations: Glossary.

- Write "saved search" in full. Do not write "bookmark", "favorite", "preset", "filter", or "view" for it.

### Source line 52

- Proposed destinations: Glossary.

- Write "search field" in full. Do not write "search box" or "query box" for it.

### Source line 53

- Proposed destinations: Glossary.

- Write "search line" in full. Do not write "toolbar", "search bar", or "search row" for it.

### Source line 54

- Proposed destinations: Glossary.

- Write "merge window" and "merge bar" in full. Do not write "merge dialog", "merge popup", or "merge panel" for them.

### Source line 55

- Proposed destinations: Glossary.

- Write "permanent branch" in full. Do not write "protected branch" for it: GitHub and GitLab use "protected branch" for a different setting of the hosting service.
