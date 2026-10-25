import ChildProcess from 'node:child_process';
import Crypto from 'node:crypto';
import Fs from 'node:fs';
import Path from 'node:path';
import { TargetPaths } from './target_paths.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	BundledCommandsStamp — tells if the bundled command line tools are built from the sources of the checkout
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The folder `target/release/bundled_commands` holds the two command line tools that Tauri packages. After a build,
 * a stamp file in the same folder holds a fingerprint of every source file that the tools are built from. A new
 * worktree clones the folder with its stamp. When the fingerprint of the worktree is the same as the stamp, the tools
 * are up to date and nobody builds them again.
 */
export class BundledCommandsStamp {
	/** The name of the stamp file inside the folder of the bundled command line tools. */
	static readonly stampFileName = 'sources.sha256';

	/**
	 * The packages of the two bundled command line tools, relative to the root of a checkout. The script
	 * `scripts/build_command_line_tools.sh` builds the same two packages.
	 */
	static readonly toolPackageRelativePaths = [
		Path.join('packages', 'auxiliary', 'heidrun_code_ctrl'),
		Path.join('submodules', 'heidrun_data', 'packages', 'heidrun_data'),
	];

	/**
	 * The files of the Cargo workspace at the root of a checkout: the shared lock file, the workspace with its
	 * profiles, and the configuration of Cargo. A change in one of them can change the tools.
	 */
	static readonly workspaceFileRelativePaths = [
		'Cargo.toml',
		'Cargo.lock',
		Path.join('.cargo', 'config.toml'),
	];

	/** The names of the folders that the fingerprint never reads: they hold build output or installed packages. */
	static readonly ignoredFolderNames = new Set(['target', 'node_modules', '.git']);

	/** The largest output of one `cargo metadata` command that the class reads, in bytes. */
	static readonly maximumOutputBytes = 64 * 1024 * 1024;

	/**
	 * Tells if the bundled command line tools are built from the current sources of a checkout. They are when both
	 * tools exist, the stamp file exists, and its fingerprint is the fingerprint of the sources now.
	 * @param checkoutPath The absolute path of the root of the main checkout or of a worktree.
	 * @param fingerprint The fingerprint of the sources now, from `computeFingerprint`.
	 * @returns True when no build is needed.
	 */
	static isUpToDate(checkoutPath: string, fingerprint: string): boolean {
		const commandsPath = TargetPaths.bundledCommandsPath(checkoutPath);
		for (const commandFileName of TargetPaths.bundledCommandFileNames) {
			if (Fs.existsSync(Path.join(commandsPath, commandFileName)) === false) {
				return false;
			}
		}
		const stampPath = Path.join(commandsPath, BundledCommandsStamp.stampFileName);
		if (Fs.existsSync(stampPath) === false) {
			return false;
		}
		return Fs.readFileSync(stampPath, 'utf8').trim() === fingerprint;
	}

	/**
	 * Writes the stamp file next to the bundled command line tools.
	 * @param checkoutPath The absolute path of the root of the main checkout or of a worktree.
	 * @param fingerprint The fingerprint of the sources that the tools were built from, from `computeFingerprint`.
	 * @returns Nothing.
	 */
	static write(checkoutPath: string, fingerprint: string): void {
		const commandsPath = TargetPaths.bundledCommandsPath(checkoutPath);
		Fs.mkdirSync(commandsPath, { recursive: true });
		Fs.writeFileSync(Path.join(commandsPath, BundledCommandsStamp.stampFileName), `${fingerprint}\n`);
	}

	/**
	 * Computes the fingerprint of everything that the two tools are built from: the version of the Rust compiler, the
	 * files of the Cargo workspace at the root, and the name and the content of every file in the folder of each of the two packages and of each package of the
	 * repository that they depend on. The paths in the fingerprint are relative to the checkout, so a worktree and the
	 * main checkout give the same fingerprint for the same sources.
	 * @param checkoutPath The absolute path of the root of the main checkout or of a worktree.
	 * @returns The fingerprint, as a hexadecimal text.
	 * @throws An error when `cargo` or `rustc` does not start or fails.
	 */
	static computeFingerprint(checkoutPath: string): string {
		const hash = Crypto.createHash('sha256');
		hash.update(`${BundledCommandsStamp._run('rustc', ['--version'], checkoutPath)}\n`);
		for (const relativePath of BundledCommandsStamp.workspaceFileRelativePaths) {
			const filePath = Path.join(checkoutPath, relativePath);
			if (Fs.existsSync(filePath) === true) {
				hash.update(`${relativePath}\0`);
				hash.update(Fs.readFileSync(filePath));
				hash.update('\0');
			}
		}
		for (const folderPath of BundledCommandsStamp.findSourceFolders(checkoutPath)) {
			BundledCommandsStamp._hashFolder(hash, checkoutPath, folderPath);
		}
		return hash.digest('hex');
	}

