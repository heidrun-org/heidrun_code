import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Path from 'node:path';
import { BuildScriptOutputs } from './build_script_outputs.ts';
import { DirectoryClone } from './directory_clone.ts';
import { SourceDates } from './source_dates.ts';
import { TargetPaths } from './target_paths.ts';
import { WorktreeGit } from './worktree_git.ts';
import type { SourceDatesResult, WorktreeCreateResult } from './worktree_tools_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	WorktreeCreate — creates a Git worktree, clones the compiled Rust files into it, and installs its packages
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Creates a Git worktree in the folder `.claude/worktrees` of the main checkout. Then, on macOS, it clones the `debug`
 * folder and the `release` folder of the Cargo target folder of the main checkout into the worktree, with
 * copy-on-write clones. The `release` folder holds the bundled command line tools and their compiled dependencies. The first build in the worktree then compiles only the crates of Heidrun Code, and not every Rust
 * dependency again. After the clone, each file of the worktree that has the same content as in the main checkout gets
 * the dates of the main checkout, and the cloned build script records name the worktree, so Cargo does not compile
 * its crate again. Every submodule is initialized at its
 * recorded commit before the compiled files are cloned.
 * At the end, it installs the packages of the worktree with `pnpm install --frozen-lockfile`, so the worktree has a
 * folder `node_modules` and `pnpm dev` runs at once.
 */
export class WorktreeCreate {
	/** The folder of the main checkout that holds the worktrees. */
	static readonly worktreesRelativePath = Path.join('.claude', 'worktrees');

	/** The commit where the new branch starts when the caller gives none. */
	static readonly defaultBaseRef = 'HEAD';

	/**
	 * The built mobile website, relative to the root of a checkout. The package `mobile_server` puts it inside its
	 * program, and Cargo compiles the application again when a file of it is newer, so the clone keeps its dates.
	 */
	static readonly mobileWebsiteDistRelativePath = Path.join('packages', 'auxiliary', 'mobile_website', 'dist');

	/** The reason that the result gives when the caller asked for no optimization. */
	static readonly withoutOptimizationReason = 'The option --without-optimization was given.';

	/** The arguments of the `pnpm` command that installs the packages of a new worktree. */
	static readonly installArguments = ['install', '--frozen-lockfile'];

	/**
	 * Creates the worktree on a new branch, clones the compiled Rust files into it when it is possible, then installs
	 * its packages. Submodule initialization happens before cloning and installation.
	 * @param options.workingDirectory A folder inside the main checkout or inside a worktree.
	 * @param options.name The name of the new branch, and the name of the folder of the worktree.
	 * @param options.baseRef The commit, the branch, or the tag where the new branch starts. The default is the
	 * current commit of the main checkout.
	 * @param options.isWithoutOptimization True to skip the clones, the copy of the dates, and the change of the build
	 * script records. The first build in the worktree then compiles everything, which is slow but uses nothing of the
	 * main checkout. Use it to check whether a problem comes from these optimizations.
	 * @returns The path of the worktree, and whether the clone happened.
	 * @throws An error when the name is not a valid branch name, or when the worktree folder or the branch exists. Also
	 * an error when submodule initialization or the installation of the packages fails: the worktree then exists,
	 * without a folder `node_modules`.
	 */
	static run(options: {
		workingDirectory: string;
		name: string;
		baseRef?: string;
		isWithoutOptimization?: boolean;
	}): WorktreeCreateResult {
		const mainCheckoutPath = WorktreeGit.findMainCheckoutPath(options.workingDirectory);
		if (WorktreeGit.isBranchNameValid(mainCheckoutPath, options.name) === false) {
			throw new Error(`"${options.name}" is not a valid branch name.`);
		}
		const worktreePath = Path.join(mainCheckoutPath, WorktreeCreate.worktreesRelativePath, options.name);
		if (Fs.existsSync(worktreePath) === true) {
			throw new Error(`The folder of the worktree exists already: ${worktreePath}`);
		}

		WorktreeGit.addWorktree(
			mainCheckoutPath,
			worktreePath,
			options.name,
			options.baseRef ?? WorktreeCreate.defaultBaseRef,
		);

		WorktreeGit.initializeSubmodules(worktreePath);
		const skipReason = options.isWithoutOptimization === true
			? WorktreeCreate.withoutOptimizationReason
			: WorktreeCreate._cloneTarget(mainCheckoutPath, worktreePath);
		let sourceDates: SourceDatesResult = {
			fileCount: 0,
			folderCount: 0,
		};
		let rewrittenBuildScriptOutputCount = 0;
		if (skipReason === null) {
			WorktreeCreate._cloneMobileWebsiteDist(mainCheckoutPath, worktreePath);
			sourceDates = SourceDates.copyFromMainCheckout(mainCheckoutPath, worktreePath);
			rewrittenBuildScriptOutputCount = BuildScriptOutputs.rewrite(mainCheckoutPath, worktreePath);
		}
		WorktreeCreate._installPackages(worktreePath);
		return {
			worktreePath,
			branchName: options.name,
			isTargetCloned: skipReason === null,
			skipReason,
			sourceDates,
			rewrittenBuildScriptOutputCount,
		};
	}

