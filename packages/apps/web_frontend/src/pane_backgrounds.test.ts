// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PaneBackgroundsTest — the window shell and the sidebar share one background, and the pane has a lighter one, as in VS Code
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of the background colours in `styles.css`.
 */
class PaneBackgroundsTestHelper {
	/**
	 * Reads one colour variable from the block of one theme in `styles.css`.
	 *
	 * @param selector - The selector that opens the block, for example `:root`.
	 * @param variableName - The variable name, for example `--shell`.
	 * @returns The value of the variable.
	 */
	static readVariable(selector: string, variableName: string): string {
		const cssText = Fs.readFileSync(Path.resolve(__dirname, 'styles.css'), 'utf8');
		const blockStart = cssText.indexOf(`${selector} {`);
		const blockEnd = cssText.indexOf('}', blockStart);
		const blockText = cssText.slice(blockStart, blockEnd);
		const match = new RegExp(`${variableName}:\\s*([^;]+);`).exec(blockText);
		if (match === null) {
			throw new Error(`The variable ${variableName} is missing in the block ${selector}.`);
		}
		return match[1].trim();
	}

	/**
	 * Computes the relative luminance of a colour, as the WCAG defines it.
	 *
	 * @param hexColour - A colour written as `#rrggbb`.
	 * @returns The relative luminance, from 0 (black) to 1 (white).
	 */
	static readLuminance(hexColour: string): number {
		const channels = [1, 3, 5].map((start) => {
			const value = parseInt(hexColour.slice(start, start + 2), 16) / 255;
			return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
	}

	/**
	 * Computes the contrast ratio between two colours, as the WCAG defines it.
	 *
	 * @param firstColour - A colour written as `#rrggbb`.
	 * @param secondColour - A colour written as `#rrggbb`.
	 * @returns The contrast ratio, from 1 (the same colour) to 21 (black on white).
	 */
	static readContrastRatio(firstColour: string, secondColour: string): number {
		const firstLuminance = PaneBackgroundsTestHelper.readLuminance(firstColour);
		const secondLuminance = PaneBackgroundsTestHelper.readLuminance(secondColour);
		const lighter = Math.max(firstLuminance, secondLuminance);
		const darker = Math.min(firstLuminance, secondLuminance);
		return (lighter + 0.05) / (darker + 0.05);
	}
}

describe('background colours of the window', () => {
	for (const selector of [':root', ':root[data-theme="light"]']) {
		it(`gives the shell and the sidebar the same background, and the pane another one, in ${selector}`, () => {
			const shell = PaneBackgroundsTestHelper.readVariable(selector, '--shell');
			const side = PaneBackgroundsTestHelper.readVariable(selector, '--side');
			const viewport = PaneBackgroundsTestHelper.readVariable(selector, '--bg');
			expect(side).toBe(shell);
			expect(viewport).not.toBe(shell);
		});

		it(`makes the pane background lighter than the shell and the sidebar background in ${selector}`, () => {
			const side = PaneBackgroundsTestHelper.readVariable(selector, '--side');
			const viewport = PaneBackgroundsTestHelper.readVariable(selector, '--bg');
			expect(viewport > side).toBe(true);
		});

		it(`gives the header of the selected pane its own tint, different from the pane background, in ${selector}`, () => {
			const selectedHeader = PaneBackgroundsTestHelper.readVariable(selector, '--pane-head-selected');
			const viewport = PaneBackgroundsTestHelper.readVariable(selector, '--bg');
			expect(selectedHeader).toMatch(/^#[0-9a-f]{6}$/i);
			expect(selectedHeader).not.toBe(viewport);
		});

		it(`draws the line under the header of a pane with a contrast of at least 1.1 against the pane background in ${selector}`, () => {
			const headerLine = PaneBackgroundsTestHelper.readVariable(selector, '--pane-head-line');
			const viewport = PaneBackgroundsTestHelper.readVariable(selector, '--bg');
			expect(PaneBackgroundsTestHelper.readContrastRatio(headerLine, viewport)).toBeGreaterThanOrEqual(1.1);
		});
	}
});
