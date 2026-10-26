import Fs from 'node:fs';
import Path from 'node:path';
import Crypto from 'node:crypto';
import { DocumentationChecks } from './documentation_checks.ts';
import { DocumentationGeneration } from './documentation_generation.ts';
import { DocumentationHints } from './documentation_hints.ts';
import { DocumentationInputs } from './documentation_inputs.ts';
import { DocumentationProcess } from './documentation_process.ts';
import type { DocumentationOptions } from './documentation_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DocumentationUpdate — validates one full generation and opens a draft for review
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Keeps the user's checkout unchanged and publishes only checked documentation in a separate worktree. */
export class DocumentationUpdate {
	/**
	 * Generates once in an isolated worktree, checks the result and opens a draft pull request or merge request.
	 * @param options Writer model, effort and optional verified evidence; limited runs are rejected.
	 * @returns The draft address, or undefined for a dry run.
	 */
	static async run(options: DocumentationOptions): Promise<string | undefined> {
		if (options.onlyRuleFiles.length > 0) {
			throw new Error('docs:update_by_ai always checks all documentation. Use docs:generate-and-build for --only.');
		}
		const root = DocumentationGeneration.repositoryPath;
		const previous = DocumentationChecks.previousCommit(root);
		const head = DocumentationChecks.command(root, 'git', ['rev-parse', 'HEAD']);
		const hintsText = DocumentationHints.collect(root, previous);
		const fullOptions = {
			...options,
			hintsText,
		};
		DocumentationInputs.collect(root, fullOptions);
		if (options.isDryRun === true) {
			await DocumentationGeneration.run(fullOptions);
			return undefined;
		}
		if (DocumentationChecks.command(root, 'git', ['status', '--porcelain']) !== '') {
			throw new Error('Start docs:update_by_ai from a clean checkout. Existing changes are never committed.');
		}
		const base = DocumentationChecks.command(root, 'git', ['branch', '--show-current']);
		if (['dev_jerome', 'dev_eric'].includes(base) === false) {
			throw new Error('Start from your personal development branch: dev_jerome or dev_eric.');
		}
		const repositoryUrl = DocumentationHints.repositoryUrl(root);
		const branch = `documentation-update-375-${Crypto.randomUUID().slice(0, 8)}`;
		const recordPath = Path.join(root, 'packages/dev_tools/documentation_by_ai/runs', branch);
		Fs.mkdirSync(recordPath, {
			recursive: true,
		});
		const lockPath = Path.join(root, 'packages/dev_tools/documentation_by_ai/.generation.lock');
		const lock = Fs.openSync(lockPath, 'wx');
		let worktree: string | undefined;
		try {
			Fs.writeFileSync(lock, JSON.stringify({
				pid: process.pid,
				recordPath,
			}));
			await DocumentationProcess.run('pnpm', ['worktree:create', branch, '--base', head],
				root, Path.join(recordPath, 'worktree.log'));
			const records = DocumentationChecks.command(root, 'git', ['worktree', 'list', '--porcelain']).split('\n\n');
			const entry = records.find((record) => record.includes(`branch refs/heads/${branch}\n`)
				|| record.endsWith(`branch refs/heads/${branch}`));
			worktree = entry?.split('\n')[0].slice('worktree '.length);
			if (worktree === undefined) {
				throw new Error('The created documentation worktree could not be identified.');
			}
			if (options.evidencePath !== undefined) {
				const source = Fs.realpathSync(Path.resolve(root, options.evidencePath));
				const evidencePath = 'packages/dev_tools/documentation_by_ai/runs/supplied_evidence';
				Fs.cpSync(source, Path.join(worktree, evidencePath), {
					recursive: true,
				});
				fullOptions.evidencePath = evidencePath;
			}
			const runPath = await DocumentationGeneration.run(fullOptions, worktree);
			if (runPath === undefined) {
				throw new Error('The full generation did not create run records.');
			}
			DocumentationChecks.pages(worktree);
			DocumentationChecks.publicationFiles(worktree);
			if (DocumentationChecks.command(worktree, 'git', ['rev-parse', 'HEAD']) !== head
				|| DocumentationChecks.command(worktree, 'git', ['branch', '--show-current']) !== branch) {
				throw new Error('The writer changed Git history or the selected branch. Publication stopped.');
			}
			if (DocumentationChecks.command(worktree, 'git', ['diff', '--cached', '--name-only']) !== '') {
				throw new Error('The writer staged files. Publication stopped.');
			}
			await DocumentationProcess.run('pnpm', ['--filter', 'website_public', 'test'],
				worktree, Path.join(runPath, 'tests.log'));
			DocumentationChecks.pages(worktree);
			Fs.writeFileSync(Path.join(worktree, DocumentationChecks.markerPath), `${head}\n`);
			const files = DocumentationChecks.publicationFiles(worktree);
			if (files.length === 0) {
				process.stdout.write(`Documentation is unchanged. Review records: ${runPath}\n`);
				return undefined;
			}
			DocumentationChecks.command(worktree, 'git', ['diff', '--check']);
			DocumentationChecks.command(worktree, 'git', ['add', '--', ...files]);
			DocumentationChecks.command(worktree, 'git', ['commit', '-m', 'Update AI user documentation (#375)']);
			const bodyPath = Path.join(runPath, 'draft_body.md');
			const answer = Fs.readFileSync(Path.join(runPath, 'answer.md'), 'utf8');
			Fs.writeFileSync(bodyPath, `Checks all user documentation against the current rules and code.\n\n`
				+ `Source revision: [documented source](${repositoryUrl}/commit/${head}).\n\n`
				+ `${answer}\n\nValidation: website build and website tests passed.\n\n`
				+ `The developer reviews and merges this draft. Deployment remains separate.\n`);
			DocumentationChecks.command(worktree, 'git', ['push', '-u', 'origin', branch]);
			const isGitHub = new URL(repositoryUrl).hostname === 'github.com';
			const url = isGitHub
				? DocumentationChecks.command(worktree, 'gh', ['pr', 'create', '--draft', '--base', base,
					'--head', branch, '--title', 'Update AI user documentation', '--body-file', bodyPath])
				: DocumentationChecks.command(worktree, 'glab', ['mr', 'create', '--draft', '--target-branch', base,
					'--source-branch', branch, '--title', 'Update AI user documentation',
					'--description', Fs.readFileSync(bodyPath, 'utf8'), '--yes']);
			Fs.writeFileSync(Path.join(recordPath, 'result.json'), JSON.stringify({
				url,
				worktree,
				runPath,
			}, null, 2));
			process.stdout.write(`${url}\nReview worktree: ${worktree}\n`);
			return url;
		} catch (error) {
			Fs.writeFileSync(Path.join(recordPath, 'failure.json'), JSON.stringify({
				error: String(error),
				worktree,
			}, null, 2));
			throw error;
		} finally {
			Fs.closeSync(lock);
			Fs.unlinkSync(lockPath);
		}
	}
}
