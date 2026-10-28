import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Path from 'node:path';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DirectoryClone — clones a whole folder with copy-on-write, in one call when it is possible
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Clones a folder with copy-on-write on the Apple File System. The function `clonefile` of macOS clones a whole folder
 * in one call: on 2026-10-25 it cloned the 53077 entries of `target/debug` in 2.1 seconds, against 11.7 seconds for
 * `cp -c -R -p`, which clones the files one at a time. Node.js cannot call `clonefile`, so `python3` calls it. When
 * `python3` is missing or `clonefile` fails, the clone falls back to `cp -c -R -p`. The clone keeps the dates of the
 * files, and `clonefile` gives the folders the date of the clone, so this class then copies the dates of the folders.
 */
export class DirectoryClone {
	/** The command that calls the function `clonefile` of macOS. */
	static readonly pythonCommand = 'python3';

	/** The Python program that calls `clonefile(source, destination, 0)` and exits with the code 1 when it fails. */
	static readonly clonefileProgram = [
		'import ctypes, os, sys',
		'libc = ctypes.CDLL("/usr/lib/libSystem.dylib", use_errno=True)',
		'result = libc.clonefile(os.fsencode(sys.argv[1]), os.fsencode(sys.argv[2]), 0)',
		'if result != 0:',
		'    sys.stderr.write(os.strerror(ctypes.get_errno()))',
		'    sys.exit(1)',
	].join('\n');

	/**
	 * Clones a folder. The destination must not exist, and its parent folder must exist.
	 * @param sourcePath The absolute path of the folder to clone.
	 * @param destinationPath The absolute path of the new folder.
	 * @param options.pythonCommand The command that runs Python. The default is `python3`. The tests give a missing
	 * command to check the fallback.
	 * @returns Null when the clone happened, or the error of `cp` when both ways failed.
	 */
	static clone(
		sourcePath: string,
		destinationPath: string,
		options: { pythonCommand?: string } = {},
	): string | null {
		const clonefileResult = ChildProcess.spawnSync(
			options.pythonCommand ?? DirectoryClone.pythonCommand,
			['-I', '-c', DirectoryClone.clonefileProgram, sourcePath, destinationPath],
			{
				encoding: 'utf8',
			},
		);
		if (clonefileResult.error === undefined && clonefileResult.status === 0) {
			DirectoryClone._copyFolderDates(sourcePath, destinationPath);
			return null;
		}
		Fs.rmSync(destinationPath, { recursive: true, force: true });
		const copyResult = ChildProcess.spawnSync('cp', ['-c', '-R', '-p', sourcePath, destinationPath], {
			encoding: 'utf8',
		});
		if (copyResult.status !== 0) {
			return copyResult.stderr.trim();
		}
		return null;
	}

	/**
	 * Gives each folder of the clone the access time and the modification time of the same folder in the source.
	 * @param sourcePath The absolute path of the source folder.
	 * @param destinationPath The absolute path of the cloned folder.
	 * @returns Nothing.
	 */
	private static _copyFolderDates(sourcePath: string, destinationPath: string): void {
		const sourceStat = Fs.lstatSync(sourcePath);
		for (const entry of Fs.readdirSync(sourcePath, { withFileTypes: true })) {
			if (entry.isDirectory() === true) {
				DirectoryClone._copyFolderDates(Path.join(sourcePath, entry.name), Path.join(destinationPath, entry.name));
			}
		}
		Fs.utimesSync(destinationPath, sourceStat.atime, sourceStat.mtime);
	}
}
