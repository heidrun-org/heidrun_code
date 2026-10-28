# Directory Context: `/data`

## Purpose
The data files that several packages of the repository share: the identity texts of Heidrun Code, the key images, and the sounds.

## Key Exports & Entry Points
- `identity.json`: the title, the motto, and the description of Heidrun Code, with the motto and the description in English and in French. This file is the only place where these three texts are written by hand.
- `images/`: the key images of Heidrun Code. See [docs/marketing/images.md](../docs/marketing/images.md).
- `sounds/`: the sound files that the application plays, one folder for each sound, with the source and the license of the sound in its README.md. The folder `sounds/goat_bleat/` holds the two goat bleats of the About modal, the splash screen, and the empty tab screen.

## Rules
- The application, the website, and the three Markdown files get the title, the motto, and the description from `identity.json`. No other file holds a hand-written copy.
- The application reads `identity.json` through `packages/apps/web_frontend/src/i18n/index.ts`. The website reads it through `packages/auxiliary/website_public/docs/.vitepress/config.ts`. The three Markdown files `README.md`, `AGENTS.md`, and `docs/release_notes/prefix.md` receive it from the command `pnpm docs:identity`.
- A test fails when one of these three Markdown files differs from the output of `pnpm docs:identity`.

## Background
- The single source of truth for the three texts comes from [issue #246](https://github.com/heidrun-org/heidrun/issues/246).
