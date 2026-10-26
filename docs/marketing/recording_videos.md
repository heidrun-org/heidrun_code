# Recording marketing videos of Heidrun Code

- Created: 11 October 2026
- Last updated: 13 October 2026
- Status: Maintained method for recording videos
- Related framing: [Project instructions](../../AGENTS.md)
- Related issue: [issue 211](https://github.com/heidrun-org/heidrun/issues/211)

The package `packages/dev_tools/video_recorder` records a short video of the Heidrun Code window, with the mouse and a circle at each click, and cuts it around the clicks. The first video was made for [issue #211](https://github.com/heidrun-org/heidrun/issues/211). The raw videos and the cut videos stay out of the repository.

## Method

1. Write a scenario file in `packages/dev_tools/video_recorder/scenarios/`: the list of the clicks, with what each click does.
2. Run `pnpm --filter video_recorder video:record --output-dir <folder>`. The tool records only the Heidrun Code window with `screencapture -v -C -k -o -l<window id>`, and logs each click. Other windows on top of the Heidrun Code window, for example the Claude window, do not show in the video.
3. Computer use runs the scenario in the real Heidrun Code window and moves the real mouse. Each click is "mouse button down, wait 0.1 second, mouse button up". A click without this wait is too short, and the click logger does not see it.
4. Stop the recording with Ctrl-C, or with SIGTERM.
5. Run `pnpm --filter video_recorder video:cut --recording <folder>/recording.json --scenario <scenario file>`. The tool cuts the video from 1 second before the first click to 1.5 seconds after the last click, and writes `cut.mp4` and `clicks.json` in the same folder.
6. Remotion can use `clicks.json` to add titles, zooms, and music.

The recording needs the permission Screen Recording for the terminal application. The tools need `ffmpeg` and `ffprobe`. The number of logged clicks must equal the number of clicks of the scenario, or `pnpm --filter video_recorder video:cut` fails.

## Files in the output folder

- `raw.mov`: the video of the window.
- `clicks_log.jsonl`: one line for each click: `timeSeconds` (since 1970-01-01), `x` and `y` (screen points).
- `recording.json`: the start time of the recording, and the identifier and the bounds of the window.
- `cut.mp4`: the cut video, H.264, without sound.
- `clicks.json`: the clicks in the cut video.

## Format of `clicks.json`

```json
{
	"scenario": "issue_211_pin_a_pane",
	"video": { "widthPixels": 1920, "heightPixels": 1200, "durationSeconds": 7.8 },
	"clicks": [
		{ "index": 0, "timeSeconds": 1, "x": 640, "y": 38, "label": "Click the second tab in the tab bar" }
	]
}
```

- `timeSeconds`: the time of the click in `cut.mp4`, in seconds.
- `x` and `y`: the position of the click in `cut.mp4`, in pixels from the top-left corner.
- `label`: what the click does, from the scenario.

## Start delay

`pnpm --filter video_recorder video:cut` takes the start of the video from the moment when `screencapture` was started. The first frame comes a little later. If the circles of the clicks come too early in the video, measure the difference and give it with `--start-delay <seconds>`.
