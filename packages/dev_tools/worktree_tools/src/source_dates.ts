import Fs from 'node:fs';
import Path from 'node:path';
import { WorktreeGit } from './worktree_git.ts';
import type { SourceDatesResult } from './worktree_tools_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SourceDates — gives the files and folders of a new worktree the dates of the same ones in the main checkout
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Cargo decides that a crate of the repository must be compiled again when one of its source files, or one of the
 * folders that a build script watches, is newer than its last build. Git writes every file of a new worktree now, so
 * everything is newer than the compiled files cloned from the main checkout. This class gives each file of the
 * worktree the dates of the same file in the main checkout, but only when the two files have the same content, and
 * each folder the dates of the same folder, but only when the two folders hold the same names. Anything that differs
 * keeps its new date, so Cargo compiles its crate again.
 */
export class SourceDates {
	/**
	 * Copies the dates of the main checkout to the worktree. Only the files that Git tracks in the worktree, and the
	 * folders that hold them, are read.
	 * @param mainCheckoutPath The absolute path of the main checkout.
	 * @param worktreePath The absolute path of the worktree.
	 * @returns The number of files and of folders whose dates were copied.
	 */
	static copyFromMainCheckout(mainCheckoutPath: string, worktreePath: string): SourceDatesResult {
		const result: SourceDatesResult = {
			fileCount: 0,
			folderCount: 0,
		};
		const folderRelativePaths = new Set<string>();
		for (const relativePath of WorktreeGit.listTrackedFiles(worktreePath)) {
			let folderRelativePath = Path.dirname(relativePath);
			while (folderRelativePath !== '.') {
				folderRelativePaths.add(folderRelativePath);
				folderRelativePath = Path.dirname(folderRelativePath);
			}
			const mainFilePath = Path.join(mainCheckoutPath, relativePath);
			const worktreeFilePath = Path.join(worktreePath, relativePath);
			if (SourceDates._isSameFile(mainFilePath, worktreeFilePath) === true) {
				SourceDates._copyDates(mainFilePath, worktreeFilePath);
				result.fileCount += 1;
			}
		}
		for (const folderRelativePath of folderRelativePaths) {
			const mainFolderPath = Path.join(mainCheckoutPath, folderRelativePath);
			const worktreeFolderPath = Path.join(worktreePath, folderRelativePath);
			if (SourceDates._isSameFolder(mainFolderPath, worktreeFolderPath) === true) {
				SourceDates._copyDates(mainFolderPath, worktreeFolderPath);
				result.folderCount += 1;
			}
		}
		return result;
	}

	/**
	 * Gives a path the access time and the modification time of another path.
	 * @param sourcePath The absolute path that has the dates.
	 * @param targetPath The absolute path that gets the dates.
	 * @returns Nothing.
	 */
	private static _copyDates(sourcePath: string, targetPath: string): void {
		const sourceStat = Fs.statSync(sourcePath);
		Fs.utimesSync(targetPath, sourceStat.atime, sourceStat.mtime);
	}

	/**
	 * Tells if two paths are two regular files with the same content.
	 * @param firstPath The absolute path of the first file.
	 * @param secondPath The absolute path of the second file.
	 * @returns True when both are regular files with the same bytes.
	 */
	private static _isSameFile(firstPath: string, secondPath: string): boolean {
		const firstStat = Fs.lstatSync(firstPath, { throwIfNoEntry: false });
		const secondStat = Fs.lstatSync(secondPath, { throwIfNoEntry: false });
		if (firstStat === undefined || secondStat === undefined) {
			return false;
		}
		if (firstStat.isFile() === false || secondStat.isFile() === false || firstStat.size !== secondStat.size) {
			return false;
		}
		return Fs.readFileSync(firstPath).equals(Fs.readFileSync(secondPath));
	}

	/**
	 * Tells if two paths are two folders that hold the same names.
	 * @param firstPath The absolute path of the first folder.
	 * @param secondPath The absolute path of the second folder.
	 * @returns True when both are folders with the same list of names.
	 */
	private static _isSameFolder(firstPath: string, secondPath: string): boolean {
		const firstStat = Fs.lstatSync(firstPath, { throwIfNoEntry: false });
		const secondStat = Fs.lstatSync(secondPath, { throwIfNoEntry: false });
		if (firstStat === undefined || secondStat === undefined) {
			return false;
		}
		if (firstStat.isDirectory() === false || secondStat.isDirectory() === false) {
			return false;
		}
		const firstNames = Fs.readdirSync(firstPath).sort().join('\0');
		return firstNames === Fs.readdirSync(secondPath).sort().join('\0');
	}
}
