# Glossary of Heidrun Code: chats

- Created: 14 October 2026
- Last updated: 23 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md), [User interface of Heidrun Code: chats](../user_interface/sidebars/chats/index.md)
- Related issue: [issue 405](https://github.com/heidrun-org/heidrun/issues/405)

This document gives one short definition for each word of the chats, the chat sessions, and the Past chats sidebar section. The other words of Heidrun Code are in [index.md](index.md).

## The chats

### Chat

One saved conversation between the developer and a coding agent, for example Claude Code or Codex. The coding agent saves each chat in a file on the disk of the developer. A chat belongs to a workspace when the coding agent ran in the folder of that workspace. The source "AI cost" of the Statistics window also counts the chats that ran in a folder below it, such as a worktree, with the stored token usage. A chat is not a pane: the pane is the terminal, and the chat is the saved conversation.

### Chat session

The word that the data layer uses for a chat: one saved conversation between the developer and a coding agent. The package `data_layer_coding_agents` reads the chat sessions from the files of the coding agents, and the Past chats sidebar section lists the same conversations as chats. Use "chat" for what the developer sees in the user interface, and "chat session" for the package and its tables.

### Estimated cost of a chat

The amount of money that the tokens of a chat would cost if each request were paid by token, at the public price of its model. It is an estimate: neither coding agent writes the cost in its files, and a developer on a fixed subscription pays something else. It shows in the information card "Dates and messages", with the input tokens, the cached input tokens, and the output tokens.

### Past chats sidebar section

The sidebar section of the right sidebar that lists the chats of the selected workspace. At its top, a header that stays in place holds a line with the selector that chooses the coding agent, the Chats sort dropdown menu, and the two view buttons, then the dynamic topic bar. Below the header, the list shows the title of each chat of that coding agent, with a summary of up to four lines under the title. Under the list, the buttons "Show less" and "Show more" change the number of chats. The words for the dynamic topics, such as "dynamic topic bar" and "translation table", are in [dynamic_topics.md](dynamic_topics.md).

### Chats sort dropdown menu

The dropdown menu at the top of the Past chats sidebar section, at the left of the two view buttons. Its button shows the name of the chosen sort key, with an icon that shows the chosen order. It has two parts: "Sort by" chooses what the chats are sorted by (created on, last updated, messages from you, issues, pull requests, or files written), and "Order" chooses "Ascending" (the smallest value first) or "Descending" (the largest value first), for the sort key that was chosen. It looks like the sort dropdown menu of the list of issues of GitHub.

## Rules

- The word "chat" means only a saved conversation, as defined above. A pane is not a chat.
