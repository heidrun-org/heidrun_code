// Builds the macOS disk image (.dmg) of Heidrun Code and uploads it to the GitHub release of the current version.
// pnpm release:dmg
import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import Chalk from 'chalk';
import { Command } from 'commander';

const __filename = import.meta.filename;
const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ReleaseDmg — builds the macOS disk image and uploads it to a GitHub release
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Builds the macOS disk image of Heidrun Code and uploads it to the GitHub release of the current version.
 */
class ReleaseDmg {
	/**
	 * The name of the second copy of the disk image for Apple silicon. This name never changes, so the web address
	 * https://github.com/heidrun-org/heidrun_code/releases/latest/download/Heidrun_Code_aarch64.dmg is always the latest disk
	 * image, and the script scripts/install.sh downloads it.
	 */
	private static readonly LATEST_DMG_FILE_NAME = 'Heidrun_Code_aarch64.dmg';

	/**
	 * Builds the disk image, then creates the GitHub release if it does not exist, uploads the disk image,
	 * and prints the URL of the release.
	 * @param argv The command line arguments, in the format of `process.argv`.
	 * @returns Nothing.
	 */
	static main(argv: string[]): void {
		const program = new Command();
		program
			.name('pnpm release:dmg')
			.description(
				'Builds the macOS disk image of Heidrun Code and uploads it to the GitHub release of the version in the root '
					+ 'package.json. The release is created when it does not exist, and its text is rewritten when it '
					+ 'exists. The text of the release is the file '
					+ 'docs/release_notes/prefix.md, then the file of the option --notes-file, then the list of changes '
					+ 'that GitHub generates. The disk image is uploaded twice: with its version in its name, and as a '
					+ 'copy named Heidrun_Code_aarch64.dmg for the script scripts/install.sh.',
			)
			.option(
				'--notes-file <path>',
				'Markdown file with the text of this release. It goes after the prefix and before the generated list of '
					+ 'changes.',
			)
			.option(
				'--recreate',
				'Delete the existing release and its tag, then create them again on the current commit. The release gets '
					+ 'a new date.',
			)
			.parse(argv);
		const options = program.opts<{ notesFile?: string; recreate?: boolean }>();

		let notesPath: string | undefined = undefined;
		if (options.notesFile !== undefined) {
			notesPath = Path.resolve(process.cwd(), options.notesFile);
			if (Fs.existsSync(notesPath) === false) {
				ReleaseDmg._fail(`The notes file does not exist: ${notesPath}`, 'Give the path of an existing file.');
			}
		}

		const rootDir = Path.resolve(__dirname, '..');
		ReleaseDmg._checkRepositoryIsSynchronized(rootDir);

		const prefixPath = Path.join(rootDir, 'docs', 'release_notes', 'prefix.md');
		if (Fs.existsSync(prefixPath) === false) {
			ReleaseDmg._fail(`The release notes prefix file does not exist: ${prefixPath}`, 'Create this file.');
		}

		if (process.platform !== 'darwin') {
			ReleaseDmg._fail('The disk image can only be built on macOS.');
		}

		const rootPackage = JSON.parse(Fs.readFileSync(Path.join(rootDir, 'package.json'), 'utf8')) as { version: string };
		const version = rootPackage.version;
		const tagName = `v${version}`;

		ReleaseDmg._run('pnpm', ['--filter', 'desktop_tauri', 'tauri', 'build', '--bundles', 'dmg'], rootDir);

		const dmgDir = Path.join(rootDir, 'packages', 'apps', 'desktop_tauri', 'target', 'release', 'bundle', 'dmg');
		const dmgFileNames = Fs.existsSync(dmgDir) === true
			? Fs.readdirSync(dmgDir).filter((fileName) => fileName.endsWith('.dmg') && fileName.includes(version))
			: [];
		if (dmgFileNames.length === 0) {
			ReleaseDmg._fail(`No disk image for version ${version} found in ${dmgDir}.`);
		}
		const dmgPaths = dmgFileNames.map((fileName) => Path.join(dmgDir, fileName));
		const aarch64DmgPath = dmgPaths.find((dmgPath) => dmgPath.endsWith('_aarch64.dmg'));
		if (aarch64DmgPath === undefined) {
			ReleaseDmg._fail(
				`No disk image for Apple silicon (a file that ends with _aarch64.dmg) in ${dmgDir}.`,
				`The script scripts/install.sh needs the file ${ReleaseDmg.LATEST_DMG_FILE_NAME} in every release.`,
				'Run this command on a Mac with Apple silicon.',
			);
		}

		const bodyDir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'release_dmg_'));
		const latestDmgPath = Path.join(bodyDir, ReleaseDmg.LATEST_DMG_FILE_NAME);
		Fs.copyFileSync(aarch64DmgPath, latestDmgPath);
		const uploadPaths = [...dmgPaths, latestDmgPath];
		const bodyPath = Path.join(bodyDir, 'release_body.md');
		const prefixText = Fs.readFileSync(prefixPath, 'utf8').trimEnd();
		const notesText = notesPath !== undefined ? Fs.readFileSync(notesPath, 'utf8').trim() : '';
		Fs.writeFileSync(bodyPath, `${prefixText}\n\n${notesText}\n`);

		const releaseView = ChildProcess.spawnSync('gh', ['release', 'view', tagName], {
			cwd: rootDir,
			stdio: 'ignore',
		});
		let isReleaseExisting = releaseView.status === 0;
		if (isReleaseExisting === true && options.recreate === true) {
			ReleaseDmg._run('gh', ['release', 'delete', tagName, '--cleanup-tag', '--yes'], rootDir);
			isReleaseExisting = false;
		}
		if (isReleaseExisting === true) {
			ReleaseDmg._run('gh', ['release', 'upload', tagName, ...uploadPaths, '--clobber'], rootDir);
			const generatedNotes = ChildProcess.spawnSync(
				'gh',
				['api', 'repos/{owner}/{repo}/releases/generate-notes', '-f', `tag_name=${tagName}`, '--jq', '.body'],
				{
					cwd: rootDir,
					encoding: 'utf8',
				},
			);
			if (generatedNotes.status !== 0) {
				ReleaseDmg._fail('The list of changes could not be generated.');
			}
			Fs.appendFileSync(bodyPath, `\n${generatedNotes.stdout.trim()}\n`);
			ReleaseDmg._run('gh', ['release', 'edit', tagName, '--notes-file', bodyPath], rootDir);
		} else {
			const commitSha = ChildProcess.execFileSync('git', ['rev-parse', 'HEAD'], {
				cwd: rootDir,
				encoding: 'utf8',
			}).trim();
			ReleaseDmg._run(
				'gh',
				[
					'release',
					'create',
					tagName,
					...uploadPaths,
					'--target',
					commitSha,
					'--title',
					`Heidrun Code ${version}`,
					'--notes-file',
					bodyPath,
					'--generate-notes',
				],
				rootDir,
			);
		}

		const releaseUrl = ChildProcess.spawnSync('gh', ['release', 'view', tagName, '--json', 'url', '--jq', '.url'], {
			cwd: rootDir,
			encoding: 'utf8',
		}).stdout.trim();
		console.log(`\nThe release is available at: ${releaseUrl}`);
	}

	/**
	 * Stops the script with a message and the command to run when the local repository is not in sync with GitHub:
	 * uncommitted changes, a branch without a remote branch, or local commits that are not pushed.
	 * @param rootDir The root folder of the repository.
	 * @returns Nothing.
	 */
	private static _checkRepositoryIsSynchronized(rootDir: string): void {
		const git = (args: string[]): ChildProcess.SpawnSyncReturns<string> => {
			return ChildProcess.spawnSync('git', args, {
				cwd: rootDir,
				encoding: 'utf8',
			});
		};

		const changes = git(['status', '--porcelain']).stdout.trim();
		if (changes !== '') {
			ReleaseDmg._fail(
				'The repository has uncommitted changes.',
				'Commit them, then push:',
				'git add -A && git commit -m "<message>" && git push',
			);
		}

		const branchName = git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout.trim();
		const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
		if (upstream.status !== 0) {
			ReleaseDmg._fail(
				`The branch ${branchName} does not exist on GitHub yet.`,
				'Push the branch:',
				`git push -u origin ${branchName}`,
			);
		}

		const aheadCount = Number(git(['rev-list', '--count', `${upstream.stdout.trim()}..HEAD`]).stdout.trim());
		if (aheadCount > 0) {
			ReleaseDmg._fail(
				`The branch ${branchName} has ${aheadCount} local commit(s) that are not on GitHub yet.`,
				'Push them:',
				'git push',
			);
		}
	}

	/**
	 * Runs a command, shows its output, and stops the script when the command fails.
	 * @param command The program to run.
	 * @param args The arguments of the program.
	 * @param cwd The folder in which the program runs.
	 * @returns Nothing.
	 */
	private static _run(command: string, args: string[], cwd: string): void {
		const result = ChildProcess.spawnSync(command, args, {
			cwd,
			stdio: 'inherit',
		});
		if (result.status !== 0) {
			ReleaseDmg._fail(`The command failed: ${command} ${args.join(' ')}`);
		}
	}

	/**
	 * Shows the reason of a failure in red, then what to do about it, then the command to run in green, and stops
	 * the script with the exit code 1.
	 * @param reason The reason of the failure.
	 * @param resolution What the developer must do, or undefined when there is nothing to say.
	 * @param command The command that the developer can copy and run, or undefined when there is none.
	 * @returns Never returns.
	 */
	private static _fail(reason: string, resolution?: string, command?: string): never {
		console.error(Chalk.red(reason));
		if (resolution !== undefined) {
			console.error(resolution);
		}
		if (command !== undefined) {
			console.error(`\n  ${Chalk.green(command)}\n`);
		}
		process.exit(1);
	}
}

ReleaseDmg.main(process.argv);
