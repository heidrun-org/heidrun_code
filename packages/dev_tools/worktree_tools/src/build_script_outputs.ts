import Fs from 'node:fs';
import Path from 'node:path';
import { TargetPaths } from './target_paths.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	BuildScriptOutputs — moves the absolute paths of the cloned build script records to the worktree
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Cargo keeps what each build script printed in the file `target/debug/build/<crate>-<hash>/output`. Some build
 * scripts, such as the one of Tauri, print the files to watch with their absolute path. After the clone, these paths
 * name the files of the main checkout, Cargo sees a different list of watched files, runs the build script again, and
 * compiles the application again. This class replaces the path of the main checkout with the path of the worktree in
 * these files, and keeps their dates.
 */
export class BuildScriptOutputs {
	/** The name of the file where Cargo keeps what a build script printed. */
	static readonly outputFileName = 'output';

	/**
	 * Rewrites the build script records of the cloned debug folder of a worktree.
	 * @param mainCheckoutPath The absolute path of the main checkout.
	 * @param worktreePath The absolute path of the worktree.
	 * @returns The number of files that were changed.
	 */
	static rewrite(mainCheckoutPath: string, worktreePath: string): number {
		const buildPath = Path.join(TargetPaths.debugPath(worktreePath), 'build');
		if (Fs.existsSync(buildPath) === false) {
			return 0;
		}
		const mainPrefix = `${Path.join(mainCheckoutPath, 'packages')}${Path.sep}`;
		const worktreePrefix = `${Path.join(worktreePath, 'packages')}${Path.sep}`;
		let changedCount = 0;
		for (const entryName of Fs.readdirSync(buildPath)) {
			const outputPath = Path.join(buildPath, entryName, BuildScriptOutputs.outputFileName);
			if (Fs.existsSync(outputPath) === false) {
				continue;
			}
			const text = Fs.readFileSync(outputPath, 'utf8');
			if (text.includes(mainPrefix) === false) {
				continue;
			}
			const outputStat = Fs.statSync(outputPath);
			Fs.writeFileSync(outputPath, text.split(mainPrefix).join(worktreePrefix));
			Fs.utimesSync(outputPath, outputStat.atime, outputStat.mtime);
			changedCount += 1;
		}
		return changedCount;
	}
}
