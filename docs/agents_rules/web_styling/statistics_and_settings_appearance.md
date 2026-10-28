# Web styling of Heidrun Code: appearance of the Statistics window and of the Settings window

- Created: 22 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Shared design rules](shared_design.md), [Charts of the Statistics window](../user_interface/window/statistics_charts.md)
- Related issue: [issue 629](https://github.com/heidrun-org/heidrun/issues/629), [issue 799](https://github.com/heidrun-org/heidrun/issues/799)

This file gives the rules about the colors of the charts of the Statistics window, the size of its inputs, and the padding of the information card of an option of the Settings window. What each chart shows, and what each input does, is in the folder `user_interface/window`. Each rule names its test, and the paths of the tests start at `packages/apps/web_frontend/src`.

## Colors of the charts

- Each workspace of the stacked bars of the tab "User activity" has one color, taken from its place in the list of buttons, which is sorted by name: the color 500 of the scales blue, orange, green, purple, red, teal, yellow, and pink of Bootstrap, then the list starts again. The color of a workspace never changes with the time range, the slot length, or the choice of the workspaces. Tests: `lib/user_activity_workspaces.test.ts` and `components/UserActivityTab.test.ts`.
- In the tab "Work of one person", with the source "Git history" and the metric "Commits and pull requests", the commits have the color `--primary-bg`, and the pull requests have the color `--success-bg`. With the metric "Lines added and deleted", the lines added have the color `--success-bg`, and the lines deleted have the color `--danger-bg`. Test: `components/PersonWorkTab.test.ts`.
- In the tab "Work of one person", with the source "AI cost", the cost of Claude Code has the color `--accent`, and the cost of Codex has the color `--primary-bg`. Test: `components/PersonWorkTab.test.ts` checks that the two colors differ; no automated test checks the two variables.

## Inputs of the tab "Work of one person"

- Every button group is small (`btn-group-sm`) and the person chooser is small (`form-control-sm`), so that the buttons have less padding ([issue 629](https://github.com/heidrun-org/heidrun/issues/629)). Test: `components/PersonWorkTab.test.ts`.

## Information card of an option of the Settings window

- The card has no padding of its own besides the Bootstrap list group. No automated test checks the padding of the card.
