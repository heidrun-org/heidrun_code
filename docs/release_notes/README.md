# Release notes

- Created: 13 October 2026
- Last updated: 23 October 2026
- Status: Maintained overview for people
- Related framing: [Project instructions](../../AGENTS.md)
- Related issue: [issue 337](https://github.com/heidrun-org/heidrun/issues/337), [issue 832](https://github.com/heidrun-org/heidrun/issues/832)

This folder holds the text of the GitHub releases of Heidrun.

The file `prefix.md` is the start of the text of every release, and it is the same for every release. The release script `scripts/release_dmg.ts` reads it. The command `pnpm docs:identity` writes the description of Heidrun in it, so the file `prefix.md` has no metadata header. A notes file for one version, for example `v0.3.0.md`, goes in this folder too. It has a heading for each topic, and a short bullet for each feature under the heading. The steps to write it are in the file `HOW_TO_RELEASE.md`.
