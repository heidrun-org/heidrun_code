# Glossary of Heidrun Code: work of one person

- Created: 15 October 2026
- Last updated: 23 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md), [User activity glossary](user_activity.md), [User interface of Heidrun Code: Statistics window, tab "Work of one person"](../user_interface/window/statistics_person_work.md)
- Related issue: [issue 482](https://github.com/heidrun-org/heidrun/issues/482), [issue 523](https://github.com/heidrun-org/heidrun/issues/523), [issue 559](https://github.com/heidrun-org/heidrun/issues/559), [issue 616](https://github.com/heidrun-org/heidrun/issues/616), [issue 622](https://github.com/heidrun-org/heidrun/issues/622), [issue 629](https://github.com/heidrun-org/heidrun/issues/629)

This document gives one short definition for each word of the statistic of the work of one person. The other words of Heidrun Code are in [index.md](index.md). The Statistics window is defined in [user_activity.md](user_activity.md).

## The work of one person

### Work of one person tab

The tab "Work of one person" of the Statistics window. It shows how much one person changed the repositories of the workspaces that the developer chooses, or what the coding agents cost, as a bar chart with one bar for each slot. For several workspaces, it adds up their work. It has a radio button group for the source, a radio button group for the metric of the Git history, a radio button group for the unit of the AI cost, a workspace selector, a person chooser, a radio button group for the time range, a radio button group for the slot length, the totals, and the bar chart.

### Source of the Work of one person tab

The kind of data that the bar chart shows, as the developer chooses it in a radio button group: the Git history, or the AI cost. The Git history is chosen at first.

### Git history

The source of the Work of one person tab that counts the commits, the pull requests, the issues, and the lines added and deleted of one person.

### Metric of the Git history

The radio button group of the Git history that chooses what the bar chart counts: "Commits and pull requests", chosen at first, or "Lines added and deleted". It is shown for the source Git history only. It does not change the person, the time range, the slot length, the workspaces, or the totals.

### AI cost

The source of the Work of one person tab that shows the estimated cost in US dollars, or the tokens, of the chats of each coding agent, Claude Code and Codex, on this computer. It is not about one person, so the person chooser is hidden. The tab reads the stored token usage: the tokens of each chat, each model, and each minute, with the cost at the latest prices. Each minute counts in the slot that holds it, in the time zone of the computer, so a chat that lasts several slots is in several bars. The first time that a workspace is read, the developer imports its history with the button "Import the history".

### Workspace selector of the Work of one person tab

The line in the Work of one person tab that chooses the workspaces that the tab reads: their repositories for the Git history, and their folders for the stored token usage of the AI cost. It has a radio button group with the buttons "All" and "None", and a button group with a checkbox button for each workspace that is open in Heidrun Code now. The developer can choose one workspace, several workspaces, or all of them, and the tab adds up their work. Only the selected workspace is chosen at first.

### Unit of the AI cost

The radio button group of the AI cost that chooses what the totals and the bar chart show: "US dollars", chosen at first, or "Tokens". The tokens are the input tokens, with the ones read from the cache and written to it, and the output tokens. A model with no known price has tokens and no cost: the cost is then not complete, and the tab says how many tokens it leaves out. The words for this are in [token_usage_and_cost.md](../../statistics/token_usage_and_cost.md).

### Person

One author of the repository. A commit knows its author by a name and an email. A pull request or an issue knows its author by a login on GitHub. Heidrun Code finds the same person when the name and the login are the same after they are written in lower case, with no space, no hyphen, and no accent: the name "Jérôme Étienne" and the login "jerome-etienne" are one person. The login in an email of the form `login@users.noreply.github.com` counts as the login.

### Person chooser

The list in the Work of one person tab that chooses the person of the bar chart of the Git history. It holds each person that has at least one commit, one pull request, or one issue in the last 30 days, the person with the most of them first.

### Time range of the Work of one person tab

The last 3 days, the last 7 days, the last 14 days, or the last 30 days, as the developer chooses. The last day of the time range is today.

### Day

The time from midnight to the next midnight, in the time zone of the computer. A commit counts on the day of its commit date. A pull request or an issue counts on the day that its author opened it.

### Slot of the Work of one person tab

One bar of the bar chart: a day, or a part of a day, in the time zone of the computer. A slot never crosses midnight. Its length is the slot length. A commit counts in the slot of its commit date, a pull request in the slot where its author opened it, and the tokens of a minute in the slot that holds the minute.

### Slot length of the Work of one person tab

The radio button group that chooses how long a slot is: "1 hour", "6 hours", or "1 day", chosen at first. Both time ranges offer the three choices. The rules are in [statistics_person_work_slots.md](../user_interface/window/statistics_person_work_slots.md).

### Totals

The numbers under the person chooser, in the time range. For the Git history there are five: the number of commits, the number of pull requests that the person opened, the number of issues that the person opened, the number of lines added, and the number of lines deleted. The lines are the lines of the commits of the person, as Git counts them for each commit, and a binary file counts 0. The issues are a number only. The lines are in the bar chart when the metric of the Git history is "Lines added and deleted". The AI cost has three totals: the cost of Claude Code, the cost of Codex, and the two together, in the unit of the AI cost.

### Average per day

The text under each total: the total divided by the number of days of the time range, 7 or 30, for example "71.1 per day". Every day counts, also a day with no work. For the AI cost, the average is a cost in US dollars, for example "$28.50 per day", or a number of tokens, for example "9.29 KT per day".

### Bar chart of the work of one person

The bar chart of the Work of one person tab. It has one bar for each slot of the time range. Each bar has two colors, one on top of the other. For the Git history, with the metric "Commits and pull requests": the number of commits of the slot, then the number of pull requests of the slot. With the metric "Lines added and deleted": the lines added of the slot, then the lines deleted of the slot. For the AI cost: the cost of Claude Code of the slot, then the cost of Codex of the slot, in the unit of the AI cost. It has a chart legend and a chart information card, as every chart of the Statistics window has ([statistics_charts.md](statistics_charts.md)).
