# Pull Request Visual Diff

Use Pull Request Visual Diff to show how an existing pull request changes what a person sees or does in an application.

## Install and configure

Run this command from the repository that will use the skill.

```bash
npx skills add jeromeetienne/coding_agent_plugins --skill pull_request_visual_diff
```

In the receiving repository's `AGENTS.md`, add a section named `Pull Request Visual Diff screenshot configuration`. Describe how to launch each revision, how to capture the intended application, and which permissions and environment rules apply. Link to existing repository instructions when they already cover those details.

## Use the skill

Ask the coding agent to run `pull_request_visual_diff` and give the GitHub pull request number or link. The agent asks for approval before running the capture plan and before publishing the comparison if posting approval is still pending.

Read the [skill instructions](SKILL.md) for the complete workflow.
