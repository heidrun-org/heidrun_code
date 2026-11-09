import { invoke } from '@tauri-apps/api/core';
import { refContext } from './refs';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FileGitLinks — resolves committed file addresses on GitHub and GitLab
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Addresses of a committed file on its hosting service. */
export type FileGitLinksResult = {
	/** The hosting service name used in menu labels. */
	service: string;
	/** Address fixed to the current commit. */
	permalink: string;
	/** Address following the current branch, absent for a detached checkout. */
	headlink: string | null;
};

/** Resolves each file in its own repository, including files inside submodules. */
export class FileGitLinks {
	/**
	 * Reads the committed file's addresses using its repository configuration.
	 * @param root - Known project root.
	 * @param path - File path relative to the project root.
	 * @returns Addresses, or null when the file has no committed version or supported remote.
	 */
	static async load(root: string, path: string): Promise<FileGitLinksResult | null> {
		const revision = await invoke<[string, string, string, string | null] | null>('fileGitRevision', {
			root,
			path,
		});
		if (revision === null) {
			return null;
		}
		const [repositoryRoot, relativePath, commit, branch] = revision;
		const context = await refContext(repositoryRoot);
		if (context.base === null || context.forge === null) {
			return null;
		}
		const base = context.forge === 'github' ? `${context.base}/blob` : `${context.base}/-/blob`;
		const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
		return {
			service: context.forge === 'github' ? 'GitHub' : 'GitLab',
			permalink: `${base}/${encodeURIComponent(commit)}/${encodedPath}`,
			headlink: branch === null ? null : `${base}/${encodeURIComponent(branch)}/${encodedPath}`,
		};
	}
}
