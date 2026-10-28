# Directory Context: `/tmp/web_doc_by_ai/workspace`

## Purpose
A frozen Heidrun Code source snapshot with an isolated documentation writer, judge and preview website.

## Key Exports & Entry Points
- `packages/dev_tools/documentation_updater/`: writer and judge; public interface is its src/index.ts.
- `packages/auxiliary/website_public/`: experiment website; see its CONTEXT.md.
- `packages/auxiliary/raw_coding_agent_cli/`: captured agent-command support; see its CONTEXT.md.
- `packages/dev_tools/change_log_generator/`: captured read-only Git helpers; see its CONTEXT.md.
- `packages/apps/`: source inputs, not the running production application.
- `docs/` and `data/`: captured rules, glossary and application assets.
- Run commands with `pnpm --dir tmp/web_doc_by_ai/workspace` from the real repository root.

## Rules
- Writer and judge entry points resolve this directory directly, never the enclosing Git repository root.
- Generated pages and sidebar edits stay under this snapshot's website_public package.
- Git metadata comes from the enclosing repository and is read only; provenance.json records the captured source version.
- Never deploy this snapshot or invoke release, branch, commit or pull request commands from its copied package.json.
- Installed dependencies and build output are local runtime files, not captured source.

## Background
- See ../process/HANDOFF.md for scope, findings and the next permitted work.
