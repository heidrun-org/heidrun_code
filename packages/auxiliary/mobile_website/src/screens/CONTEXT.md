# Directory Context: `/packages/auxiliary/mobile_website/src/screens`

## Purpose
The screens of the mobile website. Each screen is one class with one static method `render` that gives the HTML of the screen, without the bottom bar.

## Key Exports & Entry Points
- `welcome_screen.ts`: the welcome page, which is the first page: the baby goat in a big circle, the name, the motto, the description of Heidrun Code, and the button "Go to the app" at the bottom of the screen. It has no header, no bottom bar, and needs no data from the computer.
- `dashboard_screen.ts`: the Dashboard: the count of coding agents that need the developer, the count that work, and the usage limits. Each count opens a screen.
- `needs_you_screen.ts`: the coding agents that wait for the developer, and the usage limits.
- `panes_screen.ts`: every pane, with or without a coding agent, grouped by workspace and by tab.
- `pane_screen.ts`: one pane (a plain terminal is read-only, with no field for a prompt): the end of its output, its menu, the macro button, a field for a prompt, the microphone button, and the buttons that stop it.
- `launchers_screen.ts`: the launchers of the project of each workspace, with the buttons Run and Stop.
- `message_screen.ts`: the screens that the page shows before it has data: pairing needed, and connecting.

## Rules
- A screen draws only. It never calls the mobile server and never changes the data. The class `MobileApp` does both.
- A tap is marked with the attribute `data-action`, never with an event attribute. The class `MobileApp` reads the attribute.
- Every text that comes from the computer goes through `HtmlEscape.escape`.
