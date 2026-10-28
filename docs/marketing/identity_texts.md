# The title, the motto, and the description

- Created: 13 October 2026
- Last updated: 13 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../AGENTS.md) and [Marketing of Heidrun Code](README.md)
- Related issue: [issue 337](https://github.com/heidrun-org/heidrun/issues/337)

Heidrun Code has three identity texts: the title, the motto, and the description. They are written once, in the file `data/identity.json`, and nowhere else by hand.

- The application and the website get the three texts from this file. The files `README.md`, `AGENTS.md`, and `docs/release_notes/prefix.md` receive them between the markers `<!-- identity:start -->` and `<!-- identity:end -->`. To change a text, change the file, then run `pnpm docs:identity` to update these three files. A test fails when one of them is out of date.
- Write the motto exactly as in the file, with the capital letters of "THE GOAT" and the exclamation mark.
- The motto appears in the splash screen, in the About window, in the hero of the homepage of the website, and in the README.
- The description says what Heidrun Code does, in one short sentence. The jokes stay in the motto and in the other texts.
- "GOAT" has two meanings, and both are intended: the Greatest Of All Time, and the goat Heiðrún of the Norse mythology.
