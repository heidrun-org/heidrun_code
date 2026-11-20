# User interface of Heidrun Code: voice input

- Created: 18 October 2026
- Last updated: 20 November 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](../../glossary/index.md), [Information card of every option of the Settings window](settings_information_cards.md), [Composition bar](../workspaces_tabs_and_panes/composition_bar.md), [Word replacement list](settings_voice_words.md), [Voice input across panes](../workspaces_tabs_and_panes/voice_input_across_panes.md)
- Related issue: [issue 662](https://github.com/heidrun-org/heidrun/issues/662), [issue 712](https://github.com/heidrun-org/heidrun/issues/712), [issue 736](https://github.com/heidrun-org/heidrun/issues/736), [issue 753](https://github.com/heidrun-org/heidrun/issues/753), [issue 836](https://github.com/heidrun-org/heidrun_code/issues/836), [issue 868](https://github.com/heidrun-org/heidrun_code/issues/868)

See the [voice input glossary](../../glossary/voice_input.md).

## The section

- The Settings window has a tenth section, "Voice input", last in the list, with the icon of a microphone. Each option has a circled question mark with an information card in English and in French: the switch "Enable voice input", the choice "Language of the speech", the choice "Whisper model", the two recording duration fields, and the "Word replacement list", which has its own rules in [settings_voice_words.md](settings_voice_words.md). The language, the model, and the recording duration fields are dimmed while the switch is off.
- The switch is off at first. When it is off, Heidrun Code shows no push-to-talk button, downloads no model, never opens the microphone, and throws away a recording that runs.
- The language is "Detect the language" or one of 20 languages. Each name is written in the language of the window. A model whose name ends with `.en` understands only English and ignores the choice.
- The model list has 12 models, with the size of each beside its name, in MB or GB as Finder writes it (Mo and Go in French). The first model is `base`. `tiny` heard one short sentence wrong, so the first model is `base`.

## Recording duration

- Two numeric fields between the Whisper model and the word replacement list show and save whole minutes. "Maximum recording duration" accepts 2 to 15 minutes and defaults to 15. "Start flashing red after" accepts 1 minute up to one minute below the maximum and defaults to 10. When lowering the maximum puts the warning outside its range, the warning field shows the highest allowed value. The question-mark cards explain both fields.
- At the warning time, the active push-to-talk button flashes red until the recording stops. With reduced motion enabled, the button shows a steady red outline. At the maximum duration, Heidrun Code stops the recording, shows a notification, and transcribes the captured audio through the normal queue.

## The download

- Turning the switch on or choosing a model downloads the model at once when its file is not in the folder `models` in the folder of the data of Heidrun Code (`HEIDRUN_CODE_DIR`, else `~/.config/heidrun_code`). While it downloads, the section shows the percent and a progress bar, and the model list is dimmed.
- The file is written as `<file>.part` and renamed when it is complete, so Heidrun Code never reads a broken model. A download that stops early leaves no file. When the download fails, the section shows "The download failed. Check the network." and a button "Try again". A model that is not on the disk and does not download shows a button "Download the model".
- Only this download uses the network, from the official files of whisper.cpp on Hugging Face. The speech never leaves the computer.

## The push-to-talk button

- All panes share one microphone. The queue of Whisper, the states, the notification of a blocked press, and the recording icon are in [voice_input_across_panes.md](../workspaces_tabs_and_panes/voice_input_across_panes.md).
- With the switch on, the push-to-talk button is in the composition bar, after the button "Send", as the last control at the right end of the last line. The header of the pane has no push-to-talk button: the developer opens the composition bar with its toggle button, then uses the push-to-talk button.
- A press of at least 0.3 second records until release. Release anywhere in the window, loss of keyboard focus, or release of Space or Enter on the button ends the hold. A shorter press keeps recording after release until the next press. The button shows a microphone during a hold and a square after a click. Its title tells the developer to click again. Pointer release and loss of focus leave a recording started by a click running. The same rules apply if the press ends before the microphone opens. See [panes_appearance.md](../../web_styling/panes_appearance.md).
- The button "Send" and the key Enter of the composition bar never leave a recording open: they stop it, wait for Whisper, add the text, and then send. The key Escape, and the toggle button of the header that hides the composition bar, throw a recording away. The rules of the sending are in [composition_bar.md](../workspaces_tabs_and_panes/composition_bar.md).
- The text goes at the end of the text of the composition bar whose push-to-talk button started the recording, after one space, even if focus changes. Heidrun Code never sends it by itself: the developer reads it, edits it, and sends it.
- A press with no speech, a recording shorter than 0.3 second, and a room with only noise give no text and no error.
- The button is dimmed while the model is not on the disk, and shows a spinner while its recording waits for Whisper or Whisper works. The color of the spinner is in [panes_appearance.md](../../web_styling/panes_appearance.md). Whisper works on a background thread, so the window stays fast.

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

- The Rust package `packages/auxiliary/voice_input` records, downloads, and transcribes. It knows nothing about Tauri. `packages/apps/desktop_tauri/src/voice_commands.rs` holds the seven commands: `voice_options`, `voice_download_model`, `voice_start_recording`, `voice_cancel_recording`, `voice_stop_recording`, `voice_transcribe_recording`, and `voice_discard_recording`.
- The web page files are `lib/voice_input.ts`, `stores/voice_input.ts`, `components/PushToTalkButton.vue`, `components/VoiceLevel.vue`, and `components/settings/SettingsVoiceInputSection.vue`.
- The Rust tests cover audio conversion, downloads, transcription, and a sentence with the real Whisper model `tiny`. The web tests cover recording, transcription, the push-to-talk button, the level bars, the composition bar, and the Voice input section.

## Not in this feature

- A keyboard shortcut instead of the button, typing the text into another application, the mobile website, and an operating system other than macOS.
