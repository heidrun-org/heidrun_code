# Repeated patterns in the chat sessions

- Created: 16 October 2026
- Last updated: 16 October 2026
- Status: Maintained method and first result
- Related framing: [Project instructions](https://github.com/heidrun-org/heidrun_code/blob/dev_jerome/AGENTS.md)
- Related rules: [Rules for a good metric](https://github.com/heidrun-org/heidrun_code/blob/dev_jerome/docs/analytics/metrics_rules.md), [The four data layers](https://github.com/heidrun-org/heidrun_code/blob/dev_jerome/docs/statistics/the_four_data_layers.md)
- Related issue: [issue 561](https://github.com/heidrun-org/heidrun/issues/561), [issue 564](https://github.com/heidrun-org/heidrun/issues/564)

This file answers one question: can we learn from the chat sessions, for example find the patterns that the developer repeats, with the current data layer? It gives the answer, the proof on this repository, and the method in three steps.

## The answer

**Not with the tables. Yes with the files.**

- The tables of the data layer `data_layer_coding_agents` store facts only: the id, the coding agent, the title, the dates, the number of developer messages, the tokens, and the links to the issues, the pull requests, the files, and the folders. They store no message text, so a repeated message cannot be found in them.
- The chat session files are on the disk: the files `*.jsonl` of Claude Code in the folder `~/.claude/projects/<project>`, and the files `*.jsonl.zst` of Codex in the folder `~/.codex`. The library of `data_layer_coding_agents` already opens them line by line to build the tables. So the repeated patterns are found by a read of these files, not by a query of the SQLite file.

## The proof on this repository

A read-only script of 60 lines of Python read the 332 Claude Code chat files of this repository on 16 October 2026. It lowercased each developer message, collapsed the spaces, kept the messages of at most 120 characters, and counted the identical ones. It did the same with the command of each call of the tool `Bash`, and with the first line of each tool result marked as an error. The chat files were read only, and no file was changed.

| Pattern | Count | What it becomes |
| --- | --- | --- |
| "merge it" | 60 | A macro |
| "complete the issue fix", "complete the fix", "finish the issue fix", "i am satisfied, complete the issue fix" | 23 + 7 + 5 + 6 | One macro, after the variants are grouped |
| "push it", "push dev_jerome" | 12 + 5 | A macro |
| "rename this chat according to its content." | 6 | A macro |
| `cd <worktree>/packages/... && pnpm ...`, one line per worktree | 96, 54, 46, 45, 38 ... | A launcher with the worktree as a parameter |
| Error "No .claude/launch.json found" | 25 | A rule for `AGENTS.md`, or a file to add |
| Error "This session is isolated in the worktree" | 16 | A rule for `AGENTS.md` |
| Error "Permission ... denied by the Claude Code auto mode classifier" | 20 | A rule for `AGENTS.md`, or a permission to add |
| "[request interrupted by user]" | 61 | A signal: the developer stopped the coding agent 61 times in six days |

The counts are facts, as [the rules for a good metric](https://github.com/heidrun-org/heidrun_code/blob/dev_jerome/docs/analytics/metrics_rules.md) ask. The column "What it becomes" is a proposal, and the developer decides.

## The method, in three steps

1. **Extract.** Add the command `heidrun_data read chat_session <id>` of [issue 564](https://github.com/heidrun-org/heidrun/issues/564). The command prints the records of one chat session as JSON lines, with the role (developer, coding agent, tool), the text, and for a tool call its name and its command. The data layer keeps its rule "facts only": the text is read from the file when the command runs, and it is never stored in the SQLite file.
2. **Normalize and group.** Lowercase the text, collapse the spaces, cut at 120 characters. Then group the near duplicates: "complete the issue fix" and "finish the issue fix" are one pattern. Exact matching gives the table above. Grouping needs an edit distance first, and a language model only for the last step.
3. **Propose.** A repeated developer message becomes a macro. A repeated command becomes a launcher. A repeated error becomes a rule in `AGENTS.md`. The proposal shows the count and the chat sessions as proof, and the developer accepts or refuses the proposal.

Step 1 is the only step that needs code in the repository. Steps 2 and 3 are the work of the coding agent that reads the output of step 1, with the skill of [issue 561](https://github.com/heidrun-org/heidrun/issues/561).

## Limits

- The proof covers only the Claude Code files of the main checkout of this repository, over six days. The Codex files and the chat sessions of the worktrees were not read.
- The count of exact matches undercounts: the variants of one message are counted apart until they are grouped.
- A repeated message is not always a macro candidate. "merge it" is one. "[request interrupted by user]" is a signal about the work, not a text to replay.
- The method reads the text of the messages. The tables of the data layer never store this text, and this file does not ask them to.
