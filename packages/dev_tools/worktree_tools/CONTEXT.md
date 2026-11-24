# Directory Context: `/packages/dev_tools/worktree_tools`

## Purpose
A full npm package with four command line tools that make the Issue Fix Setup fast: delegate worktree creation and Cargo build reuse to Faster Rust Work Trees, delete the target folders of old worktrees, delete the obsolete files of a debug folder, and build the bundled command line tools only when their sources changed. The [README.md](README.md) gives the commands, the options, and the measures.

## Key Exports & Entry Points
- `src/index.ts`: the public interface for another package. It exports the classes `TargetClean`, `TargetPrune`, `BundledCommandsStamp`, `DirectoryClone` and their types.
- `src/worktree_create_cli.ts`: `pnpm worktree:create <name>`.
- `src/target_clean_cli.ts`: `pnpm --filter desktop_tauri target:clean`.
- `src/target_prune_cli.ts`: `pnpm --filter desktop_tauri target:prune`.
- `src/bundled_commands_build_cli.ts`: `pnpm bundled_commands:build`, the first step of `pnpm dev`.
- Each command line is also an executable of the `bin` entry in `package.json`.
- `tests/`: the Vitest tests. `tests/test_repository.ts`, `tests/sample_cargo_project.ts`, and `tests/sample_tool_packages.ts` write temporary repositories and Rust packages, and only the tests import them.
- Command to test this folder: `pnpm --filter worktree_tools test`

## Rules
- `src/worktree_git.ts` is the only code that runs `git`, and `src/target_paths.ts` is the only place that knows where the Cargo target folder is inside a checkout.
- Faster Rust Work Trees creates worktrees in `.claude/worktrees`, initializes submodules recursively, clones the Cargo target folder, and installs locked packages. The local command uses `DirectoryClone` for the built mobile website after the shared tool reports a successful clone.
- The cleaning tool and the pruning tool delete nothing without the option `--yes`. The cleaning tool never deletes the target folder of the main checkout, the first checkout of `git worktree list`.
- The pruning tool keeps a file only by the hash of a unit that the Cargo log names, and deletes nothing when a Cargo command fails or when the log names no unit. It never touches a folder of the debug folder other than `deps`, `.fingerprint`, `build`, and `incremental`.
- The stamp of the bundled command line tools holds a fingerprint of the relative paths and the contents of the files of the two tools and of every package that they depend on through a `path`. It never reads a folder `target`, `node_modules`, or `.git`. When the fingerprint cannot be computed, the tools are built.
- `pnpm dev` builds the tools through `pnpm bundled_commands:build`, but a release build (`beforeBuildCommand` in `tauri.conf.json`) always runs `scripts/build_command_line_tools.sh`.
- No package in `packages/apps` imports this package: the scripts of `desktop_tauri` only run its command line files.

## Background
- The pruning tool and the stamp come from [issue #864](https://github.com/heidrun-org/heidrun_code/issues/864): Cargo never deletes old files, and a new worktree compiled the two tools again for 62 seconds although their sources did not change.
- Submodule initialization comes from [issue #708](https://github.com/heidrun-org/heidrun/issues/708), and the installation of the packages from [issue #331](https://github.com/heidrun-org/heidrun/issues/331).
- The package was created by [issue #209](https://github.com/heidrun-org/heidrun/issues/209). The compiler cache tools `kache` and `sccache` failed in [issue #203](https://github.com/heidrun-org/heidrun/issues/203).
