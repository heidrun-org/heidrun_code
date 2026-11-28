# Symbiospec format 2.0.0

## 0. Introduction

### 0.1. Structure

Defines where project data belongs and how people and coding agents find the current specification.

### 0.2. Responsibilities

Defines the six product documentation areas and the boundaries between their responsibilities.

### 0.3. Documents and approval

Defines readable document conventions, evidence, proposals, decisions, and coverage records.

This is the complete definition for format `2.0.0`. One version covers the entire Symbiospec folder. The six specification areas retain their responsibilities; decision storage replaces the single history file. Use the shared [version record and migration rules](versioning.md) and the specific [forward and reverse conversion](migration-1-to-2.md). Retain this definition when publishing later formats.

## 1. Repository structure

Use this initial structure under the target repository root:

```text
docs/symbio_spec/
  README.md
  index.md
  format-version.md
  decisions/
    README.md
    index.md
    summaries/
      README.md
      index.md
      permissions.md
      navigation.md
    2026/
      README.md
      index.md
      11/
        README.md
        index.md
        decision-000041-permission-inheritance.md
        decision-000042-navigation-visibility.md
  coverage.md
  glossary/
    README.md
    index.md
  behaviour/
    README.md
    index.md
  user_interface/
    README.md
    index.md
  styling/
    README.md
    index.md
  platform_support/
    README.md
    index.md
  system_overview/
    README.md
    index.md
```

The topic names, dates, and decision numbers above illustrate placement, not required product content. New initialization creates only the decision overviews and indexes, with no fabricated decision records, summaries, or date folders. Create date folders and topic summaries when the first relevant decision is recorded. Unknown or incomplete decision dates use `decisions/undated/`, with its own overview and index; retain the original date text. Use `decisions/migration-map.md` only for migrated histories, as defined by the conversion instructions. No `decisions/format.json` or separate decision version is used. A completed `2.0.0` folder has no authoritative `decisions.md`.

Create topic documents only when there is useful content to record. Create `proposals/` and `reports/` only when needed; give each created folder its own `README.md` and `index.md`. Keep all Symbiospec project data within `docs/symbio_spec/`.

For an existing installation, inspect before creating anything. Preserve existing files and approvals; add missing structure without replacing existing content with empty templates. When another location already holds product definitions, link to the existing evidence and propose a migration rather than creating a competing approved definition.

`README.md` explains the folder's purpose to humans. Each area's `README.md` states what the area contains, excludes, and references elsewhere, with a boundary example. `index.md` lists direct child files and folders using working relative links and a short description of each entry. Update the parent index whenever content is added, renamed, moved, or deleted. Register `symbio_spec/index.md` in the documentation root's index without replacing existing entries.

During authorized initialization, add a concise pointer in the repository's coding-agent instructions to this skill and `docs/symbio_spec/index.md`: read relevant approved specifications before implementation and update affected specifications within the same authorized development task. Merge the pointer with existing instructions, use actual skill paths, and do not replace other rules or silently relocate existing agent rules.

## 2. Responsibilities of the six areas

### 2.1. Glossary

**Owns:** canonical names, identities, definitions, purpose, relationships, and established aliases of product concepts.

**Excludes:** control placement, full interaction scenarios, visual styles, and implementation internals.

Define concepts once and link to their definitions. Use one stable document or heading reference for each concept. Preserve identity when a display name changes; update references and retain useful aliases. Similar spelling is not evidence that two concepts are equivalent.

Example: define what a Macro is and how a Macro relates to a Pane. The result of executing a Macro belongs to Behaviour.

### 2.2. Behaviour

**Owns:** expected observable outcomes, triggers, conditions, state changes, failures, and invariants.

**Excludes:** where controls appear, visual presentation, duplicate concept definitions, and internal algorithms.

Use glossary references to describe the trigger, conditions, expected result, important failure cases, and relevant constraints. Link to verification evidence where available, without implying that a link proves coverage.

Example: define what executing a Macro should write into a Pane and what happens on failure. The location of the execution control belongs to User Interface.

