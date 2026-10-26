# Directory Context: `/tmp/web_doc_by_ai`

## Purpose
The isolated experiment for generating and evaluating Heidrun Code user documentation.

## Key Exports & Entry Points
- `workspace/`: a source snapshot with its own package manifests, writer, judge and website; see its CONTEXT.md.
- `prompts/`: saved writing and judging prompts; the source modules in workspace are authoritative.
- `data/`: provenance, copied calibration examples and file fingerprints.
- `results/`: raw model answers, reports, screenshots and live verification evidence.
- `history/`: original trial source, exact pre-parking files, patches and historical runners.
- `process/`: the workflow and handoff.
- Read `README.md` before running a command.

## Rules
- Every experiment write remains inside this folder.
- Normal packages and commands outside this folder do not depend on the experiment.
- Generator and judge runs read Git history only and never publish changes.
- Issue 407 authorises a separate commit and pull request for preserving the experiment, without merge or deployment.
- Historical runners are evidence and are not executed.
- Live verification findings take precedence over earlier source-only scores.

## Background
- [Issue 375](https://github.com/heidrun-org/heidrun/issues/375) describes the original goal.
- [Issue 407](https://github.com/heidrun-org/heidrun/issues/407) records the preservation request.
