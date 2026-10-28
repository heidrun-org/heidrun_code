# Scenario: video_game_first

- Created: 16 October 2026
- Last updated: 16 October 2026
- Status: Scenario of the first promotional video, kept true by a test
- Related framing: [Project instructions](../../../../../AGENTS.md)
- Related issue: [Issue 548](https://github.com/heidrun-org/heidrun/issues/548)

This file stores the scenario that produces the video `outputs/video_game/video_game_first.mp4`. The video is about 15.2 seconds long, 1280 by 720 pixels, 25 frames each second. The test `tests/video_game_first_scenario_document.test.ts` reads the table of timed commands below and fails when the table differs from the file `src/dino_hits_a_boulder_scenario.ts`.

To make the video again, run `pnpm --filter promotional_videos record:video_game_first` after you put the two music files in the folder `outputs/music` (see the section "Music").

## Story in one sentence

A dinosaur runs, shoots a rock until the rock breaks, changes lanes, then runs into the next rock on purpose, and the game over card shows.

## Storyboard

1. **Intro, 3 seconds.** The real splash screen of the application fills the whole frame (the top and the bottom of the picture are cropped, there are no bars). Music 1 plays and fades out with the picture.
2. **Crossfade, 1 second.** The splash screen fades into the start card of the game.
3. **Gameplay, about 10.7 seconds.** The page of the game loads again, shows the start card for 2 seconds, then the scenario runs (see the table below). The word "POW!" shows for 0.45 second at each shot. The sound of the game is recorded and mixed in.
4. **Game over card, 3 seconds.** It shows after the hit.
5. **Outro, 3 seconds.** A black background with the baby goat, the motto, and the address of the website. The video fades to the outro in 0.5 second. Music 2 plays, and the video ends when the sound of Music 2 ends.

## Game settings

- Seed of the game: 42.
- Commits: the first commits of this repository. They never change, so the game is the same each time.
- Sound of the game: on (the key M).
- The scenario must have the events `rockShrunk`, `rockDestroyed`, and `hit`, and the hit must come between 5 and 6 seconds after the key Enter.

## Timed commands

The time counts from the key Enter that starts the run.

| Time (seconds) | Command | Label |
| --- | --- | --- |
| 0.3 | shoot | First shot at the large rock |
| 0.6 | shoot | Second shot: the rock shrinks |
| 0.9 | shoot | Third shot: the rock shrinks again, then breaks |
| 3.3 | laneUp | Go to the far lane to pass the second large rock |
| 4.3 | laneDown | Come back to the middle lane, in front of the medium rock |

## Events that the rules of the game give

| Time (seconds) | Event |
| --- | --- |
| 0.00 | start |
| 0.67 | rockShrunk |
| 0.92 | rockShrunk |
| 1.15 | rockDestroyed |
| 3.30 | laneChange |
| 4.30 | laneChange |
| 5.43 | hit |

## Texts of the outro

- Motto: "With AI, every developer is THE GOAT!"
- Address: `https://heidrun-org.github.io/heidrun_code/`
- Picture: `data/images/baby_goat.png` of the repository.

## Music

The two files come from Pixabay, under the Pixabay Content License. The files are not in the repository, because the license does not allow to redistribute a music file alone. Download both files, and save them in the folder `outputs/music` with these names:

- Music 1, intro: [Epic Background Music by Echoes of Lumen](https://pixabay.com/music/adventure-epic-background-music-595722/), saved as `echoes_of_lumen-epic-background-music-595722.mp3`. Volume 0.8, fades out with the splash screen.
- Music 2, outro: [Podcast Outro Music by Vadim Makes Sound](https://pixabay.com/music/lofi-podcast-outro-music-551266/), saved as `vadim_makes_sound-podcast-outro-music-551266.mp3`. Volume 0.4. The video ends at the last silence of this music, which the program `ffmpeg` finds with `silencedetect` (−50 dB, 0.1 second).

## Sound of the game

The headless browser records no sound by itself. An init script copies the sound of the page with `MediaRecorder`. The sound is 3 times louder in the mix, it is placed with the clock of the video (the recorder is 0.27 second late), and the gaps in the sound are filled with silence.

## Announcement text

Posted with the video:

> Something is waking up in the code.
> Five seconds. One rock. No way out.
> 🐐

## Reproduction

```bash
pnpm --filter promotional_videos record:video_game_first
```
