# User interface of Heidrun Code: status bar

- Created: 13 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md)
- Related issue: [issue 290](https://github.com/heidrun-org/heidrun/issues/290), [issue 293](https://github.com/heidrun-org/heidrun/issues/293), [issue 303](https://github.com/heidrun-org/heidrun/issues/303), [issue 311](https://github.com/heidrun-org/heidrun/issues/311), [issue 324](https://github.com/heidrun-org/heidrun/issues/324), [issue 440](https://github.com/heidrun-org/heidrun/issues/440), [issue 475](https://github.com/heidrun-org/heidrun/issues/475), [issue 688](https://github.com/heidrun-org/heidrun/issues/688), [issue 690](https://github.com/heidrun-org/heidrun/issues/690), [issue 694](https://github.com/heidrun-org/heidrun/issues/694)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../glossary/index.md).

## Status bar

- In normal mode, the status bar sits at the bottom of the window, over the whole width. Zen Mode hides the status bar.
- Each status bar section shows one piece of information, for example the selected workspace, the usage of Claude, Codex, or Antigravity, the Git branch, and the connection to Herdr. The number of agents that are blocked, working, or done is not in the status bar: the top right corner of the window already shows it.
- A click on a status bar section opens its information card above the section.
- How each status bar section looks under the pointer and while its information card is open is in [status_bar_appearance.md](../../web_styling/status_bar_appearance.md).
- Quota data appears in the status bar only when quota monitoring is on in the section "Coding agents" of the Settings window and its coding agent is on. When Claude is on but no Claude quota report has arrived, the status bar says "Claude quota: unspecified"; this means the quota is unknown, not zero. The status bar never offers to turn quota monitoring on; the setting controls the Claude Code status line integration too ([issue #694](https://github.com/heidrun-org/heidrun/issues/694)).
- The track of the rings of the usage of Claude, Codex, and Antigravity is in [status_bar_appearance.md](../../web_styling/status_bar_appearance.md).
- The information card of the usage of Claude, Codex, and Antigravity, and the information card of the Workspace status bar section are 408 pixels wide, which is 20 percent more than the 340 pixels of the other information cards of the status bar ([issue #290](https://github.com/heidrun-org/heidrun/issues/290), [issue #303](https://github.com/heidrun-org/heidrun/issues/303)).

The Git branch section has its own file, [status_bar_git.md](status_bar_git.md).

## Menu of the status item

- The status item tooltip names the application. In Heidrun Code Development, the first menu line is "Open Heidrun Code Development", so two running applications can be distinguished.

- The status item sits in the macOS menu bar. A click on it opens a menu. From top to bottom, the menu has the line "Open Heidrun Code", then the three sections "Blocked", "Finished", and "Working". The menu ends with the last line of the section "Working", with no separator after it. The menu shows no quota ([issue #311](https://github.com/heidrun-org/heidrun/issues/311)).
- The picture of the status item shows only the icon of Heidrun Code and the three discs "Blocked", "Finished", and "Working", with little empty space around them. A disc without agent is gray inside, the same gray for the three statuses, and its border keeps the color of the status (red, green, or violet) and is thicker than the border of a disc with agents, so that it stays visible on the blue menu bar. The color of the status "Working" is violet, not blue, because blue is hard to see on the blue menu bar, above all on the lighter pill that macOS draws behind the status item while the pointer is over it. The same violet colors the dot before each working agent in the menu ([issue #313](https://github.com/heidrun-org/heidrun/issues/313)). The picture shows no quota: the status bar of the Heidrun Code window shows it. On a MacBook with a camera notch, macOS hides, with no message, the menu bar icons that do not fit to the right of the notch, so the picture stays as narrow as possible ([issue #311](https://github.com/heidrun-org/heidrun/issues/311)).
- The three section titles show the normal black text with the normal weight, like "Open Heidrun Code" and the names of the agents. They are not gray and not bold. The lines "None" are gray.
- macOS draws every disabled menu item in gray, and no text color changes this. So the section titles are enabled menu items, and the lines "None" are the only disabled lines. The cost is that macOS turns an enabled line blue while the pointer is over it ([issue #293](https://github.com/heidrun-org/heidrun/issues/293)).
- A click on "Open Heidrun Code" or on a section title shows the main window. A click on an agent shows the main window and selects the pane of the agent.
- While the environment variable `HEIDRUN_CODE_STATUS_ITEM_USER_ACTIVITY` is set, the icon of Heidrun Code in the picture is faded while the user is not active in front of Heidrun Code, and normal while the user is active. The user is active when the Heidrun Code window is in front and a keyboard action or a mouse action happened less than 5 seconds ago. This is a way to see by eye that the detection of the activity of the user works. It is off when the variable is not set ([issue #440](https://github.com/heidrun-org/heidrun/issues/440)).

