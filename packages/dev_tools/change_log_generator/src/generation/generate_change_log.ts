import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Path from 'node:path';
import { ChangeLogGit } from '../git/change_log_git.ts';
import { ChangeLogRenderer } from '../rendering/change_log_renderer.ts';
import type { ChangeLogRange } from '../types/change_log_types.ts';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	GenerateChangeLog — writes a section of the file CHANGELOG.md in the Keep a Changelog format
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Runs a coding agent: gives it a prompt and returns its answer.
 * @param prompt The prompt to send.
 * @param agentName The name of the coding agent, `codex`, `claude`, or `agy`.
 * @returns The answer of the coding agent.
 */
export type RunAgentFn = (prompt: string, agentName: string) => Promise<string>;

/**
 * The options of the method `GenerateChangeLog.run`.
 */
export type GenerateChangeLogRunOptions = {
	/** The root folder of the Git repository. The file `CHANGELOG.md` is in this folder. */
	repositoryPath: string;
	/** When true, a coding agent writes the section. When false, the script writes the section mechanically. */
	isAi: boolean;
	/** The name of the coding agent, or undefined for the default one. Only allowed when `isAi` is true. */
	agentName: string | undefined;
	/**
	 * The release after which the changes start, or `start` for the start of the history. When undefined, the release
	 * before the end of the range, or the start of the history when there is none.
	 */
	fromTag?: string;
	/** The release where the changes end, or `now` for the current commit. When undefined, `now`. */
	toTag?: string;
	/** Runs the coding agent. When undefined, the executable of the package `coding_agent_cli` runs it. */
	runAgentFn?: RunAgentFn;
};

/**
 * Writes a section of the file `CHANGELOG.md`, in the Keep a Changelog format, from the pull requests that were
 * merged in a range: after one release, up to another release or up to the current commit.
 */
export class GenerateChangeLog {
	/** The coding agent that the option `--ai` uses when the option `--agent` is missing. */
	static readonly defaultAgentName = 'codex';

	/** The name of the file that the script writes, in the root folder of the Git repository. */
	static readonly changeLogFileName = 'CHANGELOG.md';

	/** The value of the option `--from` that means the start of the history. */
	static readonly startKeyword = 'start';

	/** The value of the option `--to` that means the current commit. */
	static readonly nowKeyword = 'now';

