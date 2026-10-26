// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	CodeThemeMenuTest — the Files window and the large Git window have no menu for the code theme
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The two windows that showed a menu to choose the code theme before the issue 446.
 */
const WINDOW_FILE_NAME_LIST = ['FilesModal.vue', 'GitModal.vue'];

describe('CodeThemeMenuTest', () => {
	it.each(WINDOW_FILE_NAME_LIST)('%s has no menu to choose the code theme', (fileName) => {
		const sourceText = Fs.readFileSync(Path.resolve(__dirname, 'components', fileName), 'utf8');
		const templateText = sourceText.split('<style')[0];
		expect(templateText).not.toContain('<select');
		expect(sourceText).not.toContain('settings.codeTheme');
		expect(sourceText).not.toContain('CODE_THEMES');
	});
});
