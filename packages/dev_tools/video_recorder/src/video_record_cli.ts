#!/usr/bin/env tsx
// Records one window and logs the clicks, until Ctrl-C or SIGTERM. pnpm --filter video_recorder video:record --output-dir <folder>
import { Command, InvalidArgumentError } from 'commander';
import { VideoRecorder } from './video_recorder.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	VideoRecordCli — the command line `pnpm --filter video_recorder video:record`
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The command line `pnpm --filter video_recorder video:record`: finds the window, starts the recording, and waits to be stopped.
 */
export class VideoRecordCli {
	/**
	 * Parses the command line and records until the process receives SIGINT or SIGTERM, or until the option
	 * `--seconds` has passed. When an error happens, prints the message on the standard error output and sets the
	 * exit code to 1.
	 * @param argv The command line arguments, in the format of `process.argv`.
	 * @returns A promise that resolves when the recording has stopped.
	 */
	static async main(argv: string[]): Promise<void> {
		const program = new Command();
		program
			.name('pnpm --filter video_recorder video:record')
			.description(
				'Records only one window with `screencapture -v -C -k -o -l<window id>`, and logs each mouse click. '
					+ 'The recording stops with Ctrl-C or SIGTERM. Then run `pnpm --filter video_recorder video:cut`.',
			)
			.requiredOption('--output-dir <folder>', 'The folder that receives the raw video and the clicks log.')
			.option('--owner <name>', 'The name of the application whose window is recorded.', 'Heidrun Code')
			.option('--seconds <number>', 'Stop after this number of seconds.', VideoRecordCli._parseSeconds)
			.parse(argv);
		const options = program.opts<{ outputDir: string; owner: string; seconds?: number }>();
		try {
			const window = VideoRecorder.findWindow(options.owner);
			const videoRecorder = new VideoRecorder();
			videoRecorder.start({ outputDirectory: options.outputDir, window });
			process.stdout.write(
				`Recording the window ${window.windowId} of ${options.owner}. Stop with Ctrl-C or SIGTERM.\n`,
			);
			await new Promise<void>((resolve) => {
				process.once('SIGINT', () => {
					resolve();
				});
				process.once('SIGTERM', () => {
					resolve();
				});
				if (options.seconds !== undefined) {
					setTimeout(resolve, options.seconds * 1000);
				}
			});
			await videoRecorder.stop();
			process.stdout.write(`Recording written in ${options.outputDir}.\n`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`Error: ${message}\n`);
			process.exitCode = 1;
		}
	}

	/**
	 * Reads the value of the option `--seconds`.
	 * @param value The text that the user typed.
	 * @returns The number of seconds.
	 * @throws An `InvalidArgumentError` when the text is not a number above zero.
	 */
	private static _parseSeconds(value: string): number {
		const seconds = Number(value);
		if (Number.isFinite(seconds) === false || seconds <= 0) {
			throw new InvalidArgumentError('Give a number of seconds above zero.');
		}
		return seconds;
	}
}

await VideoRecordCli.main(process.argv);
