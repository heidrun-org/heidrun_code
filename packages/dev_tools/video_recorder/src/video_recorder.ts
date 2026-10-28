import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Path from 'node:path';
import type { Recording, WindowBounds } from './video_recorder_types.ts';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	VideoRecorder — records one window with the command screencapture, and logs the clicks during the recording
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Starts the command `screencapture` on one window and the click logger, and stops both on request.
 */
export class VideoRecorder {
	/** The name of the raw video file. */
	static readonly rawVideoFileName = 'raw.mov';

	/** The name of the file of the click logger. */
	static readonly clicksLogFileName = 'clicks_log.jsonl';

	/** The name of the file that describes the recording. */
	static readonly recordingFileName = 'recording.json';

	/** The command `screencapture` that records the video. */
	private _screenCaptureProcess: ChildProcess.ChildProcess | null = null;

	/** The click logger. */
	private _clickLoggerProcess: ChildProcess.ChildProcess | null = null;

	/**
	 * Finds the window of an application.
	 * @param owner The name of the application, for example `Heidrun Code`.
	 * @returns The identifier and the bounds of the largest visible window of the application.
	 * @throws An `Error` when the application has no visible window.
	 */
	static findWindow(owner: string): WindowBounds {
		const result = ChildProcess.spawnSync(
			'osascript',
			['-l', 'JavaScript', VideoRecorder._clickLoggerPath(), 'window', owner],
			{ encoding: 'utf8' },
		);
		if (result.status !== 0) {
			throw new Error(result.stderr.trim());
		}
		return JSON.parse(result.stdout) as WindowBounds;
	}

	/**
	 * Starts the click logger and the command `screencapture`, and writes the file `recording.json`.
	 * @param options.outputDirectory The folder that receives the raw video, the clicks log, and `recording.json`.
	 * @param options.window The window to record.
	 * @returns The recording that was written.
	 */
	start(options: { outputDirectory: string; window: WindowBounds }): Recording {
		Fs.mkdirSync(options.outputDirectory, { recursive: true });
		const clicksLogFd = Fs.openSync(Path.join(options.outputDirectory, VideoRecorder.clicksLogFileName), 'w');
		this._clickLoggerProcess = ChildProcess.spawn(
			'osascript',
			['-l', 'JavaScript', VideoRecorder._clickLoggerPath(), 'clicks'],
			{ stdio: ['ignore', clicksLogFd, 'inherit'] },
		);
		const rawVideoPath = Path.join(options.outputDirectory, VideoRecorder.rawVideoFileName);
		const startTimeSeconds = Date.now() / 1000;
		this._screenCaptureProcess = ChildProcess.spawn(
			'screencapture',
			['-v', '-C', '-k', '-o', `-l${options.window.windowId}`, rawVideoPath],
			{ stdio: 'inherit' },
		);
		const recording: Recording = {
			startTimeSeconds,
			window: options.window,
			rawVideoFileName: VideoRecorder.rawVideoFileName,
			clicksLogFileName: VideoRecorder.clicksLogFileName,
		};
		Fs.writeFileSync(
			Path.join(options.outputDirectory, VideoRecorder.recordingFileName),
			JSON.stringify(recording, null, '\t') + '\n',
		);
		return recording;
	}

	/**
	 * Stops the command `screencapture` with an interrupt signal, so that it finishes the video file, and stops the
	 * click logger.
	 * @returns A promise that resolves when the command `screencapture` has exited.
	 */
	async stop(): Promise<void> {
		this._clickLoggerProcess?.kill('SIGTERM');
		const screenCaptureProcess = this._screenCaptureProcess;
		if (screenCaptureProcess === null || screenCaptureProcess.exitCode !== null) {
			return;
		}
		await new Promise<void>((resolve) => {
			screenCaptureProcess.once('exit', () => {
				resolve();
			});
			screenCaptureProcess.kill('SIGINT');
		});
	}

	/**
	 * Gives the path of the click logger script.
	 * @returns The path of `click_logger.js`.
	 */
	private static _clickLoggerPath(): string {
		return Path.join(__dirname, 'click_logger.js');
	}
}
