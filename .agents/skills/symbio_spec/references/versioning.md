# Symbiospec format versioning and migration

## 0. Introduction

### 0.1. Identify the format

Use one Markdown record for the whole folder and one retained definition per published version.

### 0.2. Require the latest format

Detect the project format and automatically migrate older data to the latest published format before normal work. Reject malformed or unknown versions and interrupted migrations.

### 0.3. Convert and recover

Apply consecutive migrations as part of invoking the skill, with preservation checks, verified completion, and recovery evidence. An explicit instruction forbidding changes blocks migration and dependent work.

## 1. Version record and definitions

One version covers the complete `docs/symbio_spec/` folder: structure, file formats, and conventions. Decision storage has no separate version. The format version is independent of the installed skill's release version.

Store the version at `docs/symbio_spec/format-version.md`:

```markdown
# Symbiospec format version

- Format version: 3.1.0
```

Apply the receiving repository's document header conventions when required. The title must be `Symbiospec format version`. Require exactly one field line of the form `- Format version: MAJOR.MINOR.PATCH`, outside code blocks. Each component is a non-negative decimal integer with no leading zeros except `0`. Accept published versions only; release suffixes and build metadata are not used. Missing, duplicate, conflicting, or invalid fields in an existing record are malformed, not an unversioned folder. An unreadable record is an error, not an absent record. Dates and other document metadata do not approve product content.

The [format registry](format.md) lists published versions in transition order and links one complete reference per version. Each future reference defines the entire format and links its forward conversion from the preceding published version, reverse conversion, limitations, and verification. Definitions and migration instructions must be available in the installed skill without network access. Never invent an unpublished definition or migration path.

Use Semantic Versioning, written `MAJOR.MINOR.PATCH`:

| Component | Meaning for Symbiospec |
| --- | --- |
| Major | An incompatible change requiring migration, such as changing required locations or replacing a storage structure. |
| Minor | A compatible addition, such as an optional file. Every previously valid folder remains valid without adding the optional content. |
| Patch | A correction or clarification that changes neither folder validity nor interpretation of existing content. |

A new requirement that invalidates an existing valid folder requires a major version. Retain published definitions; publish corrected definitions under a new patch version. A compatible transition may change only the version record; say explicitly when no content conversion is needed.

## 2. Check before normal work

Every Symbiospec skill follows this procedure before normal work, including workflows that otherwise only read specifications. `symbio_spec`, `symbio_spec_to_docs`, and `symbio_spec_to_ux` use the latest published format in the installed [registry](format.md): the last entry in its ordered transition list, currently `3.1.0`. Older retained definitions, including `3.0.0`, `2.0.0`, `1.0.0` and its unversioned equivalent, are supported as migration sources, not as formats for normal work. Select the target from the registry each time; do not hard-code `3.1.0` as the permanent target. A newer installed release updates the registry, definitions, transitions and entry-point declarations together. Missing definitions, transitions or inconsistent declarations block work; never invent a path or infer compatibility from a version number.

Invoking any of these skills authorizes the documented format adoption and forward migrations needed to reach that target, without separate migration approval. Announce the source, target and conversion steps, then complete the shared preservation procedure before the requested workflow. This authorization covers storage conversion and necessary reference updates, not changes to approved product meaning, application implementation, documentation audience, or publication. An audit, documentation request or interface proposal does not exempt older data from migration. An explicit instruction such as "do not change files" or "do not migrate" overrides this default: if conversion is needed, report the conflict and stop dependent normal work without modifying data or silently using the older format.

At the beginning of setup and before any normal initialization, update, audit, Realignment, documentation generation, or interface proposal:

1. Read repository instructions. Check for `docs/symbio_spec/.format-migration.md` before consuming specification content. If present or unreadable, stop normal work and report an incomplete migration. Read only what is needed to diagnose or recover the migration under section 5.
2. If the Symbiospec folder does not exist, report that initialization is needed; create the expected format and version record only within authorized initialization. A read-only request does not authorize initialization.
3. If the folder exists but `format-version.md` is absent, report `unversioned (effective format 1.0.0)`. Plan the complete path to the latest target before writing. If the path is available and changes are not explicitly forbidden, perform section 3's metadata-only adoption, verify the unchanged existing files, then continue directly through the required migrations. Adoption alone does not satisfy readiness. Do not require an extra format-recognition investigation to assign this source version.
4. Otherwise parse the record using section 1. Stop on a malformed or unreadable record without modifying project data. Report the problem and the expected format; do not replace the record with a guess.
5. Compare the project version with the latest target from the installed registry. If the versions match, proceed using that complete definition without rewriting metadata or migrating again. If the project is an older registered migration source, complete every published forward transition automatically under section 4 before normal work, even if the old format is compatible or previously supported. This includes a version-record-only transition when the published instructions require no content conversion.
6. If the project version is unknown, newer than the installed target, or has no complete reliable forward path, report the source, target and exact missing definition or conversion. Stop dependent work without mutation or downgrade. An explicit no-changes instruction likewise leaves the source unchanged and blocks dependent work when conversion is needed. Failed or interrupted conversion never permits fallback to normal work on the older format.
7. After adoption and each migration step, verify the saved format and preservation checks. Before beginning the requested workflow, confirm the project now uses the latest target, all required references are updated, and no interruption marker remains. Report source and target versions, completed steps, actual verification and unresolved blockers. Current installed skill files alone do not establish that project data is ready.

Installation that only copies skill files performs no project mutation. Run this check on first project use. Companion skills use their actual installed `symbio_spec` location; if its definitions or shared procedure are unavailable, stop rather than proceeding with another format.

## 3. Unversioned adoption

