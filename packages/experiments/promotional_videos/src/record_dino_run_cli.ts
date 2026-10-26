import Fs from 'node:fs';
import Path from 'node:path';
import { Command } from 'commander';
import { CommitFileReader, FallbackCommits } from 'git_runner';
import type { CommitRecord } from 'git_runner';
import { DinoHitsABoulderScenario } from './dino_hits_a_boulder_scenario.ts';
import { DinoRunRecorder } from './dino_run_recorder.ts';
import { ScenarioChecker } from './scenario_checker.ts';
import { VideoComposer } from './video_composer.ts';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	RecordDinoRunCli — the command that checks the scenario, then records the video
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The command line of the package. It plays the scenario with the rules of the game first, and it records the video
 * only when the scenario does what it promises.
 */
export class RecordDinoRunCli {
	/** The folder that receives the video of the game, which Git ignores. */
	private static readonly _DEFAULT_OUTPUT_FOLDER = Path.resolve(__dirname, '../outputs/video_game');

	/** The file of commits that the page of the game reads. */
	private static readonly _COMMITS_PATH = Path.resolve(
		__dirname,
		'../../../../submodules/heidrun_git_runner/packages/git_runner/public/commits.json',
	);

	/**
	 * Runs the command line.
	 * @param argv The arguments of the command line, with the two first arguments of Node.js.
	 */
	static async run(argv: string[]): Promise<void> {
		const program = new Command();
		program
			.name('record_dino_run')
			.description('Records the scenario "the dinosaur hits a boulder" in a headless browser, then adds the intro, the comic words, the sound, and the outro.')
			.option('--output-dir <folder>', 'The folder that receives the video. The default is the folder outputs/video_game of the package.')
			.option('--intro-music <file>', 'A music file for the intro. It fades out with the splash screen.')
			.option('--outro-music <file>', 'A music file for the outro. The video ends when the sound of the music ends.');
		program.parse(argv);
		const options = program.opts<{ outputDir?: string; introMusic?: string; outroMusic?: string }>();
		const scenario = DinoHitsABoulderScenario.create();
		const report = ScenarioChecker.check(scenario, RecordDinoRunCli._readCommits());
		for (const scenarioEvent of report.events) {
			console.log(`${scenarioEvent.timeSeconds.toFixed(2)} seconds: ${scenarioEvent.event}`);
		}
		const outputFolder =
			options.outputDir === undefined ? RecordDinoRunCli._DEFAULT_OUTPUT_FOLDER : Path.resolve(options.outputDir);
		const musicPaths = {
			intro: RecordDinoRunCli._resolveMusicPath(options.introMusic),
			outro: RecordDinoRunCli._resolveMusicPath(options.outroMusic),
		};
		// The files of the work (the video of the browser, the sound, the pictures) stay next to the final video.
		const workFolder = Path.join(outputFolder, `${scenario.name}_work`);
		const timeline = await DinoRunRecorder.record(scenario, report, workFolder);
		const workVideoPath = await VideoComposer.compose(timeline, workFolder, scenario.name, musicPaths);
		const mp4Path = Path.join(outputFolder, `${scenario.name}.mp4`);
		Fs.renameSync(workVideoPath, mp4Path);
		console.log(`The video is ${mp4Path}`);
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Gives the absolute path of a music file, and checks that the file exists.
	 * @param path The path that the command line received, or undefined.
	 * @returns The absolute path, or null when the command line received no path.
	 * @throws An error that names the missing file.
	 */
	private static _resolveMusicPath(path: string | undefined): string | null {
		if (path === undefined) {
			return null;
		}
		const absolutePath = Path.resolve(path);
		if (Fs.existsSync(absolutePath) === false) {
			throw new Error(`The music file ${absolutePath} does not exist. The README.md of the package says where to get it.`);
		}
		return absolutePath;
	}

	/**
	 * Reads the commits that the page of the game plays with: the file of commits when it exists, or the fake commits
	 * when it does not exist, as the page does.
	 * @returns The commits.
	 */
	private static _readCommits(): CommitRecord[] {
		if (Fs.existsSync(RecordDinoRunCli._COMMITS_PATH) === false) {
			return FallbackCommits.create();
		}
		const commitFile = CommitFileReader.read(JSON.parse(Fs.readFileSync(RecordDinoRunCli._COMMITS_PATH, 'utf8')));
		return commitFile.commits;
	}
}

await RecordDinoRunCli.run(process.argv);
