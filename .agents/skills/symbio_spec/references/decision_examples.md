# Symbiospec decision storage verification examples

## 0. Introduction

### 0.1. Purpose

For contributors checking [format 2.0.0](format-v2.0.0.md) and the [1.0.0 transition](migration-1-to-2.md). Use disposable specification folders; these fictional decisions approve nothing in a real product. This document specifies exercises, not a claim that a particular project was migrated.

### 0.2. Evidence

Report original records examined, files opened, inventories, checksums and actual execution output. Distinguish a procedure exercise from an executable converter or a real project migration.

## 1. Representative history

Create a valid `1.0.0` folder with the six specification areas, overviews, indexes, coverage and version record. Include a permissions specification and a navigation specification. Use these five ordered decisions in the original single history, each with fictional but explicit source evidence:

| History order | Date | Topic | Recorded decision |
| --- | --- | --- | --- |
| 1 | 12 November 2026 | permissions | Accept inherited read access and inherited edit access for child workspaces. |
| 2 | Unknown — not recorded | navigation | Defer navigation ordering until keyboard review; retain the unresolved condition. |
| 3 | 13 November 2026 | permissions | Accept removal of inherited edit access only; replace that part of decision 1, preserving inherited read access. |
| 4 | 14 November 2026 | navigation, permissions | Approve showing only readable workspaces in navigation; defer any change to editing permissions. |
| 5 | 14 November 2026 | permissions | Reject automatic editing access for guests. |

Make scope, sources, approval evidence and affected references explicit, without treating a deferral, partial approval, or rejection as general approval. Add a preamble, uneven heading levels, two decisions on the same date, one legacy alias, inter-record notes, a condition after a nested heading, and a trailing note. Include a relative approval link, an old heading anchor referenced by the specification and an external repository file, and an unaffected file with local changes. Include an uneditable external bookmark to the old history in a separate fixture outside the repository. Keep that bookmark unchanged and report its broken destination as a limitation after removal; do not retain a page to serve it. Include a separate empty-history case. Exercise both LF and CRLF line endings and a final block with no terminal newline.

## 2. Retrieve relevant evidence

After conversion, use the following reading paths, recording actual files opened:

- Changing inherited editing: read the affected permissions specification, decision index and permissions summary, then original decisions 1 and 3. Explain the exact partial replacement; read decision 5 if guest access is in scope. Do not read unrelated navigation ordering evidence.
- Explaining current navigation visibility approval: read the navigation specification, decision index and navigation summary, then decision 4. Check its limited approval and its permissions cross-topic route.
- Explaining an earlier rule: follow the permissions summary's links to decisions 1 and 3. The original decision 1 must still show the original approval, while the summary identifies the replaced portion.
- Finding an unresolved condition: read the navigation summary and original undated decision 2; confirm the keyboard review condition and unknown date. Decision 4 does not resolve the deferred ordering decision.

The date folders bound directory listings and date-specific reviews; topic summaries supply feature discovery. Compare the same retrieval paths with a flat folder candidate, recording directory-list sizes and maintenance steps rather than claiming timing improvements from intuition. The dated structure was selected by the human for issue 96; the exercise checks its usefulness and limits without inventing a benchmark result.

## 3. Maintain without rereading the complete history

Add decision 6 accepting a particular navigation ordering after the keyboard review, with actual exercise evidence and a link to decision 2. Mark navigation `Needs update` before writing. Read the navigation summary, decision 2 and the relevant navigation records; update the navigation specification, affected indexes, checkpoint, original-record checksums and summary. Mark navigation `Current` last. Verify that the permissions summary and unrelated original records remain byte-identical and that the deferred condition is resolved only within the new decision's scope.

Interrupt once before refreshing the summary. A checkpoint mismatch or `Needs update` must make the stale summary detectable. A correction to an earlier original record must also be detectable through its checksum even if the topic's latest history order is unchanged. Missing topic routes, missing original files and unclassified decisions must produce explicit gaps, not a false claim of complete approval. Demonstrate that a cross-topic decision updates both routes. Record filenames inspected to show that maintenance did not read the complete history.

## 4. Migration, reverse conversion and failure cases

Follow the production transition on a disposable copy of section 1's history. Verify one output record per source decision, original byte ranges covering the complete source, sequence independent of dates, preserved aliases, exact original-block checksums, all non-decision text, correct `undated/` placement, approval and replacement semantics, summary freshness, updated references and unchanged unrelated local files. Verify that the old `decisions.md` path is completely absent, not a symbolic link, redirect, compatibility page or navigation-only file. Verify every known repository reference against the new paths and anchors, while preserving quoted original text and administrative mapping evidence without treating their historical paths as live links. Confirm that the uneditable external bookmark is reported as a limitation and does not prevent removing the old path. Verify an empty history without fabricated decisions or an obsolete history file.

