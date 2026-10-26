# Directory Context: `/`

## Purpose
The Heidrun Code repository contains the macOS application, its supporting packages, developer tools, and documentation.

## Key Exports & Entry Points
- `packages/`: the application, supporting packages, developer tools, and experiments.
- `scripts/`: repository maintenance, build, installation, and release commands; see its own CONTEXT.md.
- `submodules/`: independent repositories at recorded commits; see its own CONTEXT.md.
- `Cargo.toml`, `Cargo.lock`, `.cargo/config.toml`: the Cargo workspace of every Rust package except the experiments, its one lock file, its build profiles, and its one target folder `packages/apps/desktop_tauri/target`.
- [README.md](README.md): application overview and development setup.
- [AGENTS.md](AGENTS.md): project rules and development commands.
- Command to run the application: `pnpm dev`.
- Command to test the repository: `pnpm test` (the fast tests), `pnpm test:slow` (the slow tests), and `pnpm test:full` (both).

## Rules
- Git submodules stay outside the pnpm workspace packages.
- Initialize the recorded submodule commits with `git submodule update --init --recursive` after a pull.
- Shared skills are maintained in their independent repository; Heidrun Code's `.agents/skills` are separate installed copies.

- A new Rust package of the application is a member of the Cargo workspace, and its build profiles go in the root `Cargo.toml`: Cargo ignores the profiles of a member.

## Background
- https://github.com/heidrun-org/heidrun/issues/708
- The Cargo workspace comes from [issue #864](https://github.com/heidrun-org/heidrun_code/issues/864): without it, Cargo named each crate of the repository by its absolute path, so a worktree compiled them all again.
