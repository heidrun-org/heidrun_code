# Directory Context: `/packages/dev_tools/documentation_by_ai`

## Purpose
A reusable one-call documentation writer and one-build command, plus a full documentation update that validates the generated output and opens a draft for review.

## Key Exports & Entry Points
- `src/`: the command and public interface; see its own CONTEXT.md.
- `prompts/`: the maintained learned prompt and its provenance.
- `templates/`: reusable troubleshooting presentation resources; see its own CONTEXT.md.
- `calibration/`: historical examples and rubric for explicitly requested learning, never normal generation inputs.
- Commands: `pnpm docs:update_by_ai` and `pnpm docs:generate-and-build`; `--dry-run` prints the request without generation or build.

## Rules
- Normal generation makes exactly one model call and one build on success, with no judge, retry or repair.
- Importing the package has no execution side effect.
- The generate-and-build command never publishes; only the separate update command commits checked documentation and opens a draft.
- Neither command merges, deploys, captures screenshots or controls native applications.
- Runtime records and the exclusive lock are ignored local files.
- The checkout is resolved from the package location, not an enclosing worktree's Git metadata.

## Background
- [Process and stopping decisions](../../../docs/documentation_by_ai/process.md).
- [Technical operation](README.md).
- [Issue #501](https://github.com/heidrun-org/heidrun/issues/501).
