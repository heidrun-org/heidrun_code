import Fs from 'node:fs';
import Path from 'node:path';
import { chromium } from 'playwright-core';
import type { GameCommand } from 'git_runner';
import { AudioCaptureScript } from './audio_capture_script.ts';
import type { CapturedAudio } from './audio_capture_script.ts';
import type {
	CommandPress,
	DinoRunScenario,
	RecordedSound,
	RecordingTimeline,
	ScenarioReport,
} from './dino_run_types.ts';
import { ViteServers } from './vite_servers.ts';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DinoRunRecorder — records a scenario of the dinosaur game in a headless browser
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Records a video of the page of the dinosaur game. It starts its own server of the game on a free port, opens the page
 * in a headless Chromium that records a video, and presses the keys of the scenario at the right times. The browser
 * runs in the background: the recording needs no permission of the screen and it never moves the mouse of the
 * developer. It writes the video of the browser, and it gives back the time of each key press in this video.
 */
export class DinoRunRecorder {
	/** The folder of the package `git_runner`, in the Git submodule `submodules/heidrun_git_runner`. */
	private static readonly _GAME_FOLDER = Path.resolve(
		__dirname,
		'../../../../submodules/heidrun_git_runner/packages/git_runner',
	);

	/** The code of the key of each command, as the page reads it. */
	private static readonly _COMMAND_KEYS: Readonly<Record<GameCommand, string>> = {
		start: 'Enter',
		pause: 'KeyP',
		jump: 'Space',
		laneUp: 'ArrowUp',
		laneDown: 'ArrowDown',
		shoot: 'KeyF',
	};

	/** The code of the key that turns the sound of the game on, as the page reads it. */
	private static readonly _SOUND_KEY = 'KeyM';

	/** The width of the video, in pixels. */
	static readonly VIDEO_WIDTH = 1280;

	/** The height of the video, in pixels. */
	static readonly VIDEO_HEIGHT = 720;

	/** The time that the first page stays open before the page loads again, in seconds. */
	private static readonly _FIRST_LOAD_SECONDS = 1;

	/** The time between the second load and the silent key that starts the audio context, in seconds. */
	private static readonly _CONTEXT_KEY_DELAY_SECONDS = 0.2;

	/** The time between the silent key and the key M that turns the sound on, in seconds. */
	private static readonly _SOUND_KEY_DELAY_SECONDS = 0.5;

	/**
	 * The time that the audio recorder of the browser needs before its first sample, in seconds, measured with the
	 * jingle of the key Enter. The recorded sound is this much later than the start that the page reports.
	 */
	private static readonly _AUDIO_RECORDER_LATENCY_SECONDS = 0.27;

	/** The time that the start card shows after the second load, in seconds. The crossfade of the intro uses a part. */
	private static readonly _START_CARD_SECONDS = 2;

	/** The time that the game over card shows after the hit, in seconds. */
	private static readonly _GAME_OVER_SECONDS = 3;

	/**
	 * Gives the key that a command presses.
	 * @param command The command.
	 * @returns The code of the key.
	 */
	static keyOf(command: GameCommand): string {
		return DinoRunRecorder._COMMAND_KEYS[command];
	}

