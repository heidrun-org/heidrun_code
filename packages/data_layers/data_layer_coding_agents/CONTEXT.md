# Directory Context: `/packages/data_layers/data_layer_coding_agents`

## Purpose
Reads Claude Code and Codex chat sessions and coding agent configuration into SQLite. Stores minute token usage and model prices, and calculates estimated costs. Desktop callers use `refresh_*` and `find_*`.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface; its `pub use` lines list the readers, databases, synchronization and query functions, schemas, and data types.
- `src/main.rs` and `src/command_line.rs`: the executable `data_layer_coding_agents`.
- `src/refresh.rs`: chat, token, and price synchronization, with `chats_cache.json` beside SQLite. `src/query.rs`: stored chat and AI cost queries; absent tables give empty answers.
- `src/coding_agents/`: the reading of the chat session files, of the tokens, and of the configuration — see its own CONTEXT.md.
- `src/storage/`: the SQLite file, and the text form of the rows of a query — see its own CONTEXT.md.
- `src/pricing/`: the price list of the models, and the calculation of a cost — see its own CONTEXT.md.
- `src/model/`: the data types, and the JSON schema check — see its own CONTEXT.md.
- `src/repository_finder.rs`: repository root and `owner/name`.
- `src/synchronization.rs`: `initialize` and `update` for configuration and tokens.
- `schemas/`: validates each table with a `data` column.
- `tests/`: executable tests; library tests sit beside their implementation.
- Command to run this folder: `pnpm --silent data_layer:coding_agents --help`
- Command to test this folder: `pnpm --filter data_layer_coding_agents test`

## Rules
- The default SQLite file is `data_layer.sqlite` in `HEIDRUN_CODE_DIR`, or `~/.config/heidrun_code/data_layer.sqlite` when the variable is unset or empty.
- `chat_sessions` has exactly the columns `repository`, `id`, `updatedAt`, and `data`, with four link tables. A relation is never copied into `data`. The tables `memory_files`, `subagents`, and `skills` have the same four columns, and a row whose file is gone stays, with the date in `removedAt`.
- Every row with a column `data` is checked against its JSON schema before it is written. The program holds the schema files inside with `include_str!`.
- `initialize` reads every file. `update` reads the files that changed at the date of the last read or later. Each mode can run again and again, and never writes a row two times. For `memory_files`, `subagents`, and `skills`, both modes read every file, `initialize` writes every row, and `update` writes only the rows that are new, whose `data` changed, or that are newly marked as removed ([issue #593](https://github.com/heidrun-org/heidrun/issues/593)).
- The package stores facts only: no message text, and no body of a memory file, a subagent, or a skill. It never writes in the folders of the coding agents.
- `token_usage_minutes` has one row for each chat session, model, and minute in UTC. The cost is never stored: the view `token_usage_with_cost` calculates it, and an unknown price gives a null cost, never zero. The rules are in `docs/statistics/token_usage_and_cost.md`.
- `query` only works on a database that is open read only.
- `src/model/` imports from no other folder of `src/`. `src/coding_agents/` and `src/pricing/` import from `src/model/` only. `src/storage/` imports from `src/model/` and `src/pricing/`. Only `src/synchronization.rs` uses all of them together.
- Only `src/repository_finder.rs` runs the command `git`. Only `src/coding_agents/agent_homes.rs` reads the variables `CLAUDE_CONFIG_DIR` and `CODEX_HOME`, and the home folder for `~/.agents`.
- Calls block. The only repository dependency is `data_layer_operation_log`; Tauri is not used. Every public function records its operation and tests its events ([rule](../../../docs/agents_rules/data_layer_operation_log.md)).
- `.cargo/config.toml` selects the target folder of `desktop_tauri`, cloned by `pnpm worktree:create`; Cargo reads this configuration only from inside the package.
- Desktop callers use only `refresh_*` and `find_*`, as [data_layer_access.md](../../../docs/agents_rules/data_layer_access.md) requires; `data_layer_boundary_checker` enforces the boundary.

## Background
- Scope: [chat sessions](https://github.com/heidrun-org/heidrun/issues/463), [coding agent configuration](https://github.com/heidrun-org/heidrun/issues/569), and [the data layer](https://github.com/heidrun-org/heidrun/issues/452).
- The token usage and the prices come from [issue #616](https://github.com/heidrun-org/heidrun/issues/616).
- The relation "people" is not written, because no text of a chat session names a person ([issue #463](https://github.com/heidrun-org/heidrun/issues/463)).
- Operation logging follows [data_layer_operation_log](../data_layer_operation_log/CONTEXT.md).
