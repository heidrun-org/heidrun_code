import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Path from 'node:path';
import type { ObsoleteTargetEntry, TargetPrunePlan } from './worktree_tools_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TargetPrune — finds and deletes the files of the debug folder that the current builds do not use any more
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Cargo never deletes the files of an old build. After some weeks, the debug folder of the Cargo target folder holds
 * several old versions of each crate, and only the newest version is used. This class asks Cargo which compilation
 * units the current builds use, and finds the files of every other unit. The name of each such file holds the hash of
 * its unit, so no file that a current build uses is ever in the result.
 */
export class TargetPrune {
	/**
	 * The Cargo commands whose files are kept. `cargo build` makes the same units as `pnpm dev`, and
	 * `cargo test --no-run` makes the same units as `pnpm --filter desktop_tauri test`.
	 */
	static readonly cargoCommands: string[][] = [
		['build'],
		['test', '--no-run'],
	];

	/** The folders of the debug folder where the name of each entry ends with the hash of a compilation unit. */
	static readonly hashedFolderNames = ['deps', '.fingerprint', 'build'];

	/** The name of the folder, inside the debug folder, that holds the caches of the incremental compilation. */
	static readonly incrementalFolderName = 'incremental';

	/** The number of cache folders that the plan keeps for each crate, the most recently changed first. */
	static readonly keptIncrementalFoldersPerCrate = 2;

	/** The largest output of one Cargo command that the class reads, in bytes. */
	static readonly maximumOutputBytes = 256 * 1024 * 1024;

	/** The level of the Cargo log that prints the fingerprint folder of every compilation unit. */
	private static readonly _cargoLog = 'cargo::core::compiler::fingerprint=debug';

	/** Finds the hash of a compilation unit in the line of the Cargo log that names its fingerprint folder. */
	private static readonly _fingerprintPattern = /\.fingerprint\/[^/\s]+-([0-9a-f]{16})\//g;

	/** Finds the hash at the end of the name of a file or of a folder of the debug folder. */
	private static readonly _nameHashPattern = /-([0-9a-f]{16})(?:\.[^/]*)?$/;

	/**
	 * Runs the Cargo commands of `cargoCommands` and reads the hash of every compilation unit that they use. A unit
	 * that is already compiled counts too. A command compiles whatever is out of date, so it can take minutes.
	 * @param options.packagePath The absolute path of the package folder, where Cargo runs.
	 * @returns The hashes of the units that the current builds use.
	 * @throws An error when a Cargo command does not start or fails, or when the Cargo log names no unit. Nothing is
	 * deleted by this method.
	 */
	static findUsedHashes(options: { packagePath: string }): Set<string> {
		const usedHashes = new Set<string>();
		for (const cargoArguments of TargetPrune.cargoCommands) {
			const commandText = `cargo ${cargoArguments.join(' ')}`;
			const result = ChildProcess.spawnSync('cargo', cargoArguments, {
				cwd: options.packagePath,
				encoding: 'utf8',
				maxBuffer: TargetPrune.maximumOutputBytes,
				env: {
					...process.env,
					CARGO_LOG: TargetPrune._cargoLog,
					CARGO_TERM_COLOR: 'never',
				},
			});
			if (result.error !== undefined) {
				throw new Error(`"${commandText}" did not start: ${result.error.message}`);
			}
			if (result.status !== 0) {
				const output = result.stderr.split('\n').slice(-30).join('\n').trim();
				throw new Error(
					`"${commandText}" failed with the exit code ${result.status}, so no file is deleted.\n${output}`,
				);
			}
			for (const match of result.stderr.matchAll(TargetPrune._fingerprintPattern)) {
				usedHashes.add(match[1] as string);
			}
		}
		if (usedHashes.size === 0) {
			throw new Error(
				'The Cargo log names no compilation unit, so no file is deleted. The format of the log may have '
					+ 'changed in this version of Cargo.',
			);
		}
		return usedHashes;
	}

	/**
	 * Lists the files and the folders of the debug folder that no current build uses. In the folders `deps`,
	 * `.fingerprint`, and `build`, an entry is obsolete when the hash in its name is not one of the used hashes. An
	 * entry without a hash in its name is kept. In the folder `incremental`, the plan keeps the most recently changed
	 * cache folders of each crate, because the name of a cache folder holds no hash of a unit. The method deletes
	 * nothing.
	 * @param options.debugPath The absolute path of the debug folder of the Cargo target folder.
	 * @param options.usedHashes The hashes of the units that the current builds use, from `findUsedHashes`.
	 * @returns The obsolete entries, and the number of files that the plan deletes and keeps.
	 */
	static plan(options: { debugPath: string; usedHashes: Set<string> }): TargetPrunePlan {
		const obsoleteEntries: ObsoleteTargetEntry[] = [];
		let keptFileCount = 0;
		for (const folderName of TargetPrune.hashedFolderNames) {
			const folderPlan = TargetPrune._planHashedFolder(options.debugPath, folderName, options.usedHashes);
			obsoleteEntries.push(...folderPlan.obsoleteEntries);
			keptFileCount += folderPlan.keptFileCount;
		}
		const incrementalPlan = TargetPrune._planIncrementalFolder(options.debugPath);
		obsoleteEntries.push(...incrementalPlan.obsoleteEntries);
		keptFileCount += incrementalPlan.keptFileCount;
		let obsoleteFileCount = 0;
		for (const obsoleteEntry of obsoleteEntries) {
			obsoleteFileCount += obsoleteEntry.fileCount;
		}
		return {
			obsoleteEntries,
			obsoleteFileCount,
			keptFileCount,
		};
	}

