import { describe, expect, it } from 'vitest';
import { ChangeLogRenderer } from '../src/rendering/change_log_renderer.ts';
import type { ChangeLogSectionInput, MergedPullRequest } from '../src/types/change_log_types.ts';

const MERGED_PULL_REQUESTS: MergedPullRequest[] = [
	{
		number: 8,
		branchName: 'acme/fix-bug',
		title: 'Fix the bug',
		message: 'Merge pull request #8 from acme/fix-bug\n\nFix the bug',
	},
	{
		number: 7,
		branchName: 'acme/add-thing',
		title: 'Add the thing',
		message: 'Merge pull request #7 from acme/add-thing\n\nAdd the thing',
	},
];

const REPOSITORY_URL = 'https://github.com/acme/widgets';

const UNRELEASED_INPUT: ChangeLogSectionInput = {
	mergedPullRequests: MERGED_PULL_REQUESTS,
	repositoryUrl: REPOSITORY_URL,
	range: {
		fromTag: 'v1.0.0',
		toTag: null,
	},
	heading: '## [Unreleased]',
};

const RELEASE_INPUT: ChangeLogSectionInput = {
	...UNRELEASED_INPUT,
	range: {
		fromTag: 'v1.0.0',
		toTag: 'v1.1.0',
	},
	heading: '## [1.1.0] - 2026-02-20',
};

const HEADER = '# Changelog\n\nSome words.\n\n';

const SECTION_1_0_0 = '## [1.0.0] - 2026-01-01\n\n### Added\n\n- The first version.\n\n';

const SECTION_0_9_0 = '## [0.9.0] - 2025-12-01\n\n- A beta version.\n\n[0.9.0]: https://example.com/0.9.0\n';

const SECTION_UNRELEASED = '## [Unreleased]\n\n- An old entry.\n\n';

