// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PreviewNameTest — the button of the rendered Markdown is called "Preview", never "Reading"
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

describe('PreviewNameTest', () => {
	/**
	 * Reads one language file of the folder `i18n/locales`.
	 *
	 * @param language - The folder of the language, for example `en`.
	 * @param fileName - The name of the file, for example `fileView.json`.
	 * @returns The texts of the file.
	 */
	function readTexts(language: string, fileName: string): Record<string, string> {
		return JSON.parse(Fs.readFileSync(Path.resolve(__dirname, 'i18n', 'locales', language, fileName), 'utf8'));
	}

	it.each([
		['en', 'Preview'],
		['fr', 'Aperçu'],
	])('the file view pane calls the button %s "%s"', (language, expectedText) => {
		expect(readTexts(language, 'fileView.json').preview).toBe(expectedText);
	});

	it('the file view pane has no text that goes back to reading', () => {
		expect(Object.keys(readTexts('en', 'fileView.json'))).not.toContain('backToReading');
	});
});
