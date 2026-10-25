import Fs from 'node:fs';
import Path from 'node:path';
import type { Plugin } from 'vite';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DistSyncPlugin — writes into `dist` only the files of a build whose content changed
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The result of one synchronization of the folder `dist`.
 */
export type DistSyncResult = {
	/** The number of files that were new or had a new content, and were written. */
	writtenCount: number;
	/** The number of files that had the same content, and were left as they were, with their dates. */
	keptCount: number;
	/** The number of files and folders of `dist` that the new build does not have any more, and were deleted. */
	removedCount: number;
};

/**
 * The package `mobile_server` puts the folder `dist` inside its program, and Cargo compiles it again, then the whole
 * desktop application, when any file of `dist` has a newer date. Vite writes every file again at each build, so
 * each `pnpm dev` compiled the application again. This plugin makes Vite write the build into a staging folder, then
 * copies into `dist` only the files whose content changed, and deletes the files that are gone. An unchanged build
 * leaves `dist` exactly as it was ([issue 864](https://github.com/heidrun-org/heidrun_code/issues/864)).
 */
export class DistSyncPlugin {
	/** The name of the staging folder that Vite writes into, next to `dist`. */
	static readonly stagingFolderName = 'dist_staging';

	/** The name of the folder that the mobile server reads. */
	static readonly distFolderName = 'dist';

	/**
	 * Builds the plugin. It works only for `vite build`. Vite must write into the staging folder: `vite.config.ts` sets
	 * `build.outDir` to `stagingFolderName`.
	 * @param packagePath The absolute path of the folder of the package `mobile_website`.
	 * @returns The plugin.
	 */
	static create(packagePath: string): Plugin {
		return {
			name: 'heidrun-dist-sync',
			apply: 'build',
			closeBundle: () => {
				const stagingPath = Path.join(packagePath, DistSyncPlugin.stagingFolderName);
				DistSyncPlugin.sync(stagingPath, Path.join(packagePath, DistSyncPlugin.distFolderName));
				Fs.rmSync(stagingPath, { recursive: true, force: true });
			},
		};
	}

	/**
	 * Makes a folder hold the same files as another folder, but writes only the files whose content differs. A file
	 * with the same content keeps its dates, and a folder whose list of entries does not change keeps its date too.
	 * @param sourcePath The absolute path of the folder of the new build.
	 * @param targetPath The absolute path of the folder to update. It is created when it does not exist.
	 * @returns The number of files written, kept, and removed.
	 */
	static sync(sourcePath: string, targetPath: string): DistSyncResult {
		const result: DistSyncResult = {
			writtenCount: 0,
			keptCount: 0,
			removedCount: 0,
		};
		DistSyncPlugin._syncFolder(sourcePath, targetPath, result);
		return result;
	}

	/**
	 * Synchronizes one folder, then its subfolders.
	 * @param sourcePath The absolute path of the folder of the new build.
	 * @param targetPath The absolute path of the folder to update.
	 * @param result The counts to update.
	 * @returns Nothing.
	 */
	private static _syncFolder(sourcePath: string, targetPath: string, result: DistSyncResult): void {
		Fs.mkdirSync(targetPath, { recursive: true });
		const sourceNames = new Set(Fs.readdirSync(sourcePath));
		for (const targetName of Fs.readdirSync(targetPath)) {
			if (sourceNames.has(targetName) === false) {
				Fs.rmSync(Path.join(targetPath, targetName), { recursive: true, force: true });
				result.removedCount += 1;
			}
		}
		for (const sourceName of sourceNames) {
			const sourceEntryPath = Path.join(sourcePath, sourceName);
			const targetEntryPath = Path.join(targetPath, sourceName);
			const isSourceFolder = Fs.statSync(sourceEntryPath).isDirectory();
			const targetStat = Fs.statSync(targetEntryPath, { throwIfNoEntry: false });
			if (targetStat !== undefined && targetStat.isDirectory() !== isSourceFolder) {
				Fs.rmSync(targetEntryPath, { recursive: true, force: true });
				result.removedCount += 1;
			}
			if (isSourceFolder === true) {
				DistSyncPlugin._syncFolder(sourceEntryPath, targetEntryPath, result);
				continue;
			}
			const sourceBytes = Fs.readFileSync(sourceEntryPath);
			if (Fs.existsSync(targetEntryPath) === true && Fs.readFileSync(targetEntryPath).equals(sourceBytes) === true) {
				result.keptCount += 1;
				continue;
			}
			Fs.writeFileSync(targetEntryPath, sourceBytes);
			result.writtenCount += 1;
		}
	}
}
