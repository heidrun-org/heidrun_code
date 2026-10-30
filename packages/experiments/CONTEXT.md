# Directory Context: `/packages/experiments`

## Purpose
The packages of experiments: code that tries an idea outside the application, so that the experiment does not change the real project.

## Key Exports & Entry Points
- `promotional_videos/`: the working folder to try promotional marketing videos that a coding agent makes: a headless browser records the game Git Runner, and `ffmpeg` adds the intro, the comic words, and the outro. See its own CONTEXT.md.
- `multi_layer_graph/`: a command line tool that builds the multi-layer graph of a repository from the SQLite file of the data layer packages, and a page that shows the graph in 2D and in 3D. See its own CONTEXT.md.
- `work_by_folder_over_time/`: a command line experiment that generates a self-contained animation of Git activity by folder in ten-minute UTC intervals for one workspace folder. See its own CONTEXT.md.
- `mire_live_information/`: an optional Claude Code observer mod and a read-only collector for live subagent states and observed messages. See its own CONTEXT.md.

## Rules
- A package that only tries an idea goes in this folder.
- No package outside this folder imports a package from this folder, and the application does not need any of them to run.
- A package in this folder never writes the SQLite file of the data layer packages. It opens the file read only.

## Background
- The folder comes from [issue #510](https://github.com/heidrun-org/heidrun/issues/510) and its plan, [issue #530](https://github.com/heidrun-org/heidrun/issues/530).
- The package `promotional_videos` comes from [issue #548](https://github.com/heidrun-org/heidrun/issues/548).
- The local AI packages `localai_embeddings`, `localai_decisions_candle`, and `localai_decisions_llamacpp` moved to the repository [localai_rust](https://github.com/heidrun-org/localai_rust) in [issue #954](https://github.com/heidrun-org/heidrun_code/issues/954).
