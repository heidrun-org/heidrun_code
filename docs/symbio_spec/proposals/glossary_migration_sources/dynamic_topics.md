# Dynamic topics source material

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Transferred source material
- Related framing: [Glossary migration sources](README.md)
- Related issue: [issue 1135](https://github.com/heidrun-org/heidrun_code/issues/1135)

Original source `/docs/agents_rules/glossary/dynamic_topics.md` in the [pinned revision](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db). The headings identify original line numbers. Proposed destinations and inventory notes describe the transfer. Approval of a product rule is recorded with the resulting specification.

### Source line 10

This document gives one short definition for each word of the dynamic topics of the Past chats sidebar section. The other words of Heidrun Code are in [index.md](source_index.md).

### Source line 12

- Glossary entry: [Dynamic topic](../../glossary/dynamic_topics.md#11-dynamic-topic).
- Proposed destinations: Glossary, Behaviour, User Interface.

#### Dynamic topic

One short label of one or two words that Heidrun Code computes from the content of a chat, for example "sidebar" or "cache". Nobody writes it by hand. A chat has one to three dynamic topics. The Past chats sidebar section shows them on the row of the chat. The option "Enable dynamic topics" of the Settings window, in its section "Dynamic topics", switches all the dynamic topics on or off. While it is off, Heidrun Code shows no dynamic topic bar and no dynamic topic, and it computes no dynamic topic.

### Source line 16

- Glossary entry: [Raw dynamic topic](../../glossary/dynamic_topics.md#12-raw-dynamic-topic).
- Proposed destinations: Glossary, Behaviour, Technical documentation.

#### Raw dynamic topic

A dynamic topic exactly as it comes out of one chat. With the method "Keyword", Heidrun Code computes it from this chat and the other chats of the list, and it never asks a coding agent. With the method "Language model", a coding agent finds it from the title and the first messages of this chat. The same subject can get several raw dynamic topics, for example "sidebar" and "side bar".

### Source line 20

- Glossary entry: [Clustered dynamic topic](../../glossary/dynamic_topics.md#13-clustered-dynamic-topic).
- Proposed destinations: Glossary, Behaviour, User Interface.

#### Clustered dynamic topic

The name of a cluster, which is a group of raw dynamic topics that have a close meaning. A clustered dynamic topic gives one label to one subject. The option "Enable clustered dynamic topics" of the Settings window makes the dynamic topic bar and the rows of the chats show clustered dynamic topics instead of raw dynamic topics.

### Source line 24

- Glossary entry: [Translation table](../../glossary/dynamic_topics.md#14-translation-table).
- Proposed destinations: Glossary, Behaviour, Technical documentation.

#### Translation table

The table, saved on the disk in the file `topic_clusters.json`, that gives the cluster of each raw dynamic topic. A coding agent, `codex` or `claude`, fills it, one call for all the new raw dynamic topics. A saved row never changes, except at a rebuild.

### Source line 28

- Glossary entry: [Dynamic topic source information](../../glossary/dynamic_topics.md#15-dynamic-topic-source-information).
- Proposed destinations: Glossary, Behaviour.

#### Dynamic topic source information

The data that Heidrun Code reads in a chat to compute its dynamic topics. It has four parts: the title of the chat, the first messages that the developer typed, the folders of the files that the coding agent wrote, and the titles of the GitHub issues and of the pull requests that the chat mentioned. The messages of the coding agent are not part of it.

### Source line 32

- Glossary entry: [Dynamic topic extraction](../../glossary/dynamic_topics.md#16-dynamic-topic-extraction).
- Proposed destinations: Glossary, User Interface, Behaviour, Platform Support.

#### Dynamic topic extraction

The choice of the method that computes the dynamic topics: "Keyword" (from the words of the dynamic topic source information, without a language model) or "Language model" (from the title and the first messages of each chat, with a coding agent, `codex` or `claude`, that is installed on this computer). The Settings window holds the choice, in its section "Dynamic topics", under the title "Extraction method".

### Source line 36

- Glossary entry: [Dynamic topic bar](../../glossary/dynamic_topics.md#17-dynamic-topic-bar).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Dynamic topic bar

The row of small rounded buttons in the header of the Past chats sidebar section, below the line of the selector of the coding agent, the Chats sort dropdown menu, and the two view buttons. The first button, "All", shows every chat. Each other button is one dynamic topic, the strongest first, and shows only the chats that have the topic. The bar scrolls horizontally with the trackpad. An arrow at its end, and an arrow at its start, move the bar by three topics.

### Source line 40

#### Rules

### Source line 42

- Proposed destinations: Glossary.

- Write "dynamic topic bar" in full. Do not write "filter bar" or "chips" for it.

### Source line 43

- Proposed destinations: Glossary.

- Write "dynamic topic source information" in full.

### Source line 44

- Proposed destinations: Glossary.

- Write "raw dynamic topic" and "clustered dynamic topic" in full, and "translation table" for the table of the clusters. Do not write "category", "group name", or "mapping" for them. Do not write "source", "metadata", or "meta information" for it.
