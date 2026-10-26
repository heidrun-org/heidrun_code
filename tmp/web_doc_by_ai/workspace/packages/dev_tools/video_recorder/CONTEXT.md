# Directory Context: `/tmp/web_doc_by_ai/workspace/packages/dev_tools/video_recorder`

## Purpose
A full npm package with two command line tools that record a marketing video of the Heidrun Code window and cut it around its mouse clicks. The recording tool also logs each click. The cutting tool writes `clicks.json`, which Remotion can use later to add titles and zooms.

## Key Exports & Entry Points
- `src/index.ts`: the public interface for another package. It exports the classes `ClicksBuilder`, `VideoCutter`, and `VideoRecorder` and their types.
- `src/video_record_cli.ts`: the command line `pnpm --filter video_recorder video:record`.
- `src/video_cut_cli.ts`: the command line `pnpm --filter video_recorder video:cut`.
- `src/click_logger.js`: the script that finds a window and logs the left mouse button presses. It runs with `osascript -l JavaScript`.
- `src/video_files.ts`: the class `VideoFiles`, the only code that reads the files of a recording and runs `ffprobe` and `ffmpeg`.
- `scenarios/`: one JSON file for each video, with the label of each click in order.
- `tests/`: the Vitest tests. `tests/cli.test.ts` needs `ffmpeg`, and the tests of the click logger need macOS.
- Command to test this folder: `pnpm --filter video_recorder test`

## Rules
- The click logger needs no compiler and no permission: it reads the state of the mouse button 200 times each second. Swift is not used, because the Command Line Tools of this computer cannot compile it.
- `ClicksBuilder` has no file access and no process: all the file and process code is in `VideoFiles` and `VideoRecorder`.
- The number of logged clicks must equal the number of clicks of the scenario. The cutting tool fails otherwise.
- The raw videos and the cut videos stay out of the repository.
- The format of `clicks.json` and the method are described in one place: [docs/marketing/recording_videos.md](../../../docs/marketing/recording_videos.md). Do not copy them here.

## Background
- The package was created by [issue #217](https://github.com/heidrun-org/heidrun/issues/217), after the first video of [issue #211](https://github.com/heidrun-org/heidrun/issues/211).
