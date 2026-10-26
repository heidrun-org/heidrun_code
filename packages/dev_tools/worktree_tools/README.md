# worktree_tools

Four command line tools for [Heidrun Code](../../../README.md). They reduce the cost of the Cargo target folder in each Git worktree. Each new worktree has an empty target folder, and its first build compiles every Rust dependency again: it takes 52 to 65 seconds and about 2.5 GB of disk space.

## What it contains

- `src/worktree_create_cli.ts`: the command line `pnpm worktree:create`.
- `src/target_clean_cli.ts`: the command line `pnpm --filter desktop_tauri target:clean`.
- `src/target_prune_cli.ts`: the command line `pnpm --filter desktop_tauri target:prune`.
- `src/bundled_commands_build_cli.ts`: the command line `pnpm bundled_commands:build`, the first step of `pnpm dev`.
- `src/index.ts`: the public interface for another package: the classes `WorktreeCreate`, `TargetClean`, `TargetPrune`, and `BundledCommandsStamp`.
- `src/worktree_create.ts`, `src/target_clean.ts`, `src/target_prune.ts`, `src/bundled_commands_stamp.ts`: the logic of the four tools.
- `src/worktree_git.ts`: the only code that runs `git`.
- `src/target_paths.ts`: the place of the Cargo target folder inside a checkout.
- `tests/`: the Vitest tests, and a helper that creates temporary Git repositories.

## Create a worktree

Run the command from the root of the repository, or from any worktree.

```sh
pnpm worktree:create fix-thing-12                    # worktree on a new branch, from the current commit
pnpm worktree:create fix-thing-12 --base dev_jerome  # worktree on a new branch, from the branch dev_jerome
```

The command creates the worktree `.claude/worktrees/<name>` of the main checkout, on a new branch with the same name. The command first runs `git submodule update --init --recursive` in the new worktree, so every submodule has the commit recorded by that worktree. When initialization fails, the worktree stays, the command exits with an error, and package installation does not start. Fix the cause, then run `git submodule update --init --recursive` and `pnpm install --frozen-lockfile` in the worktree.