### 2.3. User Interface

**Owns:** screens, navigation, control placement, and how users invoke documented behaviours.

**Excludes:** repeated descriptions of the complete behaviour and reusable styling rules.

Reference Behaviour for outcomes and Glossary for concepts. Record interface structure at the level needed to review product choices.

Example: describe where the Macro execution control appears and reference its behaviour. Button colours belong to Styling.

### 2.4. Styling

**Owns:** reusable visual conventions, typography, colours, spacing, component states, and rules for choosing control types.

**Excludes:** feature-specific outcomes and navigation placement.

Describe the established design system rather than inventing a new visual direction. Reference the relevant User Interface documents for applications of shared rules.

Example: define the presentation of disabled controls. The condition that disables a particular action belongs to Behaviour.

### 2.5. Platform Support

**Owns:** supported environments, input capabilities, platform limitations, and shared platform constraints.

**Excludes:** unverified promises of support and copies of feature-specific behaviour.

Record the difference between required, observed, and verified support. Behaviour and User Interface reference shared constraints and own the feature-specific consequences.

Example: define supported keyboard or touch environments. A particular touch interaction belongs to User Interface and references Behaviour for its result.

### 2.6. System Overview

**Owns:** a concise map of the major parts, their responsibilities and relationships, important data flows, and reasons for consequential structural choices.

**Excludes:** repeated glossary definitions, detailed behavioural specifications, functions, classes, and exhaustive implementation inventories.

Include an architectural fact when the fact helps a human understand a significant decision or its consequences. Link to detailed technical documentation outside Symbiospec where appropriate.

Example: explain which major part owns stored information and which major part presents that information. The meaning of the information belongs to Glossary and the expected user action belongs to Behaviour.

## 3. Document conventions

Follow the repository's documentation rules. Unless those rules specify another form, put this header immediately after each Markdown document's title:

```markdown
# Document title

- Created: day month year
- Last updated: day month year
- Status: Proposal
- Related framing: [Symbiospec overview](relative-path-to-README.md)
```

Replace the example values with actual dates, a precise status, and a working relative link. Include related rules and source issues when applicable. Keep the creation date and update the modification date. Folder overviews use `Maintained overview for people`; indexes use `Maintained index for agents and tools`. These administrative statuses do not approve the product content they reference.

Use a short `0. Introduction` with numbered subsections summarizing the top-level sections in substantive documents. Continue with hierarchical numbering such as `1`, `1.1`, and `1.1.1`; place short paragraphs below headings. Indexes and short folder overviews may remain concise without repeating every section as an introduction.

Use descriptive topic filenames and relative links. Decision records use the permanent numbers defined below. For other documents, stable identifiers are useful when the repository already uses them; do not introduce a second identifier system unnecessarily. Keep evidence and approval references close to claims, using links to source files, tests, relevant issue discussions, or observed execution. Link commit references to the remote commit and preserve what the referenced version actually established.

## 4. Proposals, decisions, and coverage

### 4.1. Proposals

Use `proposals/<topic>.md` for a review batch when a persistent draft is useful. Record scope, proposed changes, examples, evidence, confidence, dependencies, and decisions needed. Clearly label proposed product meaning. Link to current definitions instead of copying the entire existing specification.

### 4.2. Decisions

Use one original Markdown record per actual human decision. A direct user instruction can authorize a product change; record that authorization without requesting approval again. Existing code, passing tests, strong confidence, or silence does not establish approval. Unaccepted proposals stay in `proposals/`; a human rejection or deferral is itself a recordable decision.

Each authoritative topic document identifies its approval evidence. If approval is unknown, retain a proposal or observed status. When only part is approved, separate the proposed material or identify approval at the relevant section. Topic documents state current requirements; decision records retain historical authorization. Summaries and indexes locate evidence but cannot approve product meaning.

#### 4.2.1. Original records and identity

