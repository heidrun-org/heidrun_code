# Directory Context: `/packages/dev_tools/data_layer_boundary_checker`

## Purpose
A full npm package that holds the test of the data layer access boundary. The test fails when the Past chats sidebar section or the Statistics window gets data without a package of the folder `submodules/heidrun_data/packages`: a conversation file read, a Git or hosting tool started, a network request, an SQL statement, or a Tauri command that no package backs.

## Key Exports & Entry Points
- `src/index.ts`: the public interface for another package. It exports the class `DataLayerBoundaryChecker` and the type `BoundaryViolation`.
- `src/boundary_rules.ts`: the only place that lists the scope (the folders and files that are checked), the forbidden patterns, the allowed helper paths, the allowed Tauri commands with a reason for each, and the allowed exceptions. A new exception is added here, with its reason.
- `src/rust_source.ts`, `src/rust_paths.ts`: read a Rust file. They remove the comments, the string contents, and the test code, and they read every `use` path with its groups.
- `src/rust_boundary_check.ts`, `src/frontend_boundary_check.ts`: the checks of the Rust files and of the web page files. `src/data_layer_boundary_checker.ts` runs them on a repository.
- `tests/`: the Vitest tests. `tests/real_repository.test.ts` checks the real repository. `tests/bypass_mutations.test.ts` copies the checked files with `tests/repository_copy.ts`, adds one bypass of each kind, and proves that the check fails.
- Command to test this folder: `pnpm --filter data_layer_boundary_checker test`

## Rules
- The rule that this package enforces is written only in [data_layer_access.md](../../../docs/agents_rules/data_layer_access.md). This package never copies the text of the rule.
- Every rule of `src/boundary_rules.ts` has a bypass test in `tests/bypass_mutations.test.ts`. A test fails when a rule has none.
- The check reads the text of the files and nothing else. It never runs the compiler, and it never follows a link of a markdown file.
- A file of the scope may call only a function of a package of the data layer that starts with `refresh_` or `find_`, and the functions of `ALLOWED_PACKAGE_FUNCTIONS`. A helper of the desktop application is allowed only when `ALLOWED_CRATE_PATHS` lists it.
- No package in `packages/apps` imports this package.

## Background
- The package was created by [issue 617](https://github.com/heidrun-org/heidrun/issues/617). The check finds a bypass that is written in the text of the code. It cannot prove that a command which calls `find_*` reads only the SQLite file, so the code review keeps that boundary, as the document in the first rule says.
