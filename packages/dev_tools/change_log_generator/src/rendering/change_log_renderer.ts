import type { ChangeLogRange, ChangeLogSectionInput, MergedPullRequest } from '../types/change_log_types.ts';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ChangeLogRenderer — writes the text of the change log: the section, the prompt, and the file
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The first lines of a new `CHANGELOG.md` file, in the Keep a Changelog format.
 */
const CHANGE_LOG_HEADER = [
	'# Changelog',
	'',
	'All notable changes to this project are documented in this file.',
	'',
	'The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to '
		+ '[Semantic Versioning](https://semver.org/spec/v2.0.0.html).',
	'',
].join('\n');

/**
 * The name of the section that holds the changes after the last release. It is written between square brackets in
 * the heading line.
 */
const UNRELEASED_NAME = 'Unreleased';

/**
 * Builds the texts of the change log. The class reads nothing and writes nothing: it only turns data into text.
 */
export class ChangeLogRenderer {
	/**
	 * Writes the heading line of a section.
	 * @param toTag The release where the section ends, or null for the current commit.
	 * @param tagDate The date of the release, in the format `YYYY-MM-DD`. It is not used when `toTag` is null.
	 * @returns `## [Unreleased]` when `toTag` is null. Otherwise `## [<version>] - <date>`, where the version is the
	 * name of the tag without the first letter `v`.
	 */
	static buildHeading(toTag: string | null, tagDate: string): string {
		if (toTag === null) {
			return `## [${UNRELEASED_NAME}]`;
		}
		return `## [${toTag.replace(/^v/, '')}] - ${tagDate}`;
	}

	/**
	 * Writes a section without a coding agent: one bullet for every merged pull request, with its title and its
	 * number. The method does not choose a category.
	 * @param input The pull requests, the address of the repository, the range, and the heading line.
	 * @returns The section, in Markdown.
	 */
	static renderMechanicalSection(input: ChangeLogSectionInput): string {
		if (input.mergedPullRequests.length === 0) {
			return `${input.heading}\n\nNo merged pull request${ChangeLogRenderer._describeEmptyRange(input.range)}.`;
		}
		const bullets = input.mergedPullRequests.map((mergedPullRequest) => {
			const link = ChangeLogRenderer._renderPullRequestLink(mergedPullRequest, input.repositoryUrl);
			return `- ${mergedPullRequest.title} (${link})`;
		});
		return `${input.heading}\n\n${bullets.join('\n')}`;
	}

	/**
	 * Writes the prompt that asks a coding agent to write a section.
	 * @param input The pull requests, with the message of each merge commit, the address of the repository, the range,
	 * and the heading line.
	 * @returns The prompt.
	 */
	static buildPrompt(input: ChangeLogSectionInput): string {
		const sinceStr = input.range.fromTag === null ? 'the start of the project' : `the release ${input.range.fromTag}`;
		const untilStr = input.range.toTag === null ? '' : `, up to the release ${input.range.toTag}`;
		const linkExample = input.repositoryUrl === null
			? '(#116)'
			: `([#116](${input.repositoryUrl}/pull/116))`;
		const pullRequestTexts = input.mergedPullRequests.map((mergedPullRequest) => {
			return [
				`Pull request #${mergedPullRequest.number}`,
				`Branch: ${mergedPullRequest.branchName}`,
				'Message of the merge commit:',
				mergedPullRequest.message,
			].join('\n');
		});
		return [
			'You write the change log of the application Heidrun Code.',
			'',
			`Below is the list of the pull requests that were merged since ${sinceStr}${untilStr}. Each item has the `
				+ 'number of the pull request, the name of its branch, and the message of its merge commit.',
			'',
			'Write the new section of the file CHANGELOG.md, in the Keep a Changelog 1.1.0 format.',
			'',
			'Rules:',
			`- Start with the heading line "${input.heading}".`,
			'- Group the changes under these headings, in this order: "### Added", "### Changed", "### Deprecated", '
				+ '"### Removed", "### Fixed", "### Security".',
			'- Leave out a heading that has no change.',
			'- Write one bullet for each change, in plain English, for the people who use the application.',
			'- Join several pull requests that make one change into one bullet.',
			'- Leave out a pull request that only changes the version number of the application.',
			`- End each bullet with a link to its pull request, in this form: ${linkExample}. Use all the numbers of `
				+ 'the pull requests of the bullet.',
			'- Answer with the Markdown text of the section only. Do not write an introduction, an explanation, or a '
				+ 'code fence.',
			'',
			'Merged pull requests:',
			'',
			pullRequestTexts.join('\n\n---\n\n'),
		].join('\n');
	}

