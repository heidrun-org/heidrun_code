# Voice input source material

- Created: 28 November 2026
- Last updated: 28 November 2026
- Status: Transferred source material
- Related framing: [Glossary migration sources](README.md)
- Related issue: [issue 1135](https://github.com/heidrun-org/heidrun_code/issues/1135)

Original source `/docs/agents_rules/glossary/voice_input.md` in the [pinned revision](https://github.com/heidrun-org/heidrun_code/commit/9d7989928bdc5d2499b1e7236e6c20fe0ae125db). The headings identify original line numbers. Proposed destinations and inventory notes describe the transfer. Approval of a product rule is recorded with the resulting specification.

### Source line 10

This document gives one short definition for each word of the voice input. The other words of Heidrun Code are in [index.md](source_index.md).

### Source line 12

#### Words

### Source line 14

- Glossary entry: [Voice input](../../glossary/voice_input.md#11-voice-input).
- Proposed destinations: Glossary, User Interface, Behaviour, Platform Support.

#### Voice input

The feature that changes the speech of the developer into text. The developer holds the push-to-talk button, speaks, and releases the button, or clicks the button to start and clicks it again to stop. Heidrun Code records the microphone only between these two moments, changes the speech into text on the computer with a Whisper model, and writes the text in the composition bar whose push-to-talk button started the recording, even if focus changes. All panes share one microphone, so only one composition bar records at a time, and the recordings wait in one queue for Whisper. The voice input is off at first.

### Source line 18

- Glossary entry: [Push-to-talk button](../../glossary/voice_input.md#12-push-to-talk-button).
- Proposed destinations: Glossary, User Interface, Behaviour, Platform Support.

#### Push-to-talk button

The button that the developer uses to speak. A long press is push to talk: the developer holds it and releases it. A short press is a click: the recording goes on until the next press. It shows a microphone, and a stop icon while a click keeps the recording. It is in the composition bar, after the button "Send", as the last control at the right end of the last line. It is not the microphone button of Heidrun Code Mobile, which uses the speech recognition of the browser of the phone.

### Source line 22

- Glossary entry: [Level bars](../../glossary/voice_input.md#13-level-bars).
- Proposed destinations: Glossary, User Interface, Behaviour, Styling.

#### Level bars

The row of thin vertical bars inside the text input of the composition bar, at its right end, that shows how loud the voice is while the microphone is open. The newest bar is on the right, and a silent moment is a dot. The elapsed recording time is written after the bars. The level bars stay visible during the wait for transcription and during transcription: they become flat dots, and one sine wave goes across them, again and again, orange during the wait and green during transcription. A small X button immediately to the left of the level bars cancels recording, the wait, or transcription.

### Source line 26

- Glossary entry: [Waiting for transcription](../../glossary/voice_input.md#14-waiting-for-transcription).
- Proposed destinations: Glossary, Behaviour.

#### Waiting for transcription

The state of a composition bar whose recording has ended, while Whisper still changes the recording of another composition bar into text. Whisper changes the recordings into text one by one, in the order of the recordings.

### Source line 30

- Glossary entry: [Recording icon](../../glossary/voice_input.md#15-recording-icon).
- Proposed destinations: Glossary, User Interface, Behaviour.

#### Recording icon

The microphone on the tab button and on the workspace buttons while voice input records, waits for transcription, or transcribes for a pane of that tab or workspace.

### Source line 34

- Glossary entry: [Whisper model](../../glossary/voice_input.md#16-whisper-model).
- Proposed destinations: Glossary, Behaviour, Technical documentation.
- Inventory notes: Check the stated model count before carrying it into Behaviour.

#### Whisper model

A file of whisper.cpp that changes speech into text. Heidrun Code offers 12 models, from `tiny` to `large-v3`, and downloads the model that the developer chooses into the folder `models` in the folder of the data of Heidrun Code.

### Source line 38

- Glossary entry: [Voice input section](../../glossary/voice_input.md#17-voice-input-section).
- Proposed destinations: Glossary, User Interface.

#### Voice input section

The section "Voice input" of the Settings window. It holds the switch "Enable voice input", the language of the speech, the Whisper model with the state of its download, and the word replacement list.

### Source line 42

- Glossary entry: [Word replacement list](../../glossary/voice_input.md#18-word-replacement-list).
- Proposed destinations: Glossary, User Interface, Behaviour, Technical documentation.

#### Word replacement list

The list that fixes the words that Whisper writes wrongly. It is the last part of the Voice input section. Each entry has two texts, "Whisper writes" and "Heidrun Code writes instead". After Whisper changes the speech into text, Heidrun Code replaces each listed text by its replacement, before it writes the text in the composition bar. The list is the file `voice_words.json` in the folder of the data of Heidrun Code. The window and the command line `heidrun_code_ctrl voice_words` both read and write it.

### Source line 46

- Glossary entry: [Whisper writes](../../glossary/voice_input.md#19-whisper-writes).
- Proposed destinations: Glossary, Behaviour.

#### Whisper writes

The first text of an entry of the word replacement list: the text that Whisper writes, which Heidrun Code replaces. A space at its start or at its end is part of the text. It is never empty.

### Source line 50

- Glossary entry: [Heidrun Code writes instead](../../glossary/voice_input.md#110-heidrun-code-writes-instead).
- Proposed destinations: Glossary, Behaviour.

#### Heidrun Code writes instead

The second text of an entry of the word replacement list: the text that Heidrun Code writes in place of the first text. A space at its start or at its end is part of the text. It may be empty, and the entry then removes the first text.

### Source line 54

#### Rules

### Source line 56

- Proposed destinations: Glossary.

- Use the words "voice input", "push-to-talk button", and "level bars". Never write "dictation", "speech button", "voice button", "record button", "waveform", or "equalizer" for them.

### Source line 57

- Proposed destinations: Glossary.

- The word "microphone button" means only the button of Heidrun Code Mobile, in [heidrun_code_mobile.md](heidrun_code_mobile.md).

### Source line 58

- Proposed destinations: Glossary.

- Use the words "word replacement list", "Whisper writes", and "Heidrun Code writes instead". Never write "dictionary", "vocabulary", "custom words", or "find and replace" for them.
