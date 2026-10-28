import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../docs/.vitepress/config';
import * as HomeContent from '../docs/.vitepress/theme/home/home_content';
import { SiteFiles } from './site_files';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** A link of the navigation or of the sidebar of the website. */
type Link = {
	/** The text of the link. */
	text: string;
	/** The path of the page. */
	link: string;
};

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Helpers
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Reads a feature page for the tests. */
class FeaturePageReader {
	/**
	 * Gives the lines of the text of a page that are not empty, without the frontmatter.
	 * @param text - The Markdown text of the page.
	 * @returns The lines that hold a character other than a space, after the frontmatter.
	 */
	static nonEmptyLines(text: string): string[] {
		return FeaturePageReader.withoutFrontmatter(text).split('\n').filter((line) => line.trim() !== '');
	}

	/**
	 * Gives the description that the frontmatter of a page holds.
	 * @param text - The Markdown text of the page.
	 * @returns The description with no quotes, or null when the page has none.
	 */
	static description(text: string): string | null {
		const match = text.match(/^---\n(?:[^\n]*\n)*?description: "([^"\n]*)"\n(?:[^\n]*\n)*?---\n/);
		return match === null ? null : match[1];
	}

	/**
	 * Removes the frontmatter block at the start of a page.
	 * @param text - The Markdown text of the page.
	 * @returns The text after the closing line of the frontmatter, or the whole text when the page has no frontmatter.
	 */
	static withoutFrontmatter(text: string): string {
		return text.replace(/^---\n[\s\S]*?\n---\n/, '');
	}

	/**
	 * Tells whether a line is a joke: one whole paragraph in italics.
	 * @param line - One line of the Markdown text.
	 * @returns True when the line starts and ends with one asterisk.
	 */
	static isJoke(line: string): boolean {
		return /^\*[^*].*[^*]\*$/.test(line.trim());
	}

	/**
	 * Gives the text that a reader sees, without the code spans and the addresses of the links.
	 * @param text - The Markdown text of the page.
	 * @returns The text without `code`, and with each link replaced by its label.
	 */
	static readableText(text: string): string {
		return text.replace(/`[^`]*`/g, '').replace(/\]\([^)]*\)/g, ']');
	}
}

const themeConfig = config.themeConfig as {
	nav: Link[];
	sidebar: { text: string; items: Link[] }[];
};

const EXPECTED_PAGES: Link[] = [
	{
		text: 'The Needs you sidebar section',
		link: '/features/needs_you',
	},
	{
		text: 'The panes',
		link: '/features/panes',
	},
	{
		text: 'The quotas and the usage wheel',
		link: '/features/quotas',
	},
	{
		text: 'The phone access',
		link: '/features/phone_access',
	},
	{
		text: 'The sidebar sections',
		link: '/features/sidebar_sections',
	},
	{
		text: 'The Past chats sidebar section',
		link: '/features/past_chats',
	},
	{
		text: 'The Statistics window',
		link: '/features/statistics',
	},
	{
		text: 'The use of AI',
		link: '/features/ai',
	},
];

const homepageLinks = [
	...HomeContent.FEATURES.map((feature) => feature.readMore.href),
	...HomeContent.LONGHOUSE.groups.flatMap((group) => group.items.flatMap((item) => (item.href === undefined ? [] : [item.href]))),
	HomeContent.LONGHOUSE.aiLink.href,
];

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

describe('menu of the feature pages', () => {
	it('has a navigation link "Features" to the first feature page', () => {
		expect(themeConfig.nav).toContainEqual({
			text: 'Features',
			link: '/features/needs_you',
		});
	});

	it('lists the eight feature pages of issue 517 in the sidebar, in order', () => {
		const group = themeConfig.sidebar.find((item) => item.text === 'Features');
		expect(group?.items).toEqual(EXPECTED_PAGES);
	});

	it('has no other page in the folder docs/features', () => {
		const names = Fs.readdirSync(Path.join(SiteFiles.docsDir, 'features')).sort();
		const expected = EXPECTED_PAGES.map((page) => `${Path.basename(page.link)}.md`).sort();
		expect(names).toEqual(expected);
	});
});

describe('links of the homepage to the feature pages', () => {
	for (const page of EXPECTED_PAGES) {
		it(`links to "${page.text}"`, () => {
			expect(homepageLinks).toContain(page.link);
		});
	}

	it('links the four feature sections to the page of their feature', () => {
		expect(HomeContent.FEATURES.map((feature) => feature.readMore.href)).toEqual([
			'/features/needs_you',
			'/features/panes',
			'/features/quotas',
			'/features/phone_access',
		]);
	});

	it('links only to pages that exist', () => {
		for (const link of homepageLinks) {
			expect(SiteFiles.markdownFileOfLink(link), link).not.toBeNull();
		}
	});
});

describe('captures of the feature pages', () => {
	it('has no capture in the folder docs/public/screenshots/features that no page shows', () => {
		const folder = Path.join(SiteFiles.docsDir, 'public/screenshots/features');
		const texts = EXPECTED_PAGES.map((page) => Fs.readFileSync(SiteFiles.markdownFileOfLink(page.link) ?? '', 'utf8')).join('\n');
		for (const name of Fs.readdirSync(folder)) {
			expect(texts, name).toContain(`/screenshots/features/${name}`);
		}
	});
});

describe('feature pages', () => {
	for (const page of EXPECTED_PAGES) {
		const filePath = SiteFiles.markdownFileOfLink(page.link) ?? '';
		const text = filePath === '' ? '' : Fs.readFileSync(filePath, 'utf8');
		const lines = FeaturePageReader.nonEmptyLines(text);

		describe(page.link, () => {
			it('exists', () => {
				expect(filePath).not.toBe('');
			});

			it('has the title of its link in the sidebar', () => {
				expect(lines[0]).toBe(`# ${page.text}`);
			});

			it('has one sentence of description in its frontmatter, for the link preview card', () => {
				const description = FeaturePageReader.description(text);
				expect(description).not.toBeNull();
				expect(description?.length).toBeGreaterThanOrEqual(40);
				expect(description?.length).toBeLessThanOrEqual(200);
				expect(description?.endsWith('.')).toBe(true);
			});

			it('first says what Heidrun Code does, then ends with exactly one joke', () => {
				const jokes = lines.filter((line) => FeaturePageReader.isJoke(line));
				expect(jokes).toHaveLength(1);
				expect(FeaturePageReader.isJoke(lines[lines.length - 1])).toBe(true);
				expect(lines.length).toBeGreaterThan(5);
			});

			it('writes "coding agent" in full, never "agent" alone', () => {
				const readable = FeaturePageReader.readableText(text);
				expect(readable).not.toMatch(/(?<!coding )\bagents?\b/i);
			});

			it('never writes "section" alone for a part of a sidebar', () => {
				const readable = FeaturePageReader.readableText(text);
				expect(readable).not.toMatch(/\b(Files|Notes|Scripts|Chats|Git) sidebar section\b/);
				expect(readable).not.toMatch(/\b(Needs you|Clipboard|Launchers|Source control|Code hosting|File explorer|Past chats) section\b/i);
			});

			it('never names a part that the application does not have', () => {
				expect(text).not.toMatch(/inspector/i);
			});

			it('shows at least one real capture, except the page about the use of AI', () => {
				const images = [...text.matchAll(/!\[[^\]]{30,}\]\(\/screenshots\/[^)\s]+\.png\)/g)];
				expect(images.length).toBeGreaterThanOrEqual(page.link === '/features/ai' ? 0 : 1);
			});

			it('shows only images that exist in the folder docs/public', () => {
				const images = [...text.matchAll(/!\[[^\]]+\]\((\/[^)\s]+)\)/g)].map((match) => match[1]);
				for (const image of images) {
					expect(Fs.existsSync(Path.join(SiteFiles.docsDir, 'public', image)), image).toBe(true);
				}
			});
		});
	}
});
