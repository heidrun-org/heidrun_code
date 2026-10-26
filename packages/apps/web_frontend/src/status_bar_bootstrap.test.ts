// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	StatusBarBootstrapTest — the cards above the status bar are made of Bootstrap classes
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of the Bootstrap markup of the cards above the status bar.
 */
class StatusBarBootstrapTestHelper {
	/**
	 * Reads the source of a component of the folder `components`.
	 *
	 * @param fileName - The name of the file, for example `QuotaSummary.vue`.
	 * @returns The source text of the component.
	 */
	static readComponent(fileName: string): string {
		return Fs.readFileSync(Path.resolve(__dirname, 'components', fileName), 'utf8');
	}

	/**
	 * Lists the class selectors that a `<style>` block of a component declares.
	 *
	 * @param sourceText - The source text of the component.
	 * @returns The class names, in order, without the dot.
	 */
	static listStyledClassNames(sourceText: string): string[] {
		const styleMatch = /<style[^>]*>([\s\S]*?)<\/style>/.exec(sourceText);
		if (styleMatch === null) {
			return [];
		}
		return [...styleMatch[1].matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1]);
	}
}

describe('the cards of the quotas (QuotaSummary.vue)', () => {
	const sourceText = StatusBarBootstrapTestHelper.readComponent('QuotaSummary.vue');

	it('uses the Bootstrap popover, progress bar, and alert classes', () => {
		for (const className of ['popover', 'popover-arrow', 'popover-body', 'progress', 'progress-bar', 'alert']) {
			expect(sourceText).toContain(className);
		}
	});

	it('writes style rules only for the item in the status bar, and not for the card', () => {
		const allowedClassNameList = ['quota', 'label', 'percent', 'unit', 'ring', 'track', 'arc'];
		const classNameList = StatusBarBootstrapTestHelper.listStyledClassNames(sourceText);
		expect(classNameList.filter((className) => allowedClassNameList.includes(className) === false)).toEqual([]);
	});
});

describe('the card of the git branch (GitStatusSummary.vue)', () => {
	const sourceText = StatusBarBootstrapTestHelper.readComponent('GitStatusSummary.vue');

	it('uses the Bootstrap popover classes', () => {
		for (const className of ['popover', 'popover-arrow', 'popover-body']) {
			expect(sourceText).toContain(className);
		}
	});

	it('writes style rules only for the item in the status bar, and not for the card', () => {
		const allowedClassNameList = ['git-status', 'git-counts-zone', 'behind', 'ahead', 'count'];
		const classNameList = StatusBarBootstrapTestHelper.listStyledClassNames(sourceText);
		expect(classNameList.filter((className) => allowedClassNameList.includes(className) === false)).toEqual([]);
	});
});

describe('the branch picker (GitBranchPicker.vue)', () => {
	const sourceText = StatusBarBootstrapTestHelper.readComponent('GitBranchPicker.vue');

	it('uses the Bootstrap popover, list group, and form control classes', () => {
		for (const className of ['popover', 'popover-arrow', 'popover-body', 'list-group', 'list-group-item-action', 'form-control']) {
			expect(sourceText).toContain(className);
		}
	});

	it('writes style rules only for the zone in the status bar and for the rows of the list', () => {
		const allowedClassNameList = [
			'git-branch-zone',
			'branch-picker-body',
			'branch-search',
			'branch-list',
			'branch-item',
			'branch-row',
			'branch-first-line',
			'branch-name',
			'branch-subject',
			'branch-time',
			'branch-link',
		];
		const classNameList = StatusBarBootstrapTestHelper.listStyledClassNames(sourceText);
		expect(classNameList.filter((className) => allowedClassNameList.includes(className) === false)).toEqual([]);
	});
});

describe('the list of the branch picker (GitBranchPicker.vue)', () => {
	const sourceText = StatusBarBootstrapTestHelper.readComponent('GitBranchPicker.vue');

	it('scrolls inside the card, and cuts the long lines, because the utility classes of Bootstrap for this are not built', () => {
		expect(sourceText).toMatch(/\.branch-list\s*\{[^}]*max-height:[^}]*overflow-y:\s*auto/);
		expect(sourceText).toMatch(/\.branch-name, \.branch-subject\s*\{[^}]*text-overflow:\s*ellipsis/);
	});
});

