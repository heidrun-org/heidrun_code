# Symbiospec format 1.0.0

## 0. Introduction

### 0.1. Structure

Defines where project data belongs and how people and coding agents find the current specification.

### 0.2. Responsibilities

Defines the six product documentation areas and the boundaries between their responsibilities.

### 0.3. Documents and approval

Defines readable document conventions, evidence, proposals, decisions, and coverage records.

This is the complete product-data definition for format `1.0.0`, the existing unversioned format. The shared [version record and migration rules](versioning.md) add administrative metadata without changing this product-data structure. Retain this definition when publishing later formats.

## 1. Repository structure

Use this initial structure under the target repository root:

```text
docs/symbio_spec/
  README.md
  index.md
  decisions.md
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

Use descriptive topic filenames and relative links. Stable identifiers are useful when the repository already uses them; do not introduce a second identifier system unnecessarily. Keep evidence and approval references close to claims, using links to source files, tests, relevant issue discussions, or observed execution. Link commit references to the remote commit and preserve what the referenced version actually established.

## 4. Proposals, decisions, and coverage

### 4.1. Proposals

Use `proposals/<topic>.md` for a review batch when a persistent draft is useful. Record scope, proposed changes, examples, evidence, confidence, dependencies, and decisions needed. Clearly label proposed product meaning. Link to current definitions instead of copying the entire existing specification.

### 4.2. Decisions

Use `decisions.md` to record actual human decisions with their scope, source, date, affected references, and unresolved conditions. A direct user instruction can authorize a product change; record that authorization without requesting approval again. Existing code, passing tests, strong confidence, or silence does not establish approval.

Each authoritative topic document identifies its approval evidence. If approval is unknown, retain a proposal or observed status. When only part is approved, separate the proposed material or identify approval at the relevant section. During initialization, an empty decisions file states that no product decisions have been recorded yet; never fabricate approvals to complete a template.

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
