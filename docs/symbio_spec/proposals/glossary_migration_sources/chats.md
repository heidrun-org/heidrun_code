# Chats source material

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Transferred source material
- Related framing: [Glossary migration sources](README.md)
- Related issue: [issue 1135](https://github.com/heidrun-org/heidrun_code/issues/1135)

Original source `/docs/agents_rules/glossary/chats.md` in the [pinned revision](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db). The headings identify original line numbers. Proposed destinations and inventory notes describe the transfer. Approval of a product rule is recorded with the resulting specification.

### Source line 10

This document gives one short definition for each word of the chats, the chat sessions, and the Past chats sidebar section. The other words of Heidrun Code are in [index.md](source_index.md).

### Source line 12

#### The chats

### Source line 14

- Glossary entry: [Chat](../../glossary/chats.md#11-chat).
- Proposed destinations: Glossary, Behaviour, Technical documentation.

#### Chat

One saved conversation between the developer and a coding agent, for example Claude Code or Codex. The coding agent saves each chat in a file on the disk of the developer. A chat belongs to a workspace when the coding agent ran in the folder of that workspace. The source "AI cost" of the Statistics window also counts the chats that ran in a folder below it, such as a worktree, with the stored token usage. A chat is not a pane: the pane is the terminal, and the chat is the saved conversation.

### Source line 18

- Glossary entry: [Chat session](../../glossary/chats.md#12-chat-session).
- Proposed destinations: Glossary · Alias for Chat, Technical documentation.
- Inventory notes: Use one product definition for Chat and confirm where the technical alias belongs.

#### Chat session

The word that the data layer uses for a chat: one saved conversation between the developer and a coding agent. The package `data_layer_coding_agents` reads the chat sessions from the files of the coding agents, and the Past chats sidebar section lists the same conversations as chats. Use "chat" for what the developer sees in the user interface, and "chat session" for the package and its tables.

### Source line 22

- Glossary entry: [Estimated cost of a chat](../../glossary/chats.md#13-estimated-cost-of-a-chat).
- Proposed destinations: Glossary, Behaviour, User Interface.

#### Estimated cost of a chat

The amount of money that the tokens of a chat would cost if each request were paid by token, at the public price of its model. It is an estimate: neither coding agent writes the cost in its files, and a developer on a fixed subscription pays something else. It shows in the information card "Dates and messages", with the input tokens, the cached input tokens, and the output tokens.

### Source line 26

- Glossary entry: [Past chats sidebar section](../../glossary/chats.md#14-past-chats-sidebar-section).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Past chats sidebar section

The sidebar section of the right sidebar that lists the chats of the selected workspace. At its top, a header that stays in place holds a line with the selector that chooses the coding agent, the Chats sort dropdown menu, and the two view buttons, then the dynamic topic bar. Below the header, the list shows the title of each chat of that coding agent, with a summary of up to four lines under the title. Under the list, the buttons "Show less" and "Show more" change the number of chats. The words for the dynamic topics, such as "dynamic topic bar" and "translation table", are in [dynamic_topics.md](dynamic_topics.md).

### Source line 30

- Glossary entry: [Chats sort dropdown menu](../../glossary/chats.md#15-chats-sort-dropdown-menu).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Chats sort dropdown menu

The dropdown menu at the top of the Past chats sidebar section, at the left of the two view buttons. Its button shows the name of the chosen sort key, with an icon that shows the chosen order. It has two parts: "Sort by" chooses what the chats are sorted by (created on, last updated, messages from you, issues, pull requests, or files written), and "Order" chooses "Ascending" (the smallest value first) or "Descending" (the largest value first), for the sort key that was chosen. It looks like the sort dropdown menu of the list of issues of GitHub.

### Source line 34

#### Rules

### Source line 36

- Proposed destinations: Glossary.
- Inventory notes: Cross-link the source definitions instead of creating a second Chat entry.

- The word "chat" means only a saved conversation, as defined above. A pane is not a chat.
