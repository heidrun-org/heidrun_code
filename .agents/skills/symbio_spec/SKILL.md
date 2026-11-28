---
name: symbio_spec
description: Create and maintain Symbiospec, the shared product specification in docs/symbio_spec/. Use to initialize Symbiospec for new or existing software, update the specification alongside authorized software changes, request Symbiospec Audit for self-consistency or Symbiospec Audit for software compliance, create or review human-approved user scenarios, or resolve drift between the specification, software, and tests.
---

# Symbiospec

## 1. Purpose and location 

Symbiospec is the shared product specification through which humans and coding agents define software together. Humans understand and approve product decisions; coding agents use those decisions to guide implementation and verification.

Store project-specific specifications, proposals, decisions, coverage records, and comparison reports under `docs/symbio_spec/`, relative to the target repository root. This is not the operating system's `/docs` folder. Keep reusable instructions and templates in this skill, separate from project data.

Read the target repository's instructions and applicable context files first. Follow existing documentation conventions, including `docs_folder_system` when required by the repository. Preserve unrelated documentation and local changes. Installing this skill alone does not initialize product documentation or approve product decisions.

The core workflows use the references in this skill folder. For an optional companion workflow, use the companion's installed instructions if available. See [Related skills and guides](README.md#related-skills-and-guides) for source and installation guidance when a companion is absent.

## 2. Select the workflow

**Required for normal work: the latest published Symbiospec format in the installed registry (currently `3.1.0`). Migration sources: `3.0.0`, `2.0.0`, `1.0.0` and its unversioned equivalent.** Before normal work, follow the shared [version detection and automatic migration procedure](references/versioning.md). Invoking this skill authorizes documented adoption and forward migration, including for an audit, documentation generation or interface proposal. Automatically migrate older project data before continuing; older-format compatibility does not permit skipping migration. Do not request separate migration approval. Preserve data and approvals, update known repository references, verify replacements, and remove obsolete paths completely; do not leave redirects, compatibility pages or duplicate navigation. Report uneditable external links as limitations. Verify each step and report source and target versions. Explicit instructions forbidding changes override this default: report the conflict and stop dependent work if migration is needed. Malformed, unknown or newer versions, missing reliable conversion paths, and failed or interrupted migrations block normal work. Installation that only copies skill files defers migration until first project use.

Read [format.md](references/format.md) and the detected version's complete definition before creating or restructuring Symbiospec. Use the [workflow overview](references/workflows.md) to select the relevant workflow below.

| Request | Workflow |
| --- | --- |
| Start a new project with Symbiospec | [Initialize Symbiospec](references/workflow_initialize.md): initialize the structure and templates, then use Update as development begins. |
| Introduce Symbiospec into existing software | [Initialize Symbiospec](references/workflow_initialize.md) through slow growth: establish a small validated foundation and expand iteratively. |
| Adopt existing specifications | [Initialize Symbiospec](references/workflow_initialize.md): inspect and preserve useful content and approvals; propose incremental content adoption from other systems. Published Symbiospec format conversion runs automatically first. |
| Develop an authorized software change with an established Symbiospec | [Update Symbiospec as the software changes](references/workflow_update.md): update the affected specifications in the same task. |
| Design from a human-provided batch, generate proposed user scenarios from Symbiospec or software, or review, revise or retire user scenarios | [User scenarios](references/workflow_user_scenarios.md): record source, approval, journey, proposed changes, specification findings and software verification separately. |
| Check whether approved Symbiospec descriptions agree internally | [Symbiospec Audit for self-consistency](references/workflow_audit_self_consistency.md): review the requested specification scope without testing software. |
| Compare approved Symbiospec with software in both directions | [Symbiospec Audit for software compliance](references/workflow_audit_software_compliance.md): report conflicting, missing, and unverified behaviour. |
| Investigate and resolve differences between Symbiospec, software, and tests | [Realign Symbiospec when drift is detected](references/workflow_realign.md): compare without modifying, report differences, then apply authorized corrections. |