On macOS, it then clones the folders `packages/apps/desktop_tauri/target/debug` and `packages/apps/desktop_tauri/target/release` of the main checkout into the worktree, with copy-on-write clones. The folder `release` holds the bundled command line tools in `release/bundled_commands`, and their compiled dependencies, so a change in a package that the tools use compiles only the changed packages again ([issue 877](https://github.com/heidrun-org/heidrun_code/issues/877)):

```sh
cp -c -R -p <main checkout>/packages/apps/desktop_tauri/target/debug <worktree>/packages/apps/desktop_tauri/target/debug
cp -c -R -p <main checkout>/packages/apps/desktop_tauri/target/release <worktree>/packages/apps/desktop_tauri/target/release
```

The command clones each folder in one call to the function `clonefile` of macOS, through `python3` (class `DirectoryClone`), then gives the cloned folders the dates of the main checkout. On 2026-10-25 this took 2.1 seconds for `target/debug`, against 11.7 seconds for `cp -c -R -p`, which clones the files one at a time. When `python3` is missing or `clonefile` fails, the command runs `cp -c -R -p` as shown above.

The command also clones the folder `packages/auxiliary/mobile_website/dist` when the main checkout has it. Then it prepares the clone so that Cargo compiles nothing that did not change ([issue 864](https://github.com/heidrun-org/heidrun_code/issues/864)):

- Cargo decides that a crate of the repository changed when a source file is newer than the last build. Git gives every file of a new worktree the date of the creation. So the command gives each tracked file with the same content as in the main checkout the date of the main checkout, and also each folder whose list of names is the same (class `SourceDates`).
- A build script can write the absolute path of the main checkout in its record `target/debug/build/*/output`. The command replaces this path with the path of the worktree and keeps the date of the record (class `BuildScriptOutputs`).
- The file `Cargo.toml` at the root makes all the Rust packages of the application one Cargo workspace, so Cargo uses relative paths for the packages of the repository, and the cloned compiled files keep their names in the worktree.

Measured on 2026-10-25, the first Rust build of `pnpm dev` in a new worktree went from 11 crates and 35 seconds to 0 crates and 0.95 seconds.

To check whether a problem comes from these optimizations, create the worktree with the option `--without-optimization`. The command then only creates the worktree, initializes the submodules, and installs the packages. The first `pnpm dev` compiles everything, which is slow. To build the bundled command line tools without the stamp, run `pnpm bundled_commands:build --force`.

```sh
pnpm worktree:create <name> --without-optimization
```

At the end, the command runs `pnpm install --frozen-lockfile` in the worktree, so the worktree has a folder `node_modules` and `pnpm dev` runs at once. The command reads `pnpm-lock.yaml` and never changes it. When the installation fails, the command prints the error of `pnpm` and exits with the code 1. The worktree stays, so fix the cause and run `pnpm install --frozen-lockfile` in the worktree.

Measured on 2026-10-11:

- The clone takes 10.8 seconds and 14 MB of real disk space.
- The first build takes 23.4 to 31.8 seconds and about 883 MB, against 52 to 65 seconds and 2.5 GB without the clone.
- A one-character rebuild takes 4.5 to 5.6 seconds, the same as without the clone.

Limits:

- The main checkout must be built first. Without the folders `target/debug` and `target/release`, and the two tools in `target/release/bundled_commands`, the command creates the worktree without the clone and says so.
- The clone needs macOS and the Apple File System, with both folders on the same disk. A worktree inside the main checkout is always on the same disk.
- A clone shares its files only at the start. Each file that Cargo rewrites becomes a real copy.
- The installation needs the command `pnpm` in the `PATH`.

## Clean the old target folders

```sh
pnpm --filter desktop_tauri target:clean                # list the target folders that no build used for 7 days
pnpm --filter desktop_tauri target:clean --days 3       # the same, for 3 days
pnpm --filter desktop_tauri target:clean --yes          # delete them
```

| Option | Effect |
| --- | --- |
| `--days <number>` | The number of days without a build after which a target folder is stale. The default is 7. |
| `--yes` | Delete the stale target folders. Without this option, the command only lists them. |
| `--help` | Shows the description and the options. |

- The age of a target folder is the most recent modification time of any file or folder inside it.
- The command never touches the main checkout.
- The command does not show the size of the folders. The size that `du` shows is too high, because the clones share their blocks.

## Delete the obsolete files of a debug folder

```sh
pnpm --filter desktop_tauri target:prune          # list the files that the current builds do not use
pnpm --filter desktop_tauri target:prune --yes    # delete them
```

Cargo never deletes the files of an old build. After some weeks, the folder `target/debug` holds several old versions of each crate, and only the newest version is used. On 2026-10-25 the folder of the main checkout held 152207 files (30 gigabytes), and its clone into a new worktree took 35 seconds, against 10.8 seconds on 2026-10-11.

The command runs `cargo build` and `cargo test --no-run` in the package `desktop_tauri` with `CARGO_LOG=cargo::core::compiler::fingerprint=debug`. The log names the folder `.fingerprint/<crate>-<hash>` of every compilation unit that a build uses, even a unit that is already compiled. Each file of `deps`, `.fingerprint`, and `build` has the hash of its unit at the end of its name, so the command lists every entry with another hash.

| Folder | Rule |
| --- | --- |
| `deps`, `.fingerprint`, `build` | An entry is obsolete when its hash is not in the log. An entry with no hash in its name is kept. |
| `incremental` | The names hold no hash of a unit, so the command keeps the 2 most recently changed folders of each crate. |
| any other folder | Never touched. |

Measured on 2026-10-25 on the worktree of issue 864, which started as a clone of the main checkout:

- 108493 of 157662 files were obsolete: 53829 in `deps`, 4960 in `.fingerprint`, 3690 in `build`, and 46014 in `incremental`.
- The deletion took 17 seconds. After it, `cargo build` and `cargo test --no-run` compiled nothing.
- The clone of the pruned folder (49169 files) took 11 seconds, against 35 seconds.

Limits:

- The command runs the two Cargo commands, so it can take minutes when the sources changed. If a Cargo command fails, or if the log names no unit, the command deletes nothing and exits with the code 1.
- The command works on the checkout that holds the current folder, the main checkout or a worktree.
- A build of a kind that the command does not run, for example `cargo check`, loses its files, and the next such build compiles again. To keep them, add the Cargo command to `TargetPrune.cargoCommands`.
- The next `pnpm dev` can compile the crate `heidrun_code` once, because `pnpm dev` starts Cargo through the Tauri command line.

## Build the bundled command line tools only when their sources changed

```sh
pnpm bundled_commands:build            # build heidrun_code_ctrl and heidrun_data, unless they are up to date
pnpm bundled_commands:build --force    # build them in any case
```

Tauri packages the two command line tools `heidrun_code_ctrl` and `heidrun_data` from the folder `packages/apps/desktop_tauri/target/release/bundled_commands`. The script `scripts/build_command_line_tools.sh` builds them in release mode. Before issue 864, `pnpm dev` ran the script each time. In the main checkout, Cargo found its earlier work and the script took less than one second. In a new worktree, Cargo found no earlier work, because `pnpm worktree:create` clones only the two finished tools, so the script compiled about 196 crates again for 62 seconds, from sources that did not change.

Now `pnpm dev` starts with `pnpm bundled_commands:build`:

1. The command computes a fingerprint of the sources: the version of `rustc`, and the relative path and the content of every file of the two tools and of every package that they depend on through a `path` (`cargo metadata --no-deps`, read again for each package). It never reads a folder `target`, `node_modules`, or `.git`.
2. When both tools exist and the file `sources.sha256` next to them holds the same fingerprint, the command builds nothing.
3. Else, it runs the script, then writes the fingerprint in `sources.sha256`.

`pnpm worktree:create` clones the folder `bundled_commands` with its file `sources.sha256`, and the fingerprint uses relative paths, so a new worktree builds nothing when the sources of the tools are the same as in the main checkout.

Measured on 2026-10-25: the step took 62 seconds in a new worktree before the change, and 0.6 seconds after it. A change in the application `desktop_tauri` does not change the fingerprint. A change in a dependency of `heidrun_data`, such as `data_layer_source_control`, does.

Limits:

- The main checkout gets its first file `sources.sha256` at its first `pnpm dev` or `pnpm bundled_commands:build` after this change. Until then, a new worktree builds the tools once.
- A release build (`pnpm build`) always runs the script, through `beforeBuildCommand` in `tauri.conf.json`.
- The script sets `MACOSX_DEPLOYMENT_TARGET` to `minimumSystemVersion` of `tauri.conf.json`, the value of the release build of the application. Both builds share `target/release`. Before issue 877, the tools used no value, so each build compiled again `ring`, `libsqlite3-sys`, and the other dependencies that the other build had compiled.
- The script copies a tool into `bundled_commands` only when its content changed. The build script of the application watches these files, so a copy with a new date made `pnpm dev` compile `heidrun_code` again for about 20 seconds.

## Test

```sh
pnpm --filter worktree_tools test    # run the Vitest tests
```
