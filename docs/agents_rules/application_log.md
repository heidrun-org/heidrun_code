# Rule: the application log of Heidrun Code

- Created: 25 October 2026
- Last updated: 25 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code](glossary/index.md), [GitHub and GitLab support](github_and_gitlab_support.md)
- Related issue: [issue 879](https://github.com/heidrun-org/heidrun_code/issues/879)

This file gives the rules of the application log, the file where Heidrun Code writes what it does, so that a coding agent can read it after the developer used the application.

## The file

- The file is `application_log.jsonl` in the folder of the data of Heidrun Code: `~/.config/heidrun_code` for Heidrun Code, `~/.config/heidrun_code_development` for Heidrun Code Development (or the former folders `~/.config/heidrun` and `~/.config/heidrun-development` when the new folder does not exist), or the folder that `HEIDRUN_CODE_DIR` gives.
- The code is `packages/apps/desktop_tauri/src/application_log.rs`. Every line is one JSON object with `at` (milliseconds since 1970), `event`, and the fields of the event.
- Above 8 MiB, the file becomes `application_log.1.jsonl`, which replaces the previous one, and a new file starts.
- A failure to write the log never stops the application.
- The application log is separate from the operation log of the package `data_layer_operation_log`.
- The log never holds the text that the developer spoke, nor a secret.

## The events

- `forge_call_start`: a call to `gh` or `glab` starts. Fields: `call_id`, `caller`, `tool`, `args`, `is_refresh`.
- `forge_call_end`: the same call ends. Fields: `call_id`, `caller`, `tool`, `source` (`forge`, `kept_after_failure`, or `failed`), `duration_ms`, `error`.
- `forge_cache_hit`: the cache of the answers gave the answer, and GitHub or GitLab was not asked. Fields: `caller`, `tool`, `args`.
- The values of `caller` are `code_hosting_list`, `code_hosting_rate_limit`, `reference_card`, `issue_preview`, `source_control`, and `merge`.
- `voice_recording_start`: the microphone starts to record. Field: `error`.
- `voice_recording_cancel`: the recording is thrown away.
- `voice_recording_stop`: the recording stops. Fields: `recording_seconds`, `error`.
- `voice_transcription_start`: the transcription starts. Fields: `model`, `language`, `recording_seconds`.
- `voice_transcription_end`: the transcription ends. Fields: `duration_ms`, `characters` (the length of the text), `error`.

## Reading the log

- When the developer asks which calls cost the most or repeat, count the lines `forge_call_end` by `caller` and by `args`: each one reached GitHub or GitLab. The lines `forge_cache_hit` cost nothing.
- When you add a new call to `gh` or `glab`, or a new step that takes time, write its events here and in the code in the same change.
