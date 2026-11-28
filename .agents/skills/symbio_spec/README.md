# symbio_spec

Symbiospec is the shared product specification for humans and AI. Humans can understand and approve Symbiospec, and AI uses Symbiospec to guide implementation and verification. The skill `symbio_spec` keeps each receiving project's specification and related records under `docs/symbio_spec/`.

## Why the name Symbiospec

Symbiospec is short for “Symbiotic Spec”. “Symbiotic” expresses the collaboration between humans and AI toward one shared goal: building the same product together. Humans and AI contribute different abilities, and Symbiospec gives humans and AI a common reference for describing, discussing, and agreeing on the product to build.

## When to use

Use `symbio_spec` to introduce Symbiospec into new or existing software, maintain approved expectations during development, or investigate differences between approved expectations, software and tests. Request **Symbiospec Audit for self-consistency** to review agreement within Symbiospec, or **Symbiospec Audit for software compliance** to compare software and approved Symbiospec in both directions, including undocumented software capabilities. The [shared workflow guide](https://github.com/jeromeetienne/coding_agent_plugins/blob/main/docs/about_symbio_spec/README.md) explains Initialization, Update, Realignment, and both audits with examples.

The specification separates Glossary, Behaviour, User Interface, Styling, Platform Support and System Overview. The [shared definition](https://github.com/jeromeetienne/coding_agent_plugins/blob/main/docs/about_symbio_spec/what_is_symbio_spec.md) explains the purpose and current limits. The [area guide](https://github.com/jeromeetienne/coding_agent_plugins/blob/main/docs/about_symbio_spec/areas.md) explains which area owns each fact.

User scenarios can start product design from a human-provided batch before every supporting description exists, or can be proposed from existing Symbiospec or software. The [starting paths and examples](https://github.com/jeromeetienne/coding_agent_plugins/blob/main/docs/about_symbio_spec/workflow_user_scenarios.md#choose-a-starting-point) explain how to choose a source and turn the journeys into supporting descriptions. Every user scenario requires human approval. Store project user scenarios under `docs/symbio_spec/user_scenarios/`, keeping the approved journey, pending revisions, specification findings and software verification separate. See the [workflow and template](references/workflow_user_scenarios.md) and [fictional example](references/user_scenario_examples.md).

## Requirements

The coding agent needs access to repository instructions, existing specifications and relevant project evidence. Existing software may require reading source code, tests, Git history and issue discussions, plus permitted application observation. Record unavailable evidence rather than claiming complete coverage. A person must make product decisions that are not already authorized.

The core skill includes the instructions and references needed to initialize and maintain Symbiospec on its own. Follow the receiving project's documentation rules, including `docs_folder_system` when required. No application framework, renderer or hosting service is required.

## Install

```bash
npx skills add jeromeetienne/coding_agent_plugins --skill symbio_spec
```

See the [collection installation guidance](https://github.com/jeromeetienne/coding_agent_plugins/blob/main/README.md#install-the-skills). Request [Initialize Symbiospec](references/workflow_initialize.md) after installation to set up the project specification.

## Configuration and adoption

Project data belongs at `docs/symbio_spec/`, relative to the receiving repository root. During authorized initialization, the coding agent links to the installed skill and the project specification index. A repository that uses The Rules of the Repo can provide those links through its rules list and linked configuration. A repository without The Rules of the Repo adds the links directly to its existing coding-agent instructions. See [where to add the repository instruction pointer](references/workflow_initialize.md#3-add-the-repository-instruction-pointer).

New projects use whole-folder format `3.1.0`, separately from the skill release version. Invoking any Symbiospec skill automatically migrates older project data to the latest installed published format before normal work, even when the earlier format is readable. The retained `1.0.0` definition supports conversion, not continued ordinary work. Adoption adds only version metadata as its first step; the [decision storage transition](references/migration-1-to-2.md), [coverage storage transition](references/migration-2-to-3.md), and [optional user scenario transition](references/migration-3-to-3.1.md) then follow with preservation checks and no separate migration approval. The [versioning reference](references/versioning.md) defines the Markdown version record, Semantic Versioning, compatibility checks, and consecutive migrations. An absent record means the existing unversioned format, equivalent to `1.0.0`; verify that adoption preserves every existing specification file, then migrate to the latest target. An explicit instruction forbidding changes blocks required migration and dependent work. Malformed or unsupported versions and incomplete migrations stop normal work. Completed migrations remove obsolete paths after preservation and known repository reference checks. Do not retain redirects, compatibility pages or duplicate navigation; external links that cannot be updated are reported limitations. Recovery snapshots and administrative mappings preserve history separately. Installation alone does not add the record or migrate a project.

New software starts with folder overviews, indexes, decisions and coverage records, then develops useful content through Update. Empty templates are not approved definitions. Existing software requires a bounded inspection, prepared human review and repeated small increments. Adoption effort depends on the examined scope, evidence quality and decisions needed; installation does not reconstruct a whole product. Preserve useful existing specifications and approvals. Propose moves or splits when adopting content from another specification system; published Symbiospec format conversions run automatically under the shared procedure.

## Concrete example

For an illustrative note editor, request:

> Use symbio_spec to introduce Symbiospec into this existing note editor. Inspect saving one Note, propose the Note definition and save expectations, and prepare the first review batch. Do not change the application.

A small proposed specification separates these facts:

| Area | Example content |
| --- | --- |
| Glossary | A Note is a named piece of editable text retained for later use. |
| Behaviour | Saving a Note retains the current text; a failed save reports failure without claiming success. |
| User Interface | The Note editor exposes a Save control linked to the save Behaviour. |

These are fictional proposals, not approved requirements or claims about any real product. The [complete specification example](https://github.com/jeromeetienne/coding_agent_plugins/blob/main/docs/about_symbio_spec/specification_example.md) shows file placement, cross-references, review decisions and coverage.

## Results and review

Initialization produces a useful, explicitly scoped foundation, with proposals separated from approved specifications. In `3.1.0`, dated files under `decisions/` record actual human decisions and topic summaries help locate original evidence. Format `1.0.0` retains its single decision file only as migration input; normal work requires the latest target. `coverage/` preserves original examinations and maintained topic summaries, including unexamined scope and known differences. Update changes affected specifications alongside authorized software changes. Both audits produce scoped findings with evidence and limitations. Realignment can use those findings to prepare and apply authorized corrections; a saved report belongs under `docs/symbio_spec/reports/` when saving is authorized.

Review product meaning, supporting evidence, approval references, links and coverage. Documentation approval does not prove that application tests ran. Results distinguish documentation checks, implementation checks and unresolved findings.

## Approval boundaries

Existing product authorization applies without asking again. Additional product decisions require review before adoption. Observed behaviour, proposed specifications and approved expectations remain distinct. A request to inspect or review permits investigation and a report, not unrequested product corrections. Required format adoption and forward migration still run first under the shared procedure unless changes are explicitly forbidden. The human controls which audit runs, the scope, and the timing, and may defer an audit. Neither audit runs automatically after every rule change or becomes a prerequisite for approving a rule. Apparent conflicts already noticed during discussion are reported without automatically launching deeper review. Undocumented software behaviour is a finding for discussion, not an approved requirement. Realignment does not create a recurring automation. Never rewrite approved expectations silently to accommodate a regression or conflicting test.

## Related skills and guides

Companion skills are optional for the core Symbiospec workflows. Look for the named skill among the receiving project's installed skills. If a companion is absent and needed for the requested task, find the companion in the source repository below and use the collection installation command with that skill's name.

- [docs_folder_system](https://github.com/jeromeetienne/coding_agent_plugins/blob/main/skills/docs_folder_system/README.md) supplies document form and navigation when the receiving project requires those conventions.
- [symbio_spec_to_docs](https://github.com/jeromeetienne/coding_agent_plugins/blob/main/skills/symbio_spec_to_docs/README.md) generates documentation for configured audiences from approved Symbiospec and implementation evidence.
- [symbio_spec_to_ux draft](https://github.com/jeromeetienne/coding_agent_plugins/blob/main/skills/symbio_spec_to_ux/README.md) proposes screens and navigation from approved Symbiospec for human review.
- [issue_batch_workflow](https://github.com/jeromeetienne/coding_agent_plugins/blob/main/skills/issue_batch_workflow/README.md) can implement several approved changes through linked parent and sub-issues.

## Instructions and references

- [SKILL.md](SKILL.md): workflow selection, intent, human review and evidence requirements.
- [Format registry](references/format.md): published versions and links to retained definitions.
- [Format 3.1.0](references/format-v3.1.0.md): current complete format, dated decisions, stable identity, topic summaries and reading procedure.
- [Decision storage migration](references/migration-1-to-2.md): forward and reverse conversion, preservation and limitations.
- [Decision storage examples](references/decision_examples.md): representative retrieval, maintenance and conversion checks.
- [Format 1.0.0](references/format-v1.0.0.md): authoritative structure, six area responsibilities, document conventions, decisions and coverage.
- [Versioning and migration](references/versioning.md): version record, detection, compatibility, consecutive conversion and recovery.
- [Worked verification examples](references/versioning_examples.md): representative adoption, detection, conversion and interruption exercises.
- [Workflows](references/workflows.md): overview linking to the separate workflow procedures.
- [Symbiospec Audit for self-consistency](references/workflow_audit_self_consistency.md): review agreement within the selected specification scope.
- [Symbiospec Audit for software compliance](references/workflow_audit_software_compliance.md): compare software and approved Symbiospec in both directions.

- [Coverage storage migration](references/migration-2-to-3.md): preservation, conversion and reverse limitations.
- [Coverage examples](references/coverage_examples.md): retrieval, maintenance and conversion exercises.

- [User scenario format addition](references/migration-3-to-3.1.md): compatible version-record transition and reverse limits.
