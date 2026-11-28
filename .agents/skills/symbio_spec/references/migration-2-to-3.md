# Symbiospec coverage storage migration: 2.0.0 and 3.0.0

## 0. Introduction

### 0.1. Scope

Convert between [2.0.0](format-v2.0.0.md) and [3.0.0](format-v3.0.0.md) using the complete [shared preservation and recovery procedure](versioning.md#4-prepare-and-apply-migration). Invocation authorizes documented forward conversion; explicit no-changes instructions take precedence. Earlier projects first complete [1.0.0 to 2.0.0](migration-1-to-2.md). This document is a procedure, not an executable converter or evidence of project migration.

### 0.2. Preservation

Change storage and references only. Preserve product meaning, approval status, uncertainty and historical observations. Stop competing writers, verify snapshots outside Symbiospec including affected external files and local changes, use the interruption marker, and finalize the version atomically only after verification.

## 1. Forward conversion

1. Inventory the complete folder and affected references, verify a restorable snapshot, check destination collisions, and create `.format-migration.md` before changing inputs. Keep version `2.0.0` until verification succeeds.
2. Examine actual `coverage.md` boundaries from scope and evidence, not headings alone. If a rolling account has inseparable observations, retain one legacy examination with explicit date uncertainty and limitations rather than inventing examinations. Stop if classification cannot preserve meaning. Empty files and no-examinations statements create no examination. Record source absence explicitly if the source file is absent.
3. Create `coverage/migration-map.md`: source and target versions, original path or absence, byte length, newline convention, SHA-256 checksum, each examination's byte range (start inclusive, end exclusive), checksum, identity, source order and target path. Preserve usable identifiers; otherwise allocate unique numbers with legacy aliases. Assign history order in source order. Use actual unambiguous dates or `undated/`, never migration dates.
4. Account for every source byte exactly once as an examination block or retained segment, including title, metadata, preamble, gaps and trailing material. Retain segment bytes and positions, using labelled Base64 administrative data when exact encoding cannot be preserved. Preserve meaningful prose visibly in a responsible specification or migration notes with original status, not solely encoded metadata. Map old headings and anchors including duplicate suffixes. Mapping is administrative, not approval or examination evidence.
5. Create coverage and summary overviews and indexes, even for empty input, without fictional examinations. Write each record under target section 4.3 with missing facts labelled `Unknown — not recorded`. Preserve each original block byte for byte in a final `Original record` section with a fence longer than any source fence; record byte length to exclude delimiter newlines. Preserve quoted historical links unchanged and add usable structured evidence links recalculated from the original base location.
6. Build topic routes and summaries from relevant originals, using `unclassified` where uncertain. Preserve examined and unexamined scope, dates, approved scope, evidence, differences, questions and proposed increments. Mark topics `Needs update` first, verify checkpoints and checksums, then mark `Current`. Fresh summaries prove no software compliance.
7. Update root navigation, known repository references and configured consumer locations, including relative and repository-hosted links and anchors. Whole-file links go to `coverage/index.md`; section links go to corresponding records. Record precise before/after edits, before-images and checksums of changed administrative and reference files, all created paths and verified output checksums. Keep the mapping's own checksum externally to avoid self-reference. Report uneditable external links separately. Do not alter unrelated files.
8. Verify the complete target definition, cardinality and source order, unique identities, every original block and retained segment against source bytes, required fields, preserved meaning and uncertainty, topic routes, checkpoints, checksums and links including anchors. Compare every unaffected file byte for byte, including decisions. Remove obsolete `coverage.md` only after replacements and known repository references are verified; verify absence including symbolic links. Retain no redirects or compatibility pages.
9. On a separate copy, exercise exact reverse conversion under section 2.1 and compare the complete recovered inventory and bytes against the snapshot, including external reference files and source absence. A mismatch blocks completion. Exercise [coverage examples](coverage_examples.md), reporting actual observations and limitations.
10. Atomically finalize `3.0.0`, verify again, and remove the interruption marker last. Retain mapping and external recovery evidence. Report actual counts, removed paths, checks and unresolved external links. Failure blocks normal work under shared recovery rules.

## 2. Reverse conversion

Use the same shared snapshots, interruption marker, verification and atomic finalization. Reverse conversion is for verification on a separate copy or explicitly requested restoration, never automatic fallback.

### 2.1. Exact restoration immediately after migration

Require mapping and all generated files, original blocks and reference files to match verified post-migration checksums. Interleave original blocks and retained segments at mapped byte positions to reconstruct `coverage.md`, checking length and checksum; preserve absence when originally absent. Restore changed administrative files and reference edits from verified before-images only after excluding later edits. Remove only migration-created paths matching the output inventory. Restore the source version through shared finalization and compare the complete inventory and bytes with the snapshot. Later edits make this exact path unavailable; never overwrite later work with an older snapshot.

### 2.2. Later edits or new 3.0.0 projects

Format 2.0.0 permits detailed Markdown coverage. Represent each live examination as a section of `coverage.md` in history order, preserving permanent identity, dates and uncertainty, methods, examined and unexamined scope, approval links, revisions, environments, original text, evidence, differences, questions, proposed increments and precise resolution relationships. Use stable explicit anchors such as `examination-000001`. Recalculate usable links while retaining historical quoted text and its original base location.

Preserve independent summary commentary or unresolved facts visibly in labelled coverage sections with original status. Map all incoming repository references and configured consumer paths to replacements. If any extension or relation cannot be represented without changed meaning, identify the exact limitation and stop unchanged. Verify the whole 2.0.0 definition and preservation mapping before removing obsolete `coverage/` entirely. Archive administrative recovery evidence outside the active folder; report uneditable external links without compatibility pages. Atomically finalize `2.0.0` and remove the marker last. Report semantic preservation checks separately; do not claim byte-identical restoration after later edits.