Explain that the existing unversioned format is `1.0.0` and add the Markdown record automatically as the first verified step toward the latest target. Invocation supplies adoption authorization even for an audit or another workflow that otherwise only reads specifications. Do not request separate approval or continue normal work using the unversioned equivalent. If an explicit user instruction forbids changes, or the complete forward path is unavailable, leave files unchanged and stop dependent work with the precise reason.

Inventory every existing file and its bytes, including decision history, approval evidence, coverage, indexes, and any local changes. Add only `format-version.md`, following document metadata conventions. Verify that every pre-existing path and its bytes are unchanged and that the new record parses as supported `1.0.0`. No approval of product meaning or completeness follows from adoption.

This metadata-only adoption deliberately does not edit an existing index. During subsequent authorized normal maintenance, include the version record in navigation under the ordinary format rules. New initialization includes the record in its initial index. Removing the record reverses adoption only while the data still uses `1.0.0`, with the same unchanged-file verification; removing a record from a later format is never a migration back to version 1.

## 4. Prepare and apply migration

Invocation supplies authorization for the documented forward path to the latest published installed format. Present the source, target, ordered steps, affected files and references, preservation checks, reverse limitations and recovery plan as a progress update, then perform the migration without a separate approval request. Explicit instructions forbidding changes take precedence. If the required path, preservation checks or permissions are unavailable, stop dependent work and report the exact blocker rather than skipping conversion or weakening checks. This automatic policy never authorizes a guessed conversion or changed product meaning.

Follow the published transitions consecutively. Normal skill use always moves forward to the latest target. Reverse conversion is used only for verification on a separate copy or explicitly requested restoration, never as an automatic fallback; a later normal invocation again requires the latest format. For example, reaching a third published format from the first requires the first-to-second step and then the second-to-third step, each verified separately. Do not skip intermediate definitions. The first publication has no earlier version to convert; unversioned adoption is section 3.

A completed migration removes every obsolete source path after verifying its replacement and updating known repository references. Do not leave redirects, compatibility pages or duplicate navigation at obsolete paths, even when external links cannot be updated. Report those external links as limitations; unknown external links do not justify retaining obsolete files. Preserve source bytes, approvals, sequence and recovery evidence through the verified snapshots and migration mapping, not backward compatibility in active documentation. Apply the same rule when completing an interrupted migration.

For each step:

1. Read both full format definitions and the specific forward or reverse instructions. Identify the complete input and output file inventory, moved files, updated references (including known references outside the folder), and fields requiring preservation. Preserve ordering, scope, dates, sources, approval evidence, unresolved conditions, and the distinction between proposal and approval. Report external references that cannot be updated or checked.
2. Stop competing writers and retain unrelated local changes. Take a complete restorable snapshot of the folder outside the Symbiospec folder, plus any affected external files, and verify the snapshot against the original paths and bytes. Do not rely on a clean Git state or committed content as the only backup. Retain a separate verified snapshot for each step.
3. Before changing any input, create `.format-migration.md` in the Symbiospec folder. Record source and target versions, direction, the published conversion instructions, backup location, original inventory and checksums, affected external paths, and verification needed. Do not include this temporary administrative record as product specification content. If another record already exists, stop for recovery. If this record cannot be written reliably, do not begin conversion.
4. Apply only the defined changes. Keep the old version record until verification succeeds. Use temporary output files where useful and do not discard original records during conversion. Do not leave two competing authoritative histories in a completed format. Once replacements and known repository references are verified, remove obsolete source files and navigation, including non-authoritative compatibility pages or redirects; record the removed paths.
5. Verify the whole folder against the target definition, the complete input/output mapping, and the preservation requirements. Check for omissions, duplicates, changed meaning, broken links, lost approvals, and unrelated changes. Compare untouched files byte for byte. Verify that obsolete paths are absent, including symbolic links, and that known repository links resolve to the new paths. Report uneditable or unknown external references separately; do not treat those references as verified or keep obsolete files for them. For a reversible conversion, exercise the reverse conversion on a separate copy and compare the recovered data with the source snapshot. Stop on any failure; the migration record continues to block normal work.
6. After verification, prepare the target version record in a temporary file on the same filesystem and replace `format-version.md` with a single rename. Verify the saved version and final folder again. Remove temporary outputs and `.format-migration.md` only after all checks succeed. A failure or interruption before removal still blocks normal work, even if the version record already names the target.
7. Report the completed step, actual checks and output, unchanged content, and limitations. Keep recovery evidence available until completion is accepted. Start the next step only after this step is complete.

A reverse conversion is permitted only where the earlier format can represent the data. If conversion would lose information, identify the exact affected data and stop the reverse conversion unchanged. Do not silently discard data or invent a lossless path. Obtaining a newer compatible skill or retaining the current format may be necessary.

## 5. Interrupted migration and recovery

The presence of `.format-migration.md` is the interruption signal, regardless of the version record's value. A malformed migration record also blocks work. Never clear the signal merely because some output files or the target version exist.

Read the migration record, source snapshot, current files, and conversion instructions. Preserve the interrupted state separately. Identify any edits made since conversion began; never overwrite unrelated edits with a backup. If the state or preservation cannot be established, stop and explain what is needed.

Invocation includes recovery of its documented format migration when the preserved state and recovery path are reliable and changes are not explicitly forbidden. Announce recovery, then either resume the documented step and run all target verification, or restore the complete source snapshot and affected external files. Unknown state or unrelated edits that cannot be safely retained block recovery. Restoring an older source does not permit normal work until the required forward migration has succeeded. Verify restoration against the source inventory and bytes, including the source version record or its original absence. Remove the migration record only after verified completion or restoration. Report the outcome before normal work or another migration starts.

See [worked verification examples](versioning_examples.md) for adoption, rejected records, sequential conversions, reverse limitations, and interruption recovery. The examples are isolated exercises, not additional published formats or a migration tool.
