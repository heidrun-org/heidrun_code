import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SiteFiles } from './site_files';

const pages = SiteFiles.listPages();

describe('website pages', () => {
	it('finds the twelve expected pages', () => {
		const names = pages.map((page) => Path.relative(SiteFiles.docsDir, page)).sort();
		expect(names).toEqual([
			'about.md',
			'documentation/index.md',
			'documentation/shortcuts.md',
			'features/ai.md',
			'features/needs_you.md',
			'features/panes.md',
			'features/past_chats.md',
			'features/phone_access.md',
			'features/quotas.md',
			'features/sidebar_sections.md',
			'features/statistics.md',
			'index.md',
		]);
	});

	for (const page of pages) {
		const name = Path.relative(SiteFiles.docsDir, page);
		const text = Fs.readFileSync(page, 'utf8');

		describe(name, () => {
			it('is not empty', () => {
				expect(text.trim().length).toBeGreaterThan(0);
			});

			it('has a title (a heading of level one, or a home hero)', () => {
				expect(/^# \S/m.test(text) || /^hero:/m.test(text)).toBe(true);
			});

			it('has at most one heading of level one', () => {
				const headings = text.split('\n').filter((line) => /^# \S/.test(line));
				expect(headings.length).toBeLessThanOrEqual(1);
			});

			it('has no relative link to a missing page', () => {
				const links = [...text.matchAll(/(?<!!)\[[^\]]*\]\((\/[^)\s]*)\)/g)].map((match) => match[1]);
				for (const link of links) {
					expect(SiteFiles.markdownFileOfLink(link), link).not.toBeNull();
				}
			});

			it('has no tab character in the text', () => {
				expect(text.includes('\t')).toBe(false);
			});

			it('has no leftover merge marker', () => {
				expect(/^(<<<<<<<|>>>>>>>)/m.test(text)).toBe(false);
			});
		});
	}
});

describe('home page', () => {
	const home = Fs.readFileSync(Path.join(SiteFiles.docsDir, 'index.md'), 'utf8');

	it('uses the home layout', () => {
		expect(home).toMatch(/^layout: home$/m);
	});

	it('has a call to action to the latest release, one to the repository, and one to the about page', () => {
		expect(home).toContain('link: https://github.com/heidrun-org/heidrun_code/releases/latest');
		expect(home).toContain('link: https://github.com/heidrun-org/heidrun_code\n');
		expect(home).toContain('link: /about');
	});

	it('shows the eleven sections under the hero, in the order of issue 509', () => {
		const sections = [...home.matchAll(/^<(Home\w+)(?: section-id="([\w-]+)")? \/>$/gm)]
			.map((match) => (match[2] === undefined ? match[1] : `${match[1]} ${match[2]}`));
		expect(sections).toEqual([
			'HomeProblem',
			'HomeValhalla',
			'HomeFeature know-which-one-needs-you',
			'HomeFeature real-terminals',
			'HomeFeature watch-the-mead-level',
			'HomeFeature valhalla-fits-in-a-pocket',
			'HomeLonghouse',
			'HomeQuickStart',
			'HomeOpenSource',
			'HomeMythology',
			'HomeSkal',
		]);
	});

	it('has no list of features, which the section "The whole longhouse in one window" replaces', () => {
		expect(home).not.toMatch(/^features:/m);
	});

	it('names the splash image that exists in the public folder', () => {
		expect(Fs.existsSync(Path.join(SiteFiles.docsDir, 'public/heidrun_splash_screen.png'))).toBe(true);
	});
});

describe('about page', () => {
	const about = Fs.readFileSync(Path.join(SiteFiles.docsDir, 'about.md'), 'utf8');

	it('explains who Heiðrún is and why the application has this name', () => {
		expect(about).toContain('## Who is Heiðrún?');
		expect(about).toContain('## Why this name?');
	});

	it('links to a source for the myth', () => {
		expect(about).toMatch(/\]\(https:\/\/en\.wikipedia\.org\/wiki\//);
	});

	it('shows the video that explains how to pronounce Heiðrún', () => {
		expect(about).toContain('## How to pronounce Heiðrún?');
		expect(about).toContain('<YoutubeVideo video-id="NTIw_H7UUsU"');
	});
});