describe('the link of a row of the branch picker (GitBranchPicker.vue)', () => {
	const sourceText = StatusBarBootstrapTestHelper.readComponent('GitBranchPicker.vue');

	it('is an outline Bootstrap button without border, and is always visible', () => {
		expect(sourceText).toContain('btn btn-outline theme-secondary border-0 branch-link');
		expect(sourceText).not.toMatch(/\.branch-link\s*\{[^}]*opacity:\s*0\s*;/);
		expect(sourceText).not.toMatch(/\.branch-item:hover \.branch-link/);
	});

	it('stays above the hovered row, which Bootstrap raises to z-index 1', () => {
		expect(sourceText).toMatch(/\.branch-link\s*\{[^}]*z-index:\s*2/);
	});

	it('leaves room for the link on the first line only, so the second line goes to the edge of the row', () => {
		expect(sourceText).toMatch(/\.branch-first-line\s*\{[^}]*padding-right:\s*32px/);
		expect(sourceText).not.toMatch(/\.branch-row\s*\{[^}]*padding-right:\s*44px/);
	});

	it('lets the list grow to 560 pixels, and at most 60 percent of the window height', () => {
		expect(sourceText).toMatch(/\.branch-list\s*\{[^}]*max-height:\s*min\(560px, 60vh\)/);
	});
});

describe('the button group of the three zones of the Git section', () => {
	it('rounds only the two ends of the group: the inner corners, where two zones touch, are square', () => {
		const branchText = StatusBarBootstrapTestHelper.readComponent('GitBranchPicker.vue');
		const mergeText = StatusBarBootstrapTestHelper.readComponent('GitSynchronize.vue');
		const countsText = StatusBarBootstrapTestHelper.readComponent('GitStatusSummary.vue');
		expect(branchText).toMatch(/\.git-branch-zone\s*\{[^}]*border-radius:\s*6px 0 0 6px/);
		expect(mergeText).toMatch(/\.git-synchronize-zone\s*\{[^}]*border-radius:\s*0\s*;/);
		expect(countsText).toMatch(/\.git-counts-zone\s*\{[^}]*border-radius:\s*0 6px 6px 0/);
	});
});

describe('the synchronize zone (GitSynchronize.vue)', () => {
	const sourceText = StatusBarBootstrapTestHelper.readComponent('GitSynchronize.vue');

	it('uses the Bootstrap popover, spinner, and alert classes', () => {
		for (const className of ['popover', 'popover-arrow', 'popover-body', 'spinner-border', 'alert']) {
			expect(sourceText).toContain(className);
		}
	});

	it('writes style rules only for the zone in the status bar', () => {
		const allowedClassNameList = ['git-synchronize-zone', 'git-synchronize-zone-disabled'];
		const classNameList = StatusBarBootstrapTestHelper.listStyledClassNames(sourceText);
		expect(classNameList.filter((className) => allowedClassNameList.includes(className) === false)).toEqual([]);
	});
});

describe('the card of the workspaces (WorkspaceStatusSummary.vue)', () => {
	const sourceText = StatusBarBootstrapTestHelper.readComponent('WorkspaceStatusSummary.vue');

	it('uses the Bootstrap popover classes, with the arrow like the other cards', () => {
		for (const className of ['popover', 'popover-arrow', 'popover-body', 'bs-popover-top']) {
			expect(sourceText).toContain(className);
		}
	});

	it('writes style rules only for the item in the status bar and for the rows of the list', () => {
		const allowedClassNameList = [
			'workspace-status',
			'workspace-rename',
			'name',
			'popover',
			'btn',
			'detail-row',
			'detail-value',
			'copy-detail-button',
			'workspace-row',
			'workspace-main',
			'workspace-branch',
			'workspace-branch-name',
			'active',
			'row-actions',
			'row-button',
			'dragging',
			'drop-before',
			'drop-after',
		];
		const classNameList = StatusBarBootstrapTestHelper.listStyledClassNames(sourceText);
		expect(classNameList.filter((className) => allowedClassNameList.includes(className) === false)).toEqual([]);
	});
});

describe('the theme of Bootstrap', () => {
	it('gives the Bootstrap variables of the popover, the progress bar, and the alert the colors of the application', () => {
		const stylesText = Fs.readFileSync(Path.resolve(__dirname, 'styles.css'), 'utf8');
		for (const variableName of ['--bg-2', '--success-bg', '--warning-bg', '--danger-bg', '--popover-zindex']) {
			expect(stylesText).toContain(`${variableName}:`);
		}
	});
});
