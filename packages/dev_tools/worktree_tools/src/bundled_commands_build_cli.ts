#!/usr/bin/env tsx
// Builds the bundled command line tools, unless they are already built from the current sources.
// pnpm bundled_commands:build
import ChildProcess from 'node:child_process';
import Path from 'node:path';
import { Command } from 'commander';
import { BundledCommandsStamp } from './bundled_commands_stamp.ts';
import { WorktreeGit } from './worktree_git.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	BundledCommandsBuildCli — the command line `pnpm bundled_commands:build`
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The command line `pnpm bundled_commands:build`, the first step of `pnpm dev`: runs the script
 * `scripts/build_command_line_tools.sh` only when the sources of the two tools changed since their last build.
 */
export class BundledCommandsBuildCli {
	/** The script that builds the two tools, relative to the root of a checkout. */
	static readonly buildScriptRelativePath = Path.join('scripts', 'build_command_line_tools.sh');

	/**
	 * Parses the command line, compares the fingerprint of the sources with the stamp, and runs the build script when
	 * they differ, or when the option `--force` is present. After a successful build, writes the new stamp. When the
	 * fingerprint cannot be computed, the command builds and writes no stamp. When an error happens, prints the
	 * message on the standard error output and sets the exit code to 1.
	 * @param argv The command line arguments, in the format of `process.argv`.
	 * @returns Nothing.
	 */
	static main(argv: string[]): void {
		const program = new Command();
		program
			.name('pnpm bundled_commands:build')
			.description(
				'Builds the bundled command line tools heidrun_code_ctrl and heidrun_data in release '
					+ 'mode, unless they are already built from the current sources. A new worktree gets the '
					+ 'tools and their stamp from the main checkout, so it builds nothing when the sources of the '
					+ 'tools did not change.',
			)
			.option('--force', 'Build the tools even when they are up to date.')
			.parse(argv);
		const options = program.opts<{ force?: boolean }>();
		try {
			const checkoutPath = WorktreeGit.findCheckoutPath(process.cwd());
			let fingerprint: string | null = null;
			try {
				fingerprint = BundledCommandsStamp.computeFingerprint(checkoutPath);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				process.stdout.write(
					`The fingerprint of the sources cannot be computed, so the tools are built: ${message}\n`,
				);
			}
			if (options.force !== true && fingerprint !== null) {
				if (BundledCommandsStamp.isUpToDate(checkoutPath, fingerprint) === true) {
					process.stdout.write('The bundled command line tools are up to date. Nothing to build.\n');
					return;
				}
			}
			const result = ChildProcess.spawnSync('sh', [BundledCommandsBuildCli.buildScriptRelativePath], {
				cwd: checkoutPath,
				stdio: 'inherit',
			});
			if (result.error !== undefined) {
				throw new Error(`The build script did not start: ${result.error.message}`);
			}
			if (result.status !== 0) {
				throw new Error(`The build script failed with the exit code ${result.status}.`);
			}
			if (fingerprint !== null) {
				BundledCommandsStamp.write(checkoutPath, fingerprint);
			}
			process.stdout.write('Built the bundled command line tools.\n');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`Error: ${message}\n`);
			process.exitCode = 1;
		}
	}
}

BundledCommandsBuildCli.main(process.argv);
