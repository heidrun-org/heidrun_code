# User interface of Heidrun Code: launchers

- Created: 24 October 2026
- Last updated: 24 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [Glossary of Heidrun Code: sidebars](../../glossary/sidebars.md), [User interface of Heidrun Code: code hosting saved searches](code_hosting_saved_searches.md), [User interface of Heidrun Code: Heidrun Code Mobile screens](../heidrun_code_mobile/screens.md)
- Related issue: [issue 853](https://github.com/heidrun-org/heidrun_code/issues/853)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../glossary/index.md). It gives the two levels of a launcher, the place where each level is kept, and the way that the Launchers sidebar section and the window "Create a custom launcher" show them. The rest of the sidebars is in [sidebars.md](sidebars.md).

## The two levels

A launcher has one of two levels. The two levels work like the two levels of a saved search, which are in [code_hosting_saved_searches.md](code_hosting_saved_searches.md) ([issue #853](https://github.com/heidrun-org/heidrun_code/issues/853)).

- A launcher of the user level shows in every workspace. Heidrun Code keeps it in the file `launchers.json`, in the folder of the data of Heidrun Code: the folder of the variable `HEIDRUN_CODE_DIR`, else `~/.config/heidrun_code`. The file `macros.json` of the personal macros is in the same folder. The file is a JSON list. Each item of the list has the fields of an item of the list `launchers` of the file `.heidrun/config.json`: `id`, `label`, `command`, and optionally `description`, `cwd`, and `agent`.
- A launcher of the workspace level shows only in the workspace of the project that holds it. Heidrun Code keeps it in the list `launchers` of the file `.heidrun/config.json` of the project, as it did before the levels existed. This file stays in the repository, so the team shares these launchers. The file `launchers.json` is not in the repository and is not shared.
- The format of the file `launchers.json` has one place, the package `heidrun_code_ctrl` (the functions `read_user_launchers` and `write_user_launchers`). The desktop application reads and writes the file through the Tauri commands `launchers_user_read` and `launchers_user_write`.
- The web page reads the file again about every second, so a change made by a person or by another program shows in the window. A file that cannot be read, or that has a launcher with an unknown field, a missing field, or a repeated identifier, is never overwritten: a message on the screen says why, and the launchers of the user level are not shown until the file is valid again.
- No launcher has the same identifier as another launcher of the same workspace, at either level. A new launcher gets an identifier that no launcher of the workspace has.

## The Launchers sidebar section

- The list shows first the launchers of the user level, then the launchers of the workspace level, each group in the order of saving.
- The card of a launcher of the user level shows the text "User level" next to its state. Its tooltip says "This custom launcher shows in every workspace." The card of a launcher of the workspace level shows no level.
- The text that says that there is no launcher shows only when both levels are empty.
- The window "Import launchers" does not offer a detected command that is already a launcher at either level.
- The command palette, the number of running launchers on the icon of the sidebar section, and the Launchers screen of Heidrun Code Mobile list the launchers of both levels, in the same order.

## The windows "Create a custom launcher" and "Edit a custom launcher"

- The window shows, in this order: the label "Kind" with its buttons, the label "Level" with the buttons "User" and "Workspace" and one sentence under them that says where the custom launcher shows, then the fields "Name", "Description", and "Current work directory", then the fields of the kind.
- The sentence for "User" is: "The custom launcher shows in every workspace. A current work directory that is not empty is read from the root of each workspace." The sentence for "Workspace" is: "The custom launcher shows only in the workspace <name of the selected workspace>."
- When the developer creates a custom launcher, the button "Workspace" is chosen first, because this was the only level before the levels existed. The window does not remember the last level.
- The window "Edit a custom launcher" shows the level of the custom launcher as chosen, and can change it. A change of the level moves the custom launcher to the end of the custom launchers of the new level. The window writes the custom launcher at the new level first and removes it from the old level only after that, so a failure never loses it. When the write at the new level fails, the custom launcher stays at the old level.

## The current work directory of a launcher of the user level

- The field is a folder inside the repository of the selected workspace, as before. An empty field means the root of the repository.
- A launcher of the user level keeps this folder as a path relative to the root. In another workspace it is read from the root of that workspace.
- A click on "Run" in a workspace where this folder does not exist starts no tab, and a message names the custom launcher, the folder, and the workspace. A tab that is already open is brought to the front without this test. A launcher of the workspace level is not tested.

## The command line

The group `launchers` of the command line `heidrun_code_ctrl` lists, adds, updates, and deletes the launchers of the workspace level only. No command reads or changes the file `launchers.json`.
