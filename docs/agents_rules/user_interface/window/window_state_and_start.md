# User interface of Heidrun Code: state of the window, splash screen, missing programs, and goat sounds

- Created: 13 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md)

This file is a part of the rules of the user interface of Heidrun Code. The words are defined in [glossary/index.md](../../glossary/index.md).

## Installed and development applications

- `pnpm dev` launches Heidrun Code Development with a separate application identifier, visible window title, settings, window state, data folder, and Herdr session. `pnpm build:development` builds the same development identity as a standalone application, including an optimised build. The commands and resource boundaries are in [application_installations.md](../../../architecture/application_installations.md).
- Development startup never runs the installed data or Claude Code legacy migrations, never refreshes the globally installed Claude Code status-line script, and cannot replace that script through the status-line controls.

## Position and size of the window

- When Heidrun Code quits, it saves the position and the size of the window, and whether the window was maximized or full screen. The window-state plugin of Tauri does this work, and keeps the file `.window-state.json` in the configuration folder of the application.
- At the next start, the window opens with the saved position, the saved size, and the saved maximized or full screen state.
- At the first start, no state is saved, and the window opens in the middle of the screen with the size in `tauri.conf.json`.
- When the saved position is outside every screen that is connected, the window opens at the default position of the operating system, on a connected screen.
- The visible state is never restored. The window stays hidden until the splash image is ready.

## Last state of each option