	/**
	 * Finds the merged pull requests of the range, writes the new section, and puts it in the file `CHANGELOG.md`.
	 * The method creates the file when it does not exist.
	 * @param options The folder of the repository, the range, and the choice of the mode.
	 * @returns The new section, in Markdown.
	 * @throws An error when `agentName` is given without `isAi`, when a tag of the range does not exist, or when the
	 * coding agent fails.
	 */
	static async run(options: GenerateChangeLogRunOptions): Promise<string> {
		if (options.isAi === false && options.agentName !== undefined) {
			throw new Error('The option --agent needs the option --ai.');
		}
		const range = GenerateChangeLog._resolveRange(options);
		const tagDate = range.toTag === null ? '' : ChangeLogGit.findTagDate(options.repositoryPath, range.toTag);
		const sectionInput = {
			mergedPullRequests: ChangeLogGit.listMergedPullRequests(options.repositoryPath, range),
			repositoryUrl: ChangeLogGit.findRepositoryUrl(options.repositoryPath),
			range,
			heading: ChangeLogRenderer.buildHeading(range.toTag, tagDate),
		};
		let section: string;
		if (options.isAi === true) {
			const runAgentFn = options.runAgentFn ?? GenerateChangeLog._runRawCodingAgent;
			const prompt = ChangeLogRenderer.buildPrompt(sectionInput);
			const answer = await runAgentFn(prompt, options.agentName ?? GenerateChangeLog.defaultAgentName);
			section = ChangeLogRenderer.cleanAgentAnswer(answer, sectionInput.heading);
		} else {
			section = ChangeLogRenderer.renderMechanicalSection(sectionInput);
		}
		const changeLogPath = Path.join(options.repositoryPath, GenerateChangeLog.changeLogFileName);
		let existingText = Fs.existsSync(changeLogPath) ? Fs.readFileSync(changeLogPath, 'utf8') : null;
		if (GenerateChangeLog._isLastRelease(options.repositoryPath, range) === true) {
			existingText = ChangeLogRenderer.removeUnreleasedSection(existingText);
		}
		Fs.writeFileSync(changeLogPath, ChangeLogRenderer.insertSection(existingText, section));
		return section;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Turns the options `--from` and `--to` into a range, and checks that the tags exist.
	 * @param options The options of the method `run`.
	 * @returns The range. The start is null for the start of the history, and the end is null for the current commit.
	 * @throws An error when a tag does not exist, or when `--from now` or `--to start` is given.
	 */
	private static _resolveRange(options: GenerateChangeLogRunOptions): ChangeLogRange {
		const { startKeyword, nowKeyword } = GenerateChangeLog;
		if (options.toTag === startKeyword) {
			throw new Error(`The option --to cannot be "${startKeyword}".`);
		}
		if (options.fromTag === nowKeyword) {
			throw new Error(`The option --from cannot be "${nowKeyword}".`);
		}
		let toTag: string | null = null;
		if (options.toTag !== undefined && options.toTag !== nowKeyword) {
			GenerateChangeLog._checkTagExists(options.repositoryPath, options.toTag);
			toTag = options.toTag;
		}
		if (options.fromTag === undefined) {
			return {
				fromTag: ChangeLogGit.findLastTag(options.repositoryPath, toTag ?? 'HEAD', toTag),
				toTag,
			};
		}
		if (options.fromTag === startKeyword) {
			return {
				fromTag: null,
				toTag,
			};
		}
		GenerateChangeLog._checkTagExists(options.repositoryPath, options.fromTag);
		return {
			fromTag: options.fromTag,
			toTag,
		};
	}

	/**
	 * Tells whether a range ends at the last release: the tag with the highest version number among the tags that the
	 * current commit contains. The pull requests of the old section `Unreleased` then belong to this release.
	 * @param repositoryPath The root folder of the Git repository.
	 * @param range The range of the new section.
	 * @returns True when the range ends at a release and this release is the last release. False when the range ends
	 * at the current commit, or at an older release.
	 */
	private static _isLastRelease(repositoryPath: string, range: ChangeLogRange): boolean {
		if (range.toTag === null) {
			return false;
		}
		return ChangeLogGit.findLastTag(repositoryPath, 'HEAD') === range.toTag;
	}

	/**
	 * Checks that a tag exists.
	 * @param repositoryPath The root folder of the Git repository.
	 * @param tagName The name of the tag.
	 * @returns Nothing.
	 * @throws An error when the repository has no tag with this name.
	 */
	private static _checkTagExists(repositoryPath: string, tagName: string): void {
		if (ChangeLogGit.tagExists(repositoryPath, tagName) === false) {
			throw new Error(`Unknown tag "${tagName}". Use the name of a tag of the repository.`);
		}
	}

	/**
	 * Runs a coding agent with the executable of the package `coding_agent_cli`. The executable is written in Rust,
	 * so `cargo run` builds it when needed, then runs it. The prompt goes through the standard input of the executable,
	 * and the answer comes from its standard output. The mode without the option `--ai` does not need the Rust tools.
	 * @param prompt The prompt to send.
	 * @param agentName The name of the coding agent, `codex`, `claude`, or `agy`. The executable refuses another name.
	 * @returns The answer of the coding agent, without the spaces and the line breaks at the start and at the end.
	 * @throws An error when `cargo` is not installed, or when the executable exits with an error code. The message of
	 * the error is the message that the executable printed.
	 */
	private static _runRawCodingAgent(prompt: string, agentName: string): Promise<string> {
		const packagePath = Path.resolve(__dirname, '..', '..', '..', '..', 'auxiliary', 'coding_agent_cli');
		return new Promise((resolve, reject) => {
			const childProcess = ChildProcess.spawn('cargo', ['run', '--quiet', '--', '--agent', agentName], {
				cwd: packagePath,
				stdio: ['pipe', 'pipe', 'pipe'],
			});
			let stdoutStr = '';
			let stderrStr = '';
			childProcess.stdout.setEncoding('utf8');
			childProcess.stderr.setEncoding('utf8');
			childProcess.stdout.on('data', (chunk: string) => {
				stdoutStr += chunk;
			});
			childProcess.stderr.on('data', (chunk: string) => {
				stderrStr += chunk;
			});
			childProcess.stdin.on('error', () => {
				// The executable can exit before it reads the whole prompt. The event 'close' reports the exit code.
			});
			childProcess.on('error', (error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') {
					reject(new Error(
						'The command "cargo" is not installed or is not in the PATH. The option --ai needs the Rust tools.',
					));
					return;
				}
				reject(error);
			});
			childProcess.on('close', (exitCode) => {
				if (exitCode === 0) {
					resolve(stdoutStr.trim());
					return;
				}
				const messageStr = stderrStr.trim();
				reject(new Error(messageStr === '' ? `The coding agent failed with exit code ${exitCode}.` : messageStr));
			});
			childProcess.stdin.end(prompt);
		});
	}
}
