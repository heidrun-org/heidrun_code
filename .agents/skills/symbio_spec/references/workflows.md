# Symbiospec workflows

Before any workflow, follow [version detection and migration](versioning.md), including for read-only audits and companion skills. Use the supported version's definition; do not initialize over an unsupported or interrupted format.

## 1. [Initialize Symbiospec](workflow_initialize.md)

Create the structure for new software or progressively establish a validated specification for existing software.

## 2. [Update Symbiospec as the software changes](workflow_update.md)

Keep affected specifications current during each authorized development task.

## 3. [Realign Symbiospec when drift is detected](workflow_realign.md)

Compare the current specification with the software and relevant tests, then resolve differences within the user's authorization.

## 4. [Symbiospec Audit for self-consistency](workflow_audit_self_consistency.md)

When explicitly requested, check agreement within the selected Symbiospec scope. Report contradictions, inconsistent terminology, and missing descriptions without testing software or applying corrections.

## 5. [Symbiospec Audit for software compliance](workflow_audit_software_compliance.md)

When explicitly requested, compare approved expectations with software and software capabilities with Symbiospec. Report differences and undocumented behaviour while preserving Symbiospec as authoritative.

## 6. [Propose user interface structure](workflow_user_interface.md)

Propose screens and navigation derived from approved concepts and behaviour for human review.

## 7. [Create, review and maintain user scenarios](workflow_user_scenarios.md)

Start product design from human goals or generate proposals from existing Symbiospec. Record human approval separately from specification gaps and software verification, and preserve approved journeys during revision and retirement.
