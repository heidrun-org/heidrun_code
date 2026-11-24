# worktree_tools

Developer commands for [Heidrun Code](../../../README.md).

## Create a worktree

Run the command from the root of the main checkout or a worktree.

```sh
pnpm worktree:create fix-thing-12
pnpm worktree:create fix-thing-12 --base dev_jerome
pnpm worktree:create fix-thing-12 --without-optimization
```

The command runs a pinned revision of [Faster Rust Work Trees](https://github.com/jeromeetienne/faster_rust_worktrees) with [.faster_rust_worktrees.yaml](../../../.faster_rust_worktrees.yaml). The shared tool creates a branch and a worktree at `.claude/worktrees/<name>`, initializes submodules recursively at their recorded commits, and runs `pnpm install --frozen-lockfile`. The default base is the current commit of the main checkout.

Build the main checkout first. On macOS with a filesystem that supports copy-on-write, the shared tool clones `packages/apps/desktop_tauri/target`, including the bundled tools and their source fingerprint. It preserves the dates of unchanged source files and updates the paths in Cargo build-script records. When the Cargo output was cloned and the main checkout has a built mobile website, Heidrun Code also clones `packages/auxiliary/mobile_website/dist`. Use `--without-optimization` to skip both copies.

If submodule initialization or package installation fails, the worktree remains available. After fixing the cause, run `git submodule update --init --recursive` and `pnpm install --frozen-lockfile` from the new worktree.

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