Immediately reverse on a separate copy and compare every recovered path and byte against the complete original snapshot, including the updated reference file elsewhere in the repository. The uneditable external bookmark remains unchanged throughout; no old-path page is restored in the active migrated fixture. Reverse conversion restores the source history only on the separate verification copy. Do not equate matching record counts with complete preservation. After adding decision 6, demonstrate that exact restoration refuses to overwrite later work; exercise the normalized reverse conversion, preserving all six records, partial approval, rejection and deferral history, conditions, evidence links and current topic meaning.

Reject duplicate decision numbers, ambiguous decision boundaries, colliding destinations, corrupted original blocks and unrepresentable custom content without completing a conversion. Stop rather than discard data. Interrupt before output completion and after version replacement; the migration marker must still block normal work. Verify recovery against the complete source snapshot, retaining unrelated edits and removing the marker last. Use the shared [versioning examples](versioning_examples.md) for malformed records and unsupported versions.

## 5. Completion record

Record the actual checks and results for retrieval, incremental maintenance, exact reverse restoration, normalized reverse conversion, refused cases and interruption recovery separately. State any missing evidence. Document checks alone do not prove real-project usability, human approval or migration of an installed project.


### 5.1. Implementation exercise for issue 96

On 14 November 2026, a temporary Python procedure exercise constructed five explicitly mapped fictional source decisions, generated separate records and summaries, and checked both LF and CRLF source bytes. The inherited-editing lookup opened the permissions specification, decision index, permissions summary and original decisions 1 and 3. The unknown-date navigation record was not opened for that lookup. The exercise added a sixth navigation decision and checked that the permissions summary remained byte-identical; it also detected a checksum change to an older navigation record without advancing the latest history order.

The exercised immediate reverse reconstruction matched the original history bytes and complete source file inventory. The exercise also assembled all six records for normalized reverse representation and checked retained decision text, conditions and numbering. A follow-up disposable conversion wrote the six-record single history, rewrote evidence links and incoming approval anchors, removed the decision folder, and checked 38 links for each line-ending variant. Unrelated local file bytes remained unchanged. Interruption checks confirmed marker presence at both source and target version stages; they did not execute an installed skill reader. Recovery equality used the verified source copy. Boundary selection was explicit, not an automatic parser. Empty-history verification covered preservation of non-decision bytes, not an end-to-end empty-folder migration. Duplicate identifiers, ambiguous boundaries and custom-content refusals above remain specified manual checks, not executed converter tests.

Actual terminal output included:

```text
PASS: 314 assertions.
LIMITS: hand-mapped representative procedure exercise; not an installed converter, live project migration, or human review.
LF: normalized reverse: 6 records, evidence links and approval anchors preserved, 38 links checked; unrelated local bytes unchanged.
CRLF: normalized reverse: 6 records, evidence links and approval anchors preserved, 38 links checked; unrelated local bytes unchanged.
```

The temporary exercise is verification evidence for the instructions, not a shipped migration tool. No receiving project was migrated. Use the exercises above to verify any real conversion against that project's actual source data.


### 5.2. Obsolete-path removal exercise for issue 105

On 15 November 2026, a disposable procedure exercise converted the five-decision fictional history with LF and CRLF source bytes. Both variants removed the old history completely, updated and resolved a known repository reference outside the Symbiospec folder, preserved the fictional uneditable external bookmark unchanged, and recorded the obsolete external destination as a limitation. The old path was not retained for that bookmark. Negative completion checks detected both a deliberately reintroduced navigation-only page and a dangling symbolic link at the old history path; both were removed from the disposable migrated fixture.

Original decision block checksums, order, approval and condition text, unrelated local bytes, and exact reverse restoration on a separate copy still passed. The migrated fixture remained without the obsolete path during reverse verification. The external bookmark was fictional, and source decision boundaries were explicitly mapped rather than automatically inferred. No receiving project was changed, and this was not an independent agent run or a shipped converter test.

Actual output included:

```text
LF: obsolete history absent; known repository reference resolves; uneditable external bookmark reported; old-path page and dangling symlink detected; original blocks and exact reverse restoration checked
CRLF: obsolete history absent; known repository reference resolves; uneditable external bookmark reported; old-path page and dangling symlink detected; original blocks and exact reverse restoration checked
PASS: 334 assertions.
```
