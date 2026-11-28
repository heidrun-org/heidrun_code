# Symbiospec Audit for self-consistency

## 1. Request and scope

Run only when explicitly requested. The human may request this audit alone or together with Symbiospec Audit for software compliance, choose the scope, or defer the audit. A rule change does not automatically trigger this audit.

Example request:

> Run Symbiospec Audit for self-consistency for document sharing, including approved sharing user scenarios. Report findings here; do not change the specification or software.

Identify the requested documents, approval evidence, and relevant user scenarios. Follow references needed to understand the selected scope; identify consequential references outside that scope without silently expanding into a whole-product audit. If the request leaves scope unclear, propose a bounded scope before starting substantial investigation. Missing or uncertain approval is an unresolved product decision, not permission to invent an approved expectation.

## 2. Review the specification internally

Use Symbiospec alone to compare the selected approved concepts, canonical names, rules, Behaviour, User Interface, Styling, Platform Support, and System Overview descriptions. Check that definitions and relationships agree, terminology is consistent, and each fact has one responsible description rather than conflicting copies.

Walk through each approved user scenario in scope from its starting conditions to its expected outcome, including relevant failure and recovery paths. Follow the referenced rules, behaviours, and navigation. Report contradictions, missing actions or descriptions, disconnected navigation, unclear outcomes, and unresolved decisions. Do not invent a user scenario when no approved user scenario exists; state that limitation.

Do not run software or infer implementation compliance from this review. If the human also requests software comparison, use [Symbiospec Audit for software compliance](workflow_audit_software_compliance.md) separately and distinguish the evidence.

## 3. Report and stop

Use the [audit and Realignment report conventions](format.md#44-audit-and-realignment-reports). Link each finding to the actual descriptions, approval evidence, and user scenarios involved. Distinguish confirmed conflicts, missing descriptions, and unresolved product decisions. Name any software behaviour as unverified by this audit; specification support for a user scenario is not evidence that software works.

Report examined and unexamined scope even when no conflict is found. Present findings in the conversation unless saving a report is authorized. Audit findings do not authorize corrections or changes to approved product meaning or user scenarios. For requested correction work, use [Realignment](workflow_realign.md) within the actual authorization.

## 4. Illustrative findings

These fictional examples show how to classify findings; they are not results of an audit or approved product decisions.

| Reviewed descriptions | Finding | Evidence to include in an actual report |
| --- | --- | --- |
| An approved sharing rule requires every reader to sign in; an approved sharing user scenario requires a recipient without an account to read the document. | Confirmed conflict. The user scenario cannot satisfy the rule. | Links to both approved descriptions and the conflicting step of the user scenario. Human discussion must decide which expectation changes. |
| An approved user scenario requires revoking access, but the examined Behaviour and User Interface descriptions do not explain the action or outcome. | Missing description needed to follow the user scenario. | Link to the user scenario step and identify the referenced descriptions examined. Do not claim that software lacks revocation. |
| The Glossary defines a Reader, while a related description uses Viewer without defining whether Viewer means Reader. | Unresolved product decision about terminology. | Links to both descriptions; do not silently merge the concepts or rename either concept. |

A conflict already noticed during ordinary discussion should be mentioned without launching this audit. The human retains control over deeper review and may defer that review.
