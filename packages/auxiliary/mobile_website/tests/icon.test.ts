import { describe, expect, it } from 'vitest';
import { AppHarness } from './app_harness';
import { Fixtures } from './fixtures';
import { Icon } from '../src/components/icon';
import type { IconName } from '../src/components/icon';

const iconNames: IconName[] = [
	'arrow-clockwise',
	'bell',
	'gear',
	'chevron-left',
	'grid',
	'heidrun-goat-only',
	'lightning-charge',
	'play',
	'send-fill',
	'stop-fill',
	'view-stacked',
];

describe('Icons', () => {

	it.each([
		['dashboard', 'Dashboard'],
		['needs-you', 'Needs you'],
		['panes', 'Panes'],
		['launchers', 'Launchers'],
	])('shows the Heidrun Code branding icon before the title on %s', async (screen, title) => {
		await AppHarness.start(Fixtures.computer(), true, `#/${screen}`);
		const header = document.querySelector('header');
		const branding = header?.firstElementChild;
		expect(branding?.getAttribute('aria-label')).toBe('Heidrun Code');
		expect(branding?.getAttribute('role')).toBe('img');
		const icon = branding?.querySelector('svg.bi-heidrun-goat-only');
		expect(icon?.getAttribute('width')).toBe('24');
		expect(icon?.getAttribute('height')).toBe('24');
		expect(icon?.getAttribute('viewBox')).toBe('0 0 16 16');
		expect(branding?.nextElementSibling?.textContent).toBe(title);
		expect(header?.querySelector('[aria-label="Connected"]')).not.toBeNull();
	});

	it('draws each icon with the size asked, the surrounding text color, and hidden from screen readers', () => {
		for (const name of iconNames) {
			const iconHtmlContent = Icon.render(name, 22);
			expect(iconHtmlContent.startsWith('<svg'), name).toBe(true);
			expect(iconHtmlContent, name).toContain(`class="bi bi-${name}"`);
			expect(iconHtmlContent, name).toContain('width="22" height="22" aria-hidden="true"');
			expect(iconHtmlContent, name).toContain('fill="currentColor"');
		}
	});

	it('uses Bootstrap Icons in the bottom bar, in the header of a pane, and in the prompt line', async () => {
		const harness = await AppHarness.start(Fixtures.computer());
		const barIcons = [...document.querySelectorAll('.bottom-bar .bar-button svg.bi')];
		expect(barIcons.map((icon) => icon.getAttribute('class'))).toEqual([
			'bi bi-grid',
			'bi bi-bell',
			'bi bi-view-stacked',
			'bi bi-play',
		]);
		await harness.openPane('p-working');
		expect(document.querySelector('.back svg.bi-chevron-left')).not.toBeNull();
		expect(document.querySelector('.icon-button svg.bi-arrow-clockwise')).not.toBeNull();
		expect(document.querySelector('[data-action="open-macros"] svg.bi-lightning-charge')).not.toBeNull();
		expect(document.querySelector('.send-button svg.bi-send-fill')).not.toBeNull();
		expect(document.querySelector('.stop-button svg.bi-stop-fill')).not.toBeNull();
	});

	it('keeps every icon of the page in the class Icon, and draws no icon by hand', async () => {
		const harness = await AppHarness.start(Fixtures.computer());
		await harness.openPane('p-working');
		const svgs = [...document.querySelectorAll('svg')];
		const handDrawn = svgs.filter((svg) => svg.classList.contains('bi') === false);
		expect(handDrawn).toEqual([]);
	});
});
