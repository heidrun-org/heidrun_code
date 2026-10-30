# Directory Context: `/packages/apps/web_frontend/src/lib/heidrun_code_dashboard`

## Purpose
The pure model of the Heidrun Code Dashboard and the layout of its radial graph: it builds the hierarchy Heidrun, workspaces, tabs, coding agents, and subagents from the Herdr data and the live observations, derives the visible statuses, the coverage, and the counters, and collects the messages. It draws nothing and calls no Tauri command.

## Key Exports & Entry Points
- `observation_types.ts`: `HeidrunCodeDashboardObservations` and the other types of the Heidrun Code Dashboard observation contract, the shape that the desktop application sends in the Tauri event `heidrun_code_dashboard://observations`.
- `heidrun_code_dashboard_model_types.ts`: `HeidrunCodeDashboardModel` and the types of its nodes, facts, statuses, coverage, counters, and messages.
- `heidrun_code_dashboard_model_builder.ts`: `HeidrunCodeDashboardModelBuilder.build(input)` gives the `HeidrunCodeDashboardModel`; `HEIDRUN_CODE_DASHBOARD_OBSERVATIONS_STALE_AFTER_MS`.
- `heidrun_code_dashboard_status.ts`: `HeidrunCodeDashboardStatus`, the status rules and the aggregation, for a view that needs one rule alone.
- `heidrun_code_dashboard_messages.ts`: `HeidrunCodeDashboardMessages.collect(observations, model)` and `HeidrunCodeDashboardMessages.newSince(messages, seenIds)`.
- `heidrun_code_dashboard_layout.ts`: `HeidrunCodeDashboardLayout.compute(model)`, the positions of the static radial graph. It reads only the hierarchy, the identifiers, and the names, so a status change moves nothing.
- `heidrun_code_dashboard_transitions.ts`: `HeidrunCodeDashboardTransitions.compare(previous, model, messages)` gives the real transitions between two successive models (a completion, a new blocked item, a new message) and the next state; `HeidrunCodeDashboardTransitions.keyboardPeriodMs(working)`.
- `heidrun_code_dashboard_local_network_path.ts`: `HEIDRUN_CODE_DASHBOARD_LOCAL_NETWORK_PATH`, the path `/heidrun_code_dashboard` of the page that the Heidrun Code Dashboard server serves to the devices of the local network.
- `heidrun_code_dashboard_test_fixtures.ts`: fixtures for the test files only.
- Command to run this folder: `pnpm --dir packages/apps/web_frontend exec vitest run src/lib/heidrun_code_dashboard`

## Rules
- Nothing here imports from `src/stores`, `src/components`, `src/lib/api.ts`, or Tauri: the caller gives the Herdr data and the observations.
- The shape of `observation_types.ts` changes only together with the Rust collector of the desktop application.
- Nothing here reads the data layer table `subagents`: it holds configuration files, not running subagents.
- Nothing outside a test file imports `heidrun_code_dashboard_test_fixtures.ts`: a fixture is never shown as a real observation.
- A name, a title, or a folder never links two items: only an explicit identifier does.

## Background
- The rules of the transitions are in [heidrun_code_dashboard_animations.md](../../../../../../docs/agents_rules/user_interface/heidrun_code_dashboard/heidrun_code_dashboard_animations.md), from [issue 974](https://github.com/heidrun-org/heidrun_code/issues/974).
- The rules of the data, the identities, and the statuses are in [heidrun_code_dashboard_data_and_statuses.md](../../../../../../docs/agents_rules/user_interface/heidrun_code_dashboard/heidrun_code_dashboard_data_and_statuses.md).
- The sources and their limits are in [heidrun_code_dashboard_live_information.md](../../../../../../docs/architecture/heidrun_code_dashboard_live_information.md), from [issue 966](https://github.com/heidrun-org/heidrun_code/issues/966). This folder comes from [issue 970](https://github.com/heidrun-org/heidrun_code/issues/970).
