import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgeReferenceDetails } from './forge_reference_details';

const { runForgeCli } = vi.hoisted(() => ({
	runForgeCli: vi.fn(),
}));
vi.mock('../lib/forge_cli', () => ({
	runForgeCli,
}));

beforeEach(() => {
	runForgeCli.mockReset();
});

describe('terminal reference details', () => {
	it('resolves GitHub shorthand and a full link to the same pull request card', async () => {
		const webBase = 'https://github.com/org/repo';
		const pullRequestUrl = `${webBase}/pull/123`;
		runForgeCli.mockImplementation(async (_caller, _folder, _tool, args: string[]) => JSON.stringify({
			title: 'A pull request',
			state: 'OPEN',
			url: pullRequestUrl,
			...(args[0] === 'pr' ? { headRefName: 'feature', baseRefName: 'main' } : {}),
		}));
		const shorthand = await ForgeReferenceDetails.loadTerminalReference('/workspace', 'github', webBase, {
			kind: 'issue',
			number: 123,
			url: `${webBase}/issues/123`,
		}, {
			type: 'issue',
			number: 123,
		});
		const direct = await ForgeReferenceDetails.loadTerminalReference('/workspace', 'github', webBase, {
			kind: 'pull_request',
			number: 123,
			url: pullRequestUrl,
		}, {
			forge: 'github',
			project: 'org/repo',
			type: 'mr',
			number: 123,
		});
		expect(shorthand).toEqual(direct);
		expect(shorthand.reference.kind).toBe('pull_request');
		expect(shorthand.reference.url).toBe(pullRequestUrl);
		expect(shorthand.details?.headBranch).toBe('feature');
		expect(runForgeCli.mock.calls).toHaveLength(3);
		for (const [, , , args] of runForgeCli.mock.calls) {
			expect(args.slice(-2)).toEqual(['--repo', 'github.com/org/repo']);
		}
	});

	it('uses the GitLab host and nested project from the full link', async () => {
		const webBase = 'https://gitlab.com/group/sub/repo';
		const url = `${webBase}/-/merge_requests/123`;
		runForgeCli.mockResolvedValue(JSON.stringify({
			title: 'A merge request',
			state: 'opened',
			web_url: url,
		}));
		const result = await ForgeReferenceDetails.loadTerminalReference('/unrelated-repo', 'gitlab', webBase, {
			kind: 'pull_request',
			number: 123,
			url,
		}, {
			forge: 'gitlab',
			project: 'group/sub/repo',
			type: 'mr',
			number: 123,
		});
		expect(result.details?.rawState).toBe('open');
		expect(runForgeCli).toHaveBeenCalledWith('reference_card', '/unrelated-repo', 'glab', [
			'api', 'projects/group%2Fsub%2Frepo/merge_requests/123', '--hostname', 'gitlab.com',
		]);
	});
});
