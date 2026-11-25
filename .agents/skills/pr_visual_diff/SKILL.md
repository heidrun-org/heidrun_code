---
name: pr_visual_diff
description: Plan and publish a Visual Diff comment for an existing pull request when the developer explicitly asks to run pr_visual_diff. Compare the user experience before and after the changes with screenshots from the application.
---

# Pull Request Visual Diff

## Prepare the capture plan

1. Read the pull request description, changed files, and linked issues. Identify the before and after revisions. For a merged pull request with a merge commit, compare the merge commit's first parent with the merge commit itself. For an open pull request, compare the common ancestor with the pull request head. Record the revisions so the screenshots and comment refer to the same comparison.
2. Identify what the user wants to do and what the pull request changes about that outcome. Start with one scenario that shows the main change. Add a scenario when it shows a distinct goal or outcome that matters to the review. If there is no visible change to show, report that and stop.
3. Read the Pull Request Visual Diff screenshot configuration in the project root's `AGENTS.md`. Propose each scenario with its starting state, actions in order, and the specific moments to capture. Include an unchanged step only when seeing that step helps explain the sequence. Group different ways of reaching the same outcome under the same goal.
4. Ask the developer to approve the capture plan and authorize posting one Visual Diff comment on the named pull request. Wait for capture approval before running the scenarios. If posting authorization is still pending after capture, prepare the comment locally and ask before posting.

## Capture and compare

- Run the approved scenarios in both revisions using equivalent data, settings, and window or page size where possible. Capture the application with the repository's configured method and keep the files in a temporary directory.
- At the first approved capture point, verify that the capture method works on the real application and produces a readable image of the intended screen. If the intended environment cannot be exercised, report the blocker and hold the comment.
- Combine comparable screenshots of each step into one image labeled **Before** and **After**. Keep the relevant controls legible at the rendered width. If a new step has no equivalent before, show the **After** screenshot and explain what the user could do before.
- Inspect the images before posting. Check the order, labels, legibility, and that the images contain only information appropriate for the pull request audience.

## Write and post the comment

Start with `# Visual Diff`. Give each user scenario a `##` heading named for the goal. Describe the goal once, then explain what the user does, how the experience changed, and what the change helps the user do, decide, or avoid. For a scenario with multiple steps, give every step its own third-level Markdown heading, starting with `### Step 1 — <action>` and numbering the headings in order. Restart numbering at 1 for each scenario. Put the caption and screenshot below the step heading. For a single-step scenario, put the caption and screenshot directly under the scenario description. Give each image a short caption that directs the reviewer to what matters and provide descriptive alternative text. Include a short capture note with the compared revisions, environment, and any simulated conditions.

After posting is authorized, use `gh pr comment <pull-request> --body-file <comment.md>` with one `--attach` argument per image. Use relative image paths in the comment that match the files next to the Markdown file so GitHub can replace them with uploaded image links. Read the posted comment back to verify that it appears on the intended pull request and that the image links were uploaded. Report the comment link.
