# Directory Context: `/packages/apps/web_frontend/src/lib/mire`

## Purpose
The pure model of the Mire: it builds the hierarchy Heidrun, workspaces, tabs, coding agents, and subagents from the Herdr data and the live observations, derives the visible statuses, the coverage, and the counters, and collects the messages. It draws nothing and calls no Tauri command.

## Key Exports & Entry Points
- `observation_types.ts`: `MireObservations` and the other types of the Mire observation contract, the shape that the desktop application sends in the Tauri event `mire://observations`.
- `mire_model_types.ts`: `MireModel` and the types of its nodes, facts, statuses, coverage, counters, and messages.
- `mire_model_builder.ts`: `MireModelBuilder.build(input)` gives the `MireModel`; `MIRE_OBSERVATIONS_STALE_AFTER_MS`.
- `mire_status.ts`: `MireStatus`, the status rules and the aggregation, for a view that needs one rule alone.
- `mire_messages.ts`: `MireMessages.collect(observations, model)` and `MireMessages.newSince(messages, seenIds)`.
- `mire_test_fixtures.ts`: fixtures for the test files only.
- Command to run this folder: `pnpm --dir packages/apps/web_frontend exec vitest run src/lib/mire`

## Rules
- Nothing here imports from `src/stores`, `src/components`, `src/lib/api.ts`, or Tauri: the caller gives the Herdr data and the observations.
- The shape of `observation_types.ts` changes only together with the Rust collector of the desktop application.
- Nothing here reads the data layer table `subagents`: it holds configuration files, not running subagents.
- Nothing outside a test file imports `mire_test_fixtures.ts`: a fixture is never shown as a real observation.
- A name, a title, or a folder never links two items: only an explicit identifier does.

## Background
- The rules of the data, the identities, and the statuses are in [mire_data_and_statuses.md](../../../../../../docs/agents_rules/user_interface/mire/mire_data_and_statuses.md).
- The sources and their limits are in [mire_live_information.md](../../../../../../docs/architecture/mire_live_information.md), from [issue 966](https://github.com/heidrun-org/heidrun_code/issues/966). This folder comes from [issue 970](https://github.com/heidrun-org/heidrun_code/issues/970).
