# change_log_generator

A command line tool for [Heidrun Code](../../../README.md). It writes a section of the file `CHANGELOG.md`, in the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format, from the pull requests that were merged between two releases.

## What it contains

- `src/cli.ts`: the command line, and the executable `change_log_generator`.
- `src/index.ts`: the public interface for another package: the class `GenerateChangeLog`.
- `src/generation/`: the logic. It finds the range, the pull requests, and the heading, writes the section, and puts it in the file.
- `src/git/`: the only code that runs `git`. It finds the releases (Git tags), their dates, and the merged pull requests.
- `src/rendering/`: turns data into text only: the section, the prompt for a coding agent, and the new text of the file.
- `src/types/`: the data shapes.
- `tests/`: the Vitest tests, and a helper that creates temporary Git repositories.

## Command line

Run the command from the root of the repository, with the npm script `release:change_log`.

```sh
pnpm release:change_log                                   # Unreleased: last release -> now
pnpm release:change_log --from v0.2.0                     # Unreleased: v0.2.0 -> now
pnpm release:change_log --to v0.2.0                       # [0.2.0]: release before v0.2.0, or the start -> v0.2.0
pnpm release:change_log --from start --to v0.2.0          # [0.2.0]: start -> v0.2.0
pnpm release:change_log --from v0.2.0 --to v0.3.0         # [0.3.0]: v0.2.0 -> v0.3.0
pnpm release:change_log --ai --from v0.2.0                # a coding agent writes the section
```

| Option | Effect |
| --- | --- |
| `--from <tag>` | The release after which the changes start. `start` means the start of the history. The default is the release before `--to`, or the start if there is none. |
| `--to <tag>` | The release where the changes end. `now` means the current commit. The default is `now`. |
| `--ai` | A coding agent writes the section, with the categories `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Security`. Without this option, the section is a plain list of the pull requests. |
| `--agent <name>` | The coding agent for `--ai`: `codex` (the default), `claude`, or `agy`. |
| `--help` | Shows the description and the options. |

How the command works:

- A release is a Git tag. The last release is the tag with the highest version number among the tags that the current commit contains.
- A pull request is a commit whose first line starts with `Merge pull request #`.
- The heading of the section is `## [Unreleased]` when the range ends at the current commit. Otherwise it is `## [<version>] - <date>`, where the version is the name of the tag without the first letter `v`, and the date is the date of the commit of the tag.
- The sections of the file are in this order: `Unreleased` first, then the releases from the highest version to the lowest. The command puts the new section at its place. It replaces a section with the same version, so you can run it again. When the section is a release and this release is the last release, the command also removes the section `Unreleased`, because its pull requests now belong to this release. Run the command again without `--to` to write a new section `Unreleased`. The command never changes another section.
- The command prints the new section on the standard output. It exits with code 1 and prints an error message when a tag does not exist, or when a coding agent fails.

Read the new section before you commit it: a coding agent can make a mistake.

## Library

```ts
import { GenerateChangeLog } from 'change_log_generator';

const section = await GenerateChangeLog.run({
	repositoryPath: '/path/to/repository',
	isAi: false,
	agentName: undefined,
	fromTag: 'v0.2.0',
	toTag: 'v0.3.0',
});
```

The method `GenerateChangeLog.run` writes the file `CHANGELOG.md` in the repository, and returns the new section. The coding agent runs through the executable of the package [`coding_agent_cli`](../../auxiliary/coding_agent_cli), which `cargo run` builds when needed. The method runs the executable only when `isAi` is true, so the mode without the option `--ai` needs no Rust tool.

## Commands

Run these commands from the root of the repository.

```sh
pnpm release:change_log --help                  # show the help
pnpm --filter change_log_generator test         # run the Vitest tests (slow tests: `pnpm test:slow` runs them too)
```
