// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import * as Sass from 'sass';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	BootstrapPartsTest — the compiled Bootstrap parts must stay inside one CSS layer
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Helpers for the tests of `bootstrap_parts.scss`.
 */
class BootstrapPartsTestHelper {
	/**
	 * Compiles `bootstrap_parts.scss` the way Vite compiles it.
	 *
	 * @returns The CSS text.
	 */
	static compile(): string {
		const result = Sass.compile(Path.resolve(__dirname, 'bootstrap_parts.scss'), {
			loadPaths: [Path.resolve(__dirname, '../node_modules')],
			quietDeps: true,
					});
		return result.css;
	}

	/**
	 * Lists what stands at the top level of a CSS text: the selector of each rule, and the head of each at-rule.
	 *
	 * @param cssText - The CSS text.
	 * @returns The top-level selectors and at-rule heads, in order.
	 */
	static listTopLevelHeads(cssText: string): string[] {
		const textWithoutComments = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
		const headList: string[] = [];
		let depth = 0;
		let headStart = 0;
		for (let index = 0; index < textWithoutComments.length; index++) {
			const character = textWithoutComments[index];
			if (character === '{') {
				if (depth === 0) {
					headList.push(textWithoutComments.slice(headStart, index).trim());
				}
				depth += 1;
			} else if (character === '}') {
				depth -= 1;
				if (depth === 0) {
					headStart = index + 1;
				}
			} else if (character === ';' && depth === 0) {
				headStart = index + 1;
			}
		}
		return headList;
	}
}

