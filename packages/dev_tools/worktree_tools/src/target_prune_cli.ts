#!/usr/bin/env tsx
// Lists, and with --yes deletes, the files of the debug folder that the current builds do not use any more.
// pnpm --filter desktop_tauri target:prune
import { Command } from 'commander';
import Path from 'node:path';
import { TargetPaths } from './target_paths.ts';
import { TargetPrune } from './target_prune.ts';
import { WorktreeGit } from './worktree_git.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TargetPruneCli — the command line `pnpm --filter desktop_tauri target:prune`
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The command line `pnpm --filter desktop_tauri target:prune`: asks Cargo which files the current builds use, runs
 * `TargetPrune`, and prints the obsolete files.
 */
export class TargetPruneCli {
	/**
	 * Parses the command line, lists the obsolete files of the debug folder of the checkout that holds the current
	 * folder, and deletes them when the option `--yes` is present. When an error happens, prints the message on the
	 * standard error output and sets the exit code to 1.
	 * @param argv The command line arguments, in the format of `process.argv`.
	 * @returns Nothing.
	 */
	static main(argv: string[]): void {
		const program = new Command();
		program
			.name('pnpm --filter desktop_tauri target:prune')
			.description(
				'Finds the files of the Cargo debug folder that the current builds do not use any more. Cargo never '
					+ 'deletes the files of an old build, so the folder grows without end. The command runs '
					+ '`cargo build` and `cargo test --no-run` to ask Cargo which files the builds use, so it can '
					+ 'take minutes when the sources changed. Without --yes, it only lists the obsolete files. With '
					+ '--yes, it deletes them. It works on the checkout that holds the current folder.',
			)
			.option('--yes', 'Delete the obsolete files. Without this option, the command only lists them.')
			.parse(argv);
		const options = program.opts<{ yes?: boolean }>();
		try {
			const checkoutPath = WorktreeGit.findCheckoutPath(process.cwd());
			process.stdout.write(
				`Running ${TargetPrune.cargoCommands.map((cargoArguments) => {
					return `"cargo ${cargoArguments.join(' ')}"`;
				}).join(' and ')} to find the files that the builds use.\n`,
			);
			const usedHashes = TargetPrune.findUsedHashes({ packagePath: TargetPaths.packagePath(checkoutPath) });
			const plan = TargetPrune.plan({
				debugPath: TargetPaths.debugPath(checkoutPath),
				usedHashes,
			});
			const fileCountByFolder = new Map<string, number>();
			for (const obsoleteEntry of plan.obsoleteEntries) {
				const fileCount = fileCountByFolder.get(obsoleteEntry.folderName) ?? 0;
				fileCountByFolder.set(obsoleteEntry.folderName, fileCount + obsoleteEntry.fileCount);
			}
			for (const [folderName, fileCount] of fileCountByFolder) {
				process.stdout.write(`${Path.join('debug', folderName)}: ${fileCount} obsolete files\n`);
			}
			process.stdout.write(
				`${plan.obsoleteFileCount} obsolete files in ${plan.obsoleteEntries.length} entries. `
					+ `${plan.keptFileCount} files are kept.\n`,
			);
			if (plan.obsoleteEntries.length === 0) {
				return;
			}
			if (options.yes === true) {
				TargetPrune.remove(plan);
				process.stdout.write(`Deleted ${plan.obsoleteFileCount} files.\n`);
			} else {
				process.stdout.write(
					'Nothing was deleted. Run the command again with --yes to delete these '
						+ `${plan.obsoleteFileCount} files.\n`,
				);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`Error: ${message}\n`);
			process.exitCode = 1;
		}
	}
}

TargetPruneCli.main(process.argv);
