# Web styling of Heidrun Code: appearance of the status bar

- Created: 22 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Shared design rules](shared_design.md), [Glossary of Heidrun Code: status bar](../glossary/status_bar.md)
- Related issue: [issue 324](https://github.com/heidrun-org/heidrun/issues/324), [issue 475](https://github.com/heidrun-org/heidrun/issues/475), [issue 799](https://github.com/heidrun-org/heidrun/issues/799)

This file gives the rules about how the status bar sections of the window look. What each status bar section contains and does is in [status_bar.md](../user_interface/window/status_bar.md) and [status_bar_git.md](../user_interface/window/status_bar_git.md). The status item of the macOS menu bar is not a part of the web page, so its rules stay in [status_bar.md](../user_interface/window/status_bar.md). Each rule names its test, and the paths of the tests start at `packages/apps/web_frontend/src`.

## Status bar sections

- Each status bar section looks like a button of the status bar of Visual Studio Code: while the mouse pointer is over it, and while its information card is open, it has a rounded background (6 pixels radius), white at 12 percent strength in the dark theme and black at 12 percent strength in the light theme. The background leaves 6 pixels of the status bar above and below it. The three components of the status bar sections share the class `status-section` of the file `styles.css` ([issue #324](https://github.com/heidrun-org/heidrun/issues/324)). Test: `components/StatusBar.test.ts`.
- The rings of the usage of Claude, Codex, and Antigravity have the same track as the usage wheel in the header of a pane: the part of the ring that is not filled is drawn in the faint color (`--faint`), so that the whole ring shows against the status bar in the dark theme and in the light theme ([issue 475](https://github.com/heidrun-org/heidrun/issues/475)). Test: `components/QuotaSummary.test.ts`.
- The line after the workspace status bar section has 6 more pixels of space on each side than the other lines of the status bar, so that the workspace status bar section is not packed against the next status bar section. Test: `components/StatusBar.test.ts`.
- The information card of the workspace status bar section uses the normal cursor; only enabled actions use the pointer cursor. Test: `components/WorkspaceStatusSummary.test.ts`.

## Git branch section

- The zones touch each other: each side between two zones has 4 pixels of background, and the two outer sides have the 11 pixels of the other status bar sections. The text of the zones does not move. The three zones are one button group, as in Bootstrap: only the left corners of the branch zone and the right corners of the counts zone are round (6 pixels), and the corners where two zones touch are square, also in the hover background and in the open state. Test: `status_bar_bootstrap.test.ts` checks the corners; no automated test measures the spaces.
- The card of the branch picker has no padding around the list: the separators between the rows touch the left and right borders of the card, and the scroll bar of the list touches the right border. Only the search field has space around it. The rows have 10 pixels of space above and below, and 4 pixels between their two lines. No automated test measures these spaces.
- The button with the icon of GitHub (or GitLab) on a row of the branch picker is a Bootstrap outline button with no border (classes `btn btn-outline theme-secondary border-0`). Test: `status_bar_bootstrap.test.ts`.
