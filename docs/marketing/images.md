# The images of Heidrun Code

- Created: 13 October 2026
- Last updated: 17 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../AGENTS.md) and [Marketing of Heidrun Code](README.md)
- Related issue: [issue 337](https://github.com/heidrun-org/heidrun/issues/337) and [issue 509](https://github.com/heidrun-org/heidrun/issues/509)

## The splash image

- The splash image is `data/images/heidrun_splash_screen.png`. It shows the goat Heiðrún on top of Valhalla, pouring mead into a cauldron.
- The website uses a copy of the image in `packages/auxiliary/website_public/docs/public/`.
- Use the splash image on the homepage of the website, below the hero, so the motto stays on one line and Heidrun Code stays in the center.

## The key images

Three images carry the identity of Heidrun Code in every communication. They all live in `data/images`.

- `data/images/heidrun_icon.png` is the icon of the application, a goat head on an orange square. It is a link to `packages/apps/desktop_tauri/icons/icon.png`, so the icon of the application and the icon used for communication are always the same file.
- `data/images/baby_goat.png` is the baby goat with the golden horns, on a transparent background. The application shows it on the screen of a tab without a pane.
- `data/images/heidrun_splash_screen.png` is the splash image, described above.

## The screenshots of the homepage

The screenshots of the homepage are in `packages/auxiliary/website_public/docs/public/screenshots/`. Each one is a real capture of a Heidrun Code window. To make one:

1. Build Heidrun Code from the branch of the change, so that the screenshot shows the newest code. Use `pnpm dev -- -- --no-splash-screen`, or a debug bundle with `pnpm --filter desktop_tauri tauri build --debug --bundles app` when a tool must click in the window.
2. Set up the scene with the `herdr` command line, in the Herdr session of the build (`heidrun_<worktree name>`): `workspace create`, `pane split`, `agent start`, and `agent prompt`. Give each coding agent a short prompt that changes no file.
3. Capture the window alone with `screencapture -x -o -l<window id>`, then crop and resize the capture with `magick ... -strip`.
4. Write the width and the height of the file in `home_content.ts`. The test `tests/home_content.test.ts` checks them.

Rules:

- Never capture the QR code of the Mobile access section of the Settings window: it holds the pairing key.
- Use `pnpm build:development` for a separate Heidrun Code Development application when taking screenshots. Heidrun Code Development has its own application identifier and settings. A plain debug build without the development configuration still uses the installed identity and shares installed settings; restore every setting changed in that build. See [installed and development applications](../architecture/application_installations.md).
- A section without a real capture shows its text alone. Never put a generated image in its place.
