# Web styling of Heidrun Code: Bootstrap and utility classes

- Created: 22 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Shared design rules](shared_design.md), [Glossary of Heidrun Code](../glossary/index.md)
- Related issue: [issue 799](https://github.com/heidrun-org/heidrun/issues/799)

This file gives the rules for the Bootstrap components, the Bootstrap utility classes, and the custom style rules of the web page.

## Rules

- A new screen uses Bootstrap components, Bootstrap utility classes, and theme variables, and no custom CSS. A local style rule is allowed only for a need that Bootstrap cannot meet.
- The list of the allowed utility classes is the Sass map `$application-utilities` in `packages/apps/web_frontend/src/bootstrap_parts.scss`. This file does not copy the list, so the list exists in one place only.
- The list stays short on purpose. Add one value at a time, when a screen needs it, and add the class to the expected list in `packages/apps/web_frontend/src/bootstrap_parts.test.ts` in the same change. A class name that the application already uses for another purpose must not appear in the list, because every utility class carries `!important` and wins over a rule of the application.
- The colors of Bootstrap come from the theme variables of the application, defined in `packages/apps/web_frontend/src/styles.css`, as the [shared design rules](shared_design.md) say. A screen never sets a color of its own.

## Tests

- `packages/apps/web_frontend/src/bootstrap_parts.test.ts` checks that the generated utility classes are exactly the expected list, that they sit in the layer `utilities`, and that every utility class carries `!important`.
- `packages/apps/web_frontend/src/design/design_rules.test.ts` rejects a local literal color in a Vue style block or in a local stylesheet.
