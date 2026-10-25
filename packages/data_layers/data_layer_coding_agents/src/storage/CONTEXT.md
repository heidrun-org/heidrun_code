# Directory Context: `/packages/data_layers/data_layer_coding_agents/src/storage`

## Purpose
Holds the SQLite file with its tables and views, and turns the rows of a query into text.

## Key Exports & Entry Points
- `database.rs`: `ChatSessionsDatabase`, which writes the chat sessions with their link rows, finds a row, and runs a read-only query.
- `configuration_database.rs`: `ConfigurationDatabase`, which writes the tables `memory_files`, `subagents`, and `skills`, and marks a row as removed when its file is gone.
- `token_usage_database.rs`: `TokenUsageDatabase`, which writes the table `token_usage_minutes` with the table `token_usage_synchronizations`, finds the usage of a workspace for a time range, and explains the query plan.
- `token_usage_schema.rs`: `create_all`, the statements of the four tables of the token usage and of the prices, the index by time, and the two views `latest_model_prices` and `token_usage_with_cost`, and the names of them.
- `model_price_database.rs`: `ModelPriceDatabase`, which stores the versions of the price list, loads the latest `PriceTable`, and refreshes the prices.
- `usage_grouping.rs`: `group_minutes`, `summarize_periods`, `parse_range_bound`, and the time zone functions: the minute, hour, and day periods.
- `minute_text.rs`: `minute_text`, `time_text`, and `parse_time_text`, the only place that writes a minute as text.
- `query_formatter.rs`: `to_table`, `to_json`, and `NO_ROW_TEXT`.
- Command to test this folder: `pnpm --filter data_layer_coding_agents test`

## Rules
- Nothing here imports from `src/coding_agents/`. This folder imports from `src/model/` and from `src/pricing/`.
- `database.rs` writes a chat session only after the JSON schema check of `src/model/schemas.rs` accepts it, and it writes the row and its link rows in one transaction. `configuration_database.rs` checks every item of one kind before it writes the first one, and writes them in one transaction. In the mode update it skips an item whose column `data` equals the stored text, so a second update of the same files writes no row.
- `token_usage_database.rs` writes the rows of the chats and the row of `token_usage_synchronizations` in one transaction, and a write changes only the rows whose tokens changed: a second write of the same tokens changes nothing.
- A chat that the files do not carry any more keeps its rows. Only a chat that a write carries again can lose rows.
- A row with `minuteAt` equal to an empty text holds the tokens of records without a date, and no time range includes it.
- `token_usage_with_cost` gives a null `costUsd` for a model without a price, and never zero. It reads the latest version of the prices only, so one answer never mixes two versions.
- A table is created with `CREATE ... IF NOT EXISTS` when the file opens, so an existing file gets the new tables and keeps every row.
- `query` only works on a database that is open read only.
- `query_formatter.rs` only turns rows into text, and never opens the database.
