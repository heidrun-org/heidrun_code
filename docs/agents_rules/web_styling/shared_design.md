# Web styling of Heidrun Code: shared design rules

- Created: 21 October 2026
- Last updated: 23 October 2026
- Status: Maintained shared design rules for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Colors and scroll bars](colors_and_scroll_bars.md), [Status dot](../../architecture/status_dot.md)
- Related issue: [issue 749](https://github.com/heidrun-org/heidrun/issues/749), [issue 796](https://github.com/heidrun-org/heidrun/issues/796), [issue 799](https://github.com/heidrun-org/heidrun/issues/799)

These rules govern desktop colors, buttons, contrast, and status displays. Keep the existing layout and font selections. The public website and experiments have their own visual identities. Heidrun Code Mobile retains its existing mobile layout and shared status colors.

## Authority and application

`packages/apps/web_frontend/src/styles.css` defines the palette and shared appearances. Its first `:root` block defines the dark theme and common values; `:root[data-theme="light"]` overrides the light theme. A component uses a variable by purpose, never by resemblance to a desired color. A component may set its own layout, but cannot redefine shared button states or coding agent status appearances. Add a missing purpose to the shared palette, document the purpose here, and test its intended foreground/background pairs before using the purpose.

`bootstrap_parts.scss` selects Bootstrap components and maps structural settings. The Bootstrap theme classes used by the application map all their foreground, background, border, contrast, and focus roles to the shared purpose variables; Bootstrap's generated palette does not override these choices. The shared `.btn` rules apply to native buttons and Bootstrap button groups. The existing `primary` and Bootstrap `btn-primary` classes name the same primary action appearance; `go` is an existing alias used by the merge window. New code uses `btn primary` or `btn danger`.

## Colors by purpose

| Purpose | Shared variables | Application |
| --- | --- | --- |
| Surfaces | `--bg`, `--panel`, `--shell`, `--side`, `--field`, `--raised` | Pane, window, surrounding frame, sidebar, input, raised content. |
| Readable text | `--text`, `--text-2`, `--muted`, `--link` | Main text, supporting text, secondary text, links. |
| Decoration | `--line`, `--line-soft`, `--line-strong`, `--faint` | Separators and decoration; `--faint` never supplies essential text. |
| Controls and selection | `--control-border`, `--focus`, `--sel` | Visible control boundary, keyboard focus, selected background. Selection also has text, a border, or a checked state. |
| Main actions | `--action-bg`, `--action-hover`, `--action-pressed`, `--action-text` | Amber primary action and its text; the light theme uses darker amber for contrast. |
| Destructive actions | `--danger-action-bg`, `--danger-action-hover`, `--danger-action-pressed`, `--on-solid` | Red destructive action and white text. |
| Feedback | `--ok`, `--fail`, `--accent`, `--level-ok`, `--level-warn`, `--level-crit` | Success, error, attention, and usage levels, accompanied by text or an icon. |
| Coding agent status | `--blocked`, `--working`, `--done`, `--idle` | Existing status dot colors; see the status rules below. |
| Code hosting status | `--reference-open`, `--reference-merged`, `--reference-closed`, `--on-solid` | Open, merged, closed labels with white text. These are code hosting states, not coding agent statuses. |
| Layers | `--overlay`, `--overlay-heavy`, `--shadow`, `--shadow-soft`, `--toast-shadow` | Window overlays, image overlay, and shadows. |
| File content | `--code-block-bg`, `--editor-*`, `--search-match*`, `--image-checker-*` | Code blocks, editing and search highlights, and transparency checkerboard. |
| Illustration | `--illustration-*` | Text and shading over the goat pictures; deliberately independent of the application theme. |

A contrast ratio is the difference in relative brightness between two colors. Essential text has a ratio of at least **4.5:1** against its background. Essential control boundaries and keyboard focus have at least **3:1** against adjacent surfaces. Separators do not identify controls by themselves and may have lower contrast. Disabled controls and decorative content are exempt; disabled controls must also have a real disabled state. Text on selection uses readable text colors. Status dot colors remain the completed choices of issue 739; status text uses `--blocked-text`, `--working-text`, and `--done-text` when a status dot color does not provide sufficient text contrast.

The normal tests calculate these ratios from the actual stylesheet using relative luminance. The tested pairs include main, supporting, secondary, and link text on the main surfaces and selected background, primary and destructive labels in every active state, code hosting labels, control borders, and focus indicators. This calculation does not measure arbitrary transparency, pictures, gradients, or every composited background. Review those appearances visually and measure new foreground/background combinations when introducing them.

## Buttons

Use a secondary `.btn` for ordinary actions, `.btn.primary` for the main action, and `.btn.danger` for deletion or another destructive action. The label says the action: for example, “Add item” or “Delete item”. Color alone never identifies a destructive action. The label stays visible when an icon is present. A button that contains only an icon has an accessible name and a title, and uses `.btn.icon`: it has no border and no background at rest, and its background shows only under the pointer or with the keyboard focus.

The normal height is 30 pixels, with 12 pixels of horizontal padding, a 7 pixel corner radius, and a 6 pixel gap between icon and text. `.small` is 24 pixels high with 8 pixels of horizontal padding; `.lg` is 40 pixels high with a 10 pixel corner radius. The icon precedes the text. On a menu, which is a raised surface where `--hover` is almost the same color as `--raised`, the hover background of `.btn.icon` is `--line-strong`, the same color as the selected button of the sidebar icon bar; `--line-strong` must differ from `--raised` by a contrast ratio of at least 1.15 in every theme. Related actions use a button group or an 8–12 pixel layout gap. Local layout may change width, alignment, and available space; local layout cannot replace a variant's colors or interaction states.

| State | Shared appearance and behavior |
| --- | --- |
| Rest | Secondary buttons have a visible neutral border; primary buttons are amber; destructive buttons are red. |
| Hover | Background changes through shared hover variables; disabled buttons do not gain an action hover appearance. |
| Keyboard focus | A two pixel `--focus` outline, offset two pixels from the button. Input-based button groups show the same focus outline. |
| Press | Secondary buttons use `--sel`; primary and destructive buttons use their pressed color. |
| Selection | `--sel` background, readable text, and `--focus` border; expose `aria-pressed`, a checked input, or the relevant selected semantics. |
| Disabled | Real `disabled` attribute, default cursor, and 45 percent opacity. A busy action that communicates ongoing work may retain its opacity. |

## Status displays

The [status dot architecture](../../architecture/status_dot.md) remains authoritative for Blocked, Working, Finished, Idle, and Unknown, including their meaning, priority, labels, colors, and animation. Issue 749 preserves the completed status dots from issue 739. Do not recreate `.dot` or `.t-working` and related status classes in a component. A dot has adjacent status text or an accessible name/title that gives the status. Working is the only rotating status. Reduced motion disables animation; a text label or accessible name still communicates Working.

A connection indicator, a code hosting state, and a selection indicator do not mean a coding agent status. The Mosaic window uses a separate `selection-mark` class. Never reuse a coding agent status color to invent the meaning of a selection.

See [the inventory and exceptions](shared_design_inventory.md) for the migration coverage and permitted content palettes.

## Enforcement and visible review

`src/design/design_rules.test.ts` runs within `pnpm --filter web_frontend test` and therefore within the root `pnpm test`. The tests reject local literal colors in Vue style blocks and local stylesheets, competing button appearances, and local coding agent status appearances. Error messages name the source, the violated rule, and the shared definition to use. Negative examples prove that the checker rejects representative violations. Specialized terminal content and generated-image exceptions above are explicit; these checks are not a complete CSS parser or an accessibility certification.

Run `pnpm --filter web_frontend dev --port 1429` in the worktree, then open `http://localhost:1429/design_review.html`. The development page imports the actual application styles and displays actions, sizes, selection, disabled buttons, and existing status dots on each tested surface. Toggle the theme and use the pointer, Tab key, and Space key to exercise real states. The review page is a development entry and does not appear in the application build.

Before accepting a shared rule change, review both themes in this page and the affected application windows. Check readable labels, icon placement, keyboard focus, hover, press, disabled states, selected states, overlays, and narrow windows. Include reduced motion and status labels when changing motion. Automated source and contrast checks complement this visible review; neither replaces the other.