	/**
	 * Records the scenario.
	 * @param scenario The scenario.
	 * @param report What the scenario does with the rules of the game. The recording waits until the time of the hit.
	 * @param outputFolder The folder that receives the video of the browser. It is made when it does not exist.
	 * @returns The path of the video of the browser, and the time of each thing in this video.
	 */
	static async record(
		scenario: DinoRunScenario,
		report: ScenarioReport,
		outputFolder: string,
	): Promise<RecordingTimeline> {
		Fs.mkdirSync(outputFolder, { recursive: true });
		const rawFolder = Path.join(outputFolder, 'raw');
		const { server, address } = await ViteServers.start(DinoRunRecorder._GAME_FOLDER);
		// The browser never plays the sound on the speakers of the developer: the sound is only recorded.
		const browser = await chromium.launch({ headless: true, args: ['--mute-audio'] });
		const commandPresses: CommandPress[] = [];
		let rawVideoPath: string;
		let gameStartSeconds: number;
		let gameEndSeconds: number;
		let recordedSound: RecordedSound | null = null;
		try {
			const videoStartMilliseconds = performance.now();
			const videoStartEpochMilliseconds = Date.now();
			const context = await browser.newContext({
				viewport: {
					width: DinoRunRecorder.VIDEO_WIDTH,
					height: DinoRunRecorder.VIDEO_HEIGHT,
				},
				recordVideo: {
					dir: rawFolder,
					size: {
						width: DinoRunRecorder.VIDEO_WIDTH,
						height: DinoRunRecorder.VIDEO_HEIGHT,
					},
				},
			});
			await context.addInitScript(AudioCaptureScript.source());
			const page = await context.newPage();
			await page.goto(`${address}/?seed=${scenario.seed}`);
			await DinoRunRecorder._sleep(DinoRunRecorder._FIRST_LOAD_SECONDS);
			await page.reload();
			gameStartSeconds = (performance.now() - videoStartMilliseconds) / 1000;
			if (scenario.isSoundOn === true) {
				// The key Space does nothing before the run, but it starts the audio context, so the recorder
				// of the sound runs before the key M plays its first note.
				await DinoRunRecorder._sleep(DinoRunRecorder._CONTEXT_KEY_DELAY_SECONDS);
				await page.keyboard.press(DinoRunRecorder.keyOf('jump'));
				await DinoRunRecorder._sleep(DinoRunRecorder._SOUND_KEY_DELAY_SECONDS);
				await page.keyboard.press(DinoRunRecorder._SOUND_KEY);
				await DinoRunRecorder._sleep(
					DinoRunRecorder._START_CARD_SECONDS -
						DinoRunRecorder._CONTEXT_KEY_DELAY_SECONDS -
						DinoRunRecorder._SOUND_KEY_DELAY_SECONDS,
				);
			} else {
				await DinoRunRecorder._sleep(DinoRunRecorder._START_CARD_SECONDS);
			}
			await page.keyboard.press(DinoRunRecorder.keyOf('start'));
			const runStartMilliseconds = performance.now();
			for (const timedCommand of scenario.timedCommands) {
				await DinoRunRecorder._sleepUntil(runStartMilliseconds + timedCommand.timeSeconds * 1000);
				commandPresses.push({
					command: timedCommand.command,
					label: timedCommand.label,
					videoSeconds: (performance.now() - videoStartMilliseconds) / 1000,
				});
				await page.keyboard.press(DinoRunRecorder.keyOf(timedCommand.command));
			}
			await DinoRunRecorder._sleepUntil(
				runStartMilliseconds + (report.endSeconds + DinoRunRecorder._GAME_OVER_SECONDS) * 1000,
			);
			gameEndSeconds = (performance.now() - videoStartMilliseconds) / 1000;
			if (scenario.isSoundOn === true) {
				const capturedAudio = (await page.evaluate(AudioCaptureScript.FINISH_EXPRESSION)) as CapturedAudio | null;
				if (capturedAudio === null) {
					throw new Error('The page made no sound, so there is nothing to record.');
				}
				const soundPath = Path.join(outputFolder, 'sound.webm');
				Fs.writeFileSync(soundPath, Buffer.from(capturedAudio.base64, 'base64'));
				recordedSound = {
					path: soundPath,
					startSeconds:
						(capturedAudio.startEpochMilliseconds - videoStartEpochMilliseconds) / 1000 -
						DinoRunRecorder._AUDIO_RECORDER_LATENCY_SECONDS,
				};
			}
			const video = page.video();
			await context.close();
			if (video === null) {
				throw new Error('The browser made no video.');
			}
			rawVideoPath = await video.path();
		} finally {
			await browser.close();
			await server.close();
		}
		const rawWebmPath = Path.join(outputFolder, 'raw.webm');
		Fs.renameSync(rawVideoPath, rawWebmPath);
		Fs.rmSync(rawFolder, { recursive: true, force: true });
		const recordingTimeline: RecordingTimeline = {
			rawVideoPath: rawWebmPath,
			gameStartSeconds,
			gameEndSeconds,
			commandPresses,
			recordedSound,
		};
		return recordingTimeline;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Waits for a time.
	 * @param seconds The time to wait, in seconds.
	 */
	private static async _sleep(seconds: number): Promise<void> {
		await new Promise<void>((resolve) => {
			setTimeout(resolve, seconds * 1000);
		});
	}

	/**
	 * Waits until a time of the clock of the process.
	 * @param targetMilliseconds The time, as `performance.now()` gives it.
	 */
	private static async _sleepUntil(targetMilliseconds: number): Promise<void> {
		const waitMilliseconds = targetMilliseconds - performance.now();
		if (waitMilliseconds > 0) {
			await DinoRunRecorder._sleep(waitMilliseconds / 1000);
		}
	}
}
