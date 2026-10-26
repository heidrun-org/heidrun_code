# Directory Context: `/packages/dev_tools`

## Purpose
The packages that are only tools for the developers of Heidrun Code. None of them is part of the application, and the application does not need any of them to run.

## Key Exports & Entry Points
- `agents_rules_checker/`: a package with the test of the maximum size of a file of the agent rules in the folder `docs/agents_rules`. Command: `pnpm --filter agents_rules_checker test`. See its own CONTEXT.md.
- `data_layer_boundary_checker/`: a package with the test that fails when the Past chats sidebar section or the Statistics window gets data without a package of the folder `submodules/heidrun_data/packages`. Command: `pnpm --filter data_layer_boundary_checker test`. See its own CONTEXT.md.
- `change_log_generator/`: a command line tool that writes `CHANGELOG.md` from the merged pull requests. Command: `pnpm release:change_log`. See its own CONTEXT.md.
- `documentation_by_ai/`: one documentation writing call followed by one website build, plus a validated full update that opens a draft for review. Command: `pnpm docs:generate-and-build`. See its own CONTEXT.md.
- `install_script_tests/`: a package with the tests of the script `scripts/install.sh`. Command: `pnpm --filter install_script_tests test`. See its own CONTEXT.md.
- `video_recorder/`: two command line tools that record a video of the Heidrun Code window and cut it around its mouse clicks. Commands: `pnpm --filter video_recorder video:record` and `pnpm --filter video_recorder video:cut`. See its own CONTEXT.md.
- `worktree_tools/`: four command line tools: one creates a Git worktree and clones the compiled Rust files into it, one deletes the old Cargo target folders of the worktrees, one deletes the files of a debug folder that the current builds do not use, and one builds the bundled command line tools only when their sources changed. Commands: `pnpm worktree:create`, `pnpm --filter desktop_tauri target:clean`, `pnpm --filter desktop_tauri target:prune`, and `pnpm bundled_commands:build`. See its own CONTEXT.md.

## Rules
- A package that is only a tool for the developers of Heidrun Code goes in this folder.
- No package in `packages/apps` and no package in `packages/auxiliary` imports a package from this folder.
- A package in this folder may use a package from `packages/auxiliary`. Example: `change_log_generator` runs the executable of `coding_agent_cli`.

## Background
- The three development tools moved here from `packages/auxiliary` in [issue #226](https://github.com/heidrun-org/heidrun/issues/226).
- The package `coding_agent_cli` stays in `packages/auxiliary` because the desktop application uses its library, and `change_log_generator` runs its executable.
