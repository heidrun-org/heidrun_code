# Directory Context: `/packages/auxiliary/voice_input`

## Purpose
A Rust library for the voice input of Heidrun Code: it records the microphone, downloads a Whisper model, and changes the speech into text on the computer. The audio stays in memory and is never written to a file. It knows nothing about Tauri and the web page.

## Key Exports & Entry Points
- `src/lib.rs`: the only public interface. It exports `Recorder` and `Recording` (the microphone, with `Recorder::start_with_levels` for the level of the voice every 50 milliseconds), `download_model` and `DownloadProgress` (the model files), `Transcriber` (Whisper), `whisper_log::write_to_file` (the file of the Whisper logs), `list_models`, `find_model`, `model_path`, `MODELS`, `LANGUAGES`, `DEFAULT_MODEL_ID`, and `MODELS_BASE_URL` (the 12 models and the 20 languages), and `VoiceError` with its `category()`, and `replace_words` (the word replacement list).
- `src/audio.rs`: the pure functions that change the audio of the microphone to 16 kilohertz in one channel, and measure its loudness and the level to show.
- `src/word_replacement.rs`: `replace_words`, a pure function that replaces the listed texts in the text of Whisper. It reads no file: the caller gives the pairs.
- `src/whisper_log.rs`: sends the logs of whisper.cpp and ggml to a file. `Transcriber::new` installs the hook, so the logs never reach the terminal, even before a file is set.
- Command to test this folder: `pnpm --filter voice_input test` runs both groups. `test:fast` runs `cargo test --lib`, and `test:slow` runs the tests with the real model `tiny`.

## Rules
- A recording is never longer than 300 seconds. The level callback runs in the thread of the recorder, never in the audio thread.
- The audio stays in memory. No function of this package writes the sound to a file, and the only network call is the download of a model file.
- The stream of the microphone lives in its own thread, because the stream of macOS cannot move between threads. `Recorder::stop` ends that thread.
- A recording with only exact zeros is the error `NoSignal`. A recording shorter than 0.3 second, or with no window of 30 milliseconds at the speech level, gives an empty text and no error.
- A model file is written as `<file>.part` and renamed when it is complete, so a file with the final name is never a broken model.
- An error crosses the border of the package as a category, a short word in snake case, never as a text. The details are for the terminal of the developer.
- The package imports no other package of the repository. `desktop_tauri` imports it, and `desktop_tauri` is the only package that talks with the web page.
- `replace_words` matches whole words only, ignores the case, lets the longest entry win, and repeats the passes until the text stops changing (at most 10 passes, and a pass after the first one may not make the text more than 10 times longer plus 10000 bytes; a list that loops gives the text of the first pass). The rules are in [settings_voice_words.md](../../../docs/agents_rules/user_interface/window/settings_voice_words.md).
- Building the package needs `cmake`, because `whisper-rs` builds the C++ engine whisper.cpp.
- The tests of the integration use the real model `tiny`, which the first run downloads once into the Cargo target folder. They are slow tests: the root command `pnpm test` does not run them, and `pnpm test:slow` does. A new test file in the folder `tests` runs only with the slow tests, so a fast test goes in a `#[cfg(test)]` module of the library ([issue 826](https://github.com/heidrun-org/heidrun/issues/826)).

- The logs of whisper.cpp go to a file and never to the terminal. The file is renamed to `<name>.old` when it is larger than 4 MiB at the start, and one run writes at most 16 MiB. The package needs the feature `raw-api` of `whisper-rs` for this.

## Background
- The package comes from [issue 662](https://github.com/heidrun-org/heidrun/issues/662). The rules for agents are in [settings_voice_input.md](../../../docs/agents_rules/user_interface/window/settings_voice_input.md).
- `replace_words` comes from [issue #836](https://github.com/heidrun-org/heidrun_code/issues/836).
- The method comes from the project [voice_to_keyboard](https://github.com/jeromeetienne/voice_to_keyboard). Heidrun Code records in Rust with `cpal`, and not with SoX, so that it needs no other program.
- On the computer of the developer, `whisper-rs` changed a sentence of 4.9 seconds into text in 0.22 second with the model `tiny`, 0.39 second with `base`, and 1.2 seconds with `small`.
