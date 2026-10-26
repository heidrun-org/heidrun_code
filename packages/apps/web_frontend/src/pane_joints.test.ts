// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PaneJointsTest — the panes touch the border of the viewport and each other, with square corners
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of the joints between the panes, and between the panes and the border of the viewport.
 */
class PaneJointsTestHelper {
	/**
	 * Reads the declarations of one style rule of a Vue component.
	 *
	 * @param componentPath The path of the Vue component, relative to the folder `src`.
	 * @param selector The selector of the style rule, for example `.cell`.
	 * @returns The text between the braces of the style rule.
	 */
	static readRule(componentPath: string, selector: string): string {
		const componentText = Fs.readFileSync(Path.resolve(__dirname, componentPath), 'utf8');
		const styleText = componentText.slice(componentText.indexOf('<style'));
		const ruleStart = styleText.indexOf(`\n${selector} {`);
		if (ruleStart === -1) {
			throw new Error(`The style rule ${selector} is missing in ${componentPath}.`);
		}
		const bodyStart = styleText.indexOf('{', ruleStart) + 1;
		return styleText.slice(bodyStart, styleText.indexOf('}', ruleStart));
	}

	/**
	 * Tells whether a style rule declares one property.
	 *
	 * @param ruleText The text between the braces of the style rule.
	 * @param property The name of the declaration, for example `border-radius`.
	 * @returns True when the rule declares the property.
	 */
	static hasDeclaration(ruleText: string, property: string): boolean {
		return new RegExp(`(^|[\\s;])${property}:`).test(ruleText);
	}

	/**
	 * Reads the value of one declaration in a style rule.
	 *
	 * @param ruleText The text between the braces of the style rule.
	 * @param property The name of the declaration, for example `margin`.
	 * @returns The value of the declaration.
	 */
	static readValue(ruleText: string, property: string): string {
		const match = new RegExp(`(^|[\\s;])${property}:\\s*([^;]+);`).exec(ruleText);
		if (match === null) {
			throw new Error(`The declaration ${property} is missing in the style rule.`);
		}
		return match[2].trim();
	}
}

describe('frame of the viewport', () => {
	const rule = PaneJointsTestHelper.readRule('App.vue', '.center');

	it('has no padding, so that the panes touch its border', () => {
		expect(PaneJointsTestHelper.hasDeclaration(rule, 'padding')).toBe(false);
	});

	it('clips what goes past its rounded corners, so that a pane that touches a corner of the viewport follows the corner', () => {
		expect(PaneJointsTestHelper.readValue(rule, 'overflow')).toBe('hidden');
	});

	it('hides the border of the panes on its left, on its right, and at its bottom, and shows it under the tab bar', () => {
		const stageRule = PaneJointsTestHelper.readRule('App.vue', '.stage');
		expect(PaneJointsTestHelper.readValue(stageRule, 'margin')).toBe('0 -1px -1px');
	});
});

describe('pane', () => {
	const rule = PaneJointsTestHelper.readRule('components/PaneCard.vue', '.pane');

	it('has no rounded corner', () => {
		expect(PaneJointsTestHelper.hasDeclaration(rule, 'border-radius')).toBe(false);
	});

	it('has a border of 1 pixel, which is the line between two panes', () => {
		expect(PaneJointsTestHelper.readValue(rule, 'border')).toBe('1px solid var(--line)');
	});

	it('draws its ring on the left, on the right, and at the bottom inside its border, so that the ring shows where the viewport hides the border', () => {
		const ringRule = PaneJointsTestHelper.readRule('components/PaneCard.vue', '.pane::after');
		expect(PaneJointsTestHelper.readValue(ringRule, 'inset')).toBe('0');
		expect(PaneJointsTestHelper.readValue(ringRule, 'border-width')).toBe('0 1px 1px');
		expect(PaneJointsTestHelper.readValue(ringRule, 'pointer-events')).toBe('none');
	});
});

describe('grid of panes', () => {
	it('has no space around a pane and no margin', () => {
		expect(PaneJointsTestHelper.hasDeclaration(PaneJointsTestHelper.readRule('components/PaneGrid.vue', '.cell'), 'padding')).toBe(false);
		expect(PaneJointsTestHelper.hasDeclaration(PaneJointsTestHelper.readRule('components/PaneGrid.vue', '.grid'), 'margin')).toBe(false);
	});

	it('has no rounded corner on the place to grab a line, and none on the screen of an empty tab', () => {
		expect(PaneJointsTestHelper.hasDeclaration(PaneJointsTestHelper.readRule('components/PaneGrid.vue', '.separator'), 'border-radius')).toBe(false);
		expect(PaneJointsTestHelper.hasDeclaration(PaneJointsTestHelper.readRule('components/PaneGrid.vue', '.empty'), 'border-radius')).toBe(false);
	});

	it('gives the screen of an empty tab the whole grid, with no inset', () => {
		expect(PaneJointsTestHelper.readValue(PaneJointsTestHelper.readRule('components/PaneGrid.vue', '.empty'), 'inset')).toBe('0');
	});
});

describe('column of pinned panes', () => {
	it('has no gap between two pinned panes, and puts each pinned pane 1 pixel over the previous one so that two borders make one line', () => {
		const columnRule = PaneJointsTestHelper.readRule('components/ColumnOfPinnedPanes.vue', '.column-of-pinned-panes');
		expect(PaneJointsTestHelper.hasDeclaration(columnRule, 'gap')).toBe(false);
		const nextCellRule = PaneJointsTestHelper.readRule('components/ColumnOfPinnedPanes.vue', '.cell + .cell');
		expect(PaneJointsTestHelper.readValue(nextCellRule, 'margin-top')).toBe('-1px');
	});
});

describe('handle between the panes and the column of pinned panes', () => {
	it('takes no room when it is inside, and keeps the place to grab as wide as the sash', () => {
		const handleRule = PaneJointsTestHelper.readRule('components/Resizer.vue', '.resizer.inside');
		expect(PaneJointsTestHelper.readValue(handleRule, 'width')).toBe('0');
		const grabRule = PaneJointsTestHelper.readRule('components/Resizer.vue', '.resizer.inside::before');
		expect(PaneJointsTestHelper.readValue(grabRule, 'width')).toBe('var(--pane-gap)');
	});
});
