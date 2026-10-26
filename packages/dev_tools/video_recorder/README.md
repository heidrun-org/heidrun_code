# video_recorder

Two command line tools for [Heidrun Code](../../../README.md) that record a marketing video of the Heidrun Code window, and cut it around its mouse clicks. The method, the format of `clicks.json`, and the steps are in [docs/marketing/recording_videos.md](../../../docs/marketing/recording_videos.md).

## What it contains

- `src/video_record_cli.ts`: the command line `pnpm --filter video_recorder video:record`.
- `src/video_cut_cli.ts`: the command line `pnpm --filter video_recorder video:cut`.
- `src/click_logger.js`: finds the window and logs the clicks.
- `scenarios/`: one file for each video, for example `issue_211_pin_a_pane.json`.
- `tests/`: the Vitest tests.

## Commands

```sh
pnpm --filter video_recorder video:record --output-dir ~/heidrun_videos/issue_211   # stop with Ctrl-C
pnpm --filter video_recorder video:cut --recording ~/heidrun_videos/issue_211/recording.json --scenario scenarios/issue_211_pin_a_pane.json
pnpm --filter video_recorder test
```

The tools need macOS and `ffmpeg`.
