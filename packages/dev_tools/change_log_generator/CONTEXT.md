# Directory Context: `/packages/dev_tools/change_log_generator`

## Purpose
A full npm package that writes a section of `CHANGELOG.md`, in the Keep a Changelog format, from the pull requests merged between two releases. It reads the releases and the pull requests from Git, and it can ask a coding agent to write the categories.

## Key Exports & Entry Points
- `src/index.ts`: the public interface for another package. It exports the class `GenerateChangeLog` and its types.
- `src/cli.ts`: the command line, and the executable `change_log_generator` of the `bin` entry in `package.json`.
- `src/generation/`: the class `GenerateChangeLog`, which resolves the range, writes the section, and updates the file — see its own CONTEXT.md.
- `src/git/`: the class `ChangeLogGit`, the only code that runs `git` — see its own CONTEXT.md.
- `src/rendering/`: the class `ChangeLogRenderer`, which turns data into text only — see its own CONTEXT.md.
- `src/types/`: the data shapes that the other folders share — see its own CONTEXT.md.
- `tests/`: the Vitest tests. `tests/test_repository.ts` creates temporary Git repositories, and only the tests import it.
- Command to run this folder: `pnpm release:change_log --help`
- Command to test this folder: `pnpm --filter change_log_generator test`. These tests are slow tests: `pnpm test:slow` runs them, and `pnpm test` does not ([issue 826](https://github.com/heidrun-org/heidrun/issues/826)).

## Rules
- Every file of the generator is in this folder. No file of the generator is in `scripts` outside of it.
- Only `src/cli.ts` and `src/index.ts` sit at the root of `src`. The other code is in the subfolders `generation`, `git`, `rendering`, and `types`.
- A release is a Git tag. A pull request is a commit whose first line starts with `Merge pull request #`. The package does not read the GitHub web service.
- Without `--from`, the range starts at the release before the end of the range: the tag with the highest version number among the tags that the end contains, without the end tag itself.
- The heading is `## [Unreleased]` when the range ends at the current commit. Otherwise it is `## [<version>] - <date of the commit of the tag>`.
- The renderer keeps the sections in this order: `Unreleased`, then the releases from the highest version to the lowest. It replaces a section with the same version, and it removes `Unreleased` when the new section is the last release. It never changes another section.
- The default mode never chooses a category. Only a coding agent chooses the categories.
- Only `src/generation` runs the executable of the package `coding_agent_cli`, with `cargo run`, and only when the option `--ai` is used. The mode without the option `--ai` needs no Rust tool.

## Background
- The package was created by [issue #114](https://github.com/heidrun-org/heidrun/issues/114). The options `--from` and `--to` and the move into a package come from [issue #118](https://github.com/heidrun-org/heidrun/issues/118). The coding agent comes from [issue #113](https://github.com/heidrun-org/heidrun/issues/113). The executable of the coding agent is written in Rust since [issue #394](https://github.com/heidrun-org/heidrun/issues/394).
