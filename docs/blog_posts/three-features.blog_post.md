# Three Features in Progress. Which One Needs Me?

- Created: 17 October 2026
- Last updated: 17 October 2026
- Status: Draft blog post awaiting developer review
- Related framing: [Series plan](blog_series_plan.md)
- Related rules: [Project glossary](../agents_rules/glossary/index.md), [Marketing guidance](../marketing/README.md)
- Related issue: [issue #642](https://github.com/heidrun-org/heidrun/issues/642)

## The Work Continues While You Look Elsewhere

I start a feature with a coding agent. While the coding agent works, I start a second feature. Then a third. Each feature has a separate Git worktree: a checkout where the change can be developed independently.

The problem arrives when I return. Which coding agent is waiting for a decision? Which change is ready to review? Did I already merge the work I was thinking about, or is the result still in a worktree?

Writing instructions for the coding agents helped me establish a workflow. Remembering the state of every conversation remained my responsibility. I built Heidrun because I use coding agents every day, and I needed a workspace that made the next decision easier to find.

> The complete project is open source: [github.com/heidrun-org/heidrun](https://github.com/heidrun-org/heidrun)

![Editorial illustration of a developer overseeing three ongoing software tasks](images/three-features.png)

*Illustration generated for this article; the illustration is not a screenshot of Heidrun.*

## The Developer Still Has Decisions to Make

Claude Code and Codex can implement a change while I attend to another task. The implementation still produces decisions for me: answer a question, allow a command, inspect a failure, review a proposed change, or ask for another revision.

Once several coding agents work at the same time, those decisions arrive in several terminals. Finding the terminal becomes part of the work. Remembering why I opened the terminal becomes another part.

Heidrun brings the terminals into one window. A workspace represents a project folder. A workspace contains tabs, and each tab contains one or more panes. A pane is a terminal where I can run a shell or a coding agent. The arrangement is familiar if you have used a development environment with tabs and split terminals.

The important addition is the **Needs you sidebar section**. The Needs you sidebar section gathers coding agents that are blocked, asking a question, or finished. Selecting an entry takes me to the relevant pane. I can move from noticing a request to reading the coding agent's context without first searching through every terminal.

## Follow Three Features Through a Working Session

Consider a representative session with three changes: a bug fix, an improvement to a chart, and a documentation update. This example describes the workflow rather than claiming to reproduce a recorded session.

I start each coding agent in the appropriate project folder or worktree. While the bug fix runs its checks, I explain the chart improvement to another coding agent. When the documentation change is ready for attention, the Needs you sidebar section gives me a way back to the documentation pane.

I review the result in the relevant pane. If the proposed change needs more work, I explain the revision and return to another feature. If I need to keep watching one coding agent, I pin the pane. A pinned pane remains visible when I change tabs or workspaces.

For instructions I use frequently, a macro writes reusable text into a pane. The macro helps me repeat a known instruction without typing the same paragraph again. The instruction still needs to fit the work in front of me.

There is an important distinction between a coding agent finishing and a feature being delivered. A finished coding agent can be ready for review while the change remains unmerged. Heidrun directs my attention to the conversation; I still check the code, tests, and repository state before deciding the change is complete.

## Find the Conversation After the Pane Is Gone

Sometimes the problem is no longer an active coding agent. I remember discussing a change last week, but I cannot remember which conversation contains the explanation.

The **Past chats sidebar section** lists saved conversations for the selected workspace. The chat summaries connect conversations to information such as written files, issues, and pull requests. Sorting the chats helps me find a conversation by more than its title.

For a broader investigation, I can ask a coding agent a question in ordinary language. The coding agent can use the heidrun_data skill to query stored development records and read the original sources. The question is asked in the coding agent's conversation. The next article follows a verified example of recovering the reasoning behind a change.

The history has boundaries. The indexed chat list covers conversations started at the repository root; conversations started in worktrees can be absent from that list. Token statistics have a wider scope. A useful answer needs to account for the records that were actually imported.

## Start With One Real Workflow

This series follows the development branch `dev_jerome` as checked on 17 October 2026. The latest public release checked was [v0.2.7](https://github.com/heidrun-org/heidrun/releases/tag/v0.2.7), published on 15 October. The indexed token-history work described in this series was merged later, so check the branch and version when trying those capabilities.


You do not need several coding agents to begin. One coding agent already creates a sequence of instructions, questions, reviews, and saved conversations. Heidrun becomes more useful as the number of simultaneous tasks grows, because keeping track of those tasks becomes harder.

Heidrun is early software that I use every day. The current installation instructions target a Mac with Apple silicon and require Herdr, the terminal program Heidrun uses. Start with the [installation instructions](https://github.com/heidrun-org/heidrun_code#installation) and [documentation](https://heidrun-org.github.io/heidrun_code/documentation/) so that you have the current requirements.

Try one real task, then a second task while the first coding agent works. Notice how easily you can return to a coding agent that needs you. Notice where the workflow still requires too much remembering.

That is the feedback I want from early users. Tell me which step is confusing, which missing capability interrupts your work, and which workflow does not fit the way you develop software. Bring a specific example to the [issue tracker](https://github.com/heidrun-org/heidrun/issues). Those examples help me decide what Heidrun should do next.

Next: [Why Did We Write This Code? Ask the Development History](development-history.blog_post.md).
