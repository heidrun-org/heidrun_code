import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Path from 'node:path';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	WorktreeGit — the only code of the package that runs `git`
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Runs the `git` commands that list and create worktrees.
 */
export class WorktreeGit {
	/**
	 * Lists the checkouts of the repository that holds a folder. The first one is the main checkout, and the others
	 * are the worktrees.
	 * @param workingDirectory A folder inside the main checkout or inside a worktree.
	 * @returns The absolute paths of the main checkout, then of every worktree.
	 * @throws An error when the folder is not inside a Git repository.
	 */
	static listCheckoutPaths(workingDirectory: string): string[] {
		const output = WorktreeGit._git(workingDirectory, ['worktree', 'list', '--porcelain']);
		const checkoutPaths: string[] = [];
		for (const line of output.split('\n')) {
			if (line.startsWith('worktree ') === true) {
				checkoutPaths.push(line.slice('worktree '.length));
			}
		}
		return checkoutPaths;
	}

	/**
	 * Finds the main checkout of the repository that holds a folder, even when the folder is inside a worktree.
	 * @param workingDirectory A folder inside the main checkout or inside a worktree.
	 * @returns The absolute path of the main checkout.
	 * @throws An error when the folder is not inside a Git repository.
	 */
	static findMainCheckoutPath(workingDirectory: string): string {
		const checkoutPaths = WorktreeGit.listCheckoutPaths(workingDirectory);
		const mainCheckoutPath = checkoutPaths[0];
		if (mainCheckoutPath === undefined) {
			throw new Error(`No Git checkout found from the folder: ${workingDirectory}`);
		}
		return mainCheckoutPath;
	}

	/**
	 * Finds the checkout that holds a folder: the main checkout or one of the worktrees. A worktree is inside the main
	 * checkout, so the longest checkout path that holds the folder wins.
	 * @param workingDirectory A folder inside the main checkout or inside a worktree.
	 * @returns The absolute path of the checkout that holds the folder.
	 * @throws An error when the folder is not inside a Git checkout of the repository.
	 */
	static findCheckoutPath(workingDirectory: string): string {
		const realWorkingDirectory = Fs.realpathSync(workingDirectory);
		const matchingCheckoutPaths = WorktreeGit.listCheckoutPaths(workingDirectory).filter((checkoutPath) => {
			const checkoutPrefix = `${checkoutPath}${Path.sep}`;
			return realWorkingDirectory === checkoutPath || realWorkingDirectory.startsWith(checkoutPrefix);
		});
		const checkoutPath = matchingCheckoutPaths.sort((first, second) => {
			return second.length - first.length;
		})[0];
		if (checkoutPath === undefined) {
			throw new Error(`The folder ${workingDirectory} is in no checkout of the repository.`);
		}
		return checkoutPath;
	}

	/**
	 * Runs one `git` command.
	 * @param workingDirectory The folder to run the command in.
	 * @param args The arguments of the `git` command.
	 * @returns The standard output of the command.
	 * @throws An error with the standard error output of `git` when the command fails.
	 */
	private static _git(workingDirectory: string, args: string[]): string {
		const result = ChildProcess.spawnSync('git', args, {
			cwd: workingDirectory,
			encoding: 'utf8',
		});
		if (result.status !== 0) {
			throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
		}
		return result.stdout;
	}
}
