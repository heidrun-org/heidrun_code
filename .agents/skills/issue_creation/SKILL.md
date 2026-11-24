---
name: issue_creation
description: Create an issue on GitHub with the gh command, or on GitLab with the glab command, attach screenshots or videos to the issue, and write the text of the issue and of its comments with links to files and to other issues. Use it each time that you create an issue, attach an image to an issue, or write the body or a comment of an issue.
---

# Issue Creation

## GitHub and GitLab Issue Creation

Every command for GitHub in this section has a matching command for GitLab. This repository is on GitHub, so use the `gh` command here. Use the `glab` command only for a repository on GitLab.

### Creating an issue

Create an issue with the `gh` command: `gh issue create --title "<title>" --body "<body>"`. On GitLab, use the `glab` command: `glab issue create --title "<title>" --description "<body>"`. If you have screenshots related to the issue, attach them in the same command, as described in the section "Attaching an image to an issue". Write the text of the issue as the section "Writing the text of an issue" says.

### Attaching an image to an issue

Attach every screenshot, image, or video related to an issue with the `--attach` flag of the `gh` command. The flag uploads the file to GitHub and adds it to the issue. The flag takes a file path, and an optional alt text after `#`. Repeat the flag to attach several files, up to 50 files per command.

- When you create the issue: `gh issue create --title "<title>" --body "<body>" --attach './screenshot.png#Alt text'`
- When the issue already exists: `gh issue edit <issue number> --attach './screenshot.png#Alt text'`

On GitLab, the `--attach` option of the `glab` command works in the same way, but it is experimental, and it takes a file path without alternative text.

- When you create the issue: `glab issue create --title "<title>" --description "<body>" --attach './screenshot.png'`
- When the issue already exists: `glab issue update <issue number> --attach './screenshot.png'`

Never commit an image to the repository, and never push an image to a branch, only to show it in an issue. If you need a screenshot in a specific place in the body, write `![Alt text](screenshot.png)` in the body, and the `--attach` flag rewrites the reference to the uploaded file.

### Writing the text of an issue

Use Markdown formatting to make issue bodies and issue comments easier to read. Use headings to separate topics, lists for related items or steps, emphasis for important points, links for references, and inline code or fenced code blocks for commands and code, as appropriate. Keep formatting proportional to the content: a short paragraph does not need extra sections. Follow the receiving repository's templates and formatting requirements. Leave a blank line before lists and between headings and their content.

The following file-link and issue-reference rules also apply to the body of an issue, and to every comment that you write in an issue.

- Every file name of the repository that you write in the text of an issue is a link to the file. Write the file name as the label of the link, and the address of the file on GitHub as the target, for example `[HOW_TO_RELEASE.md](https://github.com/heidrun-org/heidrun/blob/main/HOW_TO_RELEASE.md)`. Link to the branch `main`, or to the branch that holds the file when `main` does not have the file yet. On GitLab, the address of a file has the form `https://<host>/<group>/<project>/-/blob/main/<path>`.
- Every issue that you write in the text of an issue is its own bullet that starts with a dash, and the bullet holds only the plain address of the issue, for example `- https://github.com/heidrun-org/heidrun/issues/506`. GitHub changes such a bullet into the title, the state, and the number of the issue. A numbered list, a link with a label, or an issue number inside a sentence shows only the number. Write the words that explain the issues above the list, not inside the bullet. On GitLab, write each issue as its own bullet in the same way, with a plus sign after the reference, for example `- #506+`, so that GitLab shows the title.
