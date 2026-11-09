# Rule: every support for GitHub is also a support for GitLab

- Created: 13 October 2026
- Last updated: 29 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](glossary/index.md)
- Related issue: [issue 302](https://github.com/heidrun-org/heidrun/issues/302), [issue 870](https://github.com/heidrun-org/heidrun_code/issues/870), [issue 879](https://github.com/heidrun-org/heidrun_code/issues/879), [issue 890](https://github.com/heidrun-org/heidrun_code/issues/890), [issue 570](https://github.com/heidrun-org/heidrun_code/issues/570)

This file gives the rule for every agent that adds support for GitHub. Heidrun Code works with two Git hosting services: GitHub and GitLab. Everywhere that this repository supports GitHub, it must also support GitLab.

## The rule

- When a change adds support for GitHub, the same change adds the same support for GitLab. This is true for the code of the application, for the documents, and for the instructions to agents in `AGENTS.md`.
- A change that adds support for GitHub is not finished until the same support for GitLab exists, or until a separate issue for the GitLab support exists. When you use a separate issue, write its number in the description of the pull request.
- When a document shows a `gh` command, it also shows the matching `glab` command, next to the `gh` command. `gh` is the command line tool of GitHub. `glab` is the command line tool of GitLab.
- When a `gh` command or option has no matching `glab` command or option, say it in the document, and create a separate issue for the missing support.
- Create each separate issue on GitHub, with the `gh` command, as the section "GitHub and GitLab" of `AGENTS.md` describes.

## Reading GitHub and GitLab in the application

- Every read of an issue, of a pull request, of a merge request, or of a list of them in the web page of the application goes through the function `runForgeCli` of `packages/apps/web_frontend/src/lib/forge_cli.ts`, which calls the Tauri command `forge_cli_cached`. No other code calls `gh` or `glab` for these reads, because each call to GitHub takes points of the GitHub rate limit, which every project and every coding agent of the account share ([issue 870](https://github.com/heidrun-org/heidrun_code/issues/870)).
- The cache keeps an answer for ten minutes by default. With the option `isKeptUntilRefresh`, the kept answer is used whatever its age, and only a click on "Refresh" asks the hosting service again. With the option `isRefresh`, the hosting service is asked again. The function `runForgeCliWithSource` of the same file calls the Tauri command `forge_cli_cached_with_source`, which also gives the failure and the time of the kept answer when the kept answer replaces a failure ([issue 890](https://github.com/heidrun-org/heidrun_code/issues/890)).
- The packages of the folder `submodules/heidrun_data/packages` are outside this rule: they copy GitHub into their SQLite file, which is their own cache.
- Each call to `gh` or `glab` of the application writes a start line and an end line in the application log, as [application_log.md](application_log.md) says.

## The words

- Write "pull request" for GitHub, and "merge request" for GitLab.
- When a text is about both hosting services, write "pull request (GitHub) or merge request (GitLab)".
- Write "issue" for both hosting services.

## The matching commands

Each row gives the `gh` command and the matching `glab` command. In the `glab` option `--attach`, the word "experimental" means that GitLab can change or remove the option without notice. Run `glab <command> --help` to check an option before you use it.

| Action | GitHub | GitLab |
| --- | --- | --- |
| Read an issue | `gh issue view <number>` | `glab issue view <number>` |
| Create an issue | `gh issue create --title "<title>" --body "<body>"` | `glab issue create --title "<title>" --description "<body>"` |
| Attach a file when you create an issue | `gh issue create --title "<title>" --body "<body>" --attach './screenshot.png#Alt text'` | `glab issue create --title "<title>" --description "<body>" --attach './screenshot.png'` |
| Attach a file to an existing issue | `gh issue edit <number> --attach './screenshot.png#Alt text'` | `glab issue update <number> --attach './screenshot.png'` |
| Comment on an issue | `gh issue comment <number> --body "<comment>"` | `glab issue note <number> --message "<comment>"` |
| Close an issue | `gh issue close <number>` | `glab issue close <number>` |
| Create a pull request or a merge request | `gh pr create --title "<title>" --body "<body>"` | `glab mr create --title "<title>" --description "<body>"` |
| Merge a pull request or a merge request | `gh pr merge <number>` | `glab mr merge <number>` |
| Merge with a merge commit | `gh pr merge <number> --merge` | `glab mr merge <number>`, when the method of the project is `merge` |
| Squash and merge | `gh pr merge <number> --squash` | `glab mr merge <number> --squash` |
| Rebase and merge | `gh pr merge <number> --rebase` | `glab mr merge <number> --rebase` rebases the branch first; the method is a setting of the project (`merge_method`) |
| Delete the source branch | `--delete-branch` | `--remove-source-branch` |
| Read the merge settings of the repository | `gh api repos/{owner}/{repo}` | `glab api projects/:fullpath` |

The option `--attach` of `glab` takes a file path only. It has no alternative text after `#`.

The merge window of Heidrun Code calls the API of GitLab, not `glab mr merge`, to give the squash and the deletion of the branch explicitly, and never deletes a permanent branch: see [code_hosting_merge.md](user_interface/sidebars/code_hosting_merge.md).
