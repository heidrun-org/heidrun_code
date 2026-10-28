# User interface of Heidrun Code: abbreviated times

- Created: 15 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md)
- Related issue: [issue #499](https://github.com/heidrun-org/heidrun/issues/499)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../glossary/index.md).

## Abbreviated times

- An abbreviated time is a time that the program shows as a short text, counted from the present time: "Just now", "3 min ago", "2 days ago".
- Every abbreviated time has a small circled question mark directly after it (the HTML tag `small` around the icon `question-circle`). This holds in every place of the application: the sidebar sections, the windows, the modal windows, and the information cards.
- The title of the circled question mark is the exact time: the full date, with the day of the week and the time. The developer reads it when the pointer is over the circled question mark.
- The component `AbbreviatedTime` (`packages/apps/web_frontend/src/components/AbbreviatedTime.vue`) shows the abbreviated time and the circled question mark together. No other component calls the function `ago`, and a test fails when one does.
- A new place that shows an abbreviated time uses the component `AbbreviatedTime` in the same change.
- The dates line of a chat already follows this rule ([dates_line.md](../sidebars/chats/information_cards/dates_line.md)).
