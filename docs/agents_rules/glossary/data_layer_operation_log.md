# Glossary of Heidrun Code: the operation log of the data layer

- Created: 17 October 2026
- Last updated: 25 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md), [Rule: every operation of the data layer is recorded in the operation log](../data_layer_operation_log.md), [The operation log of the data layer](../../statistics/data_layer_operation_log.md)
- Related issue: [issue 618](https://github.com/heidrun-org/heidrun/issues/618), [issue 664](https://github.com/heidrun-org/heidrun/issues/664)

This document gives one short definition for each word of the operation log of the data layer. The other words of Heidrun Code are in [index.md](index.md). The word "request" does not name an operation: it keeps its other meanings (a request to the mobile server, a network request, a pull request, and a merge request).

### Operation

One call of a public function of a data layer package or of `heidrun_data`. An operation has a start event and a completion event in the operation log. An operation that has a start event and no completion event is an unfinished operation.

### Operation name

The stable name of the public function that an operation calls, for example `find_commits`. The pair of the package and the operation name is the key of every summary. The start event writes it in the field `operationName`.

### Operation log

The file `data_layer_operations.jsonl`, with one JSON line for each event. The application and the command line `heidrun_data` write it, and the command `heidrun_data operations` reads it. When it reaches 8 MiB, it becomes `data_layer_operations.jsonl.1`, and a new file starts.

### Start event and completion event

The two lines of an operation. The start event is written before the function works, and holds the caller, the package, the operation name, the parameters, the pattern, and the state of the data. The completion event is written after the function, and holds the duration, the outcome, the category of the error, and the number of results.

### Caller

The program that made the operation: `heidrun` for the desktop application, `heidrun_data` for the command line. The variable `HEIDRUN_CODE_OPERATION_LOG_CALLER` replaces it.

### Kind

What an operation does with the data: `query` (reads the rows that the SQLite file holds), `collection` (reads a source), `synchronization` (the mode initialize or update of a source), `write` (writes rows in the SQLite file), or `lock` (waits for the lock of the SQLite file).

### Workload

The word that a summary gives to a group of operations: `stored_data_query`, `collection`, `initial_import` (a synchronization in the mode initialize), `incremental_synchronization` (a synchronization in the mode update), `synchronization` (a synchronization with no mode, such as the refresh of the prices), `database_write`, or `lock_wait`.

### Nested operation

An operation that starts while another operation runs on the same thread, for example the lock inside a synchronization. A summary does not count a nested operation as an operation of its own, unless the option `--nested` is given.

### Pattern

The text that groups the operations that ask for the same thing with other values: the SQL statement without its values, and the choices of the operation.

### Unfinished operation

An operation with no completion event. It is `running` when its process lives and it started less than one hour ago, and `interrupted` in every other case. It is never shown as a success.

### Replay

An operation that the command `heidrun_data operations replay` runs again. Its events have the origin `replay` and the identifier of the original operation. A summary of the real usage leaves it out.

### Snapshot

A consistent copy of the SQLite file, made by `heidrun_data operations snapshot`. A replay of queries reads it.

### Isolated database

The new SQLite file that a replay of a synchronization writes. It must not exist before the replay, so a replay never writes a file that exists.
