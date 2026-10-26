# User interface of Heidrun Code: the other detections in the text of the terminals

- Created: 22 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [The detection in the text of the terminals](terminal_text_detection.md), [The references](terminal_text_detection_references.md)
- Related issue: [issue 793](https://github.com/heidrun-org/heidrun/issues/793), [issue 638](https://github.com/heidrun-org/heidrun/issues/638), [issue 574](https://github.com/heidrun-org/heidrun/issues/574)

This file gives the forms, the refused examples, the context, and the visible result of the seven families that are not references. The code is in `lib/refs.ts`, and the precedence is in `lib/terminal_detection.ts`.

| Family | Accepted | Refused | Needs | Visible result |
| --- | --- | --- | --- | --- |
| Web addresses | `http://` or `https://`, also over two lines. | Other schemes. | Nothing. | Underline under the pointer. ⌘-click opens the browser. No hover button, except for an issue, a request, or a commit address. |
| File paths | `src/app.ts`, `./lib/x.rs:10:5`, `~/Library/WebKit/dev.heidrun-org.heidrun-code.development`, `app.ts:42`. The last piece after the final dot starts with a letter and has 1 to 25 letters and digits. | A bare name without a line (`foo.ts`). A version (`1.2.3`). A host name (`db.example.com:5432`). A path in an address. | Nothing. A relative path starts at the folder of the pane. | Underline. Button "Open". The file opens in the File explorer sidebar section. |
| Shell commands | `! docker ps`, and `run ! pnpm test.` in a sentence, both also over several lines (Claude Code and Codex). | `Super ! Bravo`. A word that is not a path or a known tool. A command of more than 50 lines. | A pane that runs a coding agent. | Underline. Button "Run", with the whole command on one line under it. A click sends `! command` to the input, through the guards. |
| Slash commands | `/compact`, if Claude Code knows it in the folder. | `/tmp/x`. An unknown word. | A pane that runs Claude Code. | Underline. Button "Run". A click sends the command. |
| Numbered steps | `1. Open the issue`, `2) Commit`: a number of one or two digits, a full stop or a closing parenthesis, and at least 4 characters. | `1. ok`. | A pane that runs a coding agent. | No underline. Button "Do step". A click sends a message that asks the agent to do the step. |
| Agent list and input box | `● main`, `○ name`: two rows or more, near the bottom. The input box when a row has the selection. | A single row. | A pane that runs Claude Code. | Button "Show" on a row. A click on the input box gives the keyboard back to the input. |
| Questions and numbered choices | A question at the end of the last message. A menu `1. Yes / 2. No` with one selected option. | A list in the text of the agent. A menu with two selected options. | A coding agent. | The Needs you sidebar section shows the question and the buttons, and so does the phone. |

## Notes

- A shell command on several lines: Claude Code and Codex write their own line breaks, so Herdr cannot join them. A screen line goes on the line above it when the first word of the screen line did not fit at the end of the line above (`lib/wrapped_lines.ts`). The join removes the indentation of the agent, and adds one space, or no space after a line that reaches the right edge of the pane, where the agent cut a word in two. A word that ends exactly at the right edge cannot be told from a cut word: the line under the button shows the command before the click. A `\`, `&&`, `||`, `|`, or `;` at the end of a line also goes on, and a line that starts with `-` goes on after a wrapped or continued line. Spaces are kept as they are. A command of more than 50 lines, or that reaches the last line of the screen, is not proposed, rather than cut. A word longer than a whole line starts a new line. A new `!`, `⏺`, `•`, or `⎿` always ends the command. The copy with ⌘C keeps the line breaks of the agent ([issue 574](https://github.com/heidrun-org/heidrun/issues/574)).
- The sentence that the numbered step sends to the agent is written in French in the code, whatever the language of the window. The text of the buttons follows the language of the window.
- Questions and choices are not decorations of the terminal. `stores/session.ts` reads the screen of the pane (`api.read`) when an agent finishes or is blocked. With the family off, it reads nothing, and removes the questions and the menus already read. With the family on again, it reads the menus of the blocked agents again.
- The mouse behaviour is not text detection. It keeps its own option in the section Terminal of the Settings window, and the section Text detection does not list it.
