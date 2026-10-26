# Directory Context: `/packages/experiments`

## Purpose
The packages of experiments: code that tries an idea outside the application, so that the experiment does not change the real project.

## Key Exports & Entry Points
- `promotional_videos/`: the working folder to try promotional marketing videos that a coding agent makes: a headless browser records the game Git Runner, and `ffmpeg` adds the intro, the comic words, and the outro. See its own CONTEXT.md.
- `multi_layer_graph/`: a command line tool that builds the multi-layer graph of a repository from the SQLite file of the data layer packages, and a page that shows the graph in 2D and in 3D. See its own CONTEXT.md.
- `work_by_folder_over_time/`: a command line experiment that generates a self-contained animation of Git activity by folder in ten-minute UTC intervals for one workspace folder. See its own CONTEXT.md.
- `localai_decisions_candle/`: a Rust library and a command line tool that run the decision model GLiNER2.5-Decide on the computer: it reads a text and a list of labels, and returns the label that matches the text. See its own CONTEXT.md.
- `localai_decisions_llamacpp/`: a Rust library and a command line tool that run the decision models based on Qwen3.5 on the computer with llama.cpp: it reads a text and typed questions, and returns a probability for each option, as the System One API. See its own CONTEXT.md.
- `localai_embeddings/`: a Rust library and command line tool for computing text embeddings locally on the CPU or a supported accelerator. See its own CONTEXT.md.

## Rules
- A package that only tries an idea goes in this folder.
- No package outside this folder imports a package from this folder, and the application does not need any of them to run.
- A package in this folder never writes the SQLite file of the data layer packages. It opens the file read only.

## Background
- The folder comes from [issue #510](https://github.com/heidrun-org/heidrun/issues/510) and its plan, [issue #530](https://github.com/heidrun-org/heidrun/issues/530).
- The package `promotional_videos` comes from [issue #548](https://github.com/heidrun-org/heidrun/issues/548).
- The package `localai_decisions_candle` comes from [issue #717](https://github.com/heidrun-org/heidrun/issues/717).
- The package `localai_decisions_llamacpp` comes from [issue #721](https://github.com/heidrun-org/heidrun/issues/721).
