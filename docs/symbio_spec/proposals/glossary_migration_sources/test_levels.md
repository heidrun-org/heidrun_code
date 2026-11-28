# Test levels source material

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Transferred source material
- Related framing: [Glossary migration sources](README.md)
- Related issue: [issue 1135](https://github.com/heidrun-org/heidrun_code/issues/1135)

Original source `/docs/agents_rules/glossary/test_levels.md` in the [pinned revision](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db). The headings identify original line numbers. Proposed destinations and inventory notes describe the transfer. Approval of a product rule is recorded with the resulting specification.

### Source line 10

This document gives one short definition for each word of the test levels. The other words of Heidrun Code are in [index.md](source_index.md).

### Source line 12

#### Words

### Source line 14

- This passage is preserved as repository or technical terminology.
- Proposed destinations: Repository rules · Fast tests and their commands.

#### Fast tests

The tests that the developer runs often, after each change. The command `pnpm test` runs them, and so does the command `pnpm test:fast`. They are all the tests of the repository except the slow tests.

### Source line 18

- This passage is preserved as repository or technical terminology.
- Proposed destinations: Repository rules · Slow tests, when to run them, and classification.

#### Slow tests

The tests that run only when the developer asks for them, for example before a release. The command `pnpm test:slow` runs them. A test is slow when it loads a real model, or when it is in a package that the developer rarely changes and that runs for about 10 seconds or more.

### Source line 22

- This passage is preserved as repository or technical terminology.
- Proposed destinations: Repository rules · Full tests and the release requirement.

#### Full tests

The fast tests, then the slow tests. The command `pnpm test:full` runs them. The steps of the release use this command.

### Source line 26

#### Rules

### Source line 28

- Proposed destinations: Repository rules.

- Use the words "fast tests", "slow tests", and "full tests". Never write "quick tests", "long tests", "heavy tests", or "lane" for them.

### Source line 29

- Proposed destinations: Repository rules.

- Never write "all the tests" for the command `pnpm test`: this command runs the fast tests only. The words "all the tests" mean the full tests.
