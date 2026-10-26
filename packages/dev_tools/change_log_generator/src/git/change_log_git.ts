import ChildProcess from 'node:child_process';
import type { ChangeLogRange, MergedPullRequest } from '../types/change_log_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ChangeLogGit — reads the last release and the merged pull requests from the Git repository
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Runs `git` commands to find the last release and the pull requests that were merged after it.
 */
export class ChangeLogGit {
	/**
	 * Finds the root folder of the Git repository that holds a folder.
	 * @param workingDirectory A folder inside the Git repository.
	 * @returns The absolute path of the root folder of the Git repository.
	 * @throws An error when the folder is not inside a Git repository.
	 */
	static findRepositoryPath(workingDirectory: string): string {
		return ChangeLogGit._git(workingDirectory, ['rev-parse', '--show-toplevel']).trim();
	}

	/**
	 * Finds the last release before a commit: the tag with the highest version number among the tags that the commit
	 * contains.
	 * @param repositoryPath The root folder of the Git repository.
	 * @param endRef The commit, the branch, or the tag where the search starts, for example `HEAD`.
	 * @param excludedTag A tag to skip, or null. The caller skips the tag of `endRef` itself, to find the release
	 * before it.
	 * @returns The name of the tag, for example `v0.2.0`, or null when the repository has no such tag.
	 */
	static findLastTag(
		repositoryPath: string,
		endRef: string = 'HEAD',
		excludedTag: string | null = null,
	): string | null {
		const output = ChangeLogGit._git(repositoryPath, ['tag', '--merged', endRef, '--sort=-v:refname']);
		const tags = output.split('\n').map((tag) => {
			return tag.trim();
		}).filter((tag) => {
			return tag !== '' && tag !== excludedTag;
		});
		if (tags.length === 0) {
			return null;
		}
		return tags[0];
	}

	/**
	 * Checks that a tag exists.
	 * @param repositoryPath The root folder of the Git repository.
	 * @param tagName The name of the tag.
	 * @returns True when the repository has a tag with this name.
	 */
	static tagExists(repositoryPath: string, tagName: string): boolean {
		try {
			ChangeLogGit._git(repositoryPath, ['rev-parse', '--verify', '--quiet', `refs/tags/${tagName}`]);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Finds the date of a release: the date of the commit of the tag.
	 * @param repositoryPath The root folder of the Git repository.
	 * @param tagName The name of the tag.
	 * @returns The date, in the format `YYYY-MM-DD`.
	 */
	static findTagDate(repositoryPath: string, tagName: string): string {
		return ChangeLogGit._git(repositoryPath, ['log', '-1', '--format=%cs', `refs/tags/${tagName}^{commit}`]).trim();
	}

	/**
	 * Lists the pull requests that were merged in a range: the commits after the start of the range, up to the end
	 * of the range, whose subject starts with `Merge pull request #`.
	 * @param repositoryPath The root folder of the Git repository.
	 * @param range The range. A start of null means all the history before the end. An end of null means the current
	 * commit.
	 * @returns The merged pull requests, the newest first.
	 */
	static listMergedPullRequests(repositoryPath: string, range: ChangeLogRange): MergedPullRequest[] {
		const endRef = range.toTag === null ? 'HEAD' : range.toTag;
		const gitRange = range.fromTag === null ? endRef : `${range.fromTag}..${endRef}`;
		const output = ChangeLogGit._git(repositoryPath, [
			'log',
			gitRange,
			'--grep=^Merge pull request #[0-9]',
			'--format=%s%x1f%b%x1e',
		]);
		const mergedPullRequests: MergedPullRequest[] = [];
		for (const record of output.split('\x1e')) {
			const [subject, body] = record.trim().split('\x1f');
			if (subject === undefined) {
				continue;
			}
			const match = /^Merge pull request #(\d+) from (\S+)/.exec(subject);
			if (match === null) {
				continue;
			}
			const trimmedBody = (body ?? '').trim();
			const firstBodyLine = trimmedBody.split('\n')[0].trim();
			mergedPullRequests.push({
				number: Number(match[1]),
				branchName: match[2],
				title: firstBodyLine === '' ? match[2] : firstBodyLine,
				message: trimmedBody === '' ? subject : `${subject}\n\n${trimmedBody}`,
			});
		}
		return mergedPullRequests;
	}

	/**
	 * Finds the web address of the GitHub repository, from the Git remote named `origin`.
	 * @param repositoryPath The root folder of the Git repository.
	 * @returns The address, for example `https://github.com/heidrun-org/heidrun_code`, or null when the remote is missing
	 * or is not a GitHub remote.
	 */
	static findRepositoryUrl(repositoryPath: string): string | null {
		let remoteUrl: string;
		try {
			remoteUrl = ChangeLogGit._git(repositoryPath, ['remote', 'get-url', 'origin']).trim();
		} catch {
			return null;
		}
		const match = /^(?:git@github\.com:|https:\/\/github\.com\/|ssh:\/\/git@github\.com\/)([^/]+)\/(.+?)(?:\.git)?\/?$/
			.exec(remoteUrl);
		if (match === null) {
			return null;
		}
		return `https://github.com/${match[1]}/${match[2]}`;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Runs one `git` command and returns its standard output.
	 * @param workingDirectory The folder to run the command in.
	 * @param args The arguments of the `git` command.
	 * @returns The standard output of the command.
	 * @throws An error when the command exits with an error code.
	 */
	private static _git(workingDirectory: string, args: string[]): string {
		return ChildProcess.execFileSync('git', args, {
			cwd: workingDirectory,
			encoding: 'utf8',
			maxBuffer: 64 * 1024 * 1024,
			stdio: ['ignore', 'pipe', 'pipe'],
		});
	}
}
