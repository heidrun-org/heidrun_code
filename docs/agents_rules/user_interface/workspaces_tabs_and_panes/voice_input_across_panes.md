# User interface of Heidrun Code: voice input across panes, tabs, and workspaces

- Created: 26 October 2026
- Last updated: 26 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: voice input](../../glossary/voice_input.md), [User interface of Heidrun Code: voice input](../window/settings_voice_input.md), [User interface of Heidrun Code: composition bar](composition_bar.md)
- Related issue: [issue 762](https://github.com/heidrun-org/heidrun_code/issues/762), [issue 868](https://github.com/heidrun-org/heidrun_code/issues/868)

This file is a part of the rules of the user interface of Heidrun Code. It gives the rules of the voice input when more than one composition bar is open, in one tab or in several tabs and workspaces. The words are defined in [voice_input.md](../../glossary/voice_input.md).

## The three states of a composition bar

- **Recording**: the microphone is open for this composition bar. All panes share one microphone, so only one composition bar records at a time.
- **Waiting for transcription**: the recording has ended, but Whisper still changes the recording of another composition bar into text. Whisper changes the recordings into text one by one, in the order of the recordings. The level bars are flat dots, and the sine wave of the transcription goes across them in orange, the theme variable `--voice-wait`. The spinner of the push-to-talk button is orange. The text input shows the placeholder "Waiting for Whisper…", and the push-to-talk button has the longer title "Waiting for Whisper, which changes the speech of another composition bar into text…".
- **Transcription**: Whisper changes the speech of this composition bar into text. The sine wave and the spinner turn green, without a jump in the animation.
- During the wait and the transcription, the recording time stays still at the length of the recording, and the push-to-talk button of this composition bar is disabled. The developer can record in another composition bar.
- With the system setting "Reduce motion", nothing moves: the flat dots only turn orange, then green.
- The small X button cancels each of the three states. A cancelled wait leaves the queue, and the desktop application throws its recording away. A cancelled transcription writes no text, and the next recording of the queue starts.
- The button "Send" and the key Enter of a waiting composition bar wait for its own text, after the transcriptions before it in the queue.
- The error of a recording or of a transcription shows under the text input of its own composition bar only.

## A press while another composition bar records

- The push-to-talk button of every other composition bar stays enabled: a disabled button cannot tell why.
- A press on it starts nothing, keeps the recording that runs, and shows a notification that names the tab that records and its workspace, also when it is the selected workspace: "You cannot record: the tab “build” of the workspace “heidrun” is recording." The developer goes back to that tab to stop the recording.

## Switching tabs and workspaces

- A switch to another tab or to another workspace never stops, never cancels, and never moves a recording. The developer can read information in another tab, then come back.
- The recording and its text stay with the composition bar that started the recording.

## The recording icon

- While the microphone records, a red microphone (the color `--danger-fg` of the theme, the icon `mic-fill`) shows on the button of the tab that records, after its name, and on the workspace button of the workspace that records, after its name, in the "Needs you" sidebar section and in the information card of the workspace section of the status bar. It has the title and the label "Voice input is recording".
- The icon shows only while the microphone records, not during the wait or the transcription: it tells which tab blocks a new recording.

## The code and the tests

- `voice_stop_recording` stops the microphone and gives the number of the recording. `voice_transcribe_recording` changes one recording into text, and `voice_discard_recording` throws one away. They are in `packages/apps/desktop_tauri/src/voice_commands.rs`.
- `lib/voice_input.ts` keeps the queue in `voiceInput.transcriptions`, the errors by pane in `voiceInput.errors`, and gives the state of each pane with `VoiceInput.paneState`. `components/VoiceRecordingIcon.vue` draws the recording icon.
- `lib/voice_input.test.ts` checks the queue, the order of the transcriptions, the cancellation of each state, the wait of a send, the notification, and the tab and the workspace that record. The tests of `TabBar`, `NeedsYouWorkspaces`, and `WorkspaceStatusSummary` check the recording icon.
