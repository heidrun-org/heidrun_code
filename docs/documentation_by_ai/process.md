# Learning and using the documentation prompt

- Created: 15 October 2026
- Last updated: 15 October 2026
- Status: Maintained description of the documentation process
- Related framing: [Project instructions](../../AGENTS.md)
- Related issue: [issue 501](https://github.com/heidrun-org/heidrun/issues/501)

## Purpose

The experiment improved instructions for writing useful user documentation. The lasting result is a prompt, a reusable presentation format and a record of how to improve those instructions again. The result is not a requirement to keep judging and polishing every future page.

There are two distinct activities. Prompt improvement is an explicitly requested experiment on a small feature. Normal generation uses the resulting prompt once, builds once and returns control to the developer.

## 1. Start with a small task and current evidence

Choose a task that a person can complete in the application, such as selecting a tab or renaming a workspace. Limit the generated pages and preserve accepted pages. Record the selected source files, model, effort, exact prompt and output. Keep experimental material separate from the real website until integration is requested.

Read the current user-interface rules and glossary, then the implementation needed to establish exact behavior and labels. Rules describe intended behavior; the implementation may expose a conflict. During an explicitly authorised learning experiment, a check in the matching running application can resolve the uncertainty. A source statement alone is not proof that a visible interaction worked.

The source version matters. An older installed application, a workspace opened at the repository root instead of a subfolder, or a differently focused pane can produce misleading evidence. Use a matching application build and disposable fixtures. Restore the starting selection and settings after checks. Start Heidrun Code with --no-splash-screen when preparing such checks.

## 2. Generate and preserve a candidate

Early experiments used GPT-6.1 Sol / high as the stronger comparison model. Later runs tried a less expensive writer and settled on GPT-6 Luna / medium for the demonstrated tasks. This is a record of those trials, not proof that one model is best for every feature.

The experimental generator originally used an outline call and a writing call. Some planning calls edited files despite their instruction, so a nominal planning label was not a reliable edit boundary. The reusable normal command now uses one explicit writing call and no separate outline call. It prohibits nested generators; an exclusive lock prevents overlapping or recursive invocations of this package.

Save the candidate and its raw answer before evaluation. Do not silently replace a failed answer, hide an unsuccessful call or rerun a judge until a favorable score appears. Distinguish successful generation, successful build, readable website, successful native interaction and user acceptance.

## 3. Improve the judge before trusting its feedback

A judge is a model asked to identify documentation defects. Calibration means checking whether that model catches deliberately planted defects and leaves good examples alone. It is needed because unchanged pages received contradictory feedback and significantly different scores during early experiments.

Freeze the rubric, source snapshot, candidate examples, model, effort and expected defects before calling the judge. Include good examples and examples containing one known defect each. Keep expected labels and earlier scores out of the judge's input. Use one example per independent call, repeat the fixed set in another order when requested, and retain all results.

Require each finding to give a page location, observed evidence, reader impact, severity and exactly one existing source path. Additional sources belong in the evidence explanation. Separate whether a defect was detected from its severity and whether the answer followed the required format. Editorial preferences do not become defects simply because the judge prefers another wording.

The retained version3 rubric scores verified reader obstacles. A blocking wrong instruction prevents acceptance even when an average looks high. Unverified behavior is a stated limit, not proof that a claim is true or false. Changing the rubric creates a different evaluation; higher scores alone do not demonstrate better pages.

The historical calibration covers a small set of pane focus history text examples. It does not establish reliability for other features, screenshots, every future model version or every severity decision. Refresh examples and source evidence before using that set as a current quality gate.

## 4. Compare findings with independent evidence

In the learning phase, compare judge findings with an independent source review and, where authorised, checks in the real application and rendered website. These are different kinds of evidence. Code establishes the implemented conditions; native actions establish observed behavior; browser screenshots establish what the documentation actually displays.

The experiments exposed missing prerequisites, ambiguous release instructions, imprecise history labels, alternatives written as consecutive actions, and inaccurate recovery steps. Capture the general rule in the maintained prompt. Apply the concrete page correction only when requested. Do not turn every optional wording preference into another generation round.

Images need visual evidence. A caption and a valid image path did not prevent an SVG crop from showing an empty frame. Keep authentic original pixels, source dimensions, fingerprints, crop coordinates and annotation meanings. A useful figure shows the target plus enough surroundings for a beginner to locate the region. Use readable annotation labels and arrows, comfortable padding and restrained colors; preserve contrast in both website themes. Never present generated artwork as an application screenshot.

Troubleshooting topics became independent panels with a symptom, cause, solution and visible check. Ordinary task steps remained plain numbered lists. The package retains reusable templates so this presentation is not specific to a single page.

## 5. Stop when the developer accepts the result

User acceptance is separate from a judge's score or needs_review status. Once a page is accepted, mark tuning complete and preserve its recorded limits. Reopen the page only for a concrete reported problem or an explicit new request. The experiment demonstrated useful pages; it did not justify indefinite tuning.

## Normal generation: write, build, return

The command reads current rules, glossary and supplied evidence, sends one assembled request to GPT-6 Luna / medium, then runs the website build once. It stores settings, input fingerprints, prompt, answer, raw activity and build output under the package's ignored runs directory.

No judge, post-generation page audit, native checks, browser checks, automatic screenshot capture, correction pass, retry, model fallback or publication follows. A failed writer or build stops the command and retains partial output and logs. The command does not fix the failure or silently restore files. The developer reviews the generated files and decides what to do next.

Screenshot collection is a separate input-preparation task. Supply authentic captures with their source version, date, described state and verification limits. Old experiment images are not automatically current evidence. Without suitable captures, the writer reports the gap instead of fabricating an image.

The developer can later request one bounded correction or a new learning experiment. Such a request is a new action; it is not an implicit loop inside generate-and-build. Commits, merges, deployment and public preview updates remain separate actions too.
