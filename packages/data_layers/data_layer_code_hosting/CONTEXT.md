# Directory Context: `/packages/data_layers/data_layer_code_hosting`

## Purpose
The Code hosting source of Heidrun Code: reads GitHub issues and pull requests into SQLite. The library and executable are named `data_layer_code_hosting`; desktop callers use `refresh_code_hosting_with_progress` and `find_*`.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface; its `pub use` lines list the readers, databases, synchronization and query functions, schemas, and data types.
- `src/refresh.rs`: changed issues and pull requests; the functions `*_with_progress` also send a `CodeHostingProgress` for each stage and each page. `src/query.rs`: stored rows by date or number, with empty answers for absent tables.
- `src/main.rs`: the command line, and the executable `data_layer_code_hosting`. The module `src/command_line.rs` reads its arguments.
- `src/github/`: the reading of the issues and of the pull requests of GitHub, through a `GraphqlRunner` — see its own CONTEXT.md.
- `src/storage/`: the SQLite file, and the text form of the rows of a query — see its own CONTEXT.md.
- `src/model/`: the data types, and the JSON schema checks — see its own CONTEXT.md.
- `src/synchronization.rs`: the two modes, `initialize` and `update`.
- `schemas/`: the two JSON schema files `issue.schema.json` and `pull_request.schema.json`. They are the only place that says which fields the database stores.
- `tests/`: executable tests; library tests sit beside their implementation.
- Command to run this folder: `pnpm --silent data_layer:code_hosting --help`
- Command to test this folder: `pnpm --filter data_layer_code_hosting test`

## Rules
- The SQLite file has two tables, `issues` and `pull_requests`. Each table has exactly the columns `repository`, `number`, `updatedAt`, and `data`, and the primary key is `repository` and `number`. The column `data` holds the JSON text of the item. The facts are never split into more columns.
- Every item is checked against its JSON schema before it is written, and a wrong item writes nothing. The program holds the two schema files inside with `include_str!`.
- `initialize` reads every item since the beginning. `update` reads only the items that changed since the last read. Each mode can run again and again, and never writes a row two times.
- The date of the last read is the largest `updatedAt` of the table for the repository. The package keeps no other state, and no extra table.
- Only `src/github/graphql_runner.rs` runs the command `gh`. The tests give a fake runner or a fake `gh` command, so they need no network.
- The package stores facts only: no review, no reaction, no milestone, and no comment text.
- `query` and `CodeHostingDatabase::query` open SQLite read only, never changing or creating a file; `src/storage/query_formatter.rs` only formats rows.
- The default SQLite file is `data_layer.sqlite` in `HEIDRUN_CODE_DIR`, or `~/.config/heidrun_code/data_layer.sqlite` when the variable is unset or empty. The option `--database` changes it.
- `--verbose` sends progress through a log function; only `src/main.rs` prints it.
- The folder `src/model/` imports from no other folder of `src/`. The folder `src/github/` and the folder `src/storage/` import from `src/model/` only, and never from each other. Only `src/synchronization.rs` uses `src/github/` and `src/storage/` together.
- Calls are blocking; the package imports only `data_layer_operation_log` from other repository packages and knows nothing about Tauri. Every public function records its operation and tests its events ([rule](../../../docs/agents_rules/data_layer_operation_log.md)).
- `.cargo/config.toml` selects the target folder of `desktop_tauri`, cloned by `pnpm worktree:create`; Cargo reads this configuration only from inside the package.
- Desktop callers use only `refresh_*` and `find_*`, as [data_layer_access.md](../../../docs/agents_rules/data_layer_access.md) requires; `data_layer_boundary_checker` enforces the boundary.

## Background
- The package comes from [issue #455](https://github.com/heidrun-org/heidrun/issues/455). The data layer as a whole is [issue #452](https://github.com/heidrun-org/heidrun/issues/452).
- The field `closingIssuesReferences` of GitHub is empty for every pull request here, because the pull requests merge into `dev_jerome` and not into `main`. The link from a pull request to its issue is the text `Fixes #N` in the `body`.
- The support for GitLab is not written yet.
- Operation logging follows [data_layer_operation_log](../data_layer_operation_log/CONTEXT.md).
