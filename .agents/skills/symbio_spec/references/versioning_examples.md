# Symbiospec versioning verification examples

## 1. Purpose and limits

For contributors checking the [versioning and migration procedure](versioning.md). Use disposable copies of specification files for these exercises. Published Symbiospec formats are `1.0.0`, `2.0.0` and `3.0.0`; see [decision storage examples](decision_examples.md) for the production transition. Exercise layouts A, B, and C are illustrative layouts, not additional published versions or proposals for future storage.

Include the six specification areas, two ordered decision records with sources, dates, scope and an unresolved condition, coverage, a glossary topic, a behaviour topic, and relative references. Compare file inventories, content, and references using the tools available in the receiving environment. These examples require no particular programming language or executable migration tool.

## 2. Adoption and detection

For each entry point (`symbio_spec`, `symbio_spec_to_docs`, and `symbio_spec_to_ux`), begin with one unversioned fixture and one explicit `1.0.0` fixture. Use an ordinary invocation, such as an audit, documentation generation with a complete configuration, or an interface proposal. Do not include an extra migration instruction. Read the entry point and shared procedure, report the source and latest installed target, then carry out the documented adoption and forward migration before permitting the requested normal work. Keep fixtures separate; one successful entry point does not demonstrate the other two.

For an unversioned folder, verify the full path: effective `1.0.0`, metadata-only adoption with every existing path and byte unchanged, then the production decision storage migration to the latest target. Verify preservation of ordered decisions, sources, partial approval, conditions and references. Exact reverse verification uses a separate copy; it does not downgrade the project used for normal work. Adding only the version record must not count as completion. Refer to [decision storage examples](decision_examples.md) for representative conversion evidence.

Use this outcome matrix for every entry point:

| Initial state | Required outcome before normal work |
| --- | --- |
| Unversioned | Adopt `1.0.0`, verify existing bytes, then automatically migrate to the latest registered target. |
| Explicit `1.0.0` | Automatically migrate, even though the source definition is retained and readable. |
| Latest published format | Proceed without migration or metadata rewrites; compare the format-check inventory before and after. |
| Older format plus explicit instruction forbidding changes | Leave every path and byte unchanged, report the conflict, and stop dependent work. |
| Unknown, newer, malformed or unreadable version | Stop without mutation or guessing; report source, target and exact problem. |
| Missing definition or forward conversion | Stop without mutation, including adoption, rather than partially preparing an unavailable path. |
| Failed or interrupted conversion | Keep the interruption marker and recovery evidence; do not begin normal work on either partially written output or the older source. |

Reject a missing component, a leading zero, a release suffix, duplicate version fields, and an empty field. Reject unknown `1.1.0` and `4.0.0` without mutation. An absent folder requires authorized initialization; a request to inspect an absent folder must not create a specification. Installation that only copies skill files makes no project-data changes and defers the check to first use. Select future targets from the registry's ordered published list; do not assume the current `3.1.0` is permanently latest.

## 3. Consecutive migration and preservation

Exercise A to B moves the coverage file and updates its index reference. Exercise B to C moves the glossary topic and updates its index and incoming behaviour reference. For each step, take and verify a complete snapshot, write the migration record before changes, compare the complete resulting inventory, check moved file bytes and updated references, and compare all unaffected files byte for byte. Decision records must remain identical, preserving ordering, approval sources, affected references, dates and unresolved conditions.

Before completing each step, reverse the conversion on a separate copy and compare the recovered inventory and bytes with that step's snapshot. Check that the migration record continues to block normal work after a version-record replacement, and remove the migration record last. Do not present the changed exercise layouts as valid production `1.0.0` data or publish fictional versions to perform the exercise.

For the reverse-conversion limitation, add a field explicitly declared unrepresentable in the earlier exercise layout. Refuse reverse conversion and compare the whole inventory to prove that refusal discarded nothing. A real conversion must document the actual unrepresentable fields in its published instructions.

## 4. Interruption and recovery

Take a verified snapshot, write a migration record, and leave a partially overwritten decision file. Detection must block normal work. Preserve the interrupted state separately, restore the complete source snapshot while retaining the migration record, and compare every restored path and byte before removing the record. Also identify any unrelated edits before restoration; never overwrite those edits with a backup.

## 5. Verification record

Report the actual actions, tools, output, and limitations for each exercise. Separate successful adoption, rejected records, consecutive conversions, reverse-conversion limitations, and interruption recovery. Include the inventory comparison and reference checks supporting each result.

Inspect entry-point declarations, links, and retained definitions. File equality alone cannot establish preserved product meaning when a conversion changes content. A procedure exercise does not establish a real project migration or human acceptance.


### 5.1. Issue 103 verification record

On 14 November 2026, the assistant read each changed entry point and exercised the shared conversion procedure on six separate disposable fixtures: unversioned and explicit `1.0.0` data for each of `symbio_spec`, `symbio_spec_to_docs`, and `symbio_spec_to_ux`. The entry points supplied format-migration authorization; no separate migration approval was requested. Each fixture held five fictional decisions with source evidence, an unknown date, partial replacement, rejection, deferral and unresolved conditions. The unversioned cases added only the version record during adoption and verified all earlier bytes before conversion. The source blocks, ordered identities, references and unrelated local bytes were checked, and exact reverse restoration ran on separate copies. No receiving project was migrated.

A further file-state exercise for each entry point inspected current, unknown/newer, malformed, explicit no-changes, and interrupted examples without writing migration or normal-work outputs. Current-format inventories and the stopped-state inventories remained unchanged. Entry-point and shared-procedure inspection established that normal work is permitted only at the latest registered format, that conversion is automatic, and that explicit no-changes instructions block dependent work. Missing paths, unreadable files and full recovery behavior remain requirements above rather than additional executed agent tests in this exercise.

Actual conversion-exercise output included:

```text
PASS: 944 assertions.
LIMITS: assistant-executed procedure exercises reading each changed entry point; not independent agent invocations or a shipped converter. Normal audit/generation/proposal work not executed.
```

These are Markdown instructions followed by a coding agent, not an application with an executable format-check function. The temporary scripts exercised file conversion and preservation and checked instruction declarations; they do not prove that a separately invoked agent will always follow every instruction. Keep that distinction in completion reports. Review the automatic rule itself as well as the exercised data-preservation results.
