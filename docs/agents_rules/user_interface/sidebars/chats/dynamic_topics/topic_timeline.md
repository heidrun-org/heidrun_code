# Past chats sidebar section: the topic timeline

- Created: 27 October 2026
- Last updated: 27 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../../../glossary/index.md), [Glossary of Heidrun Code: dynamic topics](../../../../glossary/dynamic_topics.md)
- Related issue: [issue 264](https://github.com/heidrun-org/heidrun_code/issues/264)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../../../glossary/index.md) and [glossary/dynamic_topics.md](../../../../glossary/dynamic_topics.md).

- The header of the Past chats sidebar section has a button with the icon `bar-chart-steps` and the tooltip "Show the topic timeline", before the sort menu. The button shows only while the dynamic topic bar shows. A click on it opens the topic timeline, a dialog over the window (`components/TopicTimelineModal.vue`). The key Escape, the close button, and a click outside the dialog close it.
- The topic timeline shows the dynamic topics of the chats that the list shows, the same topics as the rows of the chats: raw or clustered, without the topics that more than half of the chats have. Each row is one dynamic topic, with the number of its chats after its name. The horizontal axis is time, from the oldest to the newest chat that has a topic, and the dates of the two ends are under the picture. Each dot is one chat, at the date of its last message. A chat with several topics has one dot in each of its rows, and a vertical line joins these dots.
- The rows are in the order "related topics together" (`relatedTopicOrder` in `lib/topic_timeline.ts`). The first row is the topic that the most chats have. Each next row is the topic that shares the most chats with the last row placed, then the topic that shares the most chats with all the rows already placed, then the topic that more chats have, then the alphabetical order. A smart order is needed because a picture with a time axis makes the reader think that the order of the rows means something: this order keeps the vertical lines short, and the topics that go together form a block.
- A click on a topic keeps only the chats of the topic: the other dots and lines are dimmed, and the topic is marked as selected. A second click shows every chat again. The selected topic of the topic timeline is separate from the selected topic of the dynamic topic bar.
- The tooltip of a dot gives the title of the chat and the date of its last message. A click on a dot, or the key Enter on a dot, closes the topic timeline and opens the chat in Heidrun Code, as the goat button of the row of the chat does.
- When no chat of the list has a dynamic topic, the topic timeline says so in one line, and shows no picture.
