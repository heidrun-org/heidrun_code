#!/usr/bin/env tsx
// Creates a Git worktree, clones the compiled Rust files of the main checkout into it, and installs its packages.
// pnpm worktree:create <name>
import { Command } from 'commander';
import { WorktreeCreate } from './worktree_create.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	WorktreeCreateCli — the command line `pnpm worktree:create`
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The command line `pnpm worktree:create`: reads the name, runs `WorktreeCreate`, and prints the result.
 */
export class WorktreeCreateCli {
	/**
	 * Parses the command line and creates the worktree. When an error happens, prints the message on the standard
	 * error output and sets the exit code to 1.
	 * @param argv The command line arguments, in the format of `process.argv`.
	 * @returns Nothing.
	 */
	static main(argv: string[]): void {
		const program = new Command();
		program
			.name('pnpm worktree:create')
			.description(
				'Creates a Git worktree in the folder .claude/worktrees of the main checkout, on a new branch with the '
					+ 'same name. It initializes the submodules at their recorded commits. On macOS, it then clones '
					+ 'the compiled files of the main checkout into the worktree, with '
					+ 'copy-on-write clones. The first build in the worktree '
					+ 'is then much faster and uses much less disk space. Build the main checkout before you create '
					+ 'a worktree. At the end, it runs pnpm install --frozen-lockfile in the worktree, so the '
					+ 'worktree has a folder node_modules. When the installation fails, it prints the error and '
					+ 'exits with the code 1.',
			)
			.argument('<name>', 'The name of the new branch, and the name of the folder of the worktree.')
			.option(
				'--base <ref>',
				'The commit, the branch, or the tag where the new branch starts. (default: the current commit of the '
					+ 'main checkout)',
			)
			.option(
				'--without-optimization',
				'Do not clone the compiled files and the built mobile website of the main checkout, and do not copy '
					+ 'their dates. The first pnpm dev then compiles everything, which is slow. Use it to check whether '
					+ 'a problem comes from these optimizations.',
			)
			.addHelpText(
				'after',
				`
Examples:
  $ pnpm worktree:create remove-docs-issues-35
  $ pnpm worktree:create remove-docs-issues-35 --base dev_jerome
  $ pnpm worktree:create remove-docs-issues-35 --without-optimization
`,
			)
			.parse(argv);
		const options = program.opts<{ base?: string; withoutOptimization?: boolean }>();
		const name = program.args[0] as string;
		try {
			const result = WorktreeCreate.run({
				workingDirectory: process.cwd(),
				name,
				baseRef: options.base,
				isWithoutOptimization: options.withoutOptimization === true,
			});
			process.stdout.write(
				`Created the worktree ${result.worktreePath} on the new branch ${result.branchName}.\n`,
			);
			process.stdout.write('Initialized the submodules at their recorded commits.\n');
			if (result.isTargetCloned === true) {
				process.stdout.write(
					'Cloned target/debug and target/release from the main checkout into the worktree.\n',
				);
				process.stdout.write(
					`Gave ${result.sourceDates.fileCount} unchanged files and ${result.sourceDates.folderCount} unchanged `
						+ 'folders the dates of the main checkout.\n',
				);
			} else {
				process.stdout.write(`The compiled files were not cloned. ${result.skipReason}\n`);
			}
			process.stdout.write('Installed the packages in the worktree with pnpm install --frozen-lockfile.\n');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`Error: ${message}\n`);
			process.exitCode = 1;
		}
	}
}

WorktreeCreateCli.main(process.argv);
