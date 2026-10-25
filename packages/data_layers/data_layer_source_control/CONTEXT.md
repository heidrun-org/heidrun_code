# Directory Context: `/packages/data_layers/data_layer_source_control`

## Purpose
A Rust library and a command line tool that read every commit of a Git repository, merges included, and write the facts of each one in the table `commits` of a SQLite file. It is the Source control source of the data layer of Heidrun Code. The desktop application uses the library through `refresh_source_control`, `find_commits`, and the status functions of `src/git/working_copy.rs`. The name `data_layer_source_control` is the name of the package and the name of the executable.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface of the library. Its `pub use` lines are the list of the exports.
- `src/main.rs` and `src/command_line.rs`: the command line, and the executable `data_layer_source_control`.
- `src/refresh.rs` and `src/query.rs`: `refresh_source_control` copies the commits of a folder, and `refresh_source_control_with_progress` also sends a `SourceControlProgress` for each stage and each batch. `find_commits` reads the stored commits of a time range, from the SQLite file only.
- `src/git/`: the reading of the commits through a `GitRunner`, and `working_copy.rs`, the live status of files and worktrees — see its own CONTEXT.md.
- `src/storage/` and `src/model/`: the SQLite file with the text form of the rows of a query, and the data types with the JSON schema check — see their own CONTEXT.md.
- `src/synchronization.rs`: the two modes, `initialize` and `update`.
- `schemas/`: the file `commit.schema.json`, the only place that says which fields the database stores.
- `tests/`: the tests of the executable, with a real Git repository in a temporary folder. The tests of the library sit at the end of each source file.
- Command to run this folder: `pnpm --silent data_layer:source_control --help`
- Command to test this folder: `pnpm --filter data_layer_source_control test`

## Rules
- The SQLite file has one table of this package, `commits`, with exactly the columns `repository`, `hash`, `committedAt`, and `data`. The primary key is `repository` and `hash`. The column `data` holds the JSON text of the commit. A merge is a commit whose `data` has two or more parents.
- Every commit is checked against its JSON schema before it is written, and a wrong commit writes nothing.
- `initialize` reads every commit that the local branches, the remote branches, and the tags reach. `update` reads only the commits whose hash is not in the table. Each mode can run again and again, and never writes a row two times.
- A row is never deleted: a commit that no branch reaches any more stays in the table. The package stores facts only: no text of a change, no path of a file, no name of a branch, and no name of a tag.
- Only `src/git/git_runner.rs` and `src/git/working_copy.rs` run the command `git`. The tests use a real Git repository with a fixed author and a fixed date, and a fake runner for the errors.
- The dates are in UTC. The line counts of a merge compare it with its first parent.
- The default SQLite file is `data_layer.sqlite` in `HEIDRUN_CODE_DIR`, or `~/.config/heidrun_code/data_layer.sqlite` when the variable is unset or empty, shared with the other data layer packages. Each package writes only its own tables, and a query on a file that has no table of this package gives no row.
- `query` and `SourceControlDatabase::query` only work on a database that is open read only, so a query never changes the file and never creates it.
- The desktop application calls only the functions `refresh_*` and `find_*` of this package, as [data_layer_access.md](../../../docs/agents_rules/data_layer_access.md) says. The test of the package `data_layer_boundary_checker` fails otherwise.
- The folder `src/model/` imports from no other folder of `src/`. The folders `src/git/` and `src/storage/` import from `src/model/` only, and never from each other. Only `src/synchronization.rs` and `src/refresh.rs` use both.
- The library calls are blocking. The package imports only `data_layer_operation_log` from the other packages of the repository, and it knows nothing about Tauri. Every public function records its operation with `data_layer_operation_log::record`, a new operation does the same in the same change, and its test reads the events ([rule](../../../docs/agents_rules/data_layer_operation_log.md)).
- The name of the repository comes from the address of the remote `origin`, for GitHub and for GitLab alike.
- The file `.cargo/config.toml` puts the compiled files in the Cargo target folder of `desktop_tauri`, so the folder that `pnpm worktree:create` clones is the only one.

## Background
- The package comes from [issue #462](https://github.com/heidrun-org/heidrun/issues/462). The data layer as a whole is [issue #452](https://github.com/heidrun-org/heidrun/issues/452).
- The Statistics window uses the package in `packages/apps/desktop_tauri/src/statistics/person_work.rs` ([issue #482](https://github.com/heidrun-org/heidrun/issues/482)), and the Past chats sidebar section in `past_chats/chats_files.rs` ([issue #617](https://github.com/heidrun-org/heidrun/issues/617)).
- The operation log of [issue #618](https://github.com/heidrun-org/heidrun/issues/618) records each public function of this package: see [data_layer_operation_log](../data_layer_operation_log/CONTEXT.md).
