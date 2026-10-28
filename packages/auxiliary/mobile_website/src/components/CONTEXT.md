# Directory Context: `/packages/auxiliary/mobile_website/src/components`

## Purpose
The parts that more than one screen of the mobile website uses.

## Key Exports & Entry Points
- `agent_card.ts`: a coding agent as a card that waits for the developer, and as a row of the list of panes.
- `bottom_bar.ts`: the four buttons Dashboard, Needs you, Panes, and Launchers.
- `icon.ts`: the class `Icon`. It draws the Bootstrap icons and the shared Heidrun Code branding icon as inline SVG.
- `confirm_sheet.ts`: the sheet that asks the developer to check a command once more.
- `macro_sheet.ts`: the sheet that lists the macros of the open pane. A tap writes the text of a macro into the field for a prompt.
- `menu_buttons.ts`: one button for each choice of the menu that blocks a coding agent.
- `screen_header.ts`: the top bar of a screen, with the connection dot or with the button Back.
- `status_labels.ts`: the word and the color name of the status of a coding agent.

## Rules
- A component draws only. It never calls the mobile server.
- A component imports nothing from `src/screens`.
- Every text that comes from the computer goes through `HtmlEscape.escape`.
- Every icon comes from `Icon.render`, which reads `bootstrap-icons` and the shared branding image `data/images/heidrun_icon_goat_only.svg`. Nobody draws an icon by hand, and a test checks it.
