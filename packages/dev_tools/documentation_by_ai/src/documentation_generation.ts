import Fs from 'node:fs';
import Path from 'node:path';
import Crypto from 'node:crypto';
import { DocumentationInputs } from './documentation_inputs.ts';
import { DocumentationProcess } from './documentation_process.ts';
import { DocumentationPrompt } from './documentation_prompt.ts';
import type { DocumentationOptions } from './documentation_types.ts';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DocumentationGeneration — one writing call, one build, then return to the developer
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Owns the explicit generate-and-build operation; importing the package does not execute it. */
export class DocumentationGeneration {
	/** Uses the checkout containing the code, including when the code is in a worktree. */
	static readonly repositoryPath = Path.resolve(__dirname, '../../../..');

	/**
	 * Generates once and builds once, with no judge, retry or correction pass.
	 * @param options Explicit settings for this request.
	 * @param repositoryPath Checkout receiving the output; defaults to the checkout containing this package.
	 * @returns The run record directory, or undefined for a dry run.
	 */
	static async run(
		options: DocumentationOptions,
		repositoryPath = DocumentationGeneration.repositoryPath,
	): Promise<string | undefined> {
		const packagePath = Path.join(repositoryPath, 'packages/dev_tools/documentation_by_ai');
		const files = DocumentationInputs.collect(repositoryPath, options);
		const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${Crypto.randomUUID().slice(0, 8)}`;
		const runPath = Path.join(packagePath, 'runs', runId);
		const prompt = DocumentationPrompt.build(options, files, runPath);
		if (options.isDryRun === true) {
			process.stdout.write(prompt);
			return undefined;
		}
		const lockPath = Path.join(packagePath, '.generation.lock');
		const lock = Fs.openSync(lockPath, 'wx');
		try {
			Fs.writeFileSync(lock, JSON.stringify({
				pid: process.pid,
				runPath,
			}, null, 2));
			Fs.mkdirSync(runPath, { recursive: true });
			const answerPath = Path.join(runPath, 'answer.md');
			const args = [
				'exec', '--skip-git-repo-check', '--sandbox', 'workspace-write',
				'--model', options.model, '-c', `model_reasoning_effort=${JSON.stringify(options.effort)}`,
				'--json', '--output-last-message', answerPath, '-',
			];
			Fs.writeFileSync(Path.join(runPath, 'prompt.md'), prompt);
			Fs.writeFileSync(Path.join(runPath, 'settings.json'), JSON.stringify({
				...options,
				repositoryPath,
				writerCommand: ['codex', ...args],
				buildCommand: ['pnpm', '--filter', 'website_public', 'build'],
				promptSha256: Crypto.createHash('sha256').update(prompt).digest('hex'),
			}, null, 2));
			Fs.writeFileSync(Path.join(runPath, 'inputs.json'), JSON.stringify(
				DocumentationInputs.fingerprint(repositoryPath, files), null, 2,
			));
			DocumentationGeneration._status(runPath, 'generating');
			process.stderr.write(`Generating once with ${options.model} / ${options.effort}. Record: ${runPath}\n`);
			await DocumentationProcess.run('codex', args, repositoryPath, Path.join(runPath, 'writer.jsonl'), prompt);
			DocumentationGeneration._status(runPath, 'building');
			process.stderr.write('Generation finished. Building the website once.\n');
			await DocumentationProcess.run('pnpm', ['--filter', 'website_public', 'build'],
				repositoryPath, Path.join(runPath, 'build.log'));
			DocumentationGeneration._status(runPath, 'ready_for_human_review');
			process.stderr.write(`Build passed. Review the website and ${answerPath}. No automatic review follows.\n`);
			return runPath;
		} catch (error) {
			if (Fs.existsSync(runPath)) {
				DocumentationGeneration._status(runPath, 'failed', error instanceof Error ? error.message : String(error));
			}
			throw error;
		} finally {
			Fs.closeSync(lock);
			Fs.unlinkSync(lockPath);
		}
	}

	/**
	 * Saves execution status without assigning a quality score or claiming acceptance.
	 * @param runPath The run record directory.
	 * @param status The current execution stage.
	 * @param error Optional failure detail.
	 * @returns Nothing.
	 */
	private static _status(runPath: string, status: string, error?: string): void {
		Fs.writeFileSync(Path.join(runPath, 'status.json'), JSON.stringify({
			status,
			updatedAt: new Date().toISOString(),
			error,
		}, null, 2));
	}
}
