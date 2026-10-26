# User interface of Heidrun Code: word replacement list of the voice input

- Created: 23 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [Glossary of Heidrun Code: voice input](../../glossary/voice_input.md), [Voice input](settings_voice_input.md), [Information card of every option of the Settings window](settings_information_cards.md)
- Related issue: [issue 836](https://github.com/heidrun-org/heidrun_code/issues/836)

This file is a part of the rules of the user interface of Heidrun Code. It gives the rules of the word replacement list: the list in the Voice input section of the Settings window, the matching, the file, and the tests. The words are defined in [voice_input.md](../../glossary/voice_input.md).

## The list in the Voice input section

- The word replacement list is the fourth and last option of the Voice input section, with the heading "Word replacement list" and a circled question mark with an information card in English and in French. It is never dimmed: the developer can prepare the list while the voice input is off.
- Each entry is a row of two text inputs and one button with a trash icon. The two texts have the names "Whisper writes" and "Heidrun Code writes instead". A heading line above the rows shows both names, and each input also has the name as its label for the screen reader. The button has the title "Delete the word" followed by the text that Whisper writes.
- The button "Add a word" is at the right end of the heading line. It opens an empty row at the end of the list, and the button then reads "Cancel". The row has its own button with a check icon, which writes the entry, and the key Enter in either input does the same. The button is dimmed while the text that Whisper writes is empty or only spaces.
- An existing entry is written when the developer leaves an input (the event `change`). An empty text that Whisper writes is refused, and the old text comes back. A refusal of the desktop application (for example, two entries with the same text that Whisper writes) shows its reason in a red alert, and the old text comes back.
- An empty list is the plain text "No word in the list.". It is never a boxed row that looks like an input.
- A space at the start or at the end of a text is part of the text, and the window never trims it. The information card gives the example of " at sign " with the replacement "@".
- When the file is not valid, the section shows the reason in a red alert, changes nothing, and dims the inputs and the buttons. The window never overwrites such a file.

## The matching

The pure function `voice_input::replace_words` takes the text of Whisper and the pairs, and gives the replaced text. A pass goes from left to right, and the function makes passes until a pass changes nothing.

- An entry matches a whole word or a whole group of words only. A letter or a digit is part of a word. An entry that starts or ends with a letter or a digit never matches inside a longer word. An entry that starts or ends with a space or a sign is cut by that space or that sign, so it is not checked on that side.
- The matching ignores upper case and lower case.
- When two entries match at the same place, the longer entry wins. For two entries of the same length, the first entry of the list wins.
- The text that a pass wrote is matched again by the next pass, so a replacement can match another entry: "hadron" to "Heidrun" and "heidrun card" to "Heidrun Code" change "hadron card" into "Heidrun Code". The order of the entries does not matter. When the text still changes after 10 passes, or a pass after the first one makes the text more than 10 times longer than the original text plus 10000 bytes, the list loops (for example "a" to "b" and "b" to "a", or "cat" to "cat cat"), and the result is the text of the first pass.
- An entry with no text, or with only spaces, is ignored. The orders of `heidrun_code_ctrl` refuse it, and refuse a second entry with the same text that Whisper writes (the case does not count).

## The file

- The list is the file `voice_words.json` in the folder of the data of Heidrun Code (`HEIDRUN_CODE_DIR`, else `~/.config/heidrun_code`): a JSON list of entries with the fields `id`, `whisper_writes`, and `heidrun_writes`. The package `heidrun_code_ctrl` owns the format and the four orders (list, add, update, delete). The window and the command line `heidrun_code_ctrl voice_words` both use them, so the window never writes the whole list.
- The Tauri commands `voice_words_read`, `voice_words_add`, `voice_words_update`, and `voice_words_delete` are in `packages/apps/desktop_tauri/src/voice_words.rs`. While the section is open, the web page reads the file again every second, so a change of the command line shows within about one second. Nothing reads the file while the section is closed.
- The command `voice_stop_recording` replaces the words in the text of Whisper before it gives the text to the web page. When the file is not valid, it gives the text as Whisper wrote it, and one line in the terminal says why: a mistake in the list never loses the speech.

## The code and the tests

- The web page files are `stores/voice_words.ts`, `lib/voice_words.ts`, and `components/settings/SettingsVoiceWordsEditor.vue`.
- The Rust tests check the function (whole words, upper and lower case, the longest entry first, an empty list, a chain of replacements, a list that loops, and the spaces at the ends of an entry), the file and the four orders with their errors, and the replacement with a valid, a missing, and an invalid file. The test of `heidrun_code_ctrl` compares `SKILL.md` with the help, and runs its examples.
- The Vitest tests check the library (the read each second, the stop of the read, the older read that is ignored, and the refusals) and the section (add, edit, delete, the refusals, the invalid file, and French).
