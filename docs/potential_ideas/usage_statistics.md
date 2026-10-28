# Usage statistics

- Created: 13 October 2026
- Last updated: 14 October 2026
- Status: Idea that nobody has decided to build yet
- Related framing: [Project instructions](../../AGENTS.md)
- Related issue: [issue 78](https://github.com/heidrun-org/heidrun/issues/78), [issue 79](https://github.com/heidrun-org/heidrun/issues/79), [issue 80](https://github.com/heidrun-org/heidrun/issues/80)

Usage statistics is an idea for Heidrun Code to show numbers about the Git repositories that it knows about, and about the coding agents Codex and Claude Code. This file keeps the content of the three issues above, which are closed.

## Statistics about the issues of a repository

- The number of open issues and the number of closed issues.
- The time to fix an issue, from its creation to its closing: the average, the median, and the longest time.
- The topic of each issue, for example "bug", "feature", "documentation", or "test". An agent reads the title and the body of the issue and answers with one topic. Heidrun Code then counts the issues for each topic.

## Statistics about the source code of a repository

The list is a set of ideas. The developer must choose which statistics are useful first.

- The number of files and the number of lines of code, for each programming language.
- The size of the biggest files.
- The number of commits over time.
- The number of authors, and the number of commits for each author.
- The files that change most often.

## Statistics about the logs of the coding agents

Each statistic is shown for Codex and for Claude Code, separately.

- The growth of the logs: the size on the disk and the number of sessions, over time.
- The tokens spent: input tokens, output tokens, and cached tokens, for each day, for each repository, and for each session.
- The cost in money, computed from the tokens and the price of the model of each session.

## Points to decide

- **The source of the issues.** The `gh` command is the first choice.
- **The topic of an issue.** Where Heidrun Code keeps it, so that the agent does not classify the same issue twice, and which agent classifies the issues.
- **Computed or asked.** Whether Heidrun Code computes the statistics of the source code itself, or asks an agent.
- **The logs.** Where each coding agent writes its logs, and whether each log file already holds the number of tokens. Heidrun Code must read the real files on the disk to find the format.
- **The prices.** Where Heidrun Code keeps the price of each model, and who updates the price when it changes.
- **The place on the screen.** Where Heidrun Code shows the statistics.

## What to prove before the build

Read the real log files of Codex and of Claude Code on the disk, and check that they hold the tokens and the model of each session. If they do not, the tokens and the cost cannot be shown, and the plan must change before any code is written.
