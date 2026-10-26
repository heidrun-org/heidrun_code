# Statistic from a sentence

- Created: 15 October 2026
- Last updated: 15 October 2026
- Status: Idea that nobody has decided to build yet, and that the developer judges far-fetched
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../agents_rules/glossary/index.md)
- Related issue: [issue 450](https://github.com/heidrun-org/heidrun/issues/450)

Statistic from a sentence is an idea for Heidrun Code to let the developer describe a statistic in plain words, and to let a language model write the query and the view. This file keeps the content of the issue above, which is closed.

## Judgment of the developer

The developer closed the issue and judged the idea far-fetched, not interesting, and not on the topic of Heidrun Code. The developer called it a toy. Nobody should build it before a real need appears. The rest of this file is only the record of the idea.

## Goal

The developer is inside an editor of Heidrun Code, with the full power of the coding agents. The developer writes in plain words the statistic that is wanted, and presses one button. A language model writes the query that extracts the data, and then writes the description of the view that draws the data. The developer gets a chart without writing the query or the view by hand.

The idea builds on [issue 449](https://github.com/heidrun-org/heidrun/issues/449), the issue about the statistics of Git. That issue gives the query language and the views. This idea adds the step that writes them from a sentence.

## How it works

1. The developer writes a sentence, for example: how many hours each issue took to fix, for each month.
2. The developer presses the button.
3. Heidrun Code sends the sentence to a language model, with the description of the query language, which is the schema of Git, of GitHub, and of the chats of the coding agents. Heidrun Code does not send the data.
4. The language model answers with a query, maybe in GraphQL. Heidrun Code runs the query and gets values.
5. Heidrun Code sends the sentence and the form of the values to the language model again. The language model answers with the description of a view, in the second language, the one that draws values.
6. Heidrun Code draws the view.

The query and the description of the view are plain text. The developer can read them and change them by hand at any time.

## Layers

Each statistic is saved as text: the sentence, the query, and the description of the view. A statistic can take the values of another statistic as its input. So the statistics pile up in layers: a layer extracts, the next layer groups, the next layer compares, and the last layer draws. The developer can change any layer and run the layers above it again.

## What could stop it

- The query language and the view language must exist and stay small and exact. A language model writes a small exact language well, and a large vague language badly. [Issue 449](https://github.com/heidrun-org/heidrun/issues/449) decides these languages.
- A query that the language model writes can be wrong and still run without an error. The screen must show the sentence, the query, and the values side by side, so that the developer can check them.
- A query must only read. Heidrun Code must refuse a query that changes Git or GitHub.
- Privacy: only the sentence and the schema leave the computer, never the content of a chat or of a file.
- Each call to a language model takes time and can cost money. The screen shows that a call is running, and the cost is counted like the cost of any other chat. [Issue 442](https://github.com/heidrun-org/heidrun/issues/442) shows the cost of each chat.
- Which language model: a service such as ChatGPT through its interface, or the coding agent Codex or Claude Code that is installed on this computer, as the method "Language model" of the dynamic topics already does. The second way needs no key and no new account.

## The view language: maybe Plotly.js

The second language, the one that draws the values, could be the chart description of [Plotly.js](https://plotly.com/javascript/).

- A chart of Plotly.js is plain text in the JavaScript Object Notation (JSON) form: a list of traces (the values and the kind of chart) and a layout (the titles and the axes). So a language model can write it, and the developer can read it and change it by hand.
- Plotly.js has the charts that [issue 449](https://github.com/heidrun-org/heidrun/issues/449) wants: histograms and radar charts, and also lines, bars, and tables.
- Plotly.js is widely used, so a language model probably writes its description well. The second test below proves it.
- The full library is large. Heidrun Code can load only the kinds of chart that it needs. The colors of a chart must also follow the light and the dark theme of Heidrun Code.

## Points to decide

- **The editor.** Whether the editor is a sidebar section, a pane, or a window.
- **The language of the sentence.** Whether the sentence can be written in French, in English, or in both.
- **A change in words.** How the developer asks for a change in words, for example "make it by week", and how Heidrun Code keeps the earlier version.
- **The saved statistics.** Where Heidrun Code keeps them, and whether developers can share them.
- **A query that fails.** Heidrun Code shows the error, and it can send the error back to the language model once.

## What to prove before the build

The assumption that would make this impossible: a language model cannot write a correct query from one sentence.

1. Write ten sentences that describe real statistics about this repository.
2. Give each sentence and the schema to a coding agent, and run the ten queries that come back.
3. Compare each result with the same statistic written by hand.

Then do the same test for the description of a view from the values, with the chart description of Plotly.js as the view language. If either test fails, the plan must change before any code is written.
