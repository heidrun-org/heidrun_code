#!/usr/bin/env tsx
// Generates a section of CHANGELOG.md from the pull requests merged between two releases.
// pnpm release:change_log
import Path from 'node:path';
import { Command } from 'commander';
import { ChangeLogGit } from './git/change_log_git.ts';
import { GenerateChangeLog } from './generation/generate_change_log.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Cli — the command line of the package change_log_generator
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The command line of the package `change_log_generator`: reads the options, runs `GenerateChangeLog`, and prints the
 * new section.
 */
export class Cli {
	/**
	 * Parses the command line, writes the file `CHANGELOG.md`, and prints the new section on the standard output.
	 * When an error happens, prints the message on the standard error output and sets the exit code to 1.
	 * @param argv The command line arguments, in the format of `process.argv`.
	 * @returns A promise that resolves when the command has finished.
	 */
	static async main(argv: string[]): Promise<void> {
		const program = new Command();
		program
			.name('pnpm release:change_log')
			.description(
				'Writes a section of CHANGELOG.md, in the Keep a Changelog format, from the pull requests merged '
					+ 'between two releases (Git tags). Without option, the section is "Unreleased": from the last '
					+ 'release (the tag with the highest version) to the current commit. The section goes at its place '
					+ 'in the file: "Unreleased" first, then the releases from the highest version to the lowest. A '
					+ 'section of the same version is replaced. When the section is the last release, the section '
					+ '"Unreleased" is removed. The other sections do not change. The command prints '
					+ 'the new section on the standard output.',
			)
			.option(
				'--ai',
				'Ask a coding agent to write the section, with the categories Added, Changed, Deprecated, Removed, '
					+ 'Fixed, and Security. Without this option, the section is a plain list of the pull requests.',
			)
			.option(
				'--agent <name>',
				`The coding agent for the option --ai: "codex", "claude", or "agy". (default: "${GenerateChangeLog.defaultAgentName}")`,
			)
			.option(
				'--from <tag>',
				'The release after which the changes start. "start" means the start of the history. (default: the '
					+ 'release before --to, or the start if there is none)',
			)
			.option(
				'--to <tag>',
				'The release where the changes end. The heading of the section is "[version] - date" of this release. '
					+ '"now" means the current commit, and the heading "Unreleased". (default: "now")',
			)
			.addHelpText(
				'after',
				`
Examples:
  $ pnpm release:change_log                              last release -> now ("Unreleased")
  $ pnpm release:change_log --from v0.2.0                v0.2.0 -> now ("Unreleased")
  $ pnpm release:change_log --to v0.2.0                  release before v0.2.0, or start -> v0.2.0
  $ pnpm release:change_log --from start --to v0.2.0     start -> v0.2.0
  $ pnpm release:change_log --from v0.2.0 --to v0.3.0    v0.2.0 -> v0.3.0
`,
			);
		program.parse(argv);
		const options = program.opts<{ ai?: boolean; agent?: string; from?: string; to?: string }>();
		try {
			const repositoryPath = ChangeLogGit.findRepositoryPath(process.cwd());
			const section = await GenerateChangeLog.run({
				repositoryPath,
				isAi: options.ai === true,
				agentName: options.agent,
				fromTag: options.from,
				toTag: options.to,
			});
			process.stderr.write(`Wrote ${Path.join(repositoryPath, GenerateChangeLog.changeLogFileName)}\n`);
			process.stdout.write(`${section}\n`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			process.stderr.write(`Error: ${message}\n`);
			process.exitCode = 1;
		}
	}
}

Cli.main(process.argv);
