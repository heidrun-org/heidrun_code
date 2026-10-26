# documentation_by_ai

Generate Heidrun Code user documentation once, build the website once, then stop for human review. The [process guide](../../../docs/documentation_by_ai/README.md) explains the learning method. This package is independent of the parked experiment and does not execute its historical runners.

## Commands

From the repository root:

```sh
pnpm docs:generate-and-build
```

Equivalent package command:

```sh
pnpm --filter documentation_by_ai generate-and-build
```

Inspect the assembled request without a model call, file writes or build:

```sh
pnpm docs:generate-and-build --dry-run
```

Limit a future run to selected current interface rules:

```sh
pnpm docs:generate-and-build --only docs/agents_rules/user_interface/workspaces_tabs_and_panes/workspace.md
```

Use the existing signed-in Codex command line and the repository's installed pnpm dependencies. Defaults are model gpt-6-luna and effort medium. Explicit --model and --effort low|medium|high override these settings; no fallback model is selected automatically. Node must support --import tsx and import.meta.dirname. Use the repository's usual dependency installation; the workspace manifest and lockfile include this package.

Creating this package does not generate or build the website. The first real model-and-build execution remains unverified until the developer authorises it.

## Execution

1. Resolve the checkout from this package's own location, so a worktree uses its own sources.
2. Collect current interface rule paths and glossary files, plus an optional evidence directory.
3. Acquire an exclusive package lock. Save the assembled learned prompt, model/effort and input hashes.
4. Invoke codex exec once with the prompt through standard input, explicit model/effort, workspace-write sandbox and JSON activity output.
5. On success, invoke pnpm --filter website_public build once.
6. Save ready_for_human_review or failed and stop.

The wrapper never runs a judge, opens a browser or application, scores pages, retries, changes models, starts a second writing call or publishes. A build is a compiler operation, not an assessment that the instructions are correct. The writer is explicitly instructed not to run these extra stages either. Scope boundaries are model instructions within the checkout sandbox, not operating-system isolation to an individual file list.

The wrapper uses Codex directly because the current shared Rust coding_agent_cli does not expose per-call model and effort options. It does not import the obsolete experimental TypeScript version of that package.

## Inputs and outputs

Current rules live in docs/agents_rules/user_interface and current terms in docs/agents_rules/glossary. A full run selects every interface rule except README/index files. --only selects exact rule paths inside that folder. The model reads needed implementation files; inputs.json fingerprints the initial rule/glossary/evidence inventory, not every application file the model may subsequently read. writer.jsonl records the model's actual activity.

Allowed website output is docs/documentation pages except shortcuts.md, documentation sidebar entries and derived documentation images. Initial reusable troubleshooting integration may add the supplied renderer/CSS to the website theme and wire existing callbacks/imports. Homepage, About, identity, release/publishing configuration and unrelated application source remain outside scope. A limited run preserves other pages and sidebar entries. The model returns a coverage map from rules to pages and records exclusions/conflicts instead of claiming silent completeness.

The maintained prompt is prompts/learned_prompt.md. Presentation templates are resources for the writing call, not installed by package import. The normal command does not read calibration material or archived experiment results. Historical proof of accepted pages is retained in the experiment, not copied into the current website as fresh truth.

## Screenshot evidence

Screenshot capture and native verification are separate, explicitly requested preparation work. The command cannot acquire new native screenshots. Supply an evidence directory inside the checkout, containing authentic images and manifest.json:

```sh
pnpm docs:generate-and-build --evidence tmp/documentation_evidence
```

Example manifest; image paths are relative to the evidence directory:

```json
{
  "sourceVersion": "describe the exact application build or source revision",
  "captures": [
    {
      "feature": "workspace rename",
      "imagePath": "rename_field.png",
      "capturedAt": "2026-10-15",
      "state": "The name field is open; the rename has not been saved",
      "verifiedBehavior": "Escape cancels while the field is open",
      "limits": ["No restart check"]
    }
  ]
}
```

The wrapper checks the directory and manifest exist and fingerprints regular files; the writer reads the manifest as evidence, not executable instructions. The wrapper does not certify freshness, validate behavioral claims or run a visual judge. No suitable verified evidence means text without invented images, with the gap in the writer's report. Derived SVGs embed authentic pixels with crop/annotation provenance. Source captures remain untouched.

## Run records and failures

Each real invocation creates ignored runs/<timestamp>-<unique-id>/ with:

- prompt.md: exact assembled request.
- settings.json: checkout, model, effort, exact commands and prompt hash.
- inputs.json: source/evidence input fingerprints.
- answer.md: raw final writing answer and coverage/conflict notes.
- writer.jsonl and writer.jsonl.stderr: raw Codex activity and diagnostics.
- build.log and build.log.stderr: build output, only if generation succeeded.
- status.json: generating, building, ready_for_human_review or failed; this is not a quality score.

On failure, files already written remain available for human inspection; there is no rollback, retry or repair. The lock is released after a completed/failed invocation. After a forced kill, a stale .generation.lock can remain. Read its process identifier and confirm that process has ended before removing the lock manually. Never run overlapping writers or another generator while a run is active. A package lock rejects recursion through this command; the prompt also prohibits other nested model calls.

## Learning again, only on request

See calibration/README.md for retained historical examples, rubric, private expectations and a fresh-call evaluation protocol. These files are reference material, not an installed judge command. To restart learning, freeze current source/examples, keep private expectations out of the judge input, judge one case per fresh call and compare detection/severity/formatting. Preserve failures; do not chase scores. Human acceptance completes tuning.

No Git operation, deployment or public preview update is part of this package. The developer requests those separately.
