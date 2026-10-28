import ChildProcess from 'node:child_process';
import Fs from 'node:fs';
import Os from 'node:os';
import Path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LinkPreviewCards } from '../docs/.vitepress/link_preview_cards';
import { BuiltPage } from './built_page';
import { SiteFiles } from './site_files';

const outDir = Fs.mkdtempSync(Path.join(Os.tmpdir(), 'heidrun-site-'));
const packageDir = Path.resolve(SiteFiles.docsDir, '..');
const siteAddress = 'https://heidrun-org.github.io/heidrun_code/';

/** The Open Graph tags that every page must have. */
const openGraphProperties = [
	'og:type',
	'og:site_name',
	'og:locale',
	'og:url',
	'og:title',
	'og:description',
	'og:image',
	'og:image:type',
	'og:image:width',
	'og:image:height',
	'og:image:alt',
];

/** The X card tags that every page must have. */
const xCardNames = [
	'twitter:card',
	'twitter:title',
	'twitter:description',
	'twitter:image',
	'twitter:image:alt',
];

describe('website build', () => {
	beforeAll(() => {
		ChildProcess.execFileSync('pnpm', ['exec', 'vitepress', 'build', 'docs', '--outDir', outDir], {
			cwd: packageDir,
			stdio: 'pipe',
		});
	});

	afterAll(() => {
		Fs.rmSync(outDir, { recursive: true, force: true });
	});

	it('writes a page for every Markdown source', () => {
		for (const page of ['index.html', 'about.html', 'documentation/index.html', 'documentation/shortcuts.html']) {
			expect(Fs.existsSync(Path.join(outDir, page)), page).toBe(true);
		}
	});

	it('writes a page for every feature page', () => {
		for (const name of ['needs_you', 'panes', 'quotas', 'phone_access', 'sidebar_sections', 'past_chats', 'statistics', 'ai']) {
			expect(Fs.existsSync(Path.join(outDir, 'features', `${name}.html`)), name).toBe(true);
		}
	});

	it('links the home page to every feature page, with the base path', () => {
		const html = Fs.readFileSync(Path.join(outDir, 'index.html'), 'utf8');
		for (const name of ['needs_you', 'panes', 'quotas', 'phone_access', 'sidebar_sections', 'past_chats', 'statistics', 'ai']) {
			expect(html, name).toContain(`href="/heidrun_code/features/${name}`);
		}
	});

	it('uses the base path in the links to the assets', () => {
		const html = Fs.readFileSync(Path.join(outDir, 'index.html'), 'utf8');
		expect(html).toContain('/heidrun_code/assets/');
	});

	it('puts the title of the site in the home page', () => {
		const html = Fs.readFileSync(Path.join(outDir, 'index.html'), 'utf8');
		expect(html).toMatch(/<title>Heidrun/);
	});

	it('puts the title, the motto, and the description of data/identity.json in the home page', () => {
		const identity = JSON.parse(Fs.readFileSync(Path.join(SiteFiles.repositoryDir, 'data/identity.json'), 'utf8'));
		const html = Fs.readFileSync(Path.join(outDir, 'index.html'), 'utf8');
		expect(html).toContain(identity.motto.en);
		expect(html).toContain(identity.description.en);
	});

	it('puts the Flux Lines background in the home page only', () => {
		const home = Fs.readFileSync(Path.join(outDir, 'index.html'), 'utf8');
		expect(home).toContain('home-flux-lines');
		expect(home).toContain('aria-hidden="true"');
		for (const page of ['about.html', 'documentation/index.html', 'documentation/shortcuts.html']) {
			const html = Fs.readFileSync(Path.join(outDir, page), 'utf8');
			expect(html, page).not.toContain('flux-lines');
		}
	});

	it('puts every section of the homepage in the home page', () => {
		const html = Fs.readFileSync(Path.join(outDir, 'index.html'), 'utf8');
		const ids = [
			'the-problem',
			'welcome-to-valhalla',
			'know-which-one-needs-you',
			'real-terminals',
			'watch-the-mead-level',
			'valhalla-fits-in-a-pocket',
			'the-whole-longhouse',
			'board-the-longship',
			'built-by-the-herd',
			'who-is-heidrun',
			'skal',
		];
		for (const id of ids) {
			expect(html, id).toContain(`id="${id}"`);
		}
	});

	it('copies the screenshots of the homepage', () => {
		for (const name of ['window.png', 'needs_you.png', 'panes.png', 'quotas.png']) {
			expect(Fs.existsSync(Path.join(outDir, 'screenshots', name)), name).toBe(true);
		}
	});

	it('copies the splash image', () => {
		expect(Fs.existsSync(Path.join(outDir, 'heidrun_splash_screen.png'))).toBe(true);
	});

	it('copies the favicon', () => {
		expect(Fs.existsSync(Path.join(outDir, 'favicon.svg'))).toBe(true);
	});

	it('links the favicon in every page', () => {
		const pages = Fs.readdirSync(outDir, { recursive: true, encoding: 'utf8' })
			.filter((file) => file.endsWith('.html') === true);
		expect(pages.length).toBeGreaterThanOrEqual(5);
		for (const page of pages) {
			const html = Fs.readFileSync(Path.join(outDir, page), 'utf8');
			expect(html, page).toContain('<link rel="icon" type="image/svg+xml" href="/heidrun_code/favicon.svg">');
		}
	});

	it('renders the shortcuts table', () => {
		const html = Fs.readFileSync(Path.join(outDir, 'documentation/shortcuts.html'), 'utf8');
		expect(html).toContain('<table');
		expect(html).toContain('Command palette');
	});

	it('writes the text of the about page', () => {
		const html = Fs.readFileSync(Path.join(outDir, 'about.html'), 'utf8');
		expect(html).toContain('Who is Heiðrún?');
	});

	it('copies the card image of the link previews', () => {
		expect(Fs.existsSync(Path.join(outDir, LinkPreviewCards.imageFileName))).toBe(true);
	});

	it('puts every Open Graph tag, every X card tag, the theme color, and the canonical address in every page', () => {
		const pages = Fs.readdirSync(outDir, { recursive: true, encoding: 'utf8' })
			.filter((file) => file.endsWith('.html') === true);
		expect(pages.length).toBeGreaterThanOrEqual(5);
		for (const page of pages) {
			const html = Fs.readFileSync(Path.join(outDir, page), 'utf8');
			for (const property of openGraphProperties) {
				expect(BuiltPage.metaContent(html, 'property', property), `${page} ${property}`).not.toBeNull();
			}
			for (const name of xCardNames) {
				expect(BuiltPage.metaContent(html, 'name', name), `${page} ${name}`).not.toBeNull();
			}
			expect(BuiltPage.metaContent(html, 'name', 'twitter:card'), `${page} twitter:card`).toBe('summary_large_image');
			expect(BuiltPage.metaContent(html, 'name', 'theme-color'), `${page} theme-color`).toBe('#f2a93b');
			expect(BuiltPage.canonical(html), `${page} canonical`).not.toBeNull();
		}
	});

	it('gives every card image an absolute address under the address of the website, with the size of the file', () => {
		const pages = Fs.readdirSync(outDir, { recursive: true, encoding: 'utf8' })
			.filter((file) => file.endsWith('.html') === true);
		const expected = `${siteAddress}${LinkPreviewCards.imageFileName}`;
		for (const page of pages) {
			const html = Fs.readFileSync(Path.join(outDir, page), 'utf8');
			expect(BuiltPage.metaContent(html, 'property', 'og:image'), page).toBe(expected);
			expect(BuiltPage.metaContent(html, 'name', 'twitter:image'), page).toBe(expected);
			expect(BuiltPage.metaContent(html, 'property', 'og:image:width'), page).toBe('1200');
			expect(BuiltPage.metaContent(html, 'property', 'og:image:height'), page).toBe('630');
		}
	});

	it('makes the address of each card equal to the canonical address of its page, under the address of the website', () => {
		const pages = Fs.readdirSync(outDir, { recursive: true, encoding: 'utf8' })
			.filter((file) => file.endsWith('.html') === true);
		for (const page of pages) {
			const html = Fs.readFileSync(Path.join(outDir, page), 'utf8');
			const address = BuiltPage.metaContent(html, 'property', 'og:url');
			expect(address, page).toBe(BuiltPage.canonical(html));
			expect(address?.startsWith(siteAddress), page).toBe(true);
		}
	});

	it('makes the title of each card, and its X title, equal to the title of its page', () => {
		const pages = Fs.readdirSync(outDir, { recursive: true, encoding: 'utf8' })
			.filter((file) => file.endsWith('.html') === true);
		for (const page of pages) {
			const html = Fs.readFileSync(Path.join(outDir, page), 'utf8');
			expect(BuiltPage.metaContent(html, 'property', 'og:title'), page).toBe(BuiltPage.title(html));
			expect(BuiltPage.metaContent(html, 'name', 'twitter:title'), page).toBe(BuiltPage.title(html));
		}
	});

	it('takes the card of the home page from data/identity.json', () => {
		const identity = JSON.parse(Fs.readFileSync(Path.join(SiteFiles.repositoryDir, 'data/identity.json'), 'utf8'));
		const html = Fs.readFileSync(Path.join(outDir, 'index.html'), 'utf8');
		expect(BuiltPage.metaContent(html, 'property', 'og:site_name')).toBe(identity.title);
		expect(BuiltPage.metaContent(html, 'property', 'og:title')).toBe(identity.title);
		expect(BuiltPage.metaContent(html, 'property', 'og:description')).toBe(identity.description.en);
		expect(BuiltPage.metaContent(html, 'name', 'twitter:description')).toBe(identity.description.en);
		expect(BuiltPage.metaContent(html, 'property', 'og:url')).toBe(siteAddress);
	});

	it('gives each feature page and the about page its own card title, card description, and card address', () => {
		const home = Fs.readFileSync(Path.join(outDir, 'index.html'), 'utf8');
		const homeTitle = BuiltPage.metaContent(home, 'property', 'og:title');
		const homeDescription = BuiltPage.metaContent(home, 'property', 'og:description');
		const featureNames = ['needs_you', 'panes', 'quotas', 'phone_access', 'sidebar_sections', 'past_chats', 'statistics', 'ai'];
		const pagePaths = [...featureNames.map((name) => `features/${name}.html`), 'about.html'];
		const addresses = new Set<string>();
		for (const page of pagePaths) {
			const html = Fs.readFileSync(Path.join(outDir, page), 'utf8');
			const address = BuiltPage.metaContent(html, 'property', 'og:url');
			expect(address, page).toBe(`${siteAddress}${page}`);
			expect(BuiltPage.metaContent(html, 'property', 'og:title'), page).not.toBe(homeTitle);
			expect(BuiltPage.metaContent(html, 'property', 'og:description'), page).not.toBe(homeDescription);
			addresses.add(address as string);
		}
		expect(addresses.size).toBe(pagePaths.length);
	});

	it('writes a page for an address that does not exist', () => {
		expect(Fs.existsSync(Path.join(outDir, '404.html'))).toBe(true);
	});
});
