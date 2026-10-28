# voice_input

`voice_input` is the Rust library behind the voice input of Heidrun Code. The developer holds the push-to-talk button, speaks, and releases the button, or clicks to start and clicks to stop. The library records the microphone between these two moments, tells the level of the voice 20 times a second, changes the speech into text with a Whisper model on the computer, and gives the text to the application. The sound stays in memory, is never saved, and never leaves the computer.

The library has five parts:

- `recording`: opens the microphone with `cpal`, and gives the audio at 16 kilohertz in one channel.
- `transcription`: loads a Whisper model with `whisper-rs` and changes the audio into text.
- `download`: downloads a model file from Hugging Face, with the progress, under a temporary name.
- `models`: the 12 models with their sizes, the 20 languages, and the model files on the disk.
- `whisper_log`: writes the long logs of whisper.cpp to a file, so that they never fill the terminal.

Building the library needs `cmake` (`brew install cmake`), because `whisper-rs` builds the C++ engine whisper.cpp. To test it:

```bash
pnpm --filter voice_input test:fast   # the fast tests, with no model
pnpm --filter voice_input test:slow   # the slow tests, with the real model tiny
pnpm --filter voice_input test        # both
```

The first run of the slow tests downloads the model `tiny` (78 MB) once. To record the real microphone for one second, run `cargo test live_ -- --ignored` in this folder.
