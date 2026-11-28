# Realign Symbiospec when drift is detected

Run this workflow when requested, or as part of an explicitly authorized recurring review. The skill itself does not schedule future work. A periodic check is useful even when nobody has reported drift.

## 1. Compare without modifying

Identify the approved references and an explicit scope. For software comparison, use [Symbiospec Audit for software compliance](workflow_audit_software_compliance.md), including both comparison directions. Use [Symbiospec Audit for self-consistency](workflow_audit_self_consistency.md) when internal specification review is requested. A request for software comparison does not automatically request both audits. An existing scoped report may supply the findings; repeat comparisons only where changes or missing evidence require further investigation. Read-only comparison does not permit unrequested code or specification corrections.

## 2. Report differences

Follow the [audit and Realignment report conventions](format.md#44-audit-and-realignment-reports) and the selected audit procedure. Report the differences before proposing or applying corrections. An audit-only request ends with findings; it does not authorize the remaining correction steps.

## 3. Review proposed corrections

Prepare correction decisions in batches. Corrections may affect software, Symbiospec, tests, or a combination. Use existing authorization; request decisions only where needed. Defer findings requiring further investigation and return revised product meaning for human review.

## 4. Apply authorized corrections

Preserve approved intent while applying authorized changes. Do not rewrite the specification simply to match a regression, or reinitialize the entire structure to fix a local difference. Keep software compatibility and unrelated documentation intact.

## 5. Verify the result

Repeat the affected comparisons and appropriate implementation checks. Update the report, decisions, indexes, and coverage with resolved and unresolved findings. Report the actual scope verified; no difference found in one area does not prove that the entire software matches Symbiospec.
