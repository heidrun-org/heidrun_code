# Directory Context: `/packages/apps/web_frontend/src/components/settings`

## Purpose
The content of each section of the Settings window. The Settings window itself is `../SettingsModal.vue`.

## Key Exports & Entry Points
- `SettingsSwitchRow.vue`: one Bootstrap switch with its label, bound with `v-model`. The slot after the label holds the circled question mark. Every boolean setting uses it.
- `SettingsOptionHelp.vue`: the circled question mark of an option and its information card (`../InformationCard.vue`). The properties are the key of the name of the option and the blocks, each one a key of a title and a key of a text, in the locale file `settingsHelp.json`.
- `settings_design_section.vue`: the Color themes section, with immediately applied, saved colour choices.
- `SettingsGeneralSection.vue`: the language, the time format, the working days, and the switch `goatSound`.
- `SettingsTerminalSection.vue`: the font, the font size that zooms the whole window, and the mouse behaviour (`mouseMode`).
- `SettingsTextDetectionSection.vue`: the section "Text detection": the switch `terminalTextDetection`, the data of the project, the field "Try a text" (`SettingsTextDetectionSample.vue`, runs no action), and one card for each detection family (`SettingsTextDetectionFamily.vue`) with the real patterns and examples of `../../lib/detection_catalog.ts`. See [the rules](../../../../../../docs/agents_rules/user_interface/window/settings_text_detection.md).
- `SettingsAgentsSection.vue`: the section "Coding agents": one switch per coding agent (`ownedAgents`), quota monitoring, the default command of a new tab (`newTabCommand`), the initial composition bar visibility, and `keepAgentsRunningAfterQuit`. Switching off the selected coding agent changes the default command to Terminal.
- `SettingsConfirmationsSection.vue`: the headings "Ask before closing" (workspace, tab, pane) and "Ask before deleting" (saved search).
- `SettingsGuardsSection.vue`: the project guards, then the built-in guards. It opens `../GuardModal.vue` through `../../stores/guard_window.ts`, and `../../stores/project.ts` writes the changes.
- `SettingsNotificationsSection.vue`: the notification settings, one row for each kind of notification (system notification, sound, list of sounds, button "Test"), and the switch `showStatusItem`. See [the rules](../../../../../../docs/agents_rules/user_interface/window/settings_notifications.md).
- `SettingsSidebarsSection.vue`: one heading for each sidebar section: "Needs you", "Past chats", and "Source control".
- `SettingsDynamicTopicsSection.vue`: the switches `dynamicTopics` and `clusteredDynamicTopics`, the extraction method, and the button "Rebuild the clusters".
- `SettingsMobileAccessSection.vue`: the mobile access switch, the switch `mobileTerminalTyping`, the QR code, and the paired devices.
- `SettingsVoiceInputSection.vue`: the switch `voiceInput`, the language, the Whisper model with the state of its download, and the word replacement list.
- `SettingsVoiceWordsEditor.vue`: the word replacement list (`data-option="voiceWords"`): add, edit, and delete the entries through `../../lib/voice_words.ts`, which reads the file again every second while the section is open.

## Rules
- A section component shows the content only. The title, the sidebar and the close button belong to `SettingsModal.vue`.
- One section component per entry of the sidebar of `SettingsModal.vue`. A setting lives in the section of its topic, never in a section of its own.
- The Settings window writes no style rule except the dark layer behind it and the QR code box. Every control is a Bootstrap component or a Bootstrap utility class. The test `../../settings_bootstrap.test.ts` checks it.
- A boolean setting is a Bootstrap switch, never a checkbox: the Bootstrap part `check` is not loaded.
- Every option has the attribute `data-option` and a `SettingsOptionHelp`, and goes in the list of `settings_information_cards.test.ts`, which fails when an option has no card. The rules are in [settings_information_cards.md](../../../../../../docs/agents_rules/user_interface/window/settings_information_cards.md).
- The circled question mark of a row that is a `label` is inside a `span` with `@click.capture.prevent`, so that a click on it does not switch the row.

## Background
- The Settings window is rebuilt with Bootstrap in [issue 412](https://github.com/heidrun-org/heidrun/issues/412). The sections come from [issue 556](https://github.com/heidrun-org/heidrun/issues/556), [issue 596](https://github.com/heidrun-org/heidrun/issues/596) (Guards), [issue 662](https://github.com/heidrun-org/heidrun/issues/662) (Voice input), and [issue 638](https://github.com/heidrun-org/heidrun/issues/638) (Text detection). The word replacement list comes from [issue #836](https://github.com/heidrun-org/heidrun_code/issues/836).
- Every option has an information card since [issue 608](https://github.com/heidrun-org/heidrun/issues/608).
