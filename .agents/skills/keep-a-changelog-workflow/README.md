# Keep a Changelog Workflow

Generate and maintain a repository changelog in the [Keep a Changelog 1.1.0 format](https://keepachangelog.com/en/1.1.0/). The changelog describes notable changes and links to the evidence for those changes.

## Repository requirements

The repository needs only two conventions:

- **Pull requests for changes.** Merged pull requests provide the descriptions of features, fixes, and other changes, and the links that support the changelog entries. The pull requests must contain enough information to understand the changes; no special template or labels are required.
- **Git tags for versions.** Each version to document has a Git tag identifying its commit, such as `0.1.0` or `v0.1.0`. Tags define which changes belong to each version. The first version covers the beginning of repository history through its tag; later versions cover the changes between consecutive tags.

The coding agent needs read access to the relevant Git history, tags, and pull requests, and write access to the changelog for operations that modify the file. Private repositories work when the agent has the necessary access. Local tags work too: the changelog links to the tagged commits when no hosted tag links exist; the completion report explains any link limitations.

The skill requires no particular programming language, package manager, build system, commit-message convention, pull request labels, release automation, or published release records. An existing changelog is optional because the skill can initialize the file. Git and a way to read the repository's pull requests are sufficient; for GitHub repositories, the `gh` command can provide that access.

If a change has no associated pull request, the skill reports the missing pull request evidence and can link to the commit. If a required version tag or its history is unavailable, the skill reports the missing input instead of inventing a version boundary.

## Output

The default output is `CHANGELOG.md` at the repository root. An existing changelog or an explicitly requested path takes precedence. Every release begins with formatted Release notes: a short overview followed by clear topic labels, paragraphs, or lists as needed. The detailed changes follow under the standard categories, with supporting pull request links. Version headings link to tags or comparisons where available.

## Use the skill

Ask the coding agent to use **Keep a Changelog Workflow** with the repository and version tags. For example: “Generate the initial release through `0.1.0`, then add the release from `0.1.0` to `0.2.0`, using the tagged commit dates.”

The seven operations and their detailed instructions are in [SKILL.md](SKILL.md). The skill updates the changelog; creating tags, committing, pushing, and publishing releases require separate instructions.
