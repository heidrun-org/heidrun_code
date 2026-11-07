# Improve the voice input word replacement list from saved conversations

- Created: 7 November 2026
- Last updated: 7 November 2026
- Status: Maintained maintenance workflow
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Voice input glossary](../agents_rules/glossary/voice_input.md), [Word replacement list](../agents_rules/user_interface/window/settings_voice_words.md)
- Related issue: [issue 1019](https://github.com/heidrun-org/heidrun_code/issues/1019)

Saved conversations can reveal repeated incorrect spellings and corrections by the developer. Use those records to maintain the existing word replacement list with the [heidrun-data skill](../../.agents/skills/heidrun-data/SKILL.md) and the [heidrun-code-ctrl skill](../../.agents/skills/heidrun-code-ctrl/SKILL.md). The first skill finds and reads conversations; the second skill reads and changes the list through `heidrun_code_ctrl voice_words`.

This document authorizes no maintenance run by itself. A request to write documentation does not authorize changes to the developer's list. A request to audit and update the list allows reliable corrections to be applied automatically, within the requested scope. A scheduled service and changes to Whisper are outside this workflow.

## 1. Record the scope and the destination

Record the repositories and their local folders, the start and exclusive end of the audit period, the time zone, the previous audit boundary, and the time of this run. Convert local boundaries to UTC for queries. Use an interval such as `2026-11-01T00:00:00Z <= message time < 2026-11-07T00:00:00Z`; adjacent runs then have no gap or overlap.

Confirm the destination of `HEIDRUN_CODE_DIR` before any word replacement command. Without a nonempty override, the destination is `~/.config/heidrun_code`. The list belongs to the developer across all projects. A worktree does not give the list separate storage. For a demonstration, use an isolated temporary folder as shown below. The `voice_words` commands operate on files and do not need a running application or a Herdr session. Do not control installed Heidrun Code or its Herdr session for this workflow; follow the application restrictions in the project instructions for any development application test.

Read the two skills, then check the available commands:

```bash
heidrun_data --help
heidrun_code_ctrl --help
heidrun_code_ctrl voice_words list --format json
```

Save the initial JSON list in a private run record, including each entry's identifier and both exact texts. Preserve leading and trailing spaces. Never edit the storage file directly. Keep conversation excerpts and exported lists local unless the developer asks to publish them.

## 2. Establish conversation coverage

Run the following from each selected repository folder. The database can contain several repositories; discover the stored names rather than inferring names from the current remote, particularly after a repository rename.

```bash
heidrun_data sources --format jsonl
heidrun_data schema --format jsonl
heidrun_data schema chat_sessions
heidrun_data query --format jsonl "SELECT DISTINCT repository FROM chat_sessions"
heidrun_data query --format jsonl "SELECT DISTINCT repository FROM token_usage_minutes"
```

Record source row counts and dates. `sources.lastUpdatedAt` is the newest date in a source, not proof that every conversation was scanned recently. Inspect `token_usage_synchronizations` for the selected repository and folders; `synchronizedAt` describes the scan, and `readUpTo` describes the read boundary. When data is old or missing, run `heidrun_data update coding_agents --format jsonl` in each selected repository folder, then inspect coverage again. Keep standard error and report failures. Do not refresh unrelated sources merely to read conversations.

The examples below use one stored repository and a UTC period. Replace the repository, period, and local folders with the selected scope. Repeat for each stored repository name that belongs in the audit.

```bash
heidrun_data query --format jsonl "
SELECT repository, folder, synchronizedAt, readUpTo, mode
FROM token_usage_synchronizations
WHERE repository = 'heidrun-org/heidrun_code'"

heidrun_data query --format jsonl "
SELECT id, json_extract(data, '$.codingAgent') AS codingAgent,
       json_extract(data, '$.folder') AS folder,
       json_extract(data, '$.firstRecordAt') AS firstRecordAt,
       json_extract(data, '$.lastRecordAt') AS lastRecordAt
FROM chat_sessions
WHERE repository = 'heidrun-org/heidrun_code'
  AND json_extract(data, '$.firstRecordAt') < '2026-11-07T00:00:00Z'
  AND json_extract(data, '$.lastRecordAt') >= '2026-11-01T00:00:00Z'
ORDER BY firstRecordAt, id"
```

Select conversations that overlap the period, including conversations that started earlier. Inspect conversations with missing dates separately and report any that cannot be placed in the period. The default query limit is 1000 rows; paginate or use `--limit 0` when collecting the complete set. A truncated query is incomplete coverage.

`chat_sessions` indexes conversations started at repository roots. Available worktree and subfolder conversations can also be discovered through `token_usage_minutes`:

```bash
heidrun_data query --format jsonl "
SELECT DISTINCT chatSessionId, codingAgent, folder
FROM token_usage_minutes
WHERE repository = 'heidrun-org/heidrun_code'
  AND minuteAt >= '2026-11-01T00:00:00Z'
  AND minuteAt < '2026-11-07T00:00:00Z'
ORDER BY folder, chatSessionId"
```

Combine the identifiers from both queries and deduplicate by repository and conversation identifier. Token records identify activity, not the precise times of developer messages: use the conversation records to enforce the audit period. Token records do not cover every conversation; missing or undated token records, removed worktrees, unavailable saved files, and unindexed repositories remain coverage limits. If an identifier is already known from a previous run, try reading that conversation even when no index row exists. Do not infer that no conversations exist from an empty query.

Read each discovered conversation in its repository folder, replacing the example identifier:

```bash
heidrun_data read chat_session CONVERSATION_ID --format jsonl
```

The command reads available saved conversations from repository roots, worktrees, and subfolders. Record read failures and missing sources. Use the returned `at`, `role`, and `text` fields; retain developer messages inside the interval and enough surrounding messages to understand corrections. Context outside the interval is evidence only, not another counted occurrence. A read gives message content from saved files; a database query does not search the full conversation text.

## 3. Build candidates from evidence

Look for explicit corrections by the developer, repeated incorrect spellings of names, products, and technical terms, and repeated phrases that the surrounding messages disambiguate. Do not count assistant quotations, tool output, repeated context, or the same message discovered through two indexes as new developer occurrences.

For each candidate, record:

| Field | Required content |
| --- | --- |
| Incorrect text and intended replacement | Exact strings, with surrounding spaces visible inside quotes. |
| Evidence | Repository, conversation identifier, message timestamp or position, short supporting excerpt, and a conversation link when available. |
| Recurrence | Number of distinct developer messages containing the mistake in the period, and number of conversations. |
| Confidence | Developer-confirmed correction, supported inference, or unresolved guess; explain why. |
| Consequences | Valid uses, overlap with current entries, replacement chains, and expected verification examples. |
| Decision | Add, update, remove, keep unchanged, or defer, with a reason. |

A saved message does not establish whether the developer used voice input, what Whisper originally wrote, or what the recording contained. The developer may have typed the message or edited the text before sending. Describe a spelling correction as a correction supported by conversation evidence; claim a transcription error only when evidence establishes the voice input origin.

Apply a correction automatically only when the intended replacement is reliable and specific, the request authorizes updates, and representative valid phrases remain correct. Developer confirmation is stronger than an assistant's interpretation. Recurrence alone is insufficient. Defer ambiguous or context-dependent corrections and state the missing evidence. Do not prescribe a minimum recurrence count that substitutes for judgment.

For example, `"hadron"` to `"Heidrun"` may appear plausible in a product conversation, but would damage the valid phrase `"hadron collider"`. Prefer a supported, specific phrase or defer the correction. Examples in this document are illustrative, not new evidence for the developer's list.

## 4. Compare with the current list and check matching

Read `heidrun_code_ctrl voice_words list --format json` again before changes. Preserve unrelated entries. A case-insensitive duplicate of `whisper_writes` is refused: keep an entry whose texts already agree, or update the existing entry by identifier when evidence supports a change. Differences in surrounding spaces matter. Do not invent a second identifier for the same incorrect text.

Use the actual matching rules from the [word replacement list rules](../agents_rules/user_interface/window/settings_voice_words.md):

- Matching ignores letter case. Letters and digits define word boundaries; an entry beginning or ending in a letter or digit cannot match inside a longer word on that side. A space or punctuation character in the entry supplies its own boundary on that side.
- Leading and trailing spaces are significant and are not trimmed. `" at sign "` to `"@"` changes `"name at sign example"` to `"name@example"`; without the spaces, the result is `"name @ example"`.
- The longest matching entry at the same position wins. Equal lengths use the first entry in list order.
- Replacement passes repeat until the text stops changing. `"hadron"` to `"Heidrun"` plus `"heidrun card"` to `"Heidrun Code"` changes `"hadron card"` to `"Heidrun Code"` across passes.
- A list that keeps changing beyond the pass limit, or grows beyond the later-pass size limit, returns the first-pass text. The limits protect execution; the limits do not make a bad list correct. Check loops such as `"a"` to `"b"` plus `"b"` to `"a"`, and growth such as `"cat"` to `"cat cat"`.

Check each candidate against every current replacement and every other candidate. Check whether the replacement becomes another entry's input, whether a longer phrase takes priority, and whether legitimate phrases would change. Empty replacement text deletes matching text; use deletion only when supported by evidence.

## 5. Apply supported changes through the command line

The following copyable demonstration uses an isolated folder for every command. The initial unaccented output deliberately represents an entry that needs updating; the example is not a proposed correction for the developer's live list.

```bash
voice_words_example_dir=$(mktemp -d /tmp/voice-words-example.XXXXXX)
HEIDRUN_CODE_DIR="$voice_words_example_dir" heidrun_code_ctrl voice_words list --format json
HEIDRUN_CODE_DIR="$voice_words_example_dir" heidrun_code_ctrl voice_words add --id example-person --whisper-writes "jerome etienne" --heidrun-writes "Jerome Etienne" --format json
HEIDRUN_CODE_DIR="$voice_words_example_dir" heidrun_code_ctrl voice_words update example-person --heidrun-writes "Jérôme Étienne" --format json
HEIDRUN_CODE_DIR="$voice_words_example_dir" heidrun_code_ctrl voice_words list --format json
HEIDRUN_CODE_DIR="$voice_words_example_dir" heidrun_code_ctrl voice_words delete example-person --format json
HEIDRUN_CODE_DIR="$voice_words_example_dir" heidrun_code_ctrl voice_words list --format json
```

For an authorized maintenance run, use the confirmed destination from step 1 instead of the temporary folder. Start with `list`. For each approved candidate, use `add --whisper-writes "INCORRECT TEXT" --heidrun-writes "INTENDED TEXT" --format json`, or `update EXISTING_ID --heidrun-writes "INTENDED TEXT" --format json`. Prefix these arguments with `heidrun_code_ctrl voice_words`. Copy the identifier from the current list or the successful add result. `update` also accepts `--whisper-writes` when the incorrect text itself must change; omitted fields remain unchanged.

Remove an entry only when evidence shows the entry is obsolete, harmful, or superseded without losing a needed correction. Use `heidrun_code_ctrl voice_words delete EXISTING_ID --format json`. Record the old identifier and both old texts first. Run mutations sequentially, inspect every result and exit code, and stop dependent changes after a failure. A malformed settings file is an error to report, never a reason to overwrite the file.

## 6. Verify and keep reversal information

Read the complete list back with `heidrun_code_ctrl voice_words list --format json`. Compare entries by identifier with the initial list: confirm the intended changes and prove that unrelated entries survived. If another writer changed the list during the run, inspect the difference before proceeding; the commands do not provide a transaction across the entire maintenance run.

Verify representative mistaken phrases and valid phrases against the complete resulting list using the real `voice_input::replace_words` function, including uppercase variants, punctuation, longer words, spaces, overlaps, chains, and repeated passes. The command line has no replacement-preview command. In this checkout, the existing matching tests can be run from the root:

```bash
cargo test --package voice_input --lib word_replacement
```

Those tests establish matching behavior for their built-in examples, not correctness of an arbitrary newly edited list. For changed entries, use a temporary local harness that calls the same function with pairs from the readback JSON, or an authorized Heidrun Code Development test with separate settings. Do not treat a hand-written approximate matcher as verification of the application. Record the input, expected output, actual output, and result of every case. If the actual resulting list cannot be exercised, report verification as incomplete.

For the illustrative corrected entry, representative expectations are:

| Input | Expected output |
| --- | --- |
| `Ask jerome etienne today.` | `Ask Jérôme Étienne today.` |
| `Ask JEROME ETIENNE today.` | `Ask Jérôme Étienne today.` |
| `jerome etiennex` | `jerome etiennex` |
| `Ask Jérôme Étienne today.` | `Ask Jérôme Étienne today.` |
| `hadron collider` | `hadron collider` |

Keep a local report with the audit scope, freshness, coverage gaps, candidate evidence, every add/update/remove/defer decision, before and after values, command results, and verification results. Reverse a bad add with `delete` using the returned identifier. Reverse an update with `update` restoring both exact old texts. Reverse a removal with `add --id OLD_ID --whisper-writes "OLD TEXT" --heidrun-writes "OLD REPLACEMENT" --format json`. Recheck the current list first so reversal does not overwrite later work, then read back and verify again.

Repeat when new corrections or enough new conversations justify another audit. Save the exclusive end of the completed interval as the next start. Track unresolved candidates separately. Revisit a previously incomplete interval when missing files become available; deduplicate the already reviewed messages. A completed time interval with missing sources is still partial coverage. No fixed schedule is required.

## Reusable instruction

> Audit saved conversations from START (inclusive) to END (exclusive), in TIME_ZONE, across REPOSITORIES_AND_LOCAL_FOLDERS, and update my voice input word replacement list using docs/voice_input/improving_word_replacements.md. Use the heidrun-data and heidrun-code-ctrl skills. Confirm the settings destination, record source freshness and coverage including available worktree conversations, and distinguish developer-confirmed corrections from inference. Apply reliable, specific corrections automatically through voice_words commands; preserve unrelated entries and defer ambiguous candidates. Read the list back, test the resulting list with the real matching function against mistaken and valid phrases, and report evidence, changes, reversal information, verification limits, and the next audit boundary. Use PREVIOUS_AUDIT_RECORD when provided. Do not publish private conversation excerpts.

## Verification of this document

On 7 November 2026, the installed command help and schemas were inspected. The isolated command demonstration above returned an empty list, added `example-person`, updated the replacement to `Jérôme Étienne`, read the updated entry back, deleted the entry, and returned an empty list again. The developer's settings were not changed. All 23 existing word replacement tests passed. A temporary harness called the actual matching function with pairs from the isolated command readback; all five expectations in the table above passed. The documented SQL queries also ran successfully against the local database. One discovered repository-root conversation was read successfully through `heidrun_data read chat_session`, returning 196 records, including 11 developer records; no corrections were selected from that conversation. Worktree discovery was checked against the schema and skill, but no worktree conversation read was demonstrated in this run. The matching implementation and its existing tests are in [word_replacement.rs](../../packages/auxiliary/voice_input/src/word_replacement.rs). This demonstration checks command use and matching behavior; it is not a conversation audit and does not establish new corrections for the developer.