Use `decisions/YYYY/MM/decision-NNNNNN-descriptive-topic.md`, with a four-digit year and two-digit month from the actual decision date. Use `undated/` when the date is unknown, incomplete, or ambiguous; do not substitute a migration or file-creation date. Keep the exact known date and uncertainty in the record.

Decision numbers are positive integers, unique across the entire history, displayed with at least six digits. Allocate above both the greatest existing number (list filenames across all date folders and `undated/`) and the greatest number ever allocated (retain this value in the root decision index even if a record is removed); serialize allocation and writing so competing writers cannot reuse a number. Never reuse or renumber an allocated number. Numbers identify records, not dates or approval priority. Preserve a separate `History order` integer for the original sequence: migration assigns source order; new decisions append above the greatest history order. A date correction does not change history order or identity. Keep an existing usable decision numbering system during migration rather than creating competing identities; record legacy aliases when mapping is necessary.

Use this record form, with the document metadata required by section 3, actual values, numbered introduction and sections. The following fields are required, but `Unknown — not recorded` is valid for missing historical facts. A link placeholder must never be published as evidence.

```markdown
# Decision 000041: Permission inheritance

- Created: 14 November 2026
- Last updated: 14 November 2026
- Status: Recorded human decision
- Related framing: [Decision history](../../README.md)
- Decision number: 000041
- History order: 41
- Decision date: 14 November 2026
- Outcome: Accepted
- Scope: Child workspaces; inherited permissions only
- Topics: permissions
- Source: Unknown — not recorded
- Approval evidence: Unknown — not recorded
- Affected specifications: Unknown — not recorded
- Related decisions: None recorded

## 0. Introduction

### 0.1. Purpose

Records the decision, its reason, earlier decisions affected, and conditions.

## 1. Decision

The exact decision and its limits.

## 2. Reason

The recorded reason, or Unknown — not recorded.

## 3. Effect on earlier decisions

Links to earlier decisions and the precise scope replaced,
or No replacement recorded.

## 4. Unresolved conditions

The recorded conditions, or None recorded, or Unknown — not recorded.
```

This is an illustrative form, not an approved product requirement. Outcomes are `Accepted`, `Rejected`, `Revised`, `Deferred`, or `Unknown — not recorded`. Record the actual human response and any partial approval in the decision text; an accepted outcome without available evidence does not establish verified approval. `Revised` alone does not approve the revised proposal. Keep sources and approval evidence distinct and link actual evidence when available. `Topics` lists every affected summary topic, including cross-topic effects; use `unclassified` when classification is uncertain rather than making the record undiscoverable.

Original records preserve what was decided at the time. A later decision links to the earlier record and specifies whether replacement is whole or partial. Do not rewrite an earlier approval, outcome, or conditions to describe a later state. Correct transcription mistakes only with recorded correction evidence; preserve original migrated text. Administrative link repairs and date corrections retain identity and explain the correction without inventing product meaning. Move files only with incoming link updates and recorded old-to-new references.

#### 4.2.2. Indexes and topic summaries

Every created folder has `README.md` and `index.md` under section 1. Date indexes link original records with decision number, history order, topic, and short description; year indexes link months. `decisions/index.md` links summaries, year folders, `undated/` and migration mapping when present. Include the greatest allocated number and history order, checked against filenames and index entries when allocating. Keep record lists in month indexes rather than duplicating the entire history at the root.

The root decision index also contains a topic table: topic, summary link, latest affected decision link and history order, and maintenance state (`Current` or `Needs update`). Include an `unclassified` route when needed. `summaries/index.md` lists topic summaries. Each topic summary contains:

- Its scope and links to authoritative topic specifications.
- Decisions still applicable, with exact scope and links to original records; do not copy the complete specification.
- Whole and partial replacements, retaining links to the earlier and later decisions.
- Unresolved conditions and conflicting or unavailable approval evidence.
- `Checked through`: the latest affected decision number and history order from the root topic table, plus a verification date. Include the relevant original record links and their SHA-256 content checksums so record corrections are detectable.

