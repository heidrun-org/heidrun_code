import { Command, Option } from 'commander';
import { DocumentationGeneration } from './documentation_generation.ts';
import { DocumentationUpdate } from './documentation_update.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Cli — explicit generation or a non-generating dry run
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Parses the command without starting generation on import through the package index. */
export class Cli {
	/**
	 * Runs only the requested subcommand.
	 * @param argv Process arguments including node and the script path.
	 * @returns Resolves when the chosen command finishes.
	 */
	static async main(argv: string[]): Promise<void> {
		const program = new Command();
		program.name('documentation_by_ai').description('Generate the user documentation once and build once.');
		program.command('update')
			.description('Check all documentation once, validate it and open a draft for human review.')
			.option('--model <name>', 'Codex model; no automatic fallback', 'gpt-6-luna')
			.addOption(new Option('--effort <level>', 'Reasoning effort').choices(['low', 'medium', 'high'])
				.default('medium'))
			.option('--evidence <directory>', 'Verified captures inside this checkout, with manifest.json')
			.option('--dry-run', 'Print the full request without generation or publication')
			.action(async (options: {
				model: string;
				effort: 'low' | 'medium' | 'high';
				evidence?: string;
				dryRun?: boolean;
			}) => {
				await DocumentationUpdate.run({
					model: options.model,
					effort: options.effort,
					evidencePath: options.evidence,
					isDryRun: options.dryRun === true,
					onlyRuleFiles: [],
				});
			});
		program.command('generate-and-build')
			.description('One Codex writing call, one build, then stop for human review.')
			.option('--model <name>', 'Codex model; no automatic fallback', 'gpt-6-luna')
			.addOption(new Option('--effort <level>', 'Reasoning effort').choices(['low', 'medium', 'high']).default('medium'))
			.option('--only <rule-files...>', 'Limit generation to repository-relative interface rule files')
			.option('--evidence <directory>', 'Verified capture directory inside this checkout, with manifest.json')
			.option('--dry-run', 'Print the prompt; no model call, files or website build')
			.action(async (options: {
				model: string;
				effort: 'low' | 'medium' | 'high';
				only?: string[];
				evidence?: string;
				dryRun?: boolean;
			}) => {
				await DocumentationGeneration.run({
					model: options.model,
					effort: options.effort,
					onlyRuleFiles: options.only ?? [],
					evidencePath: options.evidence,
					isDryRun: options.dryRun === true,
				});
			});
		await program.parseAsync(argv);
	}
}

Cli.main(process.argv).catch((error: unknown) => {
	process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
});
