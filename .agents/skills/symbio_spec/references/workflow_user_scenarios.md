# Create, review and maintain user scenarios

## 0. Introduction

### 0.1. Purpose

Start with a human-provided batch of user scenarios, or generate proposed user scenarios from existing Symbiospec or existing software. Apply the [shared version check](versioning.md) first and follow [the user scenario format](format-v3.1.0.md#5-user-scenarios). These instructions do not authorize software changes or an audit.

## 1. Choose the starting path

Identify the source and the requested product scope before generating or organizing user scenarios. If the project has no Symbiospec folder, use [Initialize Symbiospec](workflow_initialize.md) within the authorized task; an empty structure supplies no approved product meaning. If Symbiospec already exists, preserve the existing descriptions and approvals. Store project documents using [the user scenario format](format-v3.1.0.md#5-user-scenarios) and the template in section 6, maintaining folder overviews and indexes.

Before generating proposals from any source, apply this scope check: each user scenario describes one person pursuing one specific goal, from a clear starting condition to one observable outcome. Include only the actions necessary to reach that outcome. Put alternative goals, starting conditions and recovery journeys in separate scenario documents. Several necessary actions are allowed; there is no arbitrary click or step limit. Another person's completed work normally belongs in the starting condition or a linked scenario.

Multiple “or”, “if” or “alternatively” branches are a review warning to consider splitting. These words are not banned: a necessary condition or a failure that prevents the same outcome can be recorded without adding another goal. Link a distinct recovery journey instead of expanding the original scenario into several journeys. Preserve unresolved failures rather than inventing recovery.

When splitting supplied material into proposals, map every source goal, condition, action and outcome to a proposed document or an explicit unresolved item. Source approval does not automatically approve a proposed split. For existing approved scenarios, report the scope concern and propose a split under Proposed changes; preserve the approved text until the human authorizes the exact replacement and lifecycle changes in section 4.

### 1.1. Generate from existing Symbiospec

Read the approved concepts, Behaviour and User Interface descriptions in the selected scope, including their approval evidence. Propose goal-oriented journeys with links to the descriptions used; distinguish an inferred journey from an explicit source statement. State examined and unexamined scope, gaps and uncertainty. Ask the human which goals or journeys are missing, then record acceptance, rejection or requested revision using section 3. Source approval never automatically approves a generated user scenario; generation can repeat source omissions and cannot establish complete coverage.

Example: approved descriptions explain opening, editing and saving a Note. Propose “Edit a Note and retain the changes,” linking the descriptions for each action. If save failure recovery is absent, record that gap rather than inventing retry. The human may approve the intended journey while recovery remains undecided.

### 1.2. Generate from existing software

Within the requested scope, inspect source code, tests and permitted application observations to identify what a person appears able to accomplish. Record evidence paths, inspected software revision, and, for any execution, the environment and actual results. Keep source inspection, test inspection, executed tests and application observation distinct. Group technical operations into proposed user goals rather than listing internal functions as user scenarios.

Label every generated user scenario as a proposal. Separate observed or inferred implementation from intended product meaning. Check relevant existing approved Symbiospec descriptions before proposing changes; an implementation difference does not override approved intent. Report inaccessible evidence and unexamined capabilities, and ask the human about missing goals and whether the observed journeys are intended. Do not claim working software from reading code or tests.

After human approval, create or update the supporting Symbiospec descriptions within the approved scope, preserving missing decisions. Then perform section 2's walkthrough using Symbiospec alone. Code evidence belongs in Source or Software verification; code cannot fill a gap in specification review. This bounded discovery does not launch either audit or authorize software corrections.

Example: source code exposes a control that duplicates a Note, but no approved description explains duplication. Propose “Create a separate Note from an existing Note,” linking the control and duplication implementation as inspected evidence. Whether duplication includes attachments remains unresolved unless evidence establishes the current behaviour; whether attachments should be duplicated still needs product authorization. Record Software not exercised if only code was read.

### 1.3. Start with a human-provided batch

Preserve every supplied goal, starting condition, action, outcome and relevant failure or recovery path. Record source and approval scope separately for each user scenario: supplying a batch is not necessarily approval, while an explicit instruction approving the batch is authorization within its stated scope and needs no repeated approval request.

Organize the batch by person and goal. Identify overlaps, shared concepts, dependencies and apparently conflicting expectations. Do not silently merge distinct journeys, drop a supplied user scenario or resolve a product conflict. Preserve the source mapping when suggesting consolidation. Keep one project document per user scenario; a review batch can reference several documents and shared proposed decisions.

For a new project, identify the concepts, Behaviour and User Interface descriptions needed by the batch. For an existing project, link relevant approved descriptions first and identify the missing or conflicting parts. Prepare concrete proposed product decisions with reasons and examples, grouping shared decisions so the human need not answer the same question separately for every user scenario. Ask about information needed to understand the journeys without requiring all supporting descriptions before journey approval.

After the human decides, record the actual approval scope and update supporting descriptions in small coherent increments using section 3. Each user scenario links to the shared definitions rather than copying rules. Perform section 2's walkthrough for the user scenarios being created or reviewed, leaving undecided actions, navigation and recovery explicit. Do not require completing the entire batch or all six specification areas before a useful increment is established.

Example: the human supplies “Create a Note,” “Edit a Note,” and “Recover from a failed save.” Keep three user scenario documents linked to one Note concept and the shared save Behaviour. If the human has not decided whether unsaved text survives failure, present that choice once with its effects on editing and recovery. Journey approval alone does not settle that choice. After authorization, update the shared save description and link the affected user scenario steps.

### 1.4. Combine sources

A human-provided batch may be supplemented by proposals generated from Symbiospec or software. Label the source and approval of each user scenario independently, and identify supplied and generated material within a mixed user scenario. Existing human approval does not approve generated additions. Report missing goals and partial coverage using the relevant starting path above.

## 2. Walk through Symbiospec

When creating or explicitly reviewing a user scenario, first check that the document has one person, one specific goal, a clear starting condition and one observable outcome. Check that every action is necessary for that outcome; identify alternative goals, starting conditions or distinct recovery journeys that need separate documents. Record the scope check and any suggested split without silently rewriting an approved journey. Treat multiple “or”, “if” or “alternatively” branches as warnings to examine, not automatic violations. Then walk through the complete journey using Symbiospec alone. For each step, follow the concept, action, navigation and expected outcome references, including failures and recovery. Record supporting descriptions, missing actions, disconnected navigation, unclear outcomes, contradictions and unresolved product decisions. Link the relevant sections and original approvals; identify the examined specification revision and unreviewed scope.

Do not infer a missing screen or rule from implementation, or invent product choices to make the journey appear supported. A supported journey means only that the examined Symbiospec describes the journey. Record software verification separately, including Software not exercised when appropriate. If a saved coverage examination is needed, follow the existing original examination and summary maintenance procedure and link the examination instead of duplicating the record.

## 3. Design and approve

Present the intended journey and specification findings separately. The human may approve the user scenario with gaps still open. Approval establishes the journey, not every missing screen, action or rule. All user scenarios require human approval, regardless of source.

To resolve a gap, propose a concrete action, expected outcome, reason and affected descriptions. Apply existing authorization where the human already supplied the choice. Otherwise obtain a human decision before adopting new product meaning. Update the responsible Glossary, Behaviour or User Interface descriptions and link the user scenario to those descriptions without copying their rules. Follow [decision maintenance](format-v3.1.0.md#42-decisions) for actual decisions, their sources and approval scope. Approval can cover a user scenario and supporting decisions together only when the human actually authorizes that scope.

## 4. Maintain the approved journey

Apply the [approval, revision and retirement rules](format-v3.1.0.md#53-approval-revision-and-retirement). Put a pending revision in Proposed changes with its motivation, affected descriptions and noticed conflicts. Determine whether the human response requests another proposal, rejects a proposal, or authorizes an exact journey change. Record that response using the existing decision procedure before updating the authorized journey and approval link. Keep document status and Human approval consistent, and retain unresolved proposal scope.

For replacement or retirement, update decision links, affected user scenario references and navigation as required by the format. Check that the retained document still makes the last approved journey and the human decision discoverable.

## 5. Report noticed conflicts

Follow the [review and conflict boundaries](format-v3.1.0.md#54-creation-review-and-conflicts). During rule discussion, report an apparent conflict already noticed by linking the rule and approved user scenario step. State the unresolved choice and leave both approved expectations intact. Report the warning without launching a separate investigation or audit.

## 6. Project document template

Adapt the following template; replace every instruction in angle brackets with actual information or an explicit unknown. For a partly approved document, identify approval at section level.

```markdown
# <User scenario title>

- Created: <actual date>
- Last updated: <actual date>
- Status: <Proposal, Approved, Rejected or Retired; match Human approval>
- Related framing: [User scenarios](README.md)

## 0. Introduction

### 0.1. Purpose

<One person pursuing one specific goal, with one observable outcome.>

## 1. Source

<Human-supplied, generated from Symbiospec, generated from software, or mixed;
 source discussion and links to descriptions or software evidence; inspected
 revision, methods and examined and unexamined scope for generation.>

## 2. Human approval

<Proposal, Approved, Rejected or Retired; precise scope and original decision
 links. Explicitly state when approval has not been given.>

## 3. Journey

<Label a proposal until approved.>

### 3.1. Goal and starting conditions

<One person, one specific goal and a clear starting condition, with links to
 existing concepts. Link separate scenarios for alternative starting conditions.>

### 3.2. Actions and expected outcome

<Only the ordered actions necessary for one observable outcome, with entry
 points and no arbitrary click or step limit, linking supporting
 Behaviour and User Interface descriptions or recording missing descriptions.>

### 3.3. Failure and recovery

<Failures preventing this outcome, supporting references and unresolved
 decisions. Link distinct recovery journeys in separate scenario documents.>

## 4. Proposed changes

<Pending revisions kept separate from the approved journey, or None.>

## 5. Specification review

<One-person and one-goal scope check, starting condition, observable outcome,
 necessary actions and branch warnings, with proposed splits when needed;
 review date; specification revision and paths; steps reviewed; supporting
 descriptions; missing actions or descriptions; disconnected navigation;
 unclear outcomes; conflicts with links to both descriptions; unresolved
 questions and unreviewed scope. State Not reviewed if no review occurred.>

## 6. Software verification

<Actual checks, evidence, software revision, environment and limitations,
 or Software not exercised. Link original examinations when recorded.>
```

See the [fictional design and conflict example](user_scenario_examples.md) for a complete sequence. The example is guidance, not a project decision or execution evidence.

These generation and review instructions do not change stored-document validity or reinterpret existing approvals. Format `3.1.0` remains unchanged; no format publication or project migration is needed under the [versioning rules](versioning.md#1-version-record-and-definitions).
