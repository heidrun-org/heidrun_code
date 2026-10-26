# Promotional videos

- Created: 16 October 2026
- Last updated: 16 October 2026
- Status: Maintained overview for people
- Related framing: [Project instructions](../../../AGENTS.md)
- Related issue: [Issue 548](https://github.com/heidrun-org/heidrun/issues/548)

This package is the working folder for promotional marketing videos that an agent makes. It records the web pages of Heidrun Code with a headless browser (a browser with no window), and it puts an intro, comic words, sound, music, and an outro around the recording with the program `ffmpeg`.

## The first video

The video `video_game_first` shows the Parallax dino runner game. The dinosaur shoots a rock, changes lanes, and runs into the next rock. The video is about 15 seconds long. The scenario is written in [data/scenarios/video_game_first.scenario.md](data/scenarios/video_game_first.scenario.md).

## What you need

- The programs `ffmpeg` and `ffprobe`, with the filters `xfade`, `amix`, and `silencedetect`.
- Dependencies installed with `pnpm install`, and a Chromium browser for Playwright.
- Two music files from Pixabay, saved in the folder `outputs/music` with the names that the scenario document gives. Git does not keep them, because the license of Pixabay does not allow to redistribute a music file alone.

## Make the video

```bash
pnpm --filter promotional_videos record:video_game_first
```

The video is saved as `outputs/video_game/video_game_first.mp4`. The folder `outputs` is ignored by Git. Play the video and listen to it: the command checks the scenario with the rules of the game before it records, but it cannot judge the picture or the sound.

## Test

```bash
pnpm --filter promotional_videos test
```

The tests start no browser. They check the scenario, the filter graph of `ffmpeg`, the search of the last silence of a music file, and that the scenario document says the same as the code.

## Make a new video

1. Write a new scenario document in `data/scenarios`.
2. Write the scenario in the code, in the same way as `src/dino_hits_a_boulder_scenario.ts`.
3. Add a script to `package.json`.
4. Add a test that compares the document with the code.
