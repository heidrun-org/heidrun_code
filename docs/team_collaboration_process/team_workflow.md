# Team workflow

- Created: 12 October 2026
- Last updated: 13 October 2026
- Status: Proposal with open points
- Related framing: [Project instructions](../../AGENTS.md)
- Related issue: [issue 274](https://github.com/heidrun-org/heidrun/issues/274), [issue 277](https://github.com/heidrun-org/heidrun/issues/277)

This document describes a way for several developers to work on one repository when coding agents write much of the code. A full test runs before every merge. The idea comes from [issue 277](https://github.com/heidrun-org/heidrun/issues/277), which comes from [issue 274](https://github.com/heidrun-org/heidrun/issues/274).

## Workflow

1. The team agrees on the product level (direction and priorities) with the method of [Agreement about product](agreement_about_product.md).
2. Each developer builds a feature on a separate branch.
3. When the feature is done, the developer runs the full test.
4. The developer merges the current development branch into the feature branch, fixes the merge errors, and runs the full test again.
5. The developer opens a pull request.
6. When someone accepts the pull request, the full test runs again. If the full test passes, the pull request can be merged.

## Full test

All the members of the team agree on the full test. It has two parts:

- Code test: the usual automatic tests of the code.
- Agent test: a coding agent starts and checks that the new code does what it must do.

## Open points

- What Heidrun Code does to support this workflow is not decided.
- The open points of [Agreement about product](agreement_about_product.md) also apply to step 1.
