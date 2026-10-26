# User interface of Heidrun Code: the references in the text of the terminals

- Created: 22 October 2026
- Last updated: 23 October 2026
- Status: Maintained rules for agents and tools
- Related framing: [Project instructions](../../../../AGENTS.md)
- Related rules: [The detection in the text of the terminals](terminal_text_detection.md), [Glossary of Heidrun Code: terminal text detection](../../glossary/terminal_text_detection.md)
- Related issue: [issue 793](https://github.com/heidrun-org/heidrun/issues/793), [issue 638](https://github.com/heidrun-org/heidrun/issues/638)

This file gives, for the four reference families, the forms that Heidrun Code accepts, the forms that it refuses, and the destination. The code is `findRefs` in `lib/refs.ts`.

## One reference, many forms

The same issue, pull request, merge request, or commit gets the same hover buttons whatever the form: "Open" and "Preview" for an issue and a request, and "Open" for a ticket and a commit.

| Form | Example | Kind |
| --- | --- | --- |
| Number | `#569` | issue |
| Number with an exclamation mark | `!34` (only when the forge is not GitHub) | merge request |
| Words and a number | `PR #5`, `MR !34`, `pull request 5`, `merge request 34` | request |
| Another repository | `org/lib#7`, `group/sub/app!3` | issue, request |
| Address with its host | `https://github.com/org/app/issues/569`, `…/pull/5`, `https://gitlab.com/g/s/app/-/issues/3`, `…/-/merge_requests/3` | issue, request |
| Address without its host | `/issues/569`, `/pull/5`, `/-/issues/3`, `org/app/issues/569`, `org/app/pull/5`, `g/s/app/-/merge_requests/3` | issue, request |
| Address of a commit | `…/commit/26d63ea`, `…/-/commit/26d63ea` | commit |
| Identifier | `26d63ea` (7 to 40 characters from 0 to 9 and a to f, with at least one letter and one digit) | commit |
| Ticket key | `ABC-123` (2 to 10 capital letters and digits, starting with a letter, a hyphen, and digits) | ticket |

- A Markdown link `[label](address)` is read through its address, which is a form of the table. The label is read by its own rule: `[#12](…/issues/12)` gives two pieces that go to the same destination.
- A query string and a fragment stay in the address that opens (`…/issues/12#issuecomment-5`). A full stop, a comma, a semicolon, a colon, an exclamation mark, or a question mark at the end of the address is not part of it. A space, a quote, a closing parenthesis, or a closing square bracket ends the address.

## The destination

- A short form (`#12`, `!34`, `PR #5`, an identifier) goes to the repository of the pane: the Git remote of the folder of the pane, or the key `repo` of the section `references` of `.heidrun/config.json`. Without a repository the piece is colored and has no hover button and no action.
- A form with an explicit repository (`org/lib#7`, `org/app/issues/12`) goes to that repository, on the host of the repository of the pane. An address with its host goes to that address. The preview asks for the repository that the text names, and never for the repository of the pane.
- An address names its forge: GitHub for `…/issues/N` and `…/pull/N`, GitLab for `…/-/issues/N` and `…/-/merge_requests/N`. The preview uses the forge of the address, not the forge of the pane.
- An address with its host and the GitHub form counts only on `github.com`, or on the host of the repository of the pane when the pane is on GitHub. The GitLab form counts on every host other than `github.com`, because `/-/` belongs to GitLab only. `https://example.com/issues/12` is not an issue.
- An address without its host and without a repository (`/issues/12`) needs a leading slash, so that the folder `src/issues/12` is not read. A repository in front (`org/app/issues/12`) has exactly two pieces on GitHub, and any number of pieces before `/-/` on GitLab.
- The forge of the pane is GitHub when the host name of the repository holds the word "github", and GitLab for every other host, unless the key `forge` of the section `references` says otherwise.

## The forms that are refused

| Text | Why |
| --- | --- |
| `https://example.com/page#12` | A number inside an address is not a reference. |
| `a &#39; b` | An HTML entity is not an issue. |
| `wow !34` on GitHub | The exclamation mark is a merge request on GitLab only. |
| `deadbeef`, `1234567` | An identifier needs a letter and a digit. |
| `UTF-8`, `SHA-256` | Words of a fixed list of names that look like tickets (UTF, ISO, SHA, RFC…). When the key `tickets` gives a list of prefixes, only those prefixes count, and the fixed list is not used. |
| `ABC-123` without a ticket address | A ticket needs the key `tickets` of the section `references`. |
| `src/issues/12/index.ts` | A folder named `issues` is not an address. |

## Known limits

- A commit identifier or a ticket key inside a file name wins over the file path (`logs/26d63ea.txt` is a commit). The precedence is fixed and the sample field shows it.
- A pull request written `#12` is read as an issue. GitHub redirects the issue address to the pull request.
- The form `org/app/issues/12` is read as an address even when the text is a folder path of two names followed by `issues/12`.
