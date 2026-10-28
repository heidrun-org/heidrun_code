# Directory Context: `/submodules`

## Purpose
Independent repositories included in Heidrun Code as Git submodules at recorded commits.

## Key Exports & Entry Points
- `coding_agent_plugin/`: the independent repository of coding agent workflow skills and Jérôme Étienne’s personal coding style; see its own README.md and CONTEXT.md.
- `heidrun_data/`: the independent repository of the data layer packages; its folder `packages` holds the Rust packages that the desktop application uses; see its own README.md and CONTEXT.md.

## Rules
- Each submodule keeps its own repository, history, and maintenance rules.
- Initialize submodules with `git submodule update --init --recursive` from the Heidrun Code checkout root.
- Make skill changes in `jeromeetienne/coding_agent_plugin`, then update Heidrun Code's recorded submodule commit when adopting a version.
- The submodules are outside the pnpm workspace.
- `coding_agent_plugin` has no application build dependency.
- The packages of `heidrun_data/packages` are members of the Cargo workspace of Heidrun Code. Run Cargo for them at the root of Heidrun Code with `--package <name>`, so that the compiled files go in the target folder of `desktop_tauri` and not in the target folder that the `.cargo/config.toml` of each package names.
- Make data layer changes in `heidrun-org/heidrun_data`, then update the recorded submodule commit of Heidrun Code.
- Existing skills in `.agents/skills` remain separate copies and are not synchronized automatically.

## Background
- https://github.com/heidrun-org/heidrun/issues/708
- https://github.com/heidrun-org/heidrun_code/issues/848
