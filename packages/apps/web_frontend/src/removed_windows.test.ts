// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	RemovedWindowsTest — the Files window and the large Git window are gone (issue #886)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The texts that only the code of the Files window or of the large Git window wrote.
 */
const REMOVED_NAME_LIST = ['FilesModal', 'GitModal', 'openFiles(', 'openGitModal', 'git.modal', 'files.open'];

/**
 * Helpers for the tests of the removal of the two windows.
 */
class RemovedWindowsTestHelper {
	/**
	 * Lists the source files of the folder `src`, without the test files.
	 *
	 * @returns The paths of the files that end with `.ts` or `.vue`, relative to the folder `src`.
	 */
	static sourceFiles(): string[] {
		return Fs.readdirSync(__dirname, { recursive: true, encoding: 'utf8' }).filter((file) => {
			const isSource = file.endsWith('.ts') === true || file.endsWith('.vue') === true;
			return isSource === true && file.endsWith('.test.ts') === false;
		});
	}
}

describe('RemovedWindowsTest', () => {
	it.each(['FilesModal.vue', 'GitModal.vue', 'GitModal.test.ts'])('the component file %s is deleted', (fileName) => {
		expect(Fs.existsSync(Path.resolve(__dirname, 'components', fileName))).toBe(false);
	});

	it.each([
		['en', 'filesModal.json'],
		['en', 'gitModal.json'],
		['fr', 'filesModal.json'],
		['fr', 'gitModal.json'],
	])('the locale file %s/%s is deleted', (language, fileName) => {
		expect(Fs.existsSync(Path.resolve(__dirname, 'i18n', 'locales', language, fileName))).toBe(false);
	});

	it('the list of shortcuts has no shortcut ⌘P', () => {
		const groups: { items: { keys?: string }[] }[] = JSON.parse(
			Fs.readFileSync(Path.resolve(__dirname, 'lib', 'shortcuts.json'), 'utf8'),
		);
		const keyList = groups.flatMap((group) => group.items.map((item) => item.keys));
		expect(keyList).not.toContain('⌘P');
	});

	it.each(REMOVED_NAME_LIST)('no source file opens a window with %s', (name) => {
		const fileList = RemovedWindowsTestHelper.sourceFiles().filter((file) => {
			return Fs.readFileSync(Path.resolve(__dirname, file), 'utf8').includes(name);
		});
		expect(fileList).toEqual([]);
	});
});
