# Rule: fast tests, slow tests, and full tests

- Created: 23 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: test levels](glossary/test_levels.md)
- Related issue: [issue 826](https://github.com/heidrun-org/heidrun/issues/826)

This file gives the rule for the tests of the repository. The tests have two levels: the fast tests, which the developer runs often, and the slow tests, which run when the developer asks for them. The words are defined in [test_levels.md](glossary/test_levels.md) of the glossary.

## The commands

Run each command at the root of the repository.

| Command | What it runs |
| --- | --- |
| `pnpm test` | The fast tests only. It is the same command as `pnpm test:fast`. |
| `pnpm test:fast` | The fast tests of every package, one package after the other. |
| `pnpm test:slow` | The slow tests: `pnpm --filter voice_input test:slow`, then `pnpm --filter change_log_generator test`. |
| `pnpm test:full` | `pnpm test:fast`, then `pnpm test:slow`. |

Every command ends with a non-zero exit code when a test fails. The steps of [HOW_TO_RELEASE.md](../../HOW_TO_RELEASE.md) run `pnpm test:full`, because `pnpm test` is not enough before a release.

## Which test is slow

- A test is slow when it loads a real model, for example the real Whisper model `tiny`.
- A test is also slow when it is in a package that the developer rarely changes and that runs for about 10 seconds or more, for example `change_log_generator`.
- Every other test is fast.
- When the developer tells that a test is slow, the test is slow. The developer decides the level, and the two points above are the default.

## How to add a test

1. A new fast test goes where the other tests of its package are. The root script `test:fast` must call the script `test` of the package. When you add a package that has tests, add it to the root script `test:fast`.
2. A new slow test needs its own command, so that `pnpm test:fast` does not run it. A package that has fast tests and slow tests gets the two scripts `test:fast` and `test:slow`, and its script `test` runs both. The root script `test:slow` calls the script `test:slow` of the package. A package that has only slow tests keeps its script `test`, and the root script `test:slow` calls it.
3. In the package `voice_input`, the fast tests sit in the library (`cargo test --lib`), and the slow tests that load the real model sit in the folder `tests` (`cargo test --test transcription_with_tiny_model`). A new test file in the folder `tests` of this package runs only with `pnpm test:slow`, so a fast test never goes there.
4. The packages `localai_decisions_candle`, `localai_decisions_llamacpp`, and `localai_embeddings` need models of several hundred megabytes. They are in no level, and the developer runs them by hand.
5. Add the test and its level to the section "Tests" of [AGENTS.md](../../AGENTS.md), and to the table of the section "Test the application" of [README_DEV.md](../../README_DEV.md).

## The speed of the Vitest tests

The rules for the speed of the Vitest tests (the number of workers, the test environment of each file, the setup file, and the texts of the locale files) are in the section "Tests" of [AGENTS.md](../../AGENTS.md). Read them before you change the configuration of Vitest.

## Background

- The split comes from [issue 826](https://github.com/heidrun-org/heidrun/issues/826). Before the split, the command `pnpm test` ran every test and took 361 seconds on 23 October 2026.
- After the split, on the same computer and on the same day, the fast tests took 147 seconds, the slow tests took 75 seconds, and the full tests took 222 seconds. These times move with the load of the computer.
- The package `voice_input` is slow because of the real model. The package `change_log_generator` is slow because each test starts a new process, and the developer rarely changes the package.
