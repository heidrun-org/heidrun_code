# Glossary of Heidrun Code: test levels

- Created: 23 October 2026
- Last updated: 23 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md), [Rule: fast tests, slow tests, and full tests](../test_levels.md)
- Related issue: [issue 826](https://github.com/heidrun-org/heidrun/issues/826)

This document gives one short definition for each word of the test levels. The other words of Heidrun Code are in [index.md](index.md).

## Words

### Fast tests

The tests that the developer runs often, after each change. The command `pnpm test` runs them, and so does the command `pnpm test:fast`. They are all the tests of the repository except the slow tests.

### Slow tests

The tests that run only when the developer asks for them, for example before a release. The command `pnpm test:slow` runs them. A test is slow when it loads a real model, or when it is in a package that the developer rarely changes and that runs for about 10 seconds or more.

### Full tests

The fast tests, then the slow tests. The command `pnpm test:full` runs them. The steps of the release use this command.

## Rules

- Use the words "fast tests", "slow tests", and "full tests". Never write "quick tests", "long tests", "heavy tests", or "lane" for them.
- Never write "all the tests" for the command `pnpm test`: this command runs the fast tests only. The words "all the tests" mean the full tests.
