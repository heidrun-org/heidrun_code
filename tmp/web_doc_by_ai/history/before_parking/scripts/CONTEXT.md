# Directory Context: `/scripts`

## Purpose
The scripts that the maintainers run from the root of the repository: the release of the application and the page of shortcuts.

## Key Exports & Entry Points
- `release_dmg.ts`: builds the macOS disk image and uploads it to the GitHub release. Command: `pnpm release:dmg`.
- `shortcuts-readme.mjs`: writes the page of shortcuts of the website. Command: `pnpm docs:shortcuts`.
- `identity-texts.mjs`: writes the title, the motto, and the description of Heidrun Code from `data/identity.json` into `README.md`, and the description into `AGENTS.md` and `docs/release_notes/prefix.md`. Command: `pnpm docs:identity`.
- `claude-statusline.sh`: the status line of Claude Code for this repository.

## Rules
- A script that needs its own dependencies, tests, or several files is a full npm package in the folder `packages/dev_tools`, not in this folder. See the `CONTEXT.md` of that folder.
- A script reads the repository from the folder where it runs.

## Background
- The change log generator left this folder and went to `packages/auxiliary` in [issue #120](https://github.com/heidrun-org/heidrun/issues/120), and then to `packages/dev_tools` in [issue #226](https://github.com/heidrun-org/heidrun/issues/226). It became a package in [issue #118](https://github.com/heidrun-org/heidrun/issues/118).
