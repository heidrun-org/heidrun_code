---
name: keep-a-changelog-workflow
description: Create, update, finalize, or validate a repository changelog from pull requests and Git version tags using Keep a Changelog 1.1.0. Use for initial releases, missing releases, corrections, and unreleased changes.
---

# Keep a Changelog Workflow

Maintain a human-readable changelog using [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/). Produce curated descriptions of notable changes, rather than copying commit subjects. This skill operates on the repository changelog, not on Notebook Documents or published release records.

## Repository requirements

Read [README.md](README.md) for the repository requirements and default output location. Use merged pull requests as the primary source of feature and change descriptions, and Git tags to identify version boundaries. Verify that the changes from each pull request are included in the selected range. No special commit-message convention or release tooling is required.

## Select the operation and inputs

Use the operation requested by the developer from the seven operations below. A request to generate a complete history may combine Initialize changelog, Generate initial release, Add release for each missing version, and Update unreleased changes. Validate the result afterward.

Resolve the repository, changelog path, supplied version tags, and target revision before editing. Follow repository rules. Use an existing changelog where present; otherwise default to `CHANGELOG.md` at the repository root. Ask if several changelogs make the target ambiguous. Use the exact supplied tag names, including any `v` prefix; keep the established version heading style.

For a release, identify the preceding version tag from the supplied release sequence. For unreleased changes, use the latest supplied release tag and the current `HEAD` unless another target revision is requested. Do not treat unrelated tags as releases or silently skip a missing tag. If no release sequence is supplied, inspect existing entries and version tags and ask only when the sequence is ambiguous. Before editing, report the selected operation and version range.

## Establish the evidence

Inspect the existing changelog and local changes before writing. Use Git history and differences to understand the actual behavior delivered. Useful read-only commands, with arguments replaced by resolved values, include:

```bash
git status --short
git tag --list
git rev-parse --is-shallow-repository
git rev-parse --verify 'TAG^{commit}'
git merge-base --is-ancestor PREVIOUS_TAG RELEASE_TAG
git log --oneline PREVIOUS_TAG..RELEASE_TAG
git diff --stat PREVIOUS_TAG RELEASE_TAG
git diff PREVIOUS_TAG RELEASE_TAG
```

For the initial release, inspect all commits reachable from the first tag and the tree at that tag; do not select only commits after the root commit. For later releases, use commits reachable from the release tag but not the preceding tag, and compare the two trees. Include changes brought by merged branches, while avoiding duplicate descriptions from merge commits. For unreleased changes, apply the same method from the latest tag to the target revision. Exclude uncommitted changes unless explicitly requested.

Verify history is complete enough for the selected range. Stop generation for missing tags, unavailable history, or tags on incompatible release lines; explain what is missing rather than inventing a range. A maintenance branch needs an explicitly identified preceding release on that branch, not a numerical guess. Any fetch must follow the repository's access rules and preserve existing tags.

Read the merged pull requests associated with the selected range, including descriptions and relevant review discussion. Include a verified pull request link beside each change in the changelog. Read implementation, tests, or release documentation when the pull requests do not establish the final behavior; these sources support the explanation rather than impose extra repository conventions. If a change has no associated pull request, report that gap and use a linked commit as evidence rather than inventing a pull request. Describe established user-visible outcomes; do not infer a feature from an issue title alone. Combine related commits into one useful description, account for reverts, and exclude routine formatting, merges, or internal work without a notable effect. Include breaking changes and migration requirements when supported by evidence. Keep an internal mapping from proposed entries to evidence for the completion report; do not add tool output to the changelog.

### Dates and links

Use an explicit developer-provided release date first, then a documented release date from an authoritative release record. Preserve a valid date already present. If no release date is established, ask for the date or permission to use the tag's commit date as a proxy. Annotated tag creation dates and lightweight tag commit dates do not establish publication dates. Never substitute today's date silently. Practice tags may use commit dates when the developer explicitly accepts that convention.

Derive the public repository address from the configured remote, removing credentials and converting an SSH address if needed. Use the host's actual tag and comparison URL conventions, encoding tag names when needed. Later releases compare the preceding tag with the release tag; the first release links to its tag; Unreleased compares the latest tag with the selected branch or commit. If no public address can be established, keep headings unlinked and report the limitation rather than fabricating links. Mention commit identifiers only as links to remote commits in user-facing text.

## Changelog format

Keep `Unreleased` first and completed releases newest first. Use dated release headings such as `## [0.2.0] - YYYY-MM-DD`, with reference links when available. Group changes under `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, and `Security`, using only relevant nonempty groups. Use year-month-day dates. Preserve existing withdrawal markers such as `[YANKED]`.

For a new file, include the title `# Changelog`, a short purpose statement, the Keep a Changelog 1.1.0 reference, and `## [Unreleased]` (or `## Unreleased` until a link target exists). State adherence to Semantic Versioning only when the repository actually declares that policy; numeric tags alone do not prove adherence. Do not invent a release or change merely to fill a section.

### Release notes before the detailed changes

Every release created, updated, or finalized must begin with `### Release notes`, placed after the version heading and before `### Added`, `### Changed`, or the other change categories. Include release notes for the initial release too. For a nonempty Unreleased section, use the same structure while describing upcoming changes; leave an empty Unreleased section empty.

