# Analytics of the code

- Created: 13 October 2026
- Last updated: 16 October 2026
- Status: Maintained overview for people
- Related framing: [Project instructions](../../AGENTS.md)
- Related issue: [issue 337](https://github.com/heidrun-org/heidrun/issues/337)

This folder describes the analytics of the code of a project: how to connect the code to the work that produced it.

Read `inputs.md` first. It describes the three inputs: the source code and its history, the GitHub issues, pull requests, and reviews, and the agent sessions.

Then read `inputs_links.md`. It says how the three inputs link to each other in the SQLite file of the data layers, and which links are missing. Then read `metrics_rules.md`. It says what a metric is, what it is not, and how to evaluate one. Then read `metrics_examples.md`. It gives the ten metrics that the join of the three inputs makes possible, with the SQL query of each one and its result on this repository. The metrics are independent from the user interface of Heidrun Code: they run on the SQLite file alone.

Then read `repeated_pattern.md`. It says how to find the patterns that the developer repeats in the chat sessions, which the tables of the data layer cannot give, and what a repeated message, a repeated command, and a repeated error can become.
