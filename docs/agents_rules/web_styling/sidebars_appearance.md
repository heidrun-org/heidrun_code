# Web styling of Heidrun Code: appearance of the sidebars

- Created: 22 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Shared design rules](shared_design.md), [Colors and scroll bars](colors_and_scroll_bars.md), [Glossary of Heidrun Code: sidebars](../glossary/sidebars.md)
- Related issue: [issue 430](https://github.com/heidrun-org/heidrun/issues/430), [issue 749](https://github.com/heidrun-org/heidrun/issues/749), [issue 799](https://github.com/heidrun-org/heidrun/issues/799)

This file gives the rules about how the sidebar sections and the sidebar icon bar look. What each sidebar section contains and does is in the folder `user_interface/sidebars`. Each rule names its test, and the paths of the tests start at `packages/apps/web_frontend/src`.

## Sidebar sections and the sidebar icon bar

- The title of every sidebar section is in normal letters and in semibold (`fw-semibold`), like the title of the Past chats sidebar section. Test: `components/ToHandlePanel.test.ts` checks the title of the Needs you sidebar section.
- The title of the Past chats sidebar section has a top padding of 12 pixels. The titles of the Clipboard sidebar section and of the Needs you sidebar section have 12 pixels above them and 14 pixels at their left, the same space as the title of the Past chats sidebar section. Test: `sidebar_padding.test.ts`.
- The icon of the selected sidebar section has a background. Test: `components/SidebarIconBar.test.ts` checks the mark of the selected sidebar section; no automated test checks the background.

## Past chats sidebar section

- The separators between the rows of the list go from one edge of the sidebar to the other, and the title and the lines of a row keep the same small margin as the selector (14 pixels) at the left and at the right. A row gets a background while the mouse pointer is over it. Test: `bootstrap_parts.test.ts` checks the background of a row of a list group under the pointer; no automated test measures the margins.
- The buttons of the dynamic topic bar are small buttons (`btn small`), and the selected button has the selected appearance of the [shared design rules](shared_design.md). A topic label on the row of a chat is a Bootstrap badge with the background `--bg-2`, and the label of the selected topic has the inverted colors: the text color as background. No automated test checks these colors.
- In the information card of the choice "Extraction method" of the section "Dynamic topics" of the Settings window, each block has its name in the medium weight, and its text in muted color. No automated test checks this look.
- In the information card of the dates line, a row of a fact and a row of a message get the soft background while the pointer is over them, like the rows of the other information cards of a chat. Test: `bootstrap_parts.test.ts` checks the soft background of a row of a list group.
- A press on a row of a Bootstrap list group does not change the background of the row. The background of the files line of a chat stops at the end of the widest of the four lines of the summary, and does not go to the edge of the column. Test: `bootstrap_parts.test.ts` checks the press of a row of a list group; no automated test checks the width of the background of the files line.
- In the information card of the files line, a button gets a background, lighter than the background of the row, while the pointer is over it. A row gets a soft background while the pointer is over it, and the files line and the buttons get a stronger background than the soft one, so each of them still shows inside the row. The soft background is the color `--hover-soft`, for every row of a Bootstrap list group. Test: `bootstrap_parts.test.ts` checks the soft background and the press of a row of a list group.
- In the information card of the references line, the state is in a pill with a strong color and bold white text, so that it reads on the dark background: green `--reference-open` for open, purple `--reference-merged` for merged and for a closed issue, red `--reference-closed` for a closed pull request. The shared palette defines these backgrounds with at least 4.5:1 contrast against `--on-solid` text. Tests: `components/ChatReferenceDetails.test.ts` and `design/design_rules.test.ts`.

## Code hosting sidebar section

- A row has square corners, and a very light line separates it from the next row. The row gets a background while the pointer is over it, and keeps its background while its information card is open and while it waits for the information card. No automated test checks the corners and the backgrounds of a row.
- A label of the information card is a small pill: its font is 0.75 times the font of the card, with little padding, so that it weighs less than the text above it. No automated test checks the size of a label.

## File explorer sidebar section

- The icons of the rows are grey, not colored. No automated test checks the color of the icons.
- Every file and every folder that Git ignores, and every row inside a folder that Git ignores, is shown in the muted color ([issue #430](https://github.com/heidrun-org/heidrun/issues/430)). A file that Git tracks, and a new file, keep the normal color. Test: `components/FilesPanel.test.ts`.
- The selected row has a background that is darker than the background of a row under the pointer, and a blue line around it, as the selected row of VS Code. A row under the pointer has a background that is lighter than the sidebar, in the dark theme and in the light theme: it has the color `--files-row-hover` (`#22262a` in the dark theme, `#ececE8` in the light theme), and the difference to the sidebar is at least 10 levels in one color channel, so the developer sees it without effort. Test: `components/FilesPanel.test.ts` checks the row under the pointer; no automated test checks the selected row.

## Needs you sidebar section

- In the list of workspaces, the row of the selected workspace has the selected background. Test: `components/NeedsYouWorkspaces.test.ts` checks the mark of the selected workspace.
- The list touches the left, the right, and the bottom border of the sidebar section: the highlight of a row (under the pointer, and for the selected workspace) has no rounded corner, and the last row touches the bottom. Two rows have no space between them. Only the space of 12 pixels above the title stays. Test: `components/NeedsYouWorkspaces.test.ts`.
- The title and the status dot are 14 pixels from the left border, which is the distance of the first character of the message "No agent is blocked…" (6 pixels of padding of the cards and 8 pixels of padding of the message). The spacing is in the style block of `NeedsYouWorkspaces.vue`, because the Bootstrap parts of the application have no utility class for it. Test: `components/NeedsYouWorkspaces.test.ts` reads both numbers.
