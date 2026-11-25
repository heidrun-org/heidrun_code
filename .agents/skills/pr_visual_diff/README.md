# pr_visual_diff

Use this skill to show reviewers how an existing pull request changes the application. The result is one **Visual Diff** comment with screenshots grouped by what the user is trying to do.

## Use the skill

Ask your coding agent to run `pr_visual_diff` and give it a pull request number or link.

> Run pr_visual_diff on pull request #1091.

The agent reads the pull request and linked issues, then proposes user scenarios and the steps to capture. Review the plan and approve or adjust it before the agent takes screenshots. You can authorize posting in the same reply or review the prepared comment first.

The comment shows comparable steps in a single image labeled **Before** and **After**. Each scenario explains what changed and why it matters. Multi-step scenarios use numbered headings such as **Step 1 — Hover over the issue reference**. Each heading is followed by a short caption and the screenshot.

## Configure screenshots

In the repository's root `AGENTS.md`, describe how to start the application, prepare the same starting state in both revisions, and capture the relevant window or page. See the [Heidrun Code screenshot configuration](../../../AGENTS.md#pull-request-visual-diff-screenshot-configuration) for a desktop application example.

The full workflow is in [SKILL.md](SKILL.md).
