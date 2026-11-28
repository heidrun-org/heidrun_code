# Initialize Symbiospec

Before setup, follow [version detection and migration](versioning.md). Existing unversioned folders start at effective format `1.0.0`; automatically adopt the version record without changing existing content during that step, then complete the forward path to the latest installed published format before initialization continues. Unsupported formats or an incomplete migration must be resolved before initialization continues.

For either workflow below, follow the current [repository structure](format.md#1-repository-structure), [add the repository instruction pointer](#3-add-the-repository-instruction-pointer), and [verify initialization](#4-verify-initialization).

## 1. New software

Read [format.md](format.md), repository instructions, and existing documentation. Create the agreed structure at `docs/symbio_spec/`, including `format-version.md` with the latest published version from the installed registry (currently `3.1.0`), folder contracts in the overviews, and accurate navigation in the indexes. Include the version record in the initial root index. For an empty history, create the decisions and coverage overviews and indexes with the empty status shown below. Create dated folders and topic summaries only when actual records exist. Keep product content limited to decisions and evidence supplied during the authorized work.

A human-provided [batch of user scenarios](workflow_user_scenarios.md#13-start-with-a-human-provided-batch) can start product design before every supporting description exists. Organize the journeys, identify shared concepts and missing decisions, then develop supporting descriptions in small coherent increments. Create the optional user scenario folder only when useful user scenarios exist; do not fabricate journeys or approvals. Then use Update as the first concepts and capabilities are developed. Product decisions already supplied by the human can populate the specification within their actual scope.

Existing `1.0.0` folders are automatically migrated before normal initialization work; invocation authorizes the published conversion, not new product decisions. New Symbiospec folders in existing software use the latest installed published format directly. An explicit no-changes instruction blocks required migration and dependent initialization rather than permitting the older layout.

### 1.1. Empty indexes

Write an explicit empty status in each applicable overview and index. The table gives example wording for the four indexes under `docs/symbio_spec/`. Keep the surrounding metadata and navigation, including links from the decisions and coverage indexes to their summary indexes.

| Index | Example wording |
| --- | --- |
| `decisions/index.md` | No product decisions have been recorded yet. |
| `decisions/summaries/index.md` | No decision summaries have been recorded yet. |
| `coverage/index.md` | No coverage examinations have been recorded yet. |
| `coverage/summaries/index.md` | No coverage summaries have been recorded yet. |

## 2. Existing software: slow growth

For a request to generate user scenarios from existing software, use the [software starting path](workflow_user_scenarios.md#12-generate-from-existing-software) to propose goal-oriented journeys for human review, then establish their supporting descriptions through the cycles below.

Start with a bounded, read-only inspection. Identify existing specifications and approvals before creating competing documents. If earlier specifications exist, preserve useful content and propose moves or splits incrementally. Do not treat an uncertain approval history as approval.

Slow growth means constructing a small, trusted foundation and expanding through repeated human-reviewed cycles. Prioritize the most evident, well-supported concepts rather than the largest features. A mistaken early concept can affect many later descriptions; small validated increments limit that propagation and let the human understand and control the process.

Each cycle follows the steps below. The steps apply to the selected increment, not to the whole application.

### 2.1. Identify a few clear concepts

Use the source code, tests, existing documentation, relevant history, and permitted direct observation as evidence. Record relationships, confidence, and uncertainties. Inspect enough to understand the selected concepts without attempting an exhaustive reconstruction before the first useful review.

### 2.2. Validate the initial glossary

Prepare names, definitions, relationships, evidence, and concrete examples for several major concepts. Use the prepared review method in the skill entry point. Correct misunderstandings and establish canonical definitions before relying on those definitions for authoritative related specifications. Investigate aliases without blindly replacing names.

### 2.3. Document a small, coherent part

Prepare the relevant Behaviour, User Interface, and other applicable descriptions around the accepted concepts. Every cycle can cross documentation areas. Do not complete the whole Glossary before documenting any Behaviour, and do not require all six areas to receive content in every cycle.

Separate observed results from expected results. A test may encode a misunderstanding, so passing tests do not automatically approve the expected behaviour.

### 2.4. Review a prepared batch

Finish the investigation and prepare the affected product decisions, examples, dependencies, and consequences before the review. The human can accept, reject, revise, or defer decisions in quick succession. Carry questions requiring substantial new investigation into a later batch rather than repeatedly interrupting the review with long waits.

### 2.5. Correct and establish a trusted foundation

Apply authorized corrections to the specification, record human decisions, and verify that the documented part is coherent and understood. Update navigation and coverage. Keep known differences between approved expectations and actual software explicit; changing software requires authorization for that work.

### 2.6. Expand and repeat

Select the next evident concepts or deepen existing descriptions. Preserve validated work and check every addition's relationships to the existing specification. Revisit an earlier approved decision explicitly if new evidence challenges the decision. Keep the next scope small enough for meaningful human review.

An approved baseline may cover only part of the software. State that coverage honestly. Update can maintain already established areas while initialization continues elsewhere. Do not claim that initialization verified every feature or every test.

## 3. Add the repository instruction pointer

Use the receiving repository's active coding-agent instructions as the starting point. The instruction pointer must lead to the installed `symbio_spec/SKILL.md` and `docs/symbio_spec/index.md`. State that agents read the relevant approved specifications before implementation and update the affected specifications within the same authorized development task. Resolve each relative link from the file where the link appears.

### 3.1. Repositories that use The Rules of the Repo

Follow the location in the existing coding-agent instructions to the rules list. Use the Symbiospec row and its linked configuration as the instruction pointer. Reuse an existing Symbiospec row or add one using the repository's conventions for a living rule with human approval. Link the installed skill in the Skill column and the configuration in the Configuration column. Describe when the rule applies to work that affects product specifications.

Reuse the configuration already linked in the Symbiospec row, or create one using the repository's configuration layout outside the installed skill folder. In the configuration, link the project specification index and give the instructions for reading and updating approved specifications. Keep the existing rules-list location, unrelated rows and their configurations.

### 3.2. Repositories without The Rules of the Repo

Add a short Symbiospec section to the repository's existing coding-agent instructions, such as `AGENTS.md`. Link the actual installed skill and the project specification index in that section and give the same instructions for reading and updating approved specifications. Keep the existing instructions alongside the new section.

## 4. Verify initialization

- Start from the active coding-agent instructions and follow the links to the installed Symbiospec skill and the project specification index. If the repository uses The Rules of the Repo, follow the existing route through the rules list and the Symbiospec configuration and check that the routes to other rules still work.
- Follow the project index to `decisions/index.md`, `decisions/summaries/index.md`, `coverage/index.md`, and `coverage/summaries/index.md`. Open all four before reporting initialization complete. Check that each empty index explicitly states that there are no records of its kind, following [the example wording](#11-empty-indexes). For populated indexes, verify the links to the existing records, folders or summaries.
- For a structure-only initialization, verify that there are no new dated decision or examination files, topic summaries, or approved product descriptions. For initialization that includes actual decisions or examinations, check that each record has supporting evidence within the authorized scope.
