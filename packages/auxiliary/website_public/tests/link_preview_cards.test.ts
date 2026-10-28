import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LinkPreviewCards } from '../docs/.vitepress/link_preview_cards';
import { SiteFiles } from './site_files';

const siteAddress = 'https://heidrun-org.github.io/heidrun_code/';
const cardImagePath = Path.join(SiteFiles.docsDir, 'public', LinkPreviewCards.imageFileName);

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	The tags
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

describe('link preview card tags', () => {
	it('give the address of the index page as the address of its folder', () => {
		expect(LinkPreviewCards.pageAddress(siteAddress, 'index.md')).toBe(siteAddress);
		expect(LinkPreviewCards.pageAddress(siteAddress, 'documentation/index.md')).toBe(`${siteAddress}documentation/`);
	});

	it('give the address of any other page with the extension .html', () => {
		expect(LinkPreviewCards.pageAddress(siteAddress, 'about.md')).toBe(`${siteAddress}about.html`);
		expect(LinkPreviewCards.pageAddress(siteAddress, 'features/panes.md')).toBe(`${siteAddress}features/panes.html`);
	});

	it('share the image tags with an absolute address', () => {
		const tags = LinkPreviewCards.sharedTags(siteAddress);
		expect(tags).toContainEqual(['meta', {
			property: 'og:image',
			content: `${siteAddress}${LinkPreviewCards.imageFileName}`,
		}]);
		expect(tags).toContainEqual(['meta', {
			name: 'twitter:image',
			content: `${siteAddress}${LinkPreviewCards.imageFileName}`,
		}]);
	});

	it('share the mead color as the theme color', () => {
		expect(LinkPreviewCards.sharedTags(siteAddress)).toContainEqual(['meta', {
			name: 'theme-color',
			content: '#f2a93b',
		}]);
	});

	it('give the page its own title, description, and address', () => {
		const tags = LinkPreviewCards.pageTags({
			siteAddress,
			title: 'The panes | Heidrun Code',
			description: 'A sentence about the panes.',
			relativePath: 'features/panes.md',
		});
		expect(tags).toContainEqual(['link', {
			rel: 'canonical',
			href: `${siteAddress}features/panes.html`,
		}]);
		expect(tags).toContainEqual(['meta', {
			property: 'og:url',
			content: `${siteAddress}features/panes.html`,
		}]);
		expect(tags).toContainEqual(['meta', {
			property: 'og:title',
			content: 'The panes | Heidrun Code',
		}]);
		expect(tags).toContainEqual(['meta', {
			property: 'og:description',
			content: 'A sentence about the panes.',
		}]);
		expect(tags).toContainEqual(['meta', {
			name: 'twitter:title',
			content: 'The panes | Heidrun Code',
		}]);
		expect(tags).toContainEqual(['meta', {
			name: 'twitter:description',
			content: 'A sentence about the panes.',
		}]);
	});
});

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	The image
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

describe('link preview card image', () => {
	it('is a PNG file', () => {
		const signature = Fs.readFileSync(cardImagePath).subarray(0, 8);
		expect([...signature]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
	});

	it('is 1200 pixels wide and 630 pixels high', () => {
		const header = Fs.readFileSync(cardImagePath);
		expect(header.readUInt32BE(16)).toBe(1200);
		expect(header.readUInt32BE(20)).toBe(630);
		expect(LinkPreviewCards.imageWidth).toBe(1200);
		expect(LinkPreviewCards.imageHeight).toBe(630);
	});

	it('is smaller than 300000 bytes, because WhatsApp drops a larger image', () => {
		expect(Fs.statSync(cardImagePath).size).toBeLessThan(300_000);
	});
});
