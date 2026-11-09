// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	invoke: vi.fn(),
	context: vi.fn(),
}));
vi.mock('@tauri-apps/api/core', () => ({
	invoke: mocks.invoke,
}));
vi.mock('./refs', () => ({
	refContext: mocks.context,
}));
import { FileGitLinks } from './file_git_links';

beforeEach(() => {
	mocks.invoke.mockResolvedValue(['/repo/submodule', 'src/a #é.ts', 'abc123', 'feature/menu']);
	mocks.context.mockResolvedValue({
		base: 'https://github.com/group/repo',
		forge: 'github',
	});
});

describe('FileGitLinks', () => {
	it('uses the selected file repository and encodes the branch and file path', async () => {
		const links = await FileGitLinks.load('/repo', 'submodule/src/a #é.ts');
		expect(mocks.context).toHaveBeenCalledWith('/repo/submodule');
		expect(links).toEqual({
			service: 'GitHub',
			permalink: 'https://github.com/group/repo/blob/abc123/src/a%20%23%C3%A9.ts',
			headlink: 'https://github.com/group/repo/blob/feature%2Fmenu/src/a%20%23%C3%A9.ts',
		});
	});

	it('uses GitLab addresses and labels', async () => {
		mocks.context.mockResolvedValue({
			base: 'https://gitlab.com/group/subgroup/repo',
			forge: 'gitlab',
		});
		const links = await FileGitLinks.load('/repo', 'file');
		expect(links?.service).toBe('GitLab');
		expect(links?.headlink).toContain('/-/blob/feature%2Fmenu/');
	});

	it('keeps only the permalink for a detached checkout', async () => {
		mocks.invoke.mockResolvedValue(['/repo', 'file', 'abc123', null]);
		expect((await FileGitLinks.load('/repo', 'file'))?.headlink).toBeNull();
	});

	it('returns no addresses for a file absent from the commit', async () => {
		mocks.invoke.mockResolvedValue(null);
		expect(await FileGitLinks.load('/repo', 'new')).toBeNull();
	});

	it('returns no addresses without a hosting service', async () => {
		mocks.context.mockResolvedValue({
			base: null,
			forge: null,
		});
		expect(await FileGitLinks.load('/repo', 'file')).toBeNull();
	});
});