- Every option keeps its last state between two runs of Heidrun Code. An option is a toggle, a choice between a few values, a sidebar section that is shown, a panel that is open or closed, or a size.
- The last state of each option is saved in the `localStorage` of the web frontend, in the store `packages/apps/web_frontend/src/stores/settings.ts`, under the key `heidrun.settings`. A new option is a new line in `defaults` of this store, and not a new key.
- The web view keeps the `localStorage` in a folder named after the application identifier, so a change of the identifier shows an empty `localStorage` and every option returns to its default value ([issue 772](https://github.com/heidrun-org/heidrun/issues/772)). The data folder of Heidrun Code does not depend on the identifier, so the web frontend keeps a copy of every `localStorage` entry whose key starts with `heidrun.` in the file `local_storage.json` of the data folder (`packages/apps/web_frontend/src/lib/durable_storage.ts` and `packages/apps/desktop_tauri/src/durable_storage.rs`). Installed Heidrun Code and Heidrun Code Development have separate data folders, so they have separate copies.
- `src/main.ts` restores before any store is imported, because a store reads its saved state when its file is imported: it adds each entry of the copy that the `localStorage` lacks, and never replaces an entry that the `localStorage` holds. Then it migrates the former key names, loads the application, and starts the copy, which writes the file again after each change, at most once every 300 milliseconds.
- When the file `local_storage.json` does not exist yet, installed Heidrun Code reads the entries from the web view storage of the former identifier `dev.edefiez.herdrdesk` (Heidrun Code 0.2.7 and older), in the folder `~/Library/WebKit/dev.edefiez.herdrdesk`, with the program `/usr/bin/sqlite3` on a copy of the files (`packages/apps/desktop_tauri/src/former_web_view_storage.rs`). Heidrun Code Development never reads it. To reset every option, delete the file `local_storage.json` as well as the web view storage.
- At the start, each option reads its saved state. An option with no saved state, or with a corrupted saved value (the wrong type, or a value that is not in the list of its values), uses its default value.
- A text that the user types, a search text for example, is not an option and is not saved. A mode that edits data, for example the edit mode of the budgets in the window History, is not an option and is not saved.

## Splash screen

- At the start, Heidrun Code shows the splash screen for 3 seconds after the main window appears. A click on the splash screen closes it at once.
- The splash screen has a sound button at its bottom right corner. A click on the sound button plays a goat bleat when the setting "Enable goat sound" is on, and does not close the splash screen. See the section "Goat sounds".
- The command line option `--no-splash-screen` starts Heidrun Code without the splash screen. The main window then appears at once, and shows the application.
- A program that drives Heidrun Code, for example to take a screenshot, uses this option, so that it never waits for the splash screen to close. In development, run `pnpm dev -- -- --no-splash-screen`: the command `tauri dev` gives the arguments after its second `--` to the application, and the arguments after its first `--` to `cargo`. For the built application on macOS, run `open -a Heidrun Code --args --no-splash-screen` while Heidrun Code is not running.

## Missing programs

Heidrun Code installs no program of another maker ([issue 546](https://github.com/heidrun-org/heidrun/issues/546)). The end user installs Herdr, which is required, and ngrok, which is optional and only for the mobile access.

- At the start, the command `required_programs_status` of [required_programs.rs](../../../../packages/apps/desktop_tauri/src/required_programs.rs) tests that each program is on the computer. It tests only that the program exists, not its version.
- When a program is missing, the notice of the missing programs ([MissingProgramsModal.vue](../../../../packages/apps/web_frontend/src/components/MissingProgramsModal.vue)) shows under the splash screen, so the end user sees it when the splash screen closes. The notice names each missing program, says if it is required or optional, and gives its install command.
- The button "Continue" closes the notice, and the end user goes into the main window. When Herdr is missing, the main window shows the Offline screen.
- The test also reads the version of Herdr with `herdr --version`. A Herdr older than 0.9 is named in the notice like a missing Herdr, with a text that asks for an update. When the output has no version that Heidrun Code can read, Herdr is not called too old.
- The notice names a missing Herdr, or a Herdr older than 0.9, at every start, and a missing ngrok only once. After that, the Mobile access section of the Settings window keeps the reminder of a missing ngrok, and says that the mobile access is impossible without it.
- The install commands are in [missing_programs.ts](../../../../packages/apps/web_frontend/src/lib/missing_programs.ts), and are the same in `README.md` and on the home page of the website.

## Goat sounds

- Heidrun Code plays two goat bleats. They are the two halves of the sound "Cabra" by sonsdebarcelona, and the files are `data/sounds/goat_bleat/goat_bleat_1.wav` and `data/sounds/goat_bleat/goat_bleat_2.wav`. The application keeps one copy of each file, and plays it from the folder `data/sounds/goat_bleat`.
- A bleat plays only after a click of the developer. No bleat plays by itself.
- Three places play a bleat: the sound button of the About modal, the sound button of the splash screen, and the smiley at the end of the joke of the empty tab screen. A click on the smiley plays a bleat only when it starts the laugh again, so the laugh that starts by itself stays silent, and a click while the laugh is still running plays nothing.
- The bleats play in turn: the first click plays the first bleat, the second click plays the second bleat, the third click plays the first bleat again. The three places share the same turn. A bleat that is still playing stops when the next bleat starts.
- The setting "Enable goat sound" is a switch in the section General of the Settings window ([issue 620](https://github.com/heidrun-org/heidrun/issues/620)). It is off by default. A saved value that is missing, as in an installation that is older than the setting, or that is not true or false, means off. The application saves the setting with the other settings, so it stays the same after a restart.
- When the setting is off, a click on the three places plays nothing, and the turn of the bleats does not move. The sound buttons and the smiley stay on the screen. When the setting is on, the three places play the bleats as the rules above say.
- A change of the setting applies at once to every screen that is open, and plays no sound by itself. When the developer switches the setting off, a bleat that is playing stops at once.
- The test of the setting is in the function `playNextGoatBleat` of [goat_sounds.ts](../../../../packages/apps/web_frontend/src/lib/goat_sounds.ts), so every place that plays a bleat follows the setting. A new place that plays a bleat calls this function, and never plays the sound files by itself.
- The license of the sound is Creative Commons Attribution NonCommercial 3.0, so the About modal shows the credit to the author, with a link to the Freesound page.
