// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FaviconTest — the web page has the goat icon, and the application icon draws the same goat
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of the goat icon files.
 */
class FaviconTestHelper {
	/**
	 * Reads a text file of the package `web_frontend`.
	 *
	 * @param relativePath - The path of the file, relative to the package `web_frontend`.
	 * @returns The text of the file.
	 */
	static readPackageFile(relativePath: string): string {
		return Fs.readFileSync(Path.resolve(__dirname, '..', relativePath), 'utf8');
	}

	/**
	 * Reads the text of the application icon source in the package `desktop_tauri`.
	 *
	 * @returns The text of the file `icon.svg`.
	 */
	static readApplicationIconSource(): string {
		return Fs.readFileSync(
			Path.resolve(__dirname, '..', '..', 'desktop_tauri', 'icons', 'icon.svg'),
			'utf8',
		);
	}

	/**
	 * Extracts the drawing, which is everything between the opening tag and the closing tag of the element `svg`.
	 *
	 * @param svgText - The text of an SVG file.
	 * @returns The drawing, with the lines in the same order as in the file.
	 */
	static extractDrawing(svgText: string): string {
		const openingTagEnd = svgText.indexOf('>') + 1;
		const closingTagStart = svgText.lastIndexOf('</svg>');
		return svgText.slice(openingTagEnd, closingTagStart).trim();
	}
}

describe('favicon', () => {
	it('is linked from the web page as an SVG file', () => {
		const indexText = FaviconTestHelper.readPackageFile('index.html');
		expect(indexText).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
	});

	it('is a square drawing with a viewBox of 64 by 64', () => {
		const faviconText = FaviconTestHelper.readPackageFile('public/favicon.svg');
		expect(faviconText).toContain('viewBox="0 0 64 64"');
	});

	it('has the same drawing as the source of the application icon', () => {
		const faviconDrawing = FaviconTestHelper.extractDrawing(FaviconTestHelper.readPackageFile('public/favicon.svg'));
		const applicationIconText = FaviconTestHelper.readApplicationIconSource();
		expect(applicationIconText).toContain(faviconDrawing);
	});
});
