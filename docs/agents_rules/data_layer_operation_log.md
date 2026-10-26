# Rule: every operation of the data layer is recorded in the operation log

- Created: 17 October 2026
- Last updated: 25 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](glossary/index.md)
- Related issue: [issue 618](https://github.com/heidrun-org/heidrun/issues/618), [issue 616](https://github.com/heidrun-org/heidrun/issues/616), [issue 617](https://github.com/heidrun-org/heidrun/issues/617), [issue 664](https://github.com/heidrun-org/heidrun/issues/664)

This file gives the rules for every agent that adds or changes a public function of a data layer package or of `heidrun_data`. The description of the log, its format, and the measures are in [data_layer_operation_log.md](../statistics/data_layer_operation_log.md).

## The rule

- Every public function of the four data layer packages and of `heidrun_data` writes a start event before it works and a completion event after it, with the library `submodules/heidrun_data/packages/data_layer_operation_log`. One call of the function is one operation, and the pair of events is the record of that operation in the operation log.
- A new public function does the same in the same change. It calls `data_layer_operation_log::record` (or `Operation::start` and `succeed` or `fail_with`, when the result is not a `Result`), with an `OperationSpec` that names the package, the stable operation name (the name of the public function), and the kind: `query`, `collection`, `synchronization`, `write`, or `lock`.
- The operation name is the name of the public function. A rename of a public function changes the operation name in the log, so a rename is a change of the format: say it in the pull request.
- The parameters of the `OperationSpec` are the values that decide the workload: the repository, the dates, the grouping, the mode, the SQL statement. Use `choice` for a value with a few possible values: it is part of the pattern, and a summary counts the operations that share it together. Never put the text of a chat, of a commit, of an issue, or of a file in a parameter.
- The test of a new public function reads the events with `data_layer_operation_log::testing::capture`, and checks the tree of the operations with `testing::tree`, the kind, the parameters, the count, and the outcome. An operation that fails writes a completion event with `outcome` failure and a category, never the text of the error.
- The desktop application calls only the functions `refresh_*` and `find_*` ([data_layer_access.md](data_layer_access.md)). Each call of them is an operation of its own, and it holds the lower operations of the same package. A new `refresh_*` or `find_*` function does the same, and says its mode in the parameter `mode`, or in the detail `mode` of the completion event when it chooses the mode while it runs.
- Nested operations are normal: a synchronization holds a collection, a write, and a lock. The nesting follows the call stack of the thread. Do not start an operation in a new thread inside an operation and expect it to be nested.

## What the log never does

- It never changes the result of an operation, never hides its error, and never fails the operation when the log file cannot be written. The package counts the lost events, and the next event that is written reports the number in the field `droppedEvents`.
- It never holds a credential, a token, or the text of a conversation. `data_layer_operation_log` removes the secrets from every text before it is written, and replaces a field whose name says it holds a secret. The error text is never written: only its category.
- It never opens the SQLite file and never takes the lock of the SQLite file. A slow SQLite file cannot slow the log, and the log cannot hide a lock problem.

## The packages

- A data layer package imports only `data_layer_operation_log` from the other packages of the repository. The rule "no data layer package imports another data layer package" is unchanged.
- `data_layer_operation_log` imports no package of the repository. The test programs of Cargo write no log unless `HEIDRUN_CODE_OPERATION_LOG_FILE` gives a file, so the tests of a package never fill the log of the developer. The tests of a command line set the variable to a file in their temporary folder.
- The desktop application gives its name with `data_layer_operation_log::set_default_caller("heidrun")`. The command line `heidrun_data` is `heidrun_data`. The variable `HEIDRUN_CODE_OPERATION_LOG_CALLER` replaces both.

## The measure

- The duration starts right after the start event is written and ends right before the completion event is written, with the monotonic clock of the program. It holds the wait for a lock that the operation takes (the lock is a nested operation of the kind `lock`), the work of the operation, and the reads of the source. It does not hold the writing of the two events, and it does not hold what the caller does before or after: the opening of a SQLite file that the caller opens first, and the printing of the rows.
- `heidrun_data operations overhead` measures what the log costs. The budget is 1 millisecond and 2 KiB for an operation. A test fails when the log costs more.
- The log file is `data_layer_operations.jsonl` in the folder of `HEIDRUN_CODE_DIR`. At 8 MiB it becomes `data_layer_operations.jsonl.1`, a new file starts, and the previous `.1` is removed. The log never holds more than about 16 MiB.

## Reading and replaying

- `heidrun_data operations` has six actions: `info`, `summary`, `list`, `replay`, `snapshot`, and `overhead`. Its help and the `SKILL.md` of `heidrun_data` say the same, and a test compares them.
- A replay writes its operations with the origin `replay` and the identifier of the original operation, and a summary of the real usage leaves them out. A replay of a query opens the SQLite file read only. A replay of a synchronization needs `--isolated-database`, a new file, and never writes the SQLite file of Heidrun Code.
- A new public function that cannot run alone from its parameters is not replayable: the replay says so, and a test shows it. A new `find_*` function is replayable when its parameters in the log are enough to call it again, and a new `refresh_*` function is replayable when it also writes only the isolated file: add it to the lists `FIND_OPERATIONS` or `REFRESH_OPERATIONS` of `replay.rs` with a test.
