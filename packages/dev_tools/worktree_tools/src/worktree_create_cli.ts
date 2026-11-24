#!/usr/bin/env tsx
import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Path from 'node:path';
import { DirectoryClone } from './directory_clone.ts';
import { TargetPaths } from './target_paths.ts';
import { WorktreeGit } from './worktree_git.ts';

const __filename = import.meta.filename;
const __dirname = Path.dirname(__filename);

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	WorktreeCreateCli — delegates worktree creation and copies the built mobile website
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const MOBILE_WEBSITE_OUTPUT = 'packages/auxiliary/mobile_website/dist';

/** Output of the pinned Faster Rust Work Trees create command. */
type WorktreeCreateReport = {
	/** Absolute path to the newly created worktree. */
	worktreePath: string;
	/** Outcome of copying each configured Cargo target folder. */
	decisions: string[];
};

/** Runs Faster Rust Work Trees followed by the Heidrun Code worktree setup. */
export class WorktreeCreateCli {
	/**
	 * Creates the worktree and copies the optional mobile website output after Cargo output is cloned.
	 * @param args Arguments after the executable name.
	 * @returns The exit code.
	 */
	static run(args: string[]): number {
		const mainCheckoutPath = WorktreeGit.findMainCheckoutPath(process.cwd());
		const packagePath = Path.resolve(__dirname, '..');
		const configFile = Path.resolve(packagePath, '../../../.faster_rust_worktrees.yaml');
		const configPath = Path.relative(mainCheckoutPath, configFile);
		const toolArgs = ['--dir', packagePath, 'exec', 'faster_rust_worktrees', '--config', configPath, 'create', ...args];
		const result = ChildProcess.spawnSync('pnpm', toolArgs, {
			encoding: 'utf8',
			stdio: ['inherit', 'pipe', 'inherit'],
		});
		process.stdout.write(result.stdout ?? '');
		if (result.error !== undefined) {
			throw result.error;
		}
		if (result.status !== 0 || args.includes('--help') || args.includes('-h')) {
			return result.status ?? 1;
		}

		const { worktreePath, decisions } = JSON.parse(result.stdout) as WorktreeCreateReport;
		if (decisions.includes(`${TargetPaths.targetRelativePath}: copy-on-write cloned`) === true) {
			WorktreeCreateCli._copyMobileWebsite(mainCheckoutPath, worktreePath);
		}
		return 0;
	}

	/**
	 * Copies the built mobile website if the main checkout has it and the worktree does not.
	 * @param mainCheckoutPath Path of the main checkout.
	 * @param worktreePath Path of the newly created worktree.
	 * @returns Nothing.
	 */
	private static _copyMobileWebsite(mainCheckoutPath: string, worktreePath: string): void {
		const source = Path.join(mainCheckoutPath, MOBILE_WEBSITE_OUTPUT);
		const destination = Path.join(worktreePath, MOBILE_WEBSITE_OUTPUT);
		if (Fs.existsSync(source) === false || Fs.existsSync(destination) === true) {
			return;
		}
		Fs.mkdirSync(Path.dirname(destination), {
			recursive: true,
		});
		const error = DirectoryClone.clone(source, destination);
		if (error !== null) {
			Fs.rmSync(destination, {
				recursive: true,
				force: true,
			});
			process.stderr.write(`Could not copy the built mobile website. pnpm dev will build it. ${error}\n`);
		}
	}
}

try {
	process.exitCode = WorktreeCreateCli.run(process.argv.slice(2));
} catch (error) {
	process.stderr.write(`${String(error)}\n`);
	process.exitCode = 1;
}
