# User interface of Heidrun Code Mobile: the screens

- Created: 16 October 2026
- Last updated: 24 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: Heidrun Code Mobile](../../glossary/heidrun_code_mobile.md), [User interface of Heidrun Code: launchers](../sidebars/launchers.md)
- Related issue: [issue 581](https://github.com/heidrun-org/heidrun/issues/581)

This file gives the rules of each screen of the mobile website of Heidrun Code Mobile. The code is in [mobile_website](../../../../packages/auxiliary/mobile_website/CONTEXT.md).

## Every screen

- Each screen of the bottom bar has a top bar with the shared Heidrun Code goat branding icon before its title and a dot that shows the connection to the computer. A connected computer has a static green dot.
- The branding icon is 24 by 24 pixels, keeps its square proportions, and takes the text color. It has the accessible name "Heidrun Code" and does not shrink when the title is long.
- Coding agent status indicators follow [the status dot architecture](../../../architecture/status_dot.md): Blocked is a static red dot, Working is a purple spinning ring, Finished is a static green dot, and Idle is a static gray dot.
- The address of the page names the open screen after "#", so a reload and the buttons Back and Forward of the browser open the same screen.
- A refresh never moves what the developer reads, and never removes the text of the field for a prompt while the developer types or while the microphone listens.
- The texts are in English. A text says "coding agent", never "agent" alone.

## Welcome page

The first page: the baby goat in a big circle, the name, the motto, and the button "Go to the app" at the bottom of the screen. It needs no data from the computer.

## Dashboard

The count of coding agents that need the developer, the count that work, and the usage limits. A tap on a count opens the screen with the details.

The top bar of the Dashboard has a gear button. It opens the settings window of the phone, a sheet over the Dashboard with a Close button. The settings window holds the section "Notifications", which shows five raw values: an address with https, the support of the browser, the service worker `sw.js`, the permission, and the push from the computer. It shows the text of any error as it is. The button "Enable notifications" asks the permission at a tap, then turns the push on. The buttons "Turn on the push" or "Turn off the push", and "Send a test notification", follow. No other screen has the gear button. The service worker has no cache and no fetch handler. Only Chrome on Android can show a notification ([issue 581](https://github.com/heidrun-org/heidrun/issues/581)).

## Needs you

The coding agents that wait for the developer. The blocked coding agents come first, each one with its menu.

## Panes

Every pane, grouped by workspace and then by tab, with a status dot. A pane that runs a plain terminal has the badge "Terminal". A tap opens the screen of one pane.

## Screen of one pane

- The end of the output, with the colors of the terminal.
- The menu of a blocked coding agent, and the button Refuse.
- The macro button in the top bar.
- The field for a prompt, the microphone button, the Interrupt button while the coding agent works, and the button Send.
- The microphone button shows only when the browser has the Web Speech API. The words go into the field after the text that is already there. Nothing is sent before the developer taps Send.

## Screen of a plain terminal

- The phone always shows a plain terminal, to read: its output, and a line that says what the phone can do. A plain terminal has no macro button and no button that stops it. It is not counted in the Dashboard, and it is not in the Needs you screen.
- The setting "Allow typing in terminals from the phone" in the section "Mobile access" of the Settings window is off by default. The desktop application checks it on every typed command, and the answer of the method `state` carries it as `terminalTypingAllowed`.
- Setting off: the screen says that typing is off in the Settings window, and it has no button to type.
- Setting on: the screen has the button "Type in this terminal…". A tap opens a warning sheet that says that typing on a phone is hard and that a mistake can run a command that the developer did not mean. Only the button "Yes, let me type" gives a field for a command. The phone asks again each time that the developer opens the terminal.
- A command typed there goes through the method `prompt`, and the whole text passes the guards before it runs, like a launcher. A command that a guard stops opens the confirmation sheet, and a command that the project blocks never runs.

## Macros

- There is no Macros screen, because a macro goes to one pane. The macro button is in the top bar of the screen of one pane.
- A tap on the macro button asks the computer for the macros of that pane: the personal macros, then the macros of the project of its workspace. The computer replaces the variables of each macro for that pane.
- A tap on a macro writes its text into the field for a prompt, after the text that is already there, like the keyboard. Nothing is sent before the developer taps Send, so the macro passes the same guards as a typed prompt.

## Launchers

- The launchers of each workspace, the launchers of the user level first and then the launchers of the workspace level (see [launchers.md](../sidebars/launchers.md)), with the status "Not started", "Running", or "Finished", and the description or else the command.
- The button Run runs the command of the launcher in its own tab on the computer, like the Launchers sidebar section. The button Stop sends Ctrl+C to the tab of a running launcher.

## The guards

A dangerous command of a prompt, a macro, an answer, or a launcher opens the confirmation sheet with the command and the reason. The computer runs the command only after the developer confirms the same command.
