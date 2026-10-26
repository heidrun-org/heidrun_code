# Glossary of Heidrun Code: voice input

- Created: 18 October 2026
- Last updated: 23 October 2026
- Status: Maintained glossary for agents and tools
- Related framing: [Project instructions](../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](index.md), [User interface of Heidrun Code: voice input](../user_interface/window/settings_voice_input.md), [User interface of Heidrun Code: word replacement list of the voice input](../user_interface/window/settings_voice_words.md), [User interface of Heidrun Code: composition bar](../user_interface/workspaces_tabs_and_panes/composition_bar.md)
- Related issue: [issue 662](https://github.com/heidrun-org/heidrun/issues/662), [issue 712](https://github.com/heidrun-org/heidrun/issues/712), [issue 820](https://github.com/heidrun-org/heidrun/issues/820), [issue 836](https://github.com/heidrun-org/heidrun_code/issues/836)

This document gives one short definition for each word of the voice input. The other words of Heidrun Code are in [index.md](index.md).

## Words

### Voice input

The feature that changes the speech of the developer into text. The developer holds the push-to-talk button, speaks, and releases the button, or clicks the button to start and clicks it again to stop. Heidrun Code records the microphone only between these two moments, changes the speech into text on the computer with a Whisper model, and writes the text in the composition bar whose push-to-talk button started the recording, even if focus changes. All panes share one recorder, so only one recording can run. The voice input is off at first.

### Push-to-talk button

The button that the developer uses to speak. A long press is push to talk: the developer holds it and releases it. A short press is a click: the recording goes on until the next press. It shows a microphone, and a stop icon while a click keeps the recording. It is in the composition bar, after the button "Send", as the last control at the right end of the last line. It is not the microphone button of Heidrun Code Mobile, which uses the speech recognition of the browser of the phone.

### Level bars

The row of thin vertical bars inside the text input of the composition bar, at its right end, that shows how loud the voice is while the microphone is open. The newest bar is on the right, and a silent moment is a dot. The elapsed recording time is written after the bars. The level bars stay visible during transcription: they become flat dots, and one green sine wave goes across them, again and again. A small X button immediately to the left of the level bars cancels recording or transcription.

### Whisper model

A file of whisper.cpp that changes speech into text. Heidrun Code offers 12 models, from `tiny` to `large-v3`, and downloads the model that the developer chooses into the folder `models` in the folder of the data of Heidrun Code.

### Voice input section

The section "Voice input" of the Settings window. It holds the switch "Enable voice input", the language of the speech, the Whisper model with the state of its download, and the word replacement list.

### Word replacement list

The list that fixes the words that Whisper writes wrongly. It is the last part of the Voice input section. Each entry has two texts, "Whisper writes" and "Heidrun Code writes instead". After Whisper changes the speech into text, Heidrun Code replaces each listed text by its replacement, before it writes the text in the composition bar. The list is the file `voice_words.json` in the folder of the data of Heidrun Code. The window and the command line `heidrun_code_ctrl voice_words` both read and write it.

### Whisper writes

The first text of an entry of the word replacement list: the text that Whisper writes, which Heidrun Code replaces. A space at its start or at its end is part of the text. It is never empty.

### Heidrun Code writes instead

The second text of an entry of the word replacement list: the text that Heidrun Code writes in place of the first text. A space at its start or at its end is part of the text. It may be empty, and the entry then removes the first text.

## Rules

- Use the words "voice input", "push-to-talk button", and "level bars". Never write "dictation", "speech button", "voice button", "record button", "waveform", or "equalizer" for them.
- The word "microphone button" means only the button of Heidrun Code Mobile, in [heidrun_code_mobile.md](heidrun_code_mobile.md).
- Use the words "word replacement list", "Whisper writes", and "Heidrun Code writes instead". Never write "dictionary", "vocabulary", "custom words", or "find and replace" for them.
