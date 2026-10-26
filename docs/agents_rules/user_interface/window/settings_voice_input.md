# User interface of Heidrun Code: voice input

- Created: 18 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [Information card of every option of the Settings window](settings_information_cards.md), [Composition bar](../workspaces_tabs_and_panes/composition_bar.md), [Word replacement list](settings_voice_words.md)
- Related issue: [issue 662](https://github.com/heidrun-org/heidrun/issues/662), [issue 712](https://github.com/heidrun-org/heidrun/issues/712), [issue 736](https://github.com/heidrun-org/heidrun/issues/736), [issue 753](https://github.com/heidrun-org/heidrun/issues/753), [issue 836](https://github.com/heidrun-org/heidrun_code/issues/836)

This file is a part of the rules of the user interface of Heidrun Code. It gives the rules of the voice input and of the Voice input section. The words are defined in [voice_input.md](../../glossary/voice_input.md).

## The section

- The Settings window has a tenth section, "Voice input", last in the list, with the icon of a microphone. It has four options, and each option has a circled question mark with an information card in English and in French: the switch "Enable voice input", the choice "Language of the speech", the choice "Whisper model", and the "Word replacement list", which has its own rules in [settings_voice_words.md](settings_voice_words.md). The language and the model are dimmed while the switch is off.
- The switch is off at first. When it is off, Heidrun Code shows no push-to-talk button, downloads no model, never opens the microphone, and throws away a recording that runs.
- The language is "Detect the language" or one of 20 languages. Each name is written in the language of the window. A model whose name ends with `.en` understands only English and ignores the choice.
- The model list has 12 models, with the size of each beside its name, in MB or GB as Finder writes it (Mo and Go in French). The first model is `base`. `tiny` heard one short sentence wrong, so the first model is `base`.

## The download

- Turning the switch on or choosing a model downloads the model at once when its file is not in the folder `models` in the folder of the data of Heidrun Code (`HEIDRUN_CODE_DIR`, else `~/.config/heidrun_code`). While it downloads, the section shows the percent and a progress bar, and the model list is dimmed.
- The file is written as `<file>.part` and renamed when it is complete, so Heidrun Code never reads a broken model. A download that stops early leaves no file. When the download fails, the section shows "The download failed. Check the network." and a button "Try again". A model that is not on the disk and does not download shows a button "Download the model".
- Only this download uses the network, from the official files of whisper.cpp on Hugging Face. The speech never leaves the computer.

## The push-to-talk button

- All panes share one recorder. The recording belongs to the pane whose push-to-talk button started it; another pane cannot start a second recording or stop the first recording. A blocked press in another pane shows a translated notification to wait for recording or transcription.
- With the switch on, the push-to-talk button is in the composition bar, after the button "Send", as the last control at the right end of the last line. The header of the pane has no push-to-talk button: the developer opens the composition bar with its toggle button, then uses the push-to-talk button.
- The button has two ways to work, chosen by the length of the press. A long press, 0.3 second or more, is push to talk: the developer holds the button, speaks, and releases it. A release anywhere in the window, a loss of the keyboard by the window, and the release of the key Space or Enter on the button end the hold. A short press, less than 0.3 second, is a click: the recording goes on after the release, and the next press of the button stops it. While the microphone is open, the icon of the button is a microphone during a long press, and a square after a click. The color of the icon, and the look of the button in the composition bar, are in [panes_appearance.md](../../web_styling/panes_appearance.md). While a click keeps the recording, its title tells to click again, and the release of the pointer and the loss of the keyboard by the window end nothing. A press that ends before the microphone is open follows the same rule.
- The button "Send" and the key Enter of the composition bar never leave a recording open: they stop it, wait for Whisper, add the text, and then send. The key Escape, and the toggle button of the header that hides the composition bar, throw a recording away. The rules of the sending are in [composition_bar.md](../workspaces_tabs_and_panes/composition_bar.md).
- The text goes at the end of the text of the composition bar whose push-to-talk button started the recording, after one space, even if focus changes. Heidrun Code never sends it by itself: the developer reads it, edits it, and sends it.
- A press with no speech, a recording shorter than 0.3 second, and a room with only noise give no text and no error. A recording is never longer than 300 seconds.
- The button is dimmed while the model is not on the disk, and shows a spinner while Whisper works. The color of the spinner is in [panes_appearance.md](../../web_styling/panes_appearance.md). Whisper works on a background thread, so the window stays fast.

## The level bars

- While the microphone is open, the composition bar shows the level bars inside the text input, at its right end, followed by the time since the recording started in minutes and seconds (for example 0:07). There are 40 thin vertical bars, one for each 50 milliseconds, so they show the last 2 seconds of the voice. The newest bar is on the right. A silent moment is a dot of 4 pixels, and a loud moment is a bar of up to 36 pixels. The bars and the time take the color of the muted text, and the bars have the label "Level of the voice" for the screen readers.
- During transcription, keep the level bars and recording time visible. A small X button, 4 pixels to their left, cancels recording or transcription. Cancellation discards audio and late text or errors, preserves the draft and images, keeps the composition bar open, and permits another recording. Cancelling also cancels a Send that waits for transcription.
- The bars never cover the text: the text input keeps free room at its right end, 40% of its width and at most 340 pixels. In a narrow composition bar, fewer bars show, and the oldest bars are cut.
- The text input shows the placeholder "Listening…" while the microphone is open, and "Changing the speech into text…" while Whisper works.
- The Rust package measures the level of the voice every 50 milliseconds, on a decibel scale from -60 to -10, and the command `voice_start_recording` sends it to the web page with the event `voice-input-level`. The web page keeps the last 40 levels in `voiceInput.levels` and clears them at each new recording.

## The permission and the errors

- The file `packages/apps/desktop_tauri/Info.plist` holds the key `NSMicrophoneUsageDescription`, so macOS asks for the permission at the first recording. The development build embeds the same file. In `pnpm dev`, the permission belongs to the program that runs the command. A build signed with the hardened runtime needs the entitlement `com.apple.security.device.audio-input`.
- When the developer refuses the permission, the composition bar shows a line that tells how to change it: System Settings, Privacy & Security, Microphone. When the microphone gives only exact zeros, which a real microphone never does, the line tells the same, and tells to press the button again if macOS just asked.
- The commands send only the category of an error (`no_microphone`, `microphone_denied`, `no_signal`, `model_missing`, `model_load_failed`, or another). The details go to the terminal of the developer.
- The logs of Whisper (one line for each token of the speech) never go to the terminal. They go to the file `logs/whisper.log` in the folder of the data of Heidrun Code, which `voice_commands::open_whisper_log` opens when the application starts. The package `voice_input` renames a file that is larger than 4 MiB to `whisper.log.old` at the start, and writes at most 16 MiB in one run. If the file cannot open, the logs are dropped and one line in the terminal says why.

## The code and the tests

- The Rust package `packages/auxiliary/voice_input` records, downloads, and transcribes. It knows nothing about Tauri. `packages/apps/desktop_tauri/src/voice_commands.rs` holds the five commands: `voice_options`, `voice_download_model`, `voice_start_recording`, `voice_cancel_recording`, and `voice_stop_recording`.
- The web page files are `lib/voice_input.ts`, `stores/voice_input.ts`, `components/PushToTalkButton.vue`, `components/VoiceLevel.vue`, and `components/settings/SettingsVoiceInputSection.vue`.
- The tests of the package check the conversion of the audio, the download with a fake server (complete, stopped early, missing file, no server), the text of Whisper, and a spoken sentence with the real model `tiny`, which the first run downloads once into the folder of the build.
- The button and composition bar tests start with no recording owner, mount the controls before the first press, and check that the first click shows a red stop icon and level bars in the owning pane; two panes share one recorder.
- The Vitest tests check the library (the long press, the click, and the levels), the button, the level bars, the Settings section, the composition bar, and the toggle button of the header of the pane.

## Not in this feature

- A keyboard shortcut instead of the button, typing the text into another application, the mobile website, and an operating system other than macOS.
