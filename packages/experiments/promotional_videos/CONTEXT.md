# Directory Context: `/packages/experiments/promotional_videos`

## Purpose
The working folder to try promotional marketing videos of Heidrun Code that a coding agent makes. The first video shows the dinosaur game: the real splash screen of the application, a crossfade to the game, the dinosaur that shoots and then runs into a boulder, and an outro with the baby goat, the motto, and the address of the website.

## Key Exports & Entry Points
- `src/index.ts`: the public interface. It exports the scenario, the checker (`ScenarioChecker`, which plays a scenario with the rules of the package `git_runner`, with no browser), the recorder (`DinoRunRecorder`, a headless Chromium that presses the keys of the scenario), the pictures, and the composer (`VideoComposer`, which uses `ffmpeg`).
- `data/scenarios/video_game_first.scenario.md`: the scenario of the first video. A test compares its table of timed commands with the code.
- Command to make the first video: `pnpm --filter promotional_videos record:video_game_first`. It writes `outputs/video_game/video_game_first.mp4`. Git ignores the folder `outputs/`. The command `record:dino_run` takes the same options without music.
- `--intro-music <file>` plays a music file during the intro, and it fades out with the splash screen. `--outro-music <file>` plays a music file during the outro, and the video ends when `MusicAnalyzer` finds the last silence of the file.
- Command to test this folder: `pnpm --filter promotional_videos test`

## Rules
- A scenario is always played with `ScenarioChecker` before a browser records it, so a recording never starts with a scenario that does not do what it promises.
- The tests use the fixture `tests/fixtures/first_forty_commits.json`, never the file `commits.json` of the game: this file is not in Git. The first commits of the history never change, so the scenario plays the same with the whole file.
- The recorder never uses the port of a server that the developer started, and it never uses the screen or the mouse of the developer.
- The video of the browser starts about one second before `newPage` returns, so the recorder takes the time of the video before it creates the context.
- The browser starts with `--mute-audio`, so a recording never plays a sound on the speakers of the developer. The sound of the game is off at the start, so the recorder presses Space (silent, it starts the audio context and the recorder of the sound), then the key M, before the key Enter.
- The recorded sound starts 0.27 seconds after the time that the page reports, so the recorder subtracts this measured delay. The sound and the picture then differ by about 0.01 seconds.
- The browser writes no audio packet while the page is silent, so `sound.webm` has gaps in its timestamps. The composer reads it with `aresample=async=1` to fill each gap with silence, and it mixes every sound on a silent base track of the exact length of the video. Never use `apad` for this: with the recorded sound it ends the audio early.
- The `ffmpeg` of this computer has no filter that draws text, so a browser draws every text of the video as a picture, and `ffmpeg` only puts the pictures together.
- The motto comes from `data/identity.json` and the images come from `data/images`: this package never copies them.
- The videos and the music files stay out of the repository: the command line receives the path of the music file. The music of the first video is "Epic Background Music" by echoes_of_lumen, and the music of the outro is "Podcast Outro Music" by Vadim_Makes_Sound. Both come from Pixabay (Pixabay Content License, credit not required).
- Nothing outside the folder `packages/experiments` imports this package.
- The game comes from the package `git_runner` of the Git submodule `submodules/heidrun_git_runner`. Change the game in the repository `heidrun_git_runner`, never here.

## Background
- The package comes from [issue #548](https://github.com/heidrun-org/heidrun/issues/548) and its parent, [issue #547](https://github.com/heidrun-org/heidrun/issues/547).
- The game moved to the repository `heidrun_git_runner` in [issue #889](https://github.com/heidrun-org/heidrun_code/issues/889).
- The method to record the window of Heidrun Code itself is in [recording_videos.md](../../../docs/marketing/recording_videos.md).
