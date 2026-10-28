# Web styling rules

- Created: 22 October 2026
- Last updated: 23 October 2026
- Status: Maintained overview for people
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../glossary/index.md)
- Related issue: [issue 796](https://github.com/heidrun-org/heidrun/issues/796), [issue 799](https://github.com/heidrun-org/heidrun/issues/799)

This folder holds the rules for the appearance of the web page of the desktop window of Heidrun Code: the colors, the buttons and their states, the hover, the contrast, the icons, the spacing, the scroll bars, and the Bootstrap utility classes. Each rule is in this folder only.

The folder `user_interface` holds where each part of the window goes, how big it is, what it contains, and what it does. A sentence that is only about appearance is in this folder, and the file of the part links here. A sentence there that says what a part contains can still name its look in a few words, for example "in muted color". Two kinds of rule stay outside this folder: the status item of the macOS menu bar, which is not a part of the web page, and Heidrun Code Mobile, which is a separate website.

Read [index.md](index.md) before you change a color, a button, a hover, a space, or an icon. Start with [shared_design.md](shared_design.md). Each rule names the test that enforces it, or says that no automated test checks it.
