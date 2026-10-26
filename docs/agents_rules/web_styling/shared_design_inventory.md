# Web styling of Heidrun Code: design inventory and exceptions

- Created: 21 October 2026
- Last updated: 23 October 2026
- Status: Maintained shared design rules for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Shared design rules](shared_design.md), [Status dot](../../architecture/status_dot.md)
- Related issue: [issue 749](https://github.com/heidrun-org/heidrun/issues/749), [issue 799](https://github.com/heidrun-org/heidrun/issues/799)

## Inventory and explicit exceptions

The inventory covered the desktop stylesheet, every Vue style block, local stylesheets, and literal colors used by the terminal and editor. Conflicts included independent destructive button definitions in the confirmation windows, a purple merge button, a blue commit button, differing disabled opacity rules, repeated window overlay and shadow literals, fixed dark-theme links and warning text, and separate local code hosting status colors. These appearances now use shared definitions. Secondary text and selection colors were adjusted where measured contrast failed.

The following exceptions have different constraints and cannot silently become application control styles:

- `packages/apps/web_frontend/src/design/theme_palette.ts` contains the named color theme values. It applies those centralized values through the shared purpose variables; the contrast checks exercise each color theme's action, link, and keyboard focus colours in both appearances.
- The `.code` and `.code.github-light` blocks in `styles.css` define syntax and diff content palettes selected independently of the application theme. Their variables are local to code content, never application buttons or coding agent statuses.
- `lib/terminal_themes.ts` holds the terminal's standard and bright color slots. The terminal renderer requires resolved color strings rather than CSS variables. Existing tests require its background to match `--bg`.
- `lib/refs.ts` and the light reference palette in `components/TerminalView.vue` pass resolved colors to terminal decorations. The terminal renderer requires resolved strings. These colors identify reference types, never application actions or coding agent statuses.
- `components/RcModal.vue` passes fixed dark and white colors to the QR code generator so the generated image remains scannable in either theme.
- Picture captions use the shared `--illustration-*` values in the splash screen, empty tab screen, and About window. White text and dark shading belong to the picture rather than to a light application surface.
- The floating terminal selection toolbar uses `--field` as its button background to remain distinct above terminal content. The push-to-talk button uses recording and transcription colors to communicate microphone activity, alongside its icon and accessible name. Both retain shared button focus and action handling.
- External label colors and chart series colors are data. The chart components may pass a transparent `rgba(0, 0, 0, 0)` background to the chart renderer. Their display must remain understandable through names and legends, and their contrast against the actual background needs review.
- Heidrun Code Mobile and the native macOS status item have their own rendering implementations. The existing status tests enforce their shared status colors and rotating Working appearance where applicable.


## Color themes in Settings

Settings has a Color themes section. It lists Amber, Ocean, Forest, Violet, and Rose, each with a short description. Clicking a name immediately applies that named set of shared colours throughout the application and saves the choice on the current device. Each color theme works with the existing light or dark appearance. The row of the selected color theme uses the main action colors: its name and its description have the color `--action-text` on `--action-bg`, a ratio of at least 4.5:1 in every color theme and in both appearances (measured in a browser in [issue 788](https://github.com/heidrun-org/heidrun/issues/788)). The rule `.list-group-item.active` in `styles.css` has no layer, because the rule `button:where(:not(.btn))` has none and would give the row the text color of its parent. There are no sample controls or individual colour editors in Settings. The standalone development page remains available for reviewing shared controls. The existing status dot colours and animation remain unchanged.
