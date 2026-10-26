// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { QuickOpenSearch } from './quick_open_search';

describe('QuickOpenSearch (issue #898)', () => {
	const PATHS = ['src/main.rs', 'src/lib/main_window.ts', 'docs/maintenance.md', 'README.md', 'node_modules/'];

	it('finds the letters of the name in order, even when they are not next to each other', () => {
		expect(QuickOpenSearch.search('mnrs', PATHS)).toEqual(['src/main.rs']);
		expect(QuickOpenSearch.score('xyz', 'src/main.rs')).toBeNull();
	});

	it('puts a match at the start of the file name first, and a short path before a long one', () => {
		expect(QuickOpenSearch.search('main', PATHS)).toEqual(['src/main.rs', 'docs/maintenance.md', 'src/lib/main_window.ts']);
		expect(QuickOpenSearch.search('readme', ['docs/old/readme_old.txt', 'README.md'])).toEqual(['README.md', 'docs/old/readme_old.txt']);
	});

	it('moves to the next folder with a "/" in the search text', () => {
		expect(QuickOpenSearch.search('lib/m', PATHS)).toEqual(['src/lib/main_window.ts']);
	});

	it('skips the folders, and keeps at most the asked number of files', () => {
		expect(QuickOpenSearch.search('', PATHS)).not.toContain('node_modules/');
		expect(QuickOpenSearch.search('', PATHS, 2)).toHaveLength(2);
	});
});
