// @vitest-environment node
import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = import.meta.dirname;
const packageDir = Path.join(__dirname, '..');
const indexText = Fs.readFileSync(Path.join(packageDir, 'index.html'), 'utf8');

describe('Head of the page', () => {
	it('names the page "Heidrun Code Mobile"', () => {
		expect(indexText).toContain('<title>Heidrun Code Mobile</title>');
	});

	it('links the favicon from the root of the website', () => {
		expect(indexText).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg">');
	});

	it('has the same favicon as the application', () => {
		const pageFavicon = Fs.readFileSync(Path.join(packageDir, 'public/favicon.svg'), 'utf8');
		const applicationFaviconPath = Path.join(packageDir, '../../../data/images/heidrun_favicon.svg');
		const applicationFavicon = Fs.readFileSync(applicationFaviconPath, 'utf8');
		expect(pageFavicon).toBe(applicationFavicon);
		expect(pageFavicon).toContain('viewBox="0 0 64 64"');
	});
});
