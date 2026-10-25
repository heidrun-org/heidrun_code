# Directory Context: `/packages/dev_tools/change_log_generator/src/rendering`

## Purpose
Turns data into the texts of the change log: the heading, the section, the prompt for a coding agent, and the new text of the file `CHANGELOG.md`.

## Key Exports & Entry Points
- `change_log_renderer.ts`: the class `ChangeLogRenderer`.

## Rules
- This folder reads nothing and writes nothing: no file, no `git`, no coding agent.
- The sections of the file are in this order: `Unreleased` first, then the releases from the highest version to the lowest. The renderer replaces a section with the same version, removes `Unreleased` when the caller asks for it, and never changes another section.
- Nothing here imports from `git/` or `generation/`.

## Background
- The folder was created by [issue #114](https://github.com/heidrun-org/heidrun/issues/114), and the order of the sections comes from [issue #118](https://github.com/heidrun-org/heidrun/issues/118).