	/**
	 * Checks the answer of a coding agent and cleans it: removes a code fence around the text, and writes the exact
	 * heading line that was asked for.
	 * @param answer The answer of the coding agent.
	 * @param heading The heading line that the section must start with.
	 * @returns The section, in Markdown.
	 * @throws An error when the answer does not start with a heading of level 2.
	 */
	static cleanAgentAnswer(answer: string, heading: string): string {
		let lines = answer.trim().split('\n');
		if (lines[0].startsWith('```') && lines[lines.length - 1].trim() === '```') {
			lines = lines.slice(1, -1);
		}
		const firstLine = lines[0] ?? '';
		if (firstLine.startsWith('## ') === false) {
			throw new Error(`The coding agent did not answer with a section of the change log:\n${answer}`);
		}
		lines[0] = heading;
		return lines.join('\n').trim();
	}

	/**
	 * Puts a section in the text of the file `CHANGELOG.md`, below the header. The sections of the file are in this
	 * order: `Unreleased` first, then the releases from the highest version number to the lowest. A section with the
	 * same version is replaced. The other sections stay exactly as they are.
	 * @param existingText The text of the file `CHANGELOG.md`, or null when the file does not exist.
	 * @param section The new section, in Markdown. Its first line is its heading line.
	 * @returns The new text of the file.
	 */
	static insertSection(existingText: string | null, section: string): string {
		const sectionLines = section.trim().split('\n');
		if (existingText === null || existingText.trim() === '') {
			return `${CHANGE_LOG_HEADER}\n${sectionLines.join('\n')}\n`;
		}
		const lines = existingText.split('\n');
		const headingIndexes: number[] = [];
		lines.forEach((line, index) => {
			if (line.startsWith('## ')) {
				headingIndexes.push(index);
			}
		});
		if (headingIndexes.length === 0) {
			return `${existingText.trimEnd()}\n\n${sectionLines.join('\n')}\n`;
		}
		const newName = ChangeLogRenderer._readSectionName(sectionLines[0]);
		let startIndex = lines.length;
		let endIndex = lines.length;
		for (let position = 0; position < headingIndexes.length; position += 1) {
			const name = ChangeLogRenderer._readSectionName(lines[headingIndexes[position]]);
			const nextHeadingIndex = position + 1 < headingIndexes.length ? headingIndexes[position + 1] : lines.length;
			if (name === newName) {
				startIndex = headingIndexes[position];
				endIndex = nextHeadingIndex;
				break;
			}
			if (ChangeLogRenderer._compareSectionNames(newName, name) > 0) {
				startIndex = headingIndexes[position];
				endIndex = startIndex;
				break;
			}
		}
		const before = lines.slice(0, startIndex);
		if (startIndex === lines.length) {
			while (before[before.length - 1] === '') {
				before.pop();
			}
			before.push('');
		}
		return [
			...before,
			...sectionLines,
			'',
			...lines.slice(endIndex),
		].join('\n');
	}

