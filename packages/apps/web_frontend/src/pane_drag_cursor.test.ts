// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PaneDragCursorTest — the cursor of a drag shows over every element, also over an element with its own cursor
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of the cursor rules in `styles.css`.
 */
class PaneDragCursorTestHelper {
	/**
	 * Reads the whole text of `styles.css`.
	 *
	 * @returns The text of the file.
	 */
	static readStyles(): string {
		return Fs.readFileSync(Path.resolve(__dirname, 'styles.css'), 'utf8');
	}
}

describe('cursor during the drag of a line or a corner between panes', () => {
	for (const cursor of ['move', 'row-resize', 'col-resize']) {
		it(`forces the cursor ${cursor} on every element, also on an element that has its own cursor`, () => {
			const cssText = PaneDragCursorTestHelper.readStyles();
			const selector = `html[data-pane-drag-cursor="${cursor}"] *`;
			const ruleStart = cssText.indexOf(selector);
			expect(ruleStart).toBeGreaterThanOrEqual(0);
			const ruleText = cssText.slice(ruleStart, cssText.indexOf('}', ruleStart));
			expect(ruleText).toContain(`cursor: ${cursor} !important`);
		});
	}
});
