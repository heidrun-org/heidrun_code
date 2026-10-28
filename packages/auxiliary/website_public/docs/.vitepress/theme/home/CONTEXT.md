# Directory Context: `/packages/auxiliary/website_public/docs/.vitepress/theme/home`

## Purpose
The sections of the homepage of the public website, under the hero: the problem, the window, the four main features, the other parts of Heidrun Code, the quick start, the open source project, the mythology, and the last call "Skål!".

## Key Exports & Entry Points
- `home_content.ts`: every text, link, and screenshot of the sections. Change a text here, never in a component.
- `home_*.vue`: one component for each kind of section. `../index.ts` registers them, and `docs/index.md` places them in order.
- `home_feature.vue`: the component `HomeFeature`, which shows one entry of the list `FEATURES` of `home_content.ts`, chosen by its property `section-id`.
- `home_hero_note.vue`: the line under the buttons of the hero, put in the slot `home-hero-actions-after` by `../index.ts`.
- `home.css`: the tokens (`--home-accent`, `--home-font-display`) and the shared classes (`home-section`, `home-title`, `home-paragraph`, `home-joke`, `home-shot`, `home-button`).
- Command to test this folder: `pnpm --filter website_public test`

## Rules
- The texts use the words of the glossary (`docs/agents_rules/glossary`): "coding agent" in full, and the full name of each sidebar section. The test `tests/home_content.test.ts` fails on "agent" alone.
- The title, the motto, and the description of Heidrun Code come from `data/identity.json`, through the hero. No text of this folder repeats them.
- Each section first says what Heidrun Code does, then makes one joke, as `docs/marketing/jokes.md` asks.
- A screenshot is a real capture of the Heidrun Code window, saved in `docs/public/screenshots/`, never a generated image. The width and the height in `home_content.ts` equal the size of the file. A feature section without a real capture has no screenshot and shows its text alone. How to make a capture is in `docs/marketing/images.md`.
- The terminals of the section "Five coding agents. Five terminals. One goat." are an illustration of the problem, and their caption says so. They never imitate the Heidrun Code window.
- The colors of the states of a coding agent (blocked, question, working, done) are the colors of the application, in `packages/apps/web_frontend/src/styles.css`.
- Motion stays on the blocked dots of the illustration and on the outline of the window, and stops when the browser asks for reduced motion.

## Background
- The homepage came from [issue #509](https://github.com/heidrun-org/heidrun/issues/509). The plan of the sections is in the body of that issue.