describe('bootstrap_parts.scss', () => {
	it('puts every Bootstrap component rule in a cascade layer, so that a rule of the application always wins', () => {
		const headList = BootstrapPartsTestHelper.listTopLevelHeads(BootstrapPartsTestHelper.compile());
		const layerHeadList = headList.filter((head) => head.startsWith('@layer') === true);
		expect(layerHeadList.length).toBeGreaterThan(10);
		const ruleHeadList = headList.filter((head) => head.startsWith('@layer') === false);
		expect(ruleHeadList).toEqual([
			':root,\n:host',
			':root,\n:host',
			'@media (prefers-color-scheme: dark)',
			'[data-bs-theme=dark]',
			'[data-bs-theme=light]',
			'.form-control,\nselect.form-control',
			'.form-control:focus-visible,\n.form-control:focus-within',
			'.menu',
			'.popover',
			'.tooltip',
			'.progress',
			'.alert',
			'.badge',
			'.list-group',
			'.btn',
			'.btn:disabled',
			'.btn-group > .btn',
			'.btn-group > .btn:hover',
			'.btn-group > .btn:not(:first-child)',
			'.btn-group > .btn:not(:last-child)',
		]);
	});

	it('has only the utility classes that the web frontend uses, and they sit in the layer utilities', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		const layerText = cssText.slice(cssText.indexOf('@layer utilities {'), cssText.indexOf('\n.form-control,'));
		const utilityRuleList = layerText.match(/^ {2}\.[a-z0-9-]+ \{/gm) ?? [];
		expect(utilityRuleList.map((rule) => rule.trim().replace(' {', ''))).toEqual([
			'.justify-content-start',
			'.justify-content-center',
			'.justify-content-between',
			'.justify-content-end',
			'.border-0',
			'.border-top',
			'.d-block',
			'.d-flex',
			'.d-inline-flex',
			'.flex-column',
			'.flex-wrap',
			'.flex-fill',
			'.align-items-start',
			'.align-items-center',
			'.align-items-end',
			'.align-self-start',
			'.gap-1',
			'.gap-2',
			'.gap-3',
			'.m-0',
			'.ms-1',
			'.ms-3',
			'.ms-auto',
			'.me-2',
			'.me-auto',
			'.my-auto',
			'.mt-1',
			'.mt-2',
			'.mb-2',
			'.mb-3',
			'.p-2',
			'.ps-3',
			'.pe-2',
			'.pe-5',
			'.pt-2',
			'.fs-4',
			'.fw-medium',
			'.fw-semibold',
			'.fst-italic',
			'.font-monospace',
			'.text-start',
			'.text-end',
			'.text-break',
			'.text-wrap',
			'.text-nowrap',
			'.text-primary-emphasis',
			'.text-success-emphasis',
			'.text-warning-emphasis',
			'.text-danger-emphasis',
			'.text-body-secondary',
			'.bg-success',
			'.bg-warning',
			'.bg-danger',
			'.bg-body-emphasis',
			'.bg-white',
			'.position-fixed',
			'.position-absolute',
			'.position-relative',
			'.top-0',
			'.end-0',
			'.bottom-0',
			'.bottom-100',
			'.h-75',
			'.h-auto',
			'.w-auto',
			'.overflow-hidden',
			'.overflow-y-auto',
			'.rounded',
			'.opacity-50',
			'.invisible',
		]);
	});

	it('keeps the rule that a utility class wins over a rule of the application: every utility carries important', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		const layerText = cssText.slice(cssText.indexOf('@layer utilities {'), cssText.indexOf('\n.form-control,'));
		expect(layerText).toMatch(/^ {2}\.invisible \{\s*visibility: hidden !important;/m);
		expect(layerText).toMatch(/^ {2}\.d-flex \{\s*display: flex !important;/m);
	});

	it('has the Bootstrap parts of the dialog, the menu, the close button, the form fields, the radio button, the switch, the popover, the tooltip, the progress bar, the alert, the list group, the spinner, the button group, and the badge', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		expect(BootstrapPartsTestHelper.compile()).toContain('.popover-arrow {');
		for (const selector of ['.dialog', '.dialog-header', '.dialog-title', '.dialog-body', '.dialog-footer', '.menu', '.menu-item', '.menu-header', '.menu-divider', '.menu-text', '.btn-close', '.form-control', '.form-label', '.form-text', '.form-field', '.form-field-content', '.radio', '.switch', '.popover', '.popover-body', '.tooltip', '.tooltip-inner', '.progress', '.progress-bar', '.alert', '.theme-success', '.theme-warning', '.theme-danger', '.list-group', '.list-group-item', '.list-group-flush', '.spinner-border', '.spinner-sm', '.btn-group', '.badge']) {
			expect(cssText).toMatch(new RegExp(`^\\s*${selector.replace('.', '\\.')}[ ,{]`, 'm'));
		}
	});

	it('does not have the Bootstrap part check, because the application already uses the class name check', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		expect(cssText).not.toMatch(/^\s*\.check[ ,{]/m);
	});

	it('gives a row of a list group no background of its own, so that the sidebar shows through in both themes', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		expect(cssText).toMatch(/\.list-group \{[^}]*--list-group-bg: transparent/);
	});

	it('gives a row of a list group under the pointer the soft hover background, so that a line or a button inside it still shows', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		expect(cssText).toMatch(/\.list-group \{[^}]*--list-group-action-hover-bg: var\(--hover-soft\)/);
	});

	it('gives a row of a list group the same background when it is pressed as when it is hovered, so that a click does not darken it', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		expect(cssText).toMatch(/\.list-group \{[^}]*--list-group-action-active-bg: var\(--hover-soft\)/);
	});

	it('has the Bootstrap part of the nav with tabs and pills, and gives the links of the nav no transition', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		for (const selector of ['.nav', '.nav-link', '.nav-tabs', '.nav-pills']) {
			expect(cssText).toMatch(new RegExp(`^\\s*${selector.replace('.', '\\.')}[ ,{]`, 'm'));
		}
		expect(cssText).not.toContain('transition-duration: var(--nav-link-transition-duration)');
	});

	it('draws the text of a tooltip with the variable --font-size, so that the font size setting reaches it', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		expect(cssText).toMatch(/\n\.tooltip \{[^}]*--tooltip-font-size: var\(--font-size\)/);
	});

	it('draws the focus ring of a field on its border, so that no dark border shows inside the ring', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		expect(cssText).toMatch(/\.form-control:focus-visible,\n\.form-control:focus-within \{[^}]*outline: 2px solid var\(--focus\);[^}]*outline-offset: -1px/);
	});

	it('draws the text of a field with the variable --font-size, so that the font size setting reaches it', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		expect(cssText).toMatch(/\.form-control,\nselect\.form-control \{[^}]*--control-font-size: var\(--font-size\)/);
	});

	it('gives the button no transition, as the application has none', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		expect(cssText).not.toContain('transition: color 0.15s');
		expect(cssText).not.toContain('transition-property: var(--btn-transition-property)');
	});

	it('uses Bootstrap menus and menu items for the application popup menus', () => {
		for (const fileName of ['MoreMenu.vue', 'ThemeMenu.vue']) {
			const source = Fs.readFileSync(Path.resolve(__dirname, 'components', fileName), 'utf8');
			expect(source).toContain('class="menu show popup-menu"');
			expect(source).toMatch(/class="menu-item [^"]*"/);
		}
	});

	it('joins the buttons that have only the class btn inside a button group, because Bootstrap 6 joins only the classes that contain btn-', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		expect(cssText).toMatch(/\.btn-group > \.btn:not\(:first-child\) \{\s*margin-inline-start: calc\(-1 \* var\(--btn-border-width\)\)/);
		expect(cssText).toMatch(/\.btn-group > \.btn:not\(:last-child\) \{\s*border-start-end-radius: 0/);
	});

	it('aligns the content of a button to the start, as Bootstrap 5 did, and not to the center as Bootstrap 6 does', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		expect(cssText).toMatch(/\n\.btn \{[^}]*justify-content: flex-start/);
	});

	it('stacks the lines of a notice one under the other, as Bootstrap 5 did, and not side by side as Bootstrap 6 does', () => {
		const cssText = BootstrapPartsTestHelper.compile();
		expect(cssText).toMatch(/\n\.alert \{[^}]*display: block/);
	});
});
