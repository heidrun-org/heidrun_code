import { describe, expect, it } from 'vitest';
import config from '../docs/.vitepress/config';
import { SiteFiles } from './site_files';

type Link = { text: string; link: string };

const themeConfig = config.themeConfig as {
	nav: Link[];
	sidebar: { text: string; items: Link[] }[];
	socialLinks: { icon: string; link: string }[];
};

describe('VitePress configuration', () => {
	it('names the site Heidrun Code', () => {
		expect(config.title).toBe('Heidrun Code');
	});

	it('has a description', () => {
		expect((config.description ?? '').length).toBeGreaterThan(20);
	});

	it('uses the GitHub Pages path of the repository as base', () => {
		expect(config.base).toBe('/heidrun_code/');
	});

	it('starts and ends the base with a slash', () => {
		expect(config.base?.startsWith('/')).toBe(true);
		expect(config.base?.endsWith('/')).toBe(true);
	});

	for (const item of themeConfig.nav) {
		it(`has a page for the navigation link "${item.text}" (${item.link})`, () => {
			expect(SiteFiles.markdownFileOfLink(item.link)).not.toBeNull();
		});
	}

	for (const group of themeConfig.sidebar) {
		for (const item of group.items) {
			it(`has a page for the sidebar link "${item.text}" (${item.link})`, () => {
				expect(SiteFiles.markdownFileOfLink(item.link)).not.toBeNull();
			});
		}
	}

	it('lists no link twice in the sidebar', () => {
		const links = themeConfig.sidebar.flatMap((group) => group.items.map((item) => item.link));
		expect(new Set(links).size).toBe(links.length);
	});

	it('links the navigation to the home page, the features, the documentation and the about page', () => {
		expect(themeConfig.nav.map((item) => item.link)).toEqual(['/', '/features/needs_you', '/documentation/', '/about']);
	});

	it('links to the GitHub repository of the organization', () => {
		expect(themeConfig.socialLinks).toContainEqual({ icon: 'github', link: 'https://github.com/heidrun-org/heidrun_code' });
	});
});