Start with a short overview of what the version delivers and why the changes matter to the reader. Group larger releases into short paragraphs with descriptive bold topic labels. Use Markdown lists and properly indented supporting points when the information is easier to scan that way. Keep a small release brief; do not force a fixed number of topics or repeat the complete change list in prose.

Explain the outcome in plain language, using only facts established by the detailed entries and their evidence. Keep detailed changes and their pull request links under the standard categories after the release notes. `Release notes` is the narrative introduction, not an additional change category. Preserve an existing useful narrative and reconcile the narrative with the selected version when updating the release.

Keep the changelog ready for its readers. Do not insert notes about practice exercises, local working arrangements, generation steps, or missing hosted tags into release notes. Report verification limitations separately in the completion message and use working evidence links in the file.

Example structure (replace the example text with evidence-backed descriptions):

```markdown
## [0.2.0] - YYYY-MM-DD

### Release notes

A short overview of the main outcome of this release.

**A useful topic label**

A short explanation of the changes and their practical effect.

### Added

- A specific addition, followed by its supporting pull request link.
```

## Preserve existing content

Edit only the selected release or Unreleased section and the link definitions needed by that operation. Keep unrelated sections, introductory text, dates, manual wording, and existing local changes intact. Read the file again immediately before applying an edit if other work may have changed the file.

Compare entries by meaning, not only exact text. Retain a manual description when the description already covers the same change. Add missing facts without replacing the whole section. Without evidence that an entry was generated by this workflow, treat the entry as manual. If an existing claim conflicts with repository evidence, report the conflict and ask for a decision before deleting or materially rewriting that claim. Do not introduce hidden ownership markers into the file.

Repeated runs with the same inputs must not create duplicate sections, duplicate descriptions, or unrelated formatting changes. Never create or move tags, commit, push, publish releases, or change package versions merely because this skill was invoked.

## Operations

### Initialize changelog

Create the file only when absent, using the new-file structure above and an empty Unreleased section. If the file exists, leave the file intact and report that initialization is already complete, or report format differences for a later requested correction. Do not replace an existing changelog with a template.

### Generate initial release

Use the beginning of reachable history through the first supplied release tag. Describe the capabilities and notable changes present in that release, resolving reverted or superseded work. Add the version, established release date, and tag link below Unreleased. If the release already exists, do not append another copy; report that Update release is the applicable operation.

### Add release

Use the preceding release tag and the supplied release tag to generate one missing release. Insert the release in the appropriate position, including when adding historical versions. Update the inserted release's comparison link and an adjacent newer release's link if filling the gap changes that comparison; otherwise preserve existing releases. Update the Unreleased comparison only when the latest release changes. If the release already exists, report that fact rather than duplicating the release.

### Update release

Reconcile one existing release with evidence from its original range, or the complete history through the tag for the initial release. Correct authorized mistakes and add missing notable changes while applying the manual-content rules above. Preserve the release date unless a correction is explicitly requested or confirmed. Do not change other release entries or Unreleased, except a necessary link definition for the selected release.

### Update unreleased changes

Reconcile Unreleased with the changes after the latest supplied release tag through the target revision. Preserve manual wording and combine overlapping descriptions. Identify stale or unsupported entries for a decision rather than silently discarding them. Keep all completed release entries intact and update the Unreleased comparison link. If there are no notable changes, retain an empty Unreleased section without adding filler text.

### Finalize release

Require a supplied version tag and an established release date. Inspect the preceding-tag-to-release-tag range before moving entries: transfer only changes included in that release. Generate any missing descriptions supported by that range. Retain entries for changes after the release tag in Unreleased; leave Unreleased empty when nothing remains. Ask about entries whose membership cannot be established. Add the release heading and links and adjust the Unreleased comparison. If the release already exists, stop without duplicating or merging the release automatically; use Update release for corrections.

### Validate changelog

Read without modifying the file. Check structure, category names, date syntax and valid calendar dates, release order, duplicate versions, overlapping descriptions, heading link definitions, and comparison endpoints. Check that each release has readable Release notes before its detailed categories, and that the narrative agrees with the supported changes. Accept Release notes as the narrative introduction, separate from the standard change categories. Compare the entries with the supplied tag sequence to identify missing versions or unresolved tags. Verify that the recorded date has evidence where available; distinguish an unknown release date from an invalid date.

Separate formatting or reference errors from content questions. Similar descriptions in different releases can be legitimate repeated fixes, so report suspicious overlap for review rather than declaring every repetition an error. Verify link targets with available read-only tools when appropriate; a syntactically plausible address is not proof of a working link. Report inaccessible links as unverified. A structural check alone does not prove that every notable change is covered; inspect the relevant ranges for a content audit and state the coverage actually checked.

## Finish and review

After any write, read the changelog back, inspect the diff, and validate the affected sections and references. Check that unrelated content and manual edits remain intact and that a repeat reconciliation would add nothing. Report the operation, tags or revision range, date sources, changed file, verification performed, and unresolved questions. For Validate changelog, explicitly report that no file was changed.

Example requests:

- Initialize the changelog in this repository.
- Generate the initial release for tag `0.1.0`, using its commit date for this practice exercise.
- Add the missing releases through `0.5.0` using the supplied tag sequence and confirmed dates.
- Update unreleased changes after `0.5.0` through HEAD.
- Finalize release `0.6.0` with the supplied date, keeping later changes in Unreleased.
- Validate the changelog against these five tags without editing the file.