`Checked through` is per topic, not the highest number in the entire history. Before relying on a summary, compare its checkpoint with the root topic table and its relevant record checksums with current bytes. A mismatch, `Needs update`, missing checkpoint, missing original, or missing topic route means the summary is incomplete or outdated. Do not use an outdated summary to assert current approval. Follow original records and report uncertainty; authorized maintenance can repair the summary. A summary without evidence is not approval.

When adding or correcting a record, mark every affected topic `Needs update` before changing history. Write the record and date indexes, update each topic's latest affected reference if appropriate, and update affected specifications and summaries in the same authorized task. Recheck the relevant earlier records and replacement links; update checksums and checkpoints, then mark topics `Current` last. A correction to an earlier record keeps the topic's latest history order but changes its checksum. An interruption leaves visible `Needs update` states. Adding a cross-topic decision updates every affected topic. If an original is removed or relocated, retain its allocated number and repair all affected links; never silently delete historical decisions. New topic summaries inspect only their applicable records, using metadata and index searches; routine maintenance does not reread the complete history.

A topic summary may use a compact table with columns `Original decision`, `Applicable scope`, `Later replacement`, and `Unresolved conditions`. A partial replacement gets separate scope descriptions: for example, inherited read access remains approved by decision 1, while inherited editing from decision 1 is replaced by decision 3. Both rows link original records. The summary's maintenance metadata is separate from approval:

```text
Checked through: Decision 000003; history order 3
Verified: 14 November 2026
Original records checked: linked records with their SHA-256 checksums
```

These values are illustrative. Publish real links, dates and checksums, not this placeholder text. Neither a date nor a checkpoint alone proves summary freshness.

#### 4.2.3. Reading procedure

After the shared version and interruption checks, locate the affected authoritative specification through the normal specification indexes. Use `decisions/index.md` to choose topic summaries; readers need not know the decision date. Verify summary freshness as above, then open the original decisions needed for approval evidence, scope, later replacement, or unresolved conditions. Follow related decisions when the requested change depends on earlier reasoning. Summaries never replace original evidence for an approval claim.

If a topic route is missing or classification is uncertain, search date indexes and record metadata for the affected specification, concept, and established aliases, including `undated/` and `unclassified`. Report the examined scope and gaps; do not claim that no relevant decision exists from an index alone. Full-history review remains available for explicitly requested audits, but ordinary work reads the relevant records rather than the entire history.

### 4.3. Coverage

Use `coverage.md` to record examined areas, approved scope, partial coverage, unresolved questions, known software differences, and the next proposed increment. Keep the record concise and link to specifications and reports. An empty structure is an unpopulated starting point, not complete coverage.

### 4.4. Audit and Realignment reports

Present findings in the conversation unless saving a report is authorized. Use `reports/<topic>.md` for an authorized saved report. Identify Symbiospec Audit for self-consistency, Symbiospec Audit for software compliance, or both audits, as applicable. Record the requested scope, reviewed specification and approval references, examined and unexamined areas, and evidence limitations. For software comparison, identify the software revision and environment and report coverage of both comparison directions.

For each finding, record:

- Classification: confirmed conflict, missing description, unresolved product decision, or behaviour not verified. Add specific information such as a test coverage gap when useful; a missing test alone does not establish a conflict.
- Affected specification descriptions, approval evidence, and user scenarios, with links where present. For an undocumented capability, state that no matching description was found in the examined scope and identify the documents searched; do not invent a specification reference.
- Expected and observed results, or the two conflicting specification descriptions. Mark unavailable or inapplicable evidence explicitly.
- Evidence links and checks actually performed. Separate source and test inspection from executed tests and direct application observations; include actual execution output or observations when checks ran.
- Severity, confidence, recommended action, any human product decision needed, and resolution or deferral. Keep evidence distinct from inference and confidence distinct from approval.

Report partial coverage even when no findings are discovered. Do not claim exhaustive consistency, complete software compliance, or tests that were not performed. Findings do not authorize changes; keep proposed corrections separate from the audit results. Approval of the specification and execution of tests remain separate facts.