For `3.1.0`, follow the [decision reading and maintenance rules](references/format-v3.1.0.md#42-decisions) before relying on summaries or recording decisions. Use the retained `1.0.0` definition only to interpret migration sources; ordinary work begins after migration. Read only the workflow references relevant to the request. Both audits require an explicit request; the human chooses either audit or both audits, the scope, and the timing, including deferral until later. Do not automatically launch either audit or check affected approved user scenarios after every rule change. During discussion, mention apparent conflicts already noticed; a warning does not launch an investigation or make an audit a prerequisite for approving a rule. Never silently change approved user scenarios to remove a warning.

Keep checks scoped to the request. A request to inspect or review permits investigation and a report, not unrequested product corrections. Required format adoption and forward migration still run first under the shared procedure unless changes are explicitly forbidden. Realignment is a repeatable operation, not permission to create a scheduled automation.

## 3. Preserve human intent

- Distinguish observed implementation, proposed specification, and approved specification. Confidence in evidence is separate from human approval.
- Use existing authorization for product changes. Do not ask the human to approve the same decision again. Present additional product decisions beyond that authorization before adopting them.
- Never silently rewrite approved expectations to accommodate an implementation regression or a conflicting test. Report the difference and propose the correction to the software, specification, tests, or a combination.
- Define one canonical identity and name for each concept. Investigate historical aliases; do not blindly rename code, stored data, or external interfaces.
- Keep every fact in its responsible section and link to that fact elsewhere. Read the affected approved specifications before changing related software.
- Preserve partial coverage and uncertainty. Approval of documentation is not proof that the software was tested or that every feature is documented.

## 4. Prepare human review

Complete the investigation and prepare several concrete decisions before requesting the human's attention. Each proposal includes its reason, evidence, example, affected scope, consequences, and dependencies.

Present the prepared decisions in quick succession and record accept, reject, revise, or defer. Do not perform lengthy new investigations between short answers. Carry questions needing substantial new analysis into a later batch. Apply authorized decisions, check coherence, and return changed product meaning for review before adoption.

Keep human-facing documents easy to navigate: a short numbered introduction, numbered headings and subheadings, and short paragraphs beneath headings. Avoid repeating entire specifications in summaries, indexes, or review records.

## 5. Finish with evidence

Check affected links, indexes, section ownership, approval references, and the stated coverage. Run checks appropriate to the actual change; do not claim application behaviour was exercised from a documentation check. Report what changed, what was checked, and what remains proposed or unresolved.

## 6. Write the sub-issues of an implementation

When the approved Symbiospec changes need several implementation changes, write them as one parent issue with one sub-issue for each change. Use the repository's existing issue workflow for the handoff, including `issue_batch_workflow` when installed and configured.

- Group the sub-issues by area, and order the groups by their dependencies. Write the groups and the order in the parent issue.
- Ask every open question during the human review of section 4, and write the answers in the parent issue and in the sub-issues. A sub-issue has no open question when the implementation starts.
- Link each sub-issue to the approved specifications that it implements.

## 7. Propose screens and navigation

For user interface structure derived from approved Symbiospec, see [Propose user interface structure](references/workflow_user_interface.md).

## 8. User scenarios

Use the [user scenario workflow and template](references/workflow_user_scenarios.md) for creation, generation, review and maintenance. The [format definition](references/format-v3.1.0.md#5-user-scenarios) owns approval and lifecycle requirements. The [fictional example](references/user_scenario_examples.md) includes completed records and a noticed conflict without an automatic audit.

## 9. Design references

The supporting references make this skill usable without network access. These issues provide design context rather than project-specific approval:

- [Symbiospec definition and structure](https://github.com/jeromeetienne/coding_agent_plugin/issues/10).
- [Symbiospec workflow guide](https://github.com/jeromeetienne/coding_agent_plugin/issues/11).

For coverage retrieval and updates, follow the [original examination and topic summary procedure](references/format-v3.1.0.md#43-coverage). Verify summary freshness, then consult original evidence for the claimed scope, revision and environment. Summary freshness does not establish current software compliance.

Each user scenario describes one person pursuing one specific goal, from a clear starting condition to one observable outcome. Include only the actions necessary to reach that outcome. Put alternative goals, starting conditions and recovery journeys in separate scenarios. Check this scope during generation and requested review; use separate documents and preserve source mapping and human approval. Never silently split or rewrite existing approved scenarios.
