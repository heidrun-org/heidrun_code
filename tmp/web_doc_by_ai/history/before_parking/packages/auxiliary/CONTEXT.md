# Directory Context: `/packages/auxiliary`

## Purpose
The packages that are useful for the application Heidrun Code, but are not the application itself: a library and the public website. A package that is only a tool for the developers of Heidrun Code goes in `packages/dev_tools`.

## Key Exports & Entry Points
- `raw_coding_agent_cli/`: a library and a command line tool that send one prompt to `codex` or `claude`. See its own CONTEXT.md.
- `website_public/`: the public website and documentation, built with VitePress. See its own CONTEXT.md.

## Rules
- A package that produces the application goes in `packages/apps`, never here.
- A package that is only a tool for the developers of Heidrun Code goes in `packages/dev_tools`, never here.
- No package in `packages/apps` imports a package from this folder.
- No package in this folder imports a package from `packages/dev_tools`.

## Background
- The folder `packages` was split into `apps` and `auxiliary` in [issue #120](https://github.com/heidrun-org/heidrun/issues/120).
- The development tools left this folder for `packages/dev_tools` in [issue #226](https://github.com/heidrun-org/heidrun/issues/226).