	/**
	 * Deletes the obsolete entries of a plan.
	 * @param plan The plan from `plan`.
	 * @returns Nothing.
	 */
	static remove(plan: TargetPrunePlan): void {
		for (const obsoleteEntry of plan.obsoleteEntries) {
			Fs.rmSync(obsoleteEntry.path, { recursive: true, force: true });
		}
	}

	/**
	 * Plans one folder where the name of each entry ends with the hash of a compilation unit.
	 * @param debugPath The absolute path of the debug folder.
	 * @param folderName The name of the folder inside the debug folder.
	 * @param usedHashes The hashes of the units that the current builds use.
	 * @returns The obsolete entries of the folder, and the number of files that are kept. A missing folder gives none.
	 */
	private static _planHashedFolder(
		debugPath: string,
		folderName: string,
		usedHashes: Set<string>,
	): { obsoleteEntries: ObsoleteTargetEntry[]; keptFileCount: number } {
		const folderPath = Path.join(debugPath, folderName);
		const obsoleteEntries: ObsoleteTargetEntry[] = [];
		let keptFileCount = 0;
		if (Fs.existsSync(folderPath) === false) {
			return { obsoleteEntries, keptFileCount };
		}
		for (const entryName of Fs.readdirSync(folderPath)) {
			const entryPath = Path.join(folderPath, entryName);
			const hash = TargetPrune._readHash(entryName);
			const fileCount = TargetPrune._countFiles(entryPath);
			if (hash === null || usedHashes.has(hash) === true) {
				keptFileCount += fileCount;
				continue;
			}
			obsoleteEntries.push({
				path: entryPath,
				folderName,
				fileCount,
			});
		}
		return { obsoleteEntries, keptFileCount };
	}

	/**
	 * Plans the folder `incremental`. Its entries are named `<crate>-<identifier>`, and the identifier is not the hash
	 * of a unit, so the plan keeps the most recently changed entries of each crate.
	 * @param debugPath The absolute path of the debug folder.
	 * @returns The obsolete entries of the folder, and the number of files that are kept. A missing folder gives none.
	 */
	private static _planIncrementalFolder(
		debugPath: string,
	): { obsoleteEntries: ObsoleteTargetEntry[]; keptFileCount: number } {
		const folderPath = Path.join(debugPath, TargetPrune.incrementalFolderName);
		const obsoleteEntries: ObsoleteTargetEntry[] = [];
		let keptFileCount = 0;
		if (Fs.existsSync(folderPath) === false) {
			return { obsoleteEntries, keptFileCount };
		}
		const entriesOfCrate = new Map<string, { entryName: string; modifiedMilliseconds: number }[]>();
		for (const entryName of Fs.readdirSync(folderPath)) {
			const crateName = entryName.slice(0, Math.max(entryName.lastIndexOf('-'), 0));
			const entries = entriesOfCrate.get(crateName) ?? [];
			entries.push({
				entryName,
				modifiedMilliseconds: Fs.lstatSync(Path.join(folderPath, entryName)).mtimeMs,
			});
			entriesOfCrate.set(crateName, entries);
		}
		for (const entries of entriesOfCrate.values()) {
			entries.sort((first, second) => {
				return second.modifiedMilliseconds - first.modifiedMilliseconds;
			});
			entries.forEach((entry, index) => {
				const entryPath = Path.join(folderPath, entry.entryName);
				const fileCount = TargetPrune._countFiles(entryPath);
				if (index < TargetPrune.keptIncrementalFoldersPerCrate) {
					keptFileCount += fileCount;
					return;
				}
				obsoleteEntries.push({
					path: entryPath,
					folderName: TargetPrune.incrementalFolderName,
					fileCount,
				});
			});
		}
		return { obsoleteEntries, keptFileCount };
	}

	/**
	 * Reads the hash of a compilation unit at the end of the name of an entry.
	 * @param entryName The name of a file or of a folder, for example `libserde-0123456789abcdef.rlib`.
	 * @returns The 16 hexadecimal characters of the hash, or null when the name holds no hash.
	 */
	private static _readHash(entryName: string): string | null {
		const match = TargetPrune._nameHashPattern.exec(entryName);
		if (match === null) {
			return null;
		}
		return match[1] as string;
	}

	/**
	 * Counts the files in a file or in a folder. The method does not follow symbolic links.
	 * @param entryPath The absolute path of the file or of the folder.
	 * @returns The number of files: one for a file.
	 */
	private static _countFiles(entryPath: string): number {
		if (Fs.lstatSync(entryPath).isDirectory() === false) {
			return 1;
		}
		let fileCount = 0;
		for (const entryName of Fs.readdirSync(entryPath)) {
			fileCount += TargetPrune._countFiles(Path.join(entryPath, entryName));
		}
		return fileCount;
	}
}
