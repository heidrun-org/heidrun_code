// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PaneGapTest — the space to grab a line between two columns or two panes is thin, like in Visual Studio Code
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of the space between two panes in `styles.css`.
 */
class PaneGapTestHelper {
	/**
	 * Reads the value of the variable `--pane-gap` from the block `:root` in `styles.css`.
	 *
	 * @returns The value of the variable, for example `5px`.
	 */
	static readPaneGap(): string {
		const cssText = Fs.readFileSync(Path.resolve(__dirname, 'styles.css'), 'utf8');
		const blockStart = cssText.indexOf(':root {');
		const blockEnd = cssText.indexOf('}', blockStart);
		const blockText = cssText.slice(blockStart, blockEnd);
		const match = /--pane-gap:\s*([^;]+);/.exec(blockText);
		if (match === null) {
			throw new Error('The variable --pane-gap is missing in the block :root.');
		}
		return match[1].trim();
	}
}

describe('space to grab a line between two columns or two panes', () => {
	it('is 5 pixels wide', () => {
		expect(PaneGapTestHelper.readPaneGap()).toBe('5px');
	});
});
