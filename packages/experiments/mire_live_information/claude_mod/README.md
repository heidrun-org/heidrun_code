# Heidrun Mire observer

This optional Claude Code mod exports local observations for the Mire investigation. It records live subagents, typed pending questions and approvals, and message send/receive events. It passes each event and decision through unchanged. Start the collector first to create `/tmp/heidrun_mire_live`, then load this directory explicitly with `claude --plugin-dir`. No installation or global configuration change is required. See the parent README for the collector, supported versions, live evidence, and lifecycle limitations.
