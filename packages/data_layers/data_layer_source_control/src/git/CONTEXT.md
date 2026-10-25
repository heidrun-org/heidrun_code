# Directory Context: `/packages/data_layers/data_layer_source_control/src/git`

## Purpose
Reads the commits of a Git repository: the hashes of every commit that the branches, the remote branches, and the tags reach, and the facts of each commit, 500 commits at a time.

## Key Exports & Entry Points
- `git_runner.rs`: the trait `GitRunner`, the runner `GitCommandRunner` that runs `git -C <folder>`, `find_repository`, and `parse_repository`.
- `git_reader.rs`: `GitReader`, `ignore_log`, `ignore_progress`, the progress reports of each batch (`GitReader::with_progress`), and the conversion of the answer of `git log` into `Commit` values.
- Command to test this folder: `pnpm --filter data_layer_source_control test`

## Rules
- Only `git_runner.rs` runs the command `git`. `git_reader.rs` only talks to a `GitRunner`.
- Nothing here imports from `src/storage/`.
- `git_reader.rs` asks for the facts with one command, `git log --no-walk=unsorted --stdin --numstat`, and the hashes come on the standard input. The record of a commit starts with the character 0x1E, and its ten fields end with the character NUL, so no text of a message breaks the reading.
- The option `--diff-merges=first-parent` gives the line counts of a merge. It needs Git 2.31 or later.
- The option `--find-renames` is always given, so the line counts do not depend on the configuration of the developer.
- A wrong number of commits in the answer is an error, and never a silent loss.

## Background
- The reading with real Git repositories was chosen over a fake answer because the format of `git log` is the constraint that can break the package. The tests of the reader run the real command `git`. See [issue #462](https://github.com/heidrun-org/heidrun/issues/462).
