# Symbiospec Audit for software compliance

## 1. Request and scope

Run only when explicitly requested. The human may request this audit alone or together with Symbiospec Audit for self-consistency, choose the scope, or defer the audit. A rule change does not automatically trigger this audit.

Example request:

> Run Symbiospec Audit for software compliance for document sharing. Compare approved sharing descriptions with software and look for sharing capabilities missing from Symbiospec. Report findings here; do not apply corrections.

Identify the approved specification references, relevant user scenarios, software revision and environment, and the capabilities within the requested scope. Record available source code, tests, and permitted application observations. Propose a bounded scope if the request leaves scope unclear. Follow necessary references and report boundaries or unavailable evidence rather than silently expanding the audit.

Symbiospec remains authoritative. Software and tests provide evidence of implementation, not approval of product meaning. Uncertain approval or conflicting approved descriptions must be reported; do not choose the intended rule from current software behaviour.

## 2. Compare in both directions

### 2.1. From Symbiospec to software

For each approved expectation in scope, inspect relevant implementation paths, test expectations, and permitted application observations. Check required outcomes, conditions, failures, interface actions, and approved user scenarios. Report violations, missing implementation, and behaviour that could not be verified, distinguishing evidence from inference.

### 2.2. From software to Symbiospec

Independently identify software capabilities in scope from relevant screens, available actions, entry points, source code, and tests. Do not build the capability list only from the specification: that would miss entire undocumented features.

For each identified capability, find the corresponding approved Symbiospec description. Report behaviour or features without a corresponding description even when no written rule is contradicted. Identify the software evidence and the documents and references searched. If only a proposal describes the capability, report that approval is unresolved. If coverage is incomplete, say that no matching description was found in the examined documents; do not claim absence throughout all Symbiospec without sufficient investigation.

Completeness concerns product behaviour and relevant product constraints, not documentation of every internal function or algorithm. Existing partial adoption explains a gap but does not make the gap disappear. Report capabilities outside the requested scope as unexamined rather than automatically auditing the rest of the product.

## 3. Establish the evidence limits

Record source inspection, test inspection, executed tests, and direct application observations separately. For execution, include the actual command or interaction, relevant raw output or observed result, and the environment and conditions exercised. Reading a test is not running a test; passing tests do not prove complete compliance. A missing test is a coverage gap, not proof of broken behaviour.

When the environment or permissions prevent a meaningful check, mark the behaviour as not verified and explain the missing evidence. Do not substitute a different environment and claim that the requested environment was tested. This audit does not prove internal specification consistency; if that review is requested, use [Symbiospec Audit for self-consistency](workflow_audit_self_consistency.md).

## 4. Report and stop

Use the [audit and Realignment report conventions](format.md#44-audit-and-realignment-reports). Include both comparison directions, actual evidence links, checked and unchecked capabilities, and limitations. Distinguish confirmed conflicts, missing descriptions, unresolved product decisions, and behaviour that has not been verified.

Present findings in the conversation unless saving a report is authorized. Observing undocumented software behaviour does not authorize adding the behaviour to Symbiospec or treating the behaviour as approved. Do not change software, tests, or approved descriptions merely because a finding exists. For requested correction work, use [Realignment](workflow_realign.md) within the actual authorization.

## 5. Illustrative findings

These fictional examples are not actual execution evidence or approved product decisions.

| Comparison | Finding | Evidence to include in an actual report |
| --- | --- | --- |
| An approved rule requires a failure message when sharing fails; the application shows success after a rejected sharing request. | Confirmed conflict when reproduced under the stated conditions. | Link the approved rule, relevant user scenario if present, implementation, and actual observation or executed check. If only source code was inspected, state that limit. |
| The software provides expiring sharing links, but no corresponding description is found in the examined sharing specification. | Missing description, even if no written sharing rule forbids expiring links. | Link the software capability evidence, identify the documents searched, and state whether the capability was exercised. Human review decides whether to specify, change, or remove the capability. |
| Symbiospec requires revocation, but the available environment cannot exercise revocation. | Behaviour not verified. | Link the expected behaviour and any inspected implementation; record the unavailable check. Do not report compliance or a confirmed failure. |
