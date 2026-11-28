# Update Symbiospec as the software changes

Read the affected approved specifications before implementation. Use the user's development request to determine the authorized product change, and identify which concepts, behaviours, interface descriptions, styling conventions, platform requirements, or overview relationships are affected.

Update the corresponding Symbiospec content in the same development task. Keep unchanged product meaning unchanged, and maintain affected links and indexes. Technical refactoring with no product-level effect needs no artificial specification edit; say that no relevant specification change was found when useful.

Existing authorization applies. If the work exposes additional product decisions, prepare those decisions together for review. Apply authorized updates without asking again, and preserve unresolved proposals separately. An implementation mistake or unexpected test result does not authorize a changed product requirement.

Record meaningful decisions and coverage changes only after the shared check has brought the project to the latest installed published format. In `3.1.0`, follow the [decision writing and summary maintenance procedure](format-v3.1.0.md#422-indexes-and-topic-summaries): mark affected topics before writing, preserve earlier records, update date indexes, topic summaries and approval links, then mark summaries current last. Use the [reading procedure](format-v3.1.0.md#423-reading-procedure) to locate relevant original evidence without reading the complete history. Older `1.0.0` data is a migration source; do not continue maintaining its single history file as normal work. Run checks appropriate to the actual implementation and documentation change. Summarize the resulting product difference, affected specification, verification performed, and remaining uncertainty.

Record actual examinations under [coverage storage](format-v3.1.0.md#43-coverage), marking affected topics before writing and current only after verification. Preserve earlier observations and unexamined scope.

For explicitly requested user scenario creation or revision, follow the [user scenario workflow](workflow_user_scenarios.md). During rule discussion, report apparent conflicts already noticed with approved user scenarios. Do not automatically search affected user scenarios, repeat their reviews after every rule change, or require an audit before approval. Preserve approved journeys until an actual human decision authorizes revision, replacement or retirement.
