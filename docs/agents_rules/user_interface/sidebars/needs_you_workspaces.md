# User interface of Heidrun Code: the list of workspaces of the Needs you sidebar section

- Created: 14 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [User interface of Heidrun Code: panes](../workspaces_tabs_and_panes/panes.md), [User interface of Heidrun Code: workspace](../workspaces_tabs_and_panes/workspace.md)
- Related issue: [issue 417](https://github.com/heidrun-org/heidrun/issues/417), [issue 556](https://github.com/heidrun-org/heidrun/issues/556), [issue 807](https://github.com/heidrun-org/heidrun/issues/807)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../glossary/index.md).

## The list of workspaces

- The Needs you sidebar section shows the list of all the workspaces at its bottom, under the cards of the agents. The list stays at the bottom edge of the sidebar section. When there are many cards, only the cards scroll. By default, the list takes the height of its rows, up to 40 percent of the sidebar section.
- The separator line above the title is a line to drag, like the line between the viewport and the right sidebar: the cursor `row-resize`, the color under the pointer and while dragging, and the same title. Dragging it up makes the list taller. The height is the setting `needsYouWorkspacesHeight`, saved when the drag ends and read again after a restart; 0 is the default height. A chosen height is never smaller than 84 pixels (the title and one row), and the cards keep at least 80 pixels. The default height has no smallest height. A double click goes back to the default height. The keyboard reaches the line, and the up and down arrow keys change the height by 10 pixels, or by 40 pixels with Shift. When the rows do not fit, only the rows scroll, with a scroll bar, and the title stays ([issue 807](https://github.com/heidrun-org/heidrun/issues/807)). The limits are in `lib/needs_you_workspaces_height.ts`.
- From the top, the list has one separator line, the title "Workspaces", and one row for each workspace.
- A row shows the status dot and the name of the workspace, with the same dot as the list of the information card of the workspace status bar section: the color of the status of the agents, or a hollow ring when no agent runs. The background of the row of the selected workspace is in [sidebars_appearance.md](../../web_styling/sidebars_appearance.md). A row is 40 pixels tall, and two rows have no space between them.
- The Git branch of the workspace sits at the right end of the row, in the secondary color, and a long branch is cut with an ellipsis (at most half of the row). The tooltip gives the whole name. A workspace without a Git branch shows no branch. The branch comes from `git.status` of the store `git.ts`, which Herdr reads every 10 seconds for the selected workspace and every 60 seconds for the others.
- The spaces and the corners of the list, of its title, and of its status dots are in [sidebars_appearance.md](../../web_styling/sidebars_appearance.md).
- The rows have the same order as the list of the information card of the workspace status bar section, because both lists read `workspaces` of the store `session.ts`. The order is the order of Herdr: the number of the workspace. **The order never changes with the status dot or with the presence of an agent**: starting, blocking, finishing, or stopping an agent moves no row. Only the developer changes the order, by drag and drop or with the keyboard ([workspace.md](../workspaces_tabs_and_panes/workspace.md)).
- A click on a row selects the workspace. The information card of the workspace status bar section is not involved.
- The developer moves a row by drag and drop, with the same function `moveWorkspace` as the information card. A drop is saved in Herdr, so both lists show the new order. A drag does not select the workspace, and a short press is a click.
- The row has no button to rename or to close a workspace. The information card of the workspace status bar section keeps them.
- The list shows nothing when Herdr has no workspace.

## The heading "Needs you" of the section "Sidebars" of the Settings window

- The Settings window has a section "Sidebars" (icon `layout-sidebar-inset-reverse`, because the icon `bell` is the icon of the section "Notifications" and of the Needs you sidebar section). The section has one heading for each sidebar section: "Needs you", "Past chats", and "Source control".
- Under the heading "Needs you", the section has one Bootstrap switch, "Show the workspaces", and a help line under it. The switch is the option `showWorkspacesInNeedsYou` of the settings, and the default is on. The change applies at once, with no restart. When the switch is off, the Needs you sidebar section shows only the cards.
- Under the same heading, the choice "Hide the finished items after" is a Bootstrap button group of four radio inputs: "5 min", "15 min", "1 h", and "Never". It is the option `finishedTtl` of the settings.
- The section is the component `SettingsSidebarsSection.vue`, and the switch is a `SettingsSwitchRow.vue` ([issue 556](https://github.com/heidrun-org/heidrun/issues/556)).