describe('ChangeLogRenderer', () => {
	describe('buildHeading', () => {
		it('writes the heading Unreleased when the section ends at the current commit', () => {
			expect(ChangeLogRenderer.buildHeading(null, '')).toBe('## [Unreleased]');
		});

		it('writes the version and the date of the release, without the first letter v', () => {
			expect(ChangeLogRenderer.buildHeading('v0.2.0', '2026-10-10')).toBe('## [0.2.0] - 2026-10-10');
			expect(ChangeLogRenderer.buildHeading('1.0.0', '2026-01-01')).toBe('## [1.0.0] - 2026-01-01');
		});
	});

	describe('renderMechanicalSection', () => {
		it('writes one bullet for each pull request, with its title and its link, and no category', () => {
			expect(ChangeLogRenderer.renderMechanicalSection(UNRELEASED_INPUT)).toBe([
				'## [Unreleased]',
				'',
				'- Fix the bug ([#8](https://github.com/acme/widgets/pull/8))',
				'- Add the thing ([#7](https://github.com/acme/widgets/pull/7))',
			].join('\n'));
		});

		it('starts with the heading of a release', () => {
			expect(ChangeLogRenderer.renderMechanicalSection(RELEASE_INPUT).startsWith('## [1.1.0] - 2026-02-20\n\n- Fix'))
				.toBe(true);
		});

		it('writes the plain number when the address of the repository is not known', () => {
			expect(ChangeLogRenderer.renderMechanicalSection({ ...UNRELEASED_INPUT, repositoryUrl: null })).toBe([
				'## [Unreleased]',
				'',
				'- Fix the bug (#8)',
				'- Add the thing (#7)',
			].join('\n'));
		});

		it.each([
			['v1.0.0', null, 'No merged pull request since v1.0.0.'],
			[null, 'v1.1.0', 'No merged pull request up to v1.1.0.'],
			['v1.0.0', 'v1.1.0', 'No merged pull request between v1.0.0 and v1.1.0.'],
			[null, null, 'No merged pull request.'],
		])('says that nothing was merged when the list is empty, from %s to %s', (fromTag, toTag, expectedText) => {
			expect(ChangeLogRenderer.renderMechanicalSection({
				...UNRELEASED_INPUT,
				mergedPullRequests: [],
				range: {
					fromTag,
					toTag,
				},
			})).toBe(`## [Unreleased]\n\n${expectedText}`);
		});
	});

	describe('buildPrompt', () => {
		it('holds the rules, the last release, and the message of every merge commit', () => {
			const prompt = ChangeLogRenderer.buildPrompt(UNRELEASED_INPUT);
			expect(prompt).toContain('merged since the release v1.0.0.');
			expect(prompt).toContain('Keep a Changelog 1.1.0');
			expect(prompt).toContain('Start with the heading line "## [Unreleased]".');
			expect(prompt).toContain(
				'"### Added", "### Changed", "### Deprecated", "### Removed", "### Fixed", "### Security"',
			);
			expect(prompt).toContain('Leave out a heading that has no change.');
			expect(prompt).toContain('([#116](https://github.com/acme/widgets/pull/116))');
			expect(prompt).toContain('Pull request #8\nBranch: acme/fix-bug');
			expect(prompt).toContain('Merge pull request #7 from acme/add-thing\n\nAdd the thing');
		});

		it('gives the heading of a release and the end of the range', () => {
			const prompt = ChangeLogRenderer.buildPrompt(RELEASE_INPUT);
			expect(prompt).toContain('merged since the release v1.0.0, up to the release v1.1.0.');
			expect(prompt).toContain('Start with the heading line "## [1.1.0] - 2026-02-20".');
		});

		it('says "the start of the project" when the range has no start', () => {
			const prompt = ChangeLogRenderer.buildPrompt({
				...RELEASE_INPUT,
				range: {
					fromTag: null,
					toTag: 'v1.1.0',
				},
			});
			expect(prompt).toContain('merged since the start of the project, up to the release v1.1.0.');
		});
	});

	describe('cleanAgentAnswer', () => {
		const heading = '## [Unreleased]';

		it('keeps a good answer', () => {
			expect(ChangeLogRenderer.cleanAgentAnswer('\n## [Unreleased]\n\n### Added\n\n- A thing.\n\n', heading))
				.toBe('## [Unreleased]\n\n### Added\n\n- A thing.');
		});

		it('removes a code fence around the answer', () => {
			expect(ChangeLogRenderer.cleanAgentAnswer('```markdown\n## [Unreleased]\n\n- A thing.\n```', heading))
				.toBe('## [Unreleased]\n\n- A thing.');
		});

		it('writes the exact heading line that was asked for', () => {
			expect(ChangeLogRenderer.cleanAgentAnswer('## 1.1.0\n\n- A thing.', '## [1.1.0] - 2026-02-20'))
				.toBe('## [1.1.0] - 2026-02-20\n\n- A thing.');
		});

		it('throws an error with the answer when the answer is not a section', () => {
			expect(() => {
				ChangeLogRenderer.cleanAgentAnswer('Sure! Here is the change log.', heading);
			}).toThrow('did not answer with a section of the change log:\nSure! Here is the change log.');
			expect(() => {
				ChangeLogRenderer.cleanAgentAnswer('', heading);
			}).toThrow('did not answer with a section');
		});
	});

	describe('removeUnreleasedSection', () => {
		it('removes the section Unreleased between the header and the releases', () => {
			const existing = `${HEADER}${SECTION_UNRELEASED}${SECTION_1_0_0}${SECTION_0_9_0}`;
			expect(ChangeLogRenderer.removeUnreleasedSection(existing)).toBe(`${HEADER}${SECTION_1_0_0}${SECTION_0_9_0}`);
		});

		it('removes the lines below the heading, including the subsections', () => {
			const unreleased = '## [Unreleased]\n\n### Added\n\n- A new thing.\n\n### Fixed\n\n- A fix.\n\n';
			const existing = `${HEADER}${unreleased}${SECTION_1_0_0}`;
			expect(ChangeLogRenderer.removeUnreleasedSection(existing)).toBe(`${HEADER}${SECTION_1_0_0}`);
		});

		it('removes a section Unreleased that is the last section of the file', () => {
			const existing = `${HEADER}${SECTION_1_0_0}${SECTION_UNRELEASED}`;
			expect(ChangeLogRenderer.removeUnreleasedSection(existing)).toBe(`${HEADER}${SECTION_1_0_0.trimEnd()}\n`);
		});

		it('gives the same text when the file has no section Unreleased', () => {
			const existing = `${HEADER}${SECTION_1_0_0}${SECTION_0_9_0}`;
			expect(ChangeLogRenderer.removeUnreleasedSection(existing)).toBe(existing);
		});

		it('gives null when the file does not exist', () => {
			expect(ChangeLogRenderer.removeUnreleasedSection(null)).toBeNull();
		});
	});

	describe('insertSection', () => {
		const unreleased = '## [Unreleased]\n\n- A new thing.';
		const release = '## [1.1.0] - 2026-02-20\n\n- A release thing.';

		it('creates the file with the Keep a Changelog header when the file does not exist', () => {
			const text = ChangeLogRenderer.insertSection(null, unreleased);
			expect(text.startsWith('# Changelog\n\nAll notable changes to this project are documented')).toBe(true);
			expect(text).toContain('[Keep a Changelog](https://keepachangelog.com/en/1.1.0/)');
			expect(text.endsWith('\n\n## [Unreleased]\n\n- A new thing.\n')).toBe(true);
		});

		it('puts the section Unreleased below the header and above the releases', () => {
			const text = ChangeLogRenderer.insertSection(`${HEADER}${SECTION_1_0_0}${SECTION_0_9_0}`, unreleased);
			expect(text).toBe(`${HEADER}${unreleased}\n\n${SECTION_1_0_0}${SECTION_0_9_0}`);
		});

		it('replaces an existing section Unreleased and does not change the releases', () => {
			const existing = `${HEADER}${SECTION_UNRELEASED}${SECTION_1_0_0}${SECTION_0_9_0}`;
			const text = ChangeLogRenderer.insertSection(existing, unreleased);
			expect(text).toBe(`${HEADER}${unreleased}\n\n${SECTION_1_0_0}${SECTION_0_9_0}`);
			expect(text).not.toContain('An old entry.');
		});

		it('replaces a section Unreleased that is the last section of the file', () => {
			const existing = '# Changelog\n\n## [Unreleased]\n\n- An old entry.\n';
			expect(ChangeLogRenderer.insertSection(existing, unreleased)).toBe(`# Changelog\n\n${unreleased}\n`);
		});

		it('puts a new release between Unreleased and the older releases', () => {
			const existing = `${HEADER}${SECTION_UNRELEASED}${SECTION_1_0_0}${SECTION_0_9_0}`;
			expect(ChangeLogRenderer.insertSection(existing, release))
				.toBe(`${HEADER}${SECTION_UNRELEASED}${release}\n\n${SECTION_1_0_0}${SECTION_0_9_0}`);
		});

		it('compares the versions number by number: 0.10.0 is above 0.9.0', () => {
			const existing = `${HEADER}${SECTION_1_0_0}${SECTION_0_9_0}`;
			const section = '## [0.10.0] - 2026-01-02\n\n- A thing.';
			expect(ChangeLogRenderer.insertSection(existing, section))
				.toBe(`${HEADER}${SECTION_1_0_0}${section}\n\n${SECTION_0_9_0}`);
		});

		it('puts an old release at the end, after the other releases', () => {
			const existing = `${HEADER}${SECTION_UNRELEASED}${SECTION_1_0_0}`;
			const section = '## [0.8.0] - 2025-11-01\n\n- A thing.';
			expect(ChangeLogRenderer.insertSection(existing, section)).toBe(`${existing.trimEnd()}\n\n${section}\n`);
		});

		it('adds a blank line before an old release when the file does not end with a line break', () => {
			const existing = '# Changelog\n\n## [1.0.0] - 2026-01-01\n\n- The first version.';
			const section = '## [0.8.0] - 2025-11-01\n\n- A thing.';
			expect(ChangeLogRenderer.insertSection(existing, section))
				.toBe('# Changelog\n\n## [1.0.0] - 2026-01-01\n\n- The first version.\n\n## [0.8.0] - 2025-11-01\n\n- A thing.\n');
		});

		it('replaces the section of the same version and does not change the other sections', () => {
			const existing = `${HEADER}${SECTION_UNRELEASED}${SECTION_1_0_0}${SECTION_0_9_0}`;
			const section = '## [1.0.0] - 2026-01-05\n\n- The first version, again.';
			const text = ChangeLogRenderer.insertSection(existing, section);
			expect(text).toBe(`${HEADER}${SECTION_UNRELEASED}${section}\n\n${SECTION_0_9_0}`);
		});

		it('puts the new section above a section that has no version', () => {
			const existing = `${HEADER}## Notes\n\n- Some notes.\n`;
			expect(ChangeLogRenderer.insertSection(existing, unreleased))
				.toBe(`${HEADER}${unreleased}\n\n## Notes\n\n- Some notes.\n`);
		});

		it('adds the section at the end when the file has no section yet', () => {
			expect(ChangeLogRenderer.insertSection('# Changelog\n\nSome words.\n', unreleased))
				.toBe(`# Changelog\n\nSome words.\n\n${unreleased}\n`);
		});
	});
});
