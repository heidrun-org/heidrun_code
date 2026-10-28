import { DocumentationChecks } from './documentation_checks.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DocumentationHints — collects all commits and optional hosting context
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Resolves hosting identity and reads change hints without editing a repository. */
export class DocumentationHints {
	/**
	 * Normalizes an origin remote into a web address.
	 * @param root Checkout with an origin remote.
	 * @returns The repository web address without a trailing slash.
	 */
	static repositoryUrl(root: string): string {
		const remote = DocumentationChecks.command(root, 'git', ['remote', 'get-url', 'origin']);
		const url = remote.replace(/^git@([^:]+):/, 'https://$1/').replace(/\.git$/, '').replace(/\/$/, '');
		if (/^https:\/\//.test(url) === false) {
			throw new Error('The origin remote must be an HTTPS or Git SSH hosting address.');
		}
		return url;
	}

	/**
	 * Reads every commit and the user-facing diff in the documented range.
	 * @param root Checkout to read.
	 * @param previous Previous validated revision, or undefined on the first run.
	 * @returns Historical hints, never a replacement for the full current-source check.
	 */
	static collect(root: string, previous?: string): string {
		if (previous === undefined) {
			return 'First run: no last documented commit. Check all current documentation against all current sources.';
		}
		const commits = DocumentationChecks.command(root, 'git', [
			'log', '--format=%H %s', `${previous}..HEAD`,
		]);
		const url = DocumentationHints.repositoryUrl(root);
		const lines = commits === '' ? [] : commits.split('\n');
		const links = lines.map((line) => {
			const split = line.indexOf(' ');
			return `[${line.slice(split + 1)}](${url}/commit/${line.slice(0, split)})`;
		});
		const context: string[] = [];
		const numbers = new Set(lines.flatMap((line) => [...line.matchAll(/(?:#|!)(\d+)\b/g)]
			.map((match) => match[1])));
		for (const number of numbers) {
			try {
				const isGitHub = new URL(url).hostname === 'github.com';
				const body = isGitHub
					? DocumentationChecks.command(root, 'gh', ['pr', 'view', number, '--json',
						'title,body,state,url,closingIssuesReferences'])
					: DocumentationChecks.command(root, 'glab', ['mr', 'view', number, '--output', 'json']);
				const record = JSON.parse(body) as Record<string, unknown>;
				if (String(record.state).toLowerCase() === 'merged') {
					context.push(body);
					const issues = Array.isArray(record.closingIssuesReferences) ? record.closingIssuesReferences : [];
					const issueNumbers = new Set(issues.map((issue) => String((issue as Record<string, unknown>).number)));
					for (const match of String(record.body ?? '').matchAll(/\b(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\s+#(\d+)/gi)) {
						issueNumbers.add(match[1]);
					}
					if (isGitHub === true) {
						for (const issueNumber of issueNumbers) {
							const issueBody = DocumentationChecks.command(root, 'gh', [
								'issue', 'view', issueNumber, '--json', 'title,body,state,url',
							]);
							if ((JSON.parse(issueBody) as Record<string, unknown>).state === 'CLOSED') {
								context.push(issueBody);
							}
						}
					}
					if (isGitHub === false) {
						const project = encodeURIComponent(new URL(url).pathname.slice(1));
						context.push(DocumentationChecks.command(root, 'glab', [
							'api', `projects/${project}/merge_requests/${number}/closes_issues`,
						]));
					}
				}
			} catch (error) {
				context.push(`Hosting context unavailable for #${number}: ${String(error)}`);
			}
		}
		const diff = DocumentationChecks.command(root, 'git', ['diff', previous, 'HEAD', '--',
			'packages/apps', 'packages/auxiliary/mobile_website', 'docs/agents_rules/user_interface',
			'docs/agents_rules/glossary',
		]);
		return JSON.stringify({
			commits: links,
			hostingContext: context,
			userFacingDiff: diff,
		}, null, 2);
	}
}