	/**
	 * Removes the section `Unreleased` from the text of the file `CHANGELOG.md`: its heading line and all its lines,
	 * up to the next section. The other sections stay exactly as they are. The caller uses it when a release becomes
	 * the last release, because the pull requests of the section `Unreleased` now belong to this release.
	 * @param existingText The text of the file `CHANGELOG.md`, or null when the file does not exist.
	 * @returns The text without the section `Unreleased`, the same text when the file has no such section, or null
	 * when `existingText` is null.
	 */
	static removeUnreleasedSection(existingText: string | null): string | null {
		if (existingText === null) {
			return null;
		}
		const lines = existingText.split('\n');
		const startIndex = lines.findIndex((line) => {
			return line.startsWith('## ') && ChangeLogRenderer._readSectionName(line) === UNRELEASED_NAME;
		});
		if (startIndex === -1) {
			return existingText;
		}
		let endIndex = startIndex + 1;
		while (endIndex < lines.length && lines[endIndex].startsWith('## ') === false) {
			endIndex += 1;
		}
		return [
			...lines.slice(0, startIndex),
			...lines.slice(endIndex),
		].join('\n');
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Writes the link to one pull request.
	 * @param mergedPullRequest The merged pull request.
	 * @param repositoryUrl The web address of the GitHub repository, or null when it is not known.
	 * @returns A Markdown link, or the plain number when the address is not known.
	 */
	private static _renderPullRequestLink(mergedPullRequest: MergedPullRequest, repositoryUrl: string | null): string {
		if (repositoryUrl === null) {
			return `#${mergedPullRequest.number}`;
		}
		return `[#${mergedPullRequest.number}](${repositoryUrl}/pull/${mergedPullRequest.number})`;
	}

	/**
	 * Describes a range in the text that says that nothing was merged.
	 * @param range The range.
	 * @returns A text that starts with a space, or an empty text.
	 */
	private static _describeEmptyRange(range: ChangeLogRange): string {
		if (range.fromTag !== null && range.toTag !== null) {
			return ` between ${range.fromTag} and ${range.toTag}`;
		}
		if (range.fromTag !== null) {
			return ` since ${range.fromTag}`;
		}
		if (range.toTag !== null) {
			return ` up to ${range.toTag}`;
		}
		return '';
	}

	/**
	 * Reads the name of a section from its heading line: the text between the first square brackets.
	 * @param headingLine A heading line, for example `## [0.2.0] - 2026-10-10`.
	 * @returns The name, for example `0.2.0`, or null when the line has no square brackets.
	 */
	private static _readSectionName(headingLine: string): string | null {
		const match = /^##\s+\[([^\]]+)\]/.exec(headingLine);
		if (match === null) {
			return null;
		}
		return match[1];
	}

	/**
	 * Compares the names of two sections, in the order of the file: `Unreleased` first, then the versions from the
	 * highest to the lowest. A section without a name comes last.
	 * @param nameA The first name, or null.
	 * @param nameB The second name, or null.
	 * @returns A positive number when `nameA` comes before `nameB` in the file, a negative number when it comes
	 * after, and 0 when they are the same.
	 */
	private static _compareSectionNames(nameA: string | null, nameB: string | null): number {
		if (nameA === nameB) {
			return 0;
		}
		if (nameA === null) {
			return -1;
		}
		if (nameB === null) {
			return 1;
		}
		if (nameA === UNRELEASED_NAME) {
			return 1;
		}
		if (nameB === UNRELEASED_NAME) {
			return -1;
		}
		return ChangeLogRenderer._compareVersions(nameA, nameB);
	}

	/**
	 * Compares two version numbers, number by number, for example `0.10.0` is higher than `0.9.0`. A version with a
	 * suffix, such as `1.0.0-rc1`, is lower than the same version without a suffix.
	 * @param versionA The first version.
	 * @param versionB The second version.
	 * @returns A positive number when `versionA` is higher, a negative number when it is lower, and 0 when equal.
	 */
	private static _compareVersions(versionA: string, versionB: string): number {
		const [numbersA, suffixA] = ChangeLogRenderer._splitVersion(versionA);
		const [numbersB, suffixB] = ChangeLogRenderer._splitVersion(versionB);
		const length = Math.max(numbersA.length, numbersB.length);
		for (let index = 0; index < length; index += 1) {
			const difference = (numbersA[index] ?? 0) - (numbersB[index] ?? 0);
			if (difference !== 0) {
				return difference;
			}
		}
		if (suffixA === suffixB) {
			return 0;
		}
		if (suffixA === '') {
			return 1;
		}
		if (suffixB === '') {
			return -1;
		}
		return suffixA < suffixB ? -1 : 1;
	}

	/**
	 * Splits a version into its numbers and its suffix.
	 * @param version A version, for example `1.2.3-rc1`.
	 * @returns The numbers, for example `[1, 2, 3]`, and the suffix, for example `-rc1`, or an empty text.
	 */
	private static _splitVersion(version: string): [number[], string] {
		const match = /^(\d+(?:\.\d+)*)(.*)$/.exec(version);
		if (match === null) {
			return [[], version];
		}
		return [match[1].split('.').map(Number), match[2]];
	}
}