	/**
	 * Finds the folder of each of the two packages, and the folder of each package of the repository that they depend
	 * on, directly or not. Cargo lists the dependencies that have a `path` in `cargo metadata --no-deps`, so the
	 * method needs no network and no download.
	 * @param checkoutPath The absolute path of the root of the main checkout or of a worktree.
	 * @returns The absolute paths of the folders, sorted.
	 * @throws An error when `cargo` does not start or fails.
	 */
	static findSourceFolders(checkoutPath: string): string[] {
		const pendingFolderPaths = BundledCommandsStamp.toolPackageRelativePaths.map((relativePath) => {
			return Path.join(checkoutPath, relativePath);
		});
		const foundFolderPaths = new Set<string>();
		while (pendingFolderPaths.length > 0) {
			const folderPath = pendingFolderPaths.pop() as string;
			if (foundFolderPaths.has(folderPath) === true) {
				continue;
			}
			foundFolderPaths.add(folderPath);
			pendingFolderPaths.push(...BundledCommandsStamp._readPathDependencies(folderPath));
		}
		return [...foundFolderPaths].sort();
	}

	/**
	 * Reads the folders of the dependencies that have a `path`, in the file `Cargo.toml` of a package.
	 * @param packageFolderPath The absolute path of the folder of a package.
	 * @returns The absolute paths of the folders of its path dependencies.
	 * @throws An error when `cargo metadata` fails or prints something that is not the expected JSON.
	 */
	private static _readPathDependencies(packageFolderPath: string): string[] {
		const outputText = BundledCommandsStamp._run(
			'cargo',
			[
				'metadata',
				'--format-version',
				'1',
				'--no-deps',
				'--manifest-path',
				Path.join(packageFolderPath, 'Cargo.toml'),
			],
			packageFolderPath,
		);
		const metadata = JSON.parse(outputText) as { packages?: { dependencies?: { path?: string }[] }[] };
		const dependencyFolderPaths: string[] = [];
		for (const metadataPackage of metadata.packages ?? []) {
			for (const dependency of metadataPackage.dependencies ?? []) {
				if (dependency.path !== undefined) {
					dependencyFolderPaths.push(dependency.path);
				}
			}
		}
		return dependencyFolderPaths;
	}

	/**
	 * Adds the relative path and the content of every file of a folder to a hash. The files come in the order of their
	 * names, so the result does not depend on the order that the disk gives.
	 * @param hash The hash to update.
	 * @param checkoutPath The absolute path of the root of the checkout, to make the paths relative.
	 * @param folderPath The absolute path of the folder to read.
	 * @returns Nothing.
	 */
	private static _hashFolder(hash: Crypto.Hash, checkoutPath: string, folderPath: string): void {
		const entries = Fs.readdirSync(folderPath, { withFileTypes: true }).sort((first, second) => {
			return first.name < second.name ? -1 : 1;
		});
		for (const entry of entries) {
			const entryPath = Path.join(folderPath, entry.name);
			if (entry.isDirectory() === true) {
				if (BundledCommandsStamp.ignoredFolderNames.has(entry.name) === false) {
					BundledCommandsStamp._hashFolder(hash, checkoutPath, entryPath);
				}
				continue;
			}
			if (entry.isFile() === true) {
				hash.update(`${Path.relative(checkoutPath, entryPath)}\0`);
				hash.update(Fs.readFileSync(entryPath));
				hash.update('\0');
			}
		}
	}

	/**
	 * Runs one command and reads its standard output.
	 * @param command The program to run.
	 * @param args The arguments of the program.
	 * @param workingDirectory The folder to run the program in.
	 * @returns The standard output, without the spaces at the ends.
	 * @throws An error when the program does not start or ends with a code other than 0.
	 */
	private static _run(command: string, args: string[], workingDirectory: string): string {
		const result = ChildProcess.spawnSync(command, args, {
			cwd: workingDirectory,
			encoding: 'utf8',
			maxBuffer: BundledCommandsStamp.maximumOutputBytes,
		});
		if (result.error !== undefined) {
			throw new Error(`"${command} ${args.join(' ')}" did not start: ${result.error.message}`);
		}
		if (result.status !== 0) {
			throw new Error(
				`"${command} ${args.join(' ')}" failed with the exit code ${result.status}: ${result.stderr.trim()}`,
			);
		}
		return result.stdout.trim();
	}
}
