# Symbiospec format conversion: 3.0.0 and 3.1.0

## 0. Introduction

### 0.1. Scope

Defines a compatible optional addition and its preservation checks. Follow the complete [shared migration procedure](versioning.md#4-prepare-and-apply-migration), including snapshots, interruption marker and atomic version replacement.

## 1. Forward conversion

Read the complete [3.0.0 definition](format-v3.0.0.md) and [3.1.0 definition](format-v3.1.0.md). Inventory and snapshot all project files and affected references under the shared procedure. Format 3.1.0 adds optional `user_scenarios/` documents; no content conversion is required and no user scenario folder, document, approval, decision or examination is created by migration.

If the source already has custom user scenario documents, preserve their bytes and approvals. Do not silently reinterpret custom documents as conforming 3.1.0 user scenarios. Report differences from section 5 and prepare authorized adoption separately before relying on those documents as conforming user scenarios.

Verify every pre-existing content file byte for byte, retaining decisions, coverage, indexes, approvals, and unresolved conditions. There are no obsolete content paths or required content link replacements in this transition. After verification, atomically change only the version field from 3.0.0 to 3.1.0, retaining other metadata. Verify the parsed record, inventory and unchanged content, then remove the interruption marker. An interrupted or failed transition blocks normal work as usual.

## 2. Reverse conversion and limits

On a separate verification copy, reverse conversion changes only the version field to 3.0.0 when no 3.1.0 user scenario documents exist. Verify all other bytes against the source snapshot, including restored version metadata. Never automatically downgrade a project during normal work.

If user scenario documents have been created or adopted under 3.1.0, stop reverse conversion unchanged: 3.0.0 does not define their approval, proposed revisions, review or retirement semantics. Do not delete documents or approval evidence or claim a lossless reverse conversion. Retain 3.1.0 unless the human separately authorizes a preservation plan.

## 3. Verification cases

Exercise a representative 3.0.0 folder containing decisions, coverage, and unresolved content: migrate a separate copy, check identical content bytes, then reverse the copy and compare the complete original inventory and bytes. Confirm no scenario is fabricated. Check that a copy with a 3.1.0 user scenario blocks reverse conversion unchanged. Check that an interruption marker blocks normal work even after version replacement. Report actual checks separately from these instructions; this document is not execution evidence.
