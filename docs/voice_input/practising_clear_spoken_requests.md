# Practise clear spoken requests

- Created: 7 November 2026
- Last updated: 7 November 2026
- Status: Maintained practice guide
- Related framing: [Project instructions](../../AGENTS.md)
- Related rules: [Voice input glossary](../agents_rules/glossary/voice_input.md)
- Related issue: [Source issue](https://github.com/heidrun-org/heidrun_code/issues/1018)

## Goal

Practise spoken requests that give Codex and Claude a clear location, action, target and expected result.

## Good practices

- Name the repository or page where the work belongs.
- State one action and name the target of that action.
- Use short, complete sentences. Give each sentence one clear purpose.
- Describe the behaviour you want to observe.
- Use the established names of products, pages and controls.
- Add a short description when a name is unfamiliar: “Symbiospec, the product specification.”
- State approvals as complete sentences: “I approve all six groups on the Task page.”
- State the work boundary: “For now, create the issue. Implementation comes later.”
- When correcting a request, repeat the complete final instruction.
- Use a pasted address or exact value for a precise record or username.
- Before sending, check the action, target, names, numbers, approval words and negative words in the transcription.
- Ask for a short restatement when the location, target or scope needs clarification.

## Sentence template

> In [repository or page], do [action] on [named target]. The expected result is [observable behaviour]. For now, [work boundary].

Example:

> In the Heidrun Code repository, create a GitHub issue about the recording indicator. The recording indicator must stay visible while I am recording. For now, create the issue. Implementation comes later.

## How to practise

- Start a practice session with: “This is a voice input exercise. Evaluate my requests as practice text. Wait for a separate instruction before carrying out any example action.”
- Practise one exercise at a time.
- Read the example aloud, then inspect the transcription before sending.
- Say a second request using your own example and the same sentence structure.
- Ask the assistant to repeat the location, action, target, expected result and work boundary. The assistant should identify any information the request leaves unspecified.
- Compare the assistant's restatement with your intended request. Rewrite the whole request if a correction is needed.

## Exercises

### Exercise 1: Name the location and action

Say:

> In the Heidrun Code repository, list the open issues about voice input.

Then make your own request using another repository and subject.

Check: the assistant identifies the repository, the action “list,” and the subject “voice input.”

### Exercise 2: Separate the search location from the subject

Say:

> In the Heidrun Business repository, read the issues whose subject is Heidrun Notebook. Summarise the open decisions.

Then choose a repository and a different product discussed in that repository.

Check: the assistant searches the named repository and treats the product name as the subject.

### Exercise 3: Describe the expected behaviour

Say:

> On the Task page, show the Project title below the Task title. The Project title should open the Project page when clicked.

Then describe another visible change in two sentences.

Check: the assistant can explain the position and the click behaviour separately.

### Exercise 4: Name a feature and explain its purpose

Say:

> Check the Gantt chart, the timeline with a bar for each Task. Explain why the selected Task has no bar.

Then practise with:

> Update Symbiospec, the product specification, with the approved behaviour.

Check: the transcription preserves the name, or the description makes the intended feature clear.

### Exercise 5: Give layout instructions one sentence at a time

Say:

> Place the Profile heading above the left sidebar. Place the menu below the Profile heading. Show the selected section to the right of the left sidebar.

Then describe a layout you can see, using the visible names of the elements.

Check: each position belongs to a named element.

### Exercise 6: State an approval clearly

Say:

> I approve all six groups on the Task page.

Then practise an approval of a specific subset:

> I approve the State group and the Dates group on the Task page.

Check: the assistant repeats exactly which groups are approved.

### Exercise 7: Name the action and object in a completion request

Say:

> Merge the reviewed pull request into the target branch.

Then name an actual pull request and branch as practice text.

Check: the assistant identifies the action, the pull request and the branch. The practice session remains an exercise.

### Exercise 8: State the work boundary

Say:

> In the Heidrun Code repository, create a GitHub issue about the microphone button. Describe how the microphone button should show the recording state. For now, create the issue. Implementation comes later.

Then practise a request for assessment:

> Assess whether the specification contains enough information to implement the feature. Give me the assessment first.

Check: the assistant distinguishes creating an issue, assessing a specification and implementing a feature.

### Exercise 9: Explain a requirement through behaviour

Say:

> The website is read-only. People can browse the notebook content. Content changes go through the coding agent.

Then describe a different rule using the actions people can perform.

Check: the assistant's restatement preserves the intended behaviour.

### Exercise 10: Give a complete correction

Say:

> Correction. Audit the Gantt chart for these two Subprojects. Explain what information is missing. Keep the audit read-only.

Then practise changing the target of one of your earlier requests. Repeat the action and work boundary in the correction.

Check: the assistant follows the complete corrected instruction.

### Exercise 11: Practise exact numbers and values

Say:

> Start the review server on port three two zero zero.

Check that the transcription means port 3200. Try another port and compare the resulting text.

Then paste a record address and a username, and say:

> On this linked Person record, set the username to the value I pasted.

Check: the assistant identifies the exact record and value. Use the version of number pronunciation that produces the correct text in your setup.

### Exercise 12: Ask for a focused restatement

Say:

> First repeat the repository, the target and the action you understood. Wait for my validation.

Then give a request where the repository and the subject have different names.

Check: the assistant's restatement matches your intended scope.

## Five-minute daily routine

- Choose three exercises.
- Read each example aloud once.
- Give your own version of each example.
- Check the transcription and the assistant's understanding.
- Record the wording that needed correction, then practise the complete replacement sentence.

After 20 practice requests, review which sentence structures needed the fewest corrections in your own setup.

## Practice record

| Date | Exercise | Intended request | Transcription correct? | Assistant understood? | Complete replacement sentence |
|---|---|---|---|---|---|
| | | | | | |

## Source audit

The audit and conversation evidence behind these exercises are recorded here:

- https://github.com/heidrun-org/heidrun_code/issues/1017