	/**
	 * Clones the `debug` folder and the `release` folder of the Cargo target folder of the main checkout into the
	 * worktree. With the compiled dependencies of `release`, a change in a package that the bundled command line tools
	 * use compiles only the changed packages again. Each clone shares the disk blocks with the original, so it uses almost no disk space at the start. A
	 * file that Cargo rewrites later becomes a real copy. The worktree is inside the main checkout, so both folders are
	 * on the same disk.
	 * @param mainCheckoutPath The absolute path of the main checkout.
	 * @param worktreePath The absolute path of the new worktree.
	 * @returns Null when the clone happened, or the reason why it did not happen.
	 */
	private static _cloneTarget(mainCheckoutPath: string, worktreePath: string): string | null {
		if (process.platform !== 'darwin') {
			return 'The clone needs macOS and the Apple File System.';
		}
		const targetFolders = [
			{
				sourcePath: TargetPaths.debugPath(mainCheckoutPath),
				destinationPath: TargetPaths.debugPath(worktreePath),
			},
			{
				sourcePath: TargetPaths.releasePath(mainCheckoutPath),
				destinationPath: TargetPaths.releasePath(worktreePath),
			},
		];
		for (const targetFolder of targetFolders) {
			if (Fs.existsSync(targetFolder.sourcePath) === false) {
				return `The main checkout has no folder ${targetFolder.sourcePath}. Build the main checkout once, then create `
					+ 'worktree.';
			}
		}
		for (const commandFileName of TargetPaths.bundledCommandFileNames) {
			const commandFilePath = Path.join(TargetPaths.bundledCommandsPath(mainCheckoutPath), commandFileName);
			if (Fs.existsSync(commandFilePath) === false) {
				return `The main checkout has no bundled command line tool ${commandFilePath}. Build the main checkout once, `
					+ 'then create the worktree.';
			}
		}
		for (const targetFolder of targetFolders) {
			Fs.mkdirSync(Path.dirname(targetFolder.destinationPath), { recursive: true });
			const errorText = DirectoryClone.clone(targetFolder.sourcePath, targetFolder.destinationPath);
			if (errorText !== null) {
				Fs.rmSync(TargetPaths.targetPath(worktreePath), { recursive: true, force: true });
				return `The clone failed: ${errorText}`;
			}
		}
		return null;
	}

	/**
	 * Clones the built mobile website of the main checkout into the worktree, with its dates. Nothing happens when the
	 * main checkout has no built mobile website: `pnpm dev` builds it.
	 * @param mainCheckoutPath The absolute path of the main checkout.
	 * @param worktreePath The absolute path of the new worktree.
	 * @returns Nothing.
	 */
	private static _cloneMobileWebsiteDist(mainCheckoutPath: string, worktreePath: string): void {
		const sourcePath = Path.join(mainCheckoutPath, WorktreeCreate.mobileWebsiteDistRelativePath);
		const destinationPath = Path.join(worktreePath, WorktreeCreate.mobileWebsiteDistRelativePath);
		if (Fs.existsSync(sourcePath) === false || Fs.existsSync(destinationPath) === true) {
			return;
		}
		Fs.mkdirSync(Path.dirname(destinationPath), { recursive: true });
		DirectoryClone.clone(sourcePath, destinationPath);
	}

	/**
	 * Installs the packages of the worktree with `pnpm install --frozen-lockfile`. The command reads the file
	 * `pnpm-lock.yaml` of the worktree and never changes it.
	 * @param worktreePath The absolute path of the new worktree.
	 * @returns Nothing.
	 * @throws An error that holds the output of `pnpm` when the installation fails, or when `pnpm` does not start.
	 */
	private static _installPackages(worktreePath: string): void {
		const commandText = `pnpm ${WorktreeCreate.installArguments.join(' ')}`;
		const result = ChildProcess.spawnSync('pnpm', WorktreeCreate.installArguments, {
			cwd: worktreePath,
			encoding: 'utf8',
		});
		if (result.error !== undefined) {
			throw new Error(
				`The worktree ${worktreePath} was created, but "${commandText}" did not start: ${result.error.message}`,
			);
		}
		if (result.status !== 0) {
			const output = `${result.stdout}${result.stderr}`.trim();
			throw new Error(
				`The worktree ${worktreePath} was created, but "${commandText}" failed with the exit code `
					+ `${result.status}. Fix the cause, then run the command in the worktree.\n${output}`,
			);
		}
	}
}
