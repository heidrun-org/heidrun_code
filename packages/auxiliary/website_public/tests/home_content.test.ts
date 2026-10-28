import Fs from 'node:fs';
import Path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as HomeContent from '../docs/.vitepress/theme/home/home_content';
import { SiteFiles } from './site_files';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Helpers
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Reads the texts and the paths of the homepage for the tests. */
class HomeContentReader {
	/**
	 * Collects every string of a value, at every depth.
	 * @param value - A string, an array, or an object of the content of the homepage.
	 * @returns Every string found in the value.
	 */
	static collectStrings(value: unknown): string[] {
		if (typeof value === 'string') {
			return [value];
		}
		if (Array.isArray(value) === true) {
			return (value as unknown[]).flatMap((item) => HomeContentReader.collectStrings(item));
		}
		if (typeof value === 'object' && value !== null) {
			return Object.values(value).flatMap((item) => HomeContentReader.collectStrings(item));
		}
		return [];
	}

	/**
	 * Reads the width and the height of a PNG file from its header.
	 * @param filePath - The absolute path of the PNG file.
	 * @returns The width and the height in pixels.
	 */
	static pngSize(filePath: string): { width: number; height: number } {
		const header = Fs.readFileSync(filePath).subarray(0, 24);
		return {
			width: header.readUInt32BE(16),
			height: header.readUInt32BE(20),
		};
	}
}

const allTexts = HomeContentReader.collectStrings(HomeContent);
const screenshots = [
	HomeContent.VALHALLA.screenshot,
	...HomeContent.FEATURES.flatMap((feature) => (feature.screenshot === undefined ? [] : [feature.screenshot])),
];

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Tests
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

describe('content of the homepage', () => {
	it('writes "coding agent" in full, never "agent" alone', () => {
		const sentences = allTexts.filter((text) => text.startsWith('https://') === false);
		for (const text of sentences) {
			expect(text, text).not.toMatch(/(?<!coding )\bagents?\b/i);
			expect(text, text).not.toMatch(/\bAI agents?\b/i);
		}
	});

	it('never names the inspector, which the application does not have', () => {
		for (const text of allTexts) {
			expect(text, text).not.toMatch(/inspector/i);
		}
	});

	it('never writes the motto or the description by hand, which come from data/identity.json', () => {
		const identity = JSON.parse(Fs.readFileSync(Path.join(SiteFiles.repositoryDir, 'data/identity.json'), 'utf8'));
		for (const text of allTexts) {
			expect(text).not.toContain(identity.motto.en);
			expect(text).not.toContain(identity.description.en);
		}
	});

	it('gives every section with a joke an explanation first', () => {
		const sections = [
			HomeContent.PROBLEM,
			HomeContent.VALHALLA,
			...HomeContent.FEATURES,
			HomeContent.LONGHOUSE,
			HomeContent.MYTHOLOGY,
		];
		for (const section of sections) {
			expect(section.paragraphs.length, section.id).toBeGreaterThan(0);
			expect(section.joke.length, section.id).toBeGreaterThan(0);
		}
	});

	it('gives every section a different identifier', () => {
		const ids = [
			HomeContent.PROBLEM.id,
			HomeContent.VALHALLA.id,
			...HomeContent.FEATURES.map((feature) => feature.id),
			HomeContent.LONGHOUSE.id,
			HomeContent.QUICK_START.id,
			HomeContent.OPEN_SOURCE.id,
			HomeContent.MYTHOLOGY.id,
			HomeContent.SKAL.id,
		];
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('shows five terminals in the illustration of the problem, one per title', () => {
		const titles = HomeContent.PROBLEM.terminals.map((terminal) => terminal.title);
		expect(titles).toHaveLength(5);
		expect(new Set(titles).size).toBe(5);
	});

	it('keeps each outline of the window inside the screenshot', () => {
		for (const part of HomeContent.VALHALLA.parts) {
			expect(part.box.left + part.box.width, part.name).toBeLessThanOrEqual(100);
			expect(part.box.top + part.box.height, part.name).toBeLessThanOrEqual(100);
		}
	});

	it('links to the latest release, the repository, and the issues of GitHub', () => {
		expect(HomeContent.DOWNLOAD_URL).toBe('https://github.com/heidrun-org/heidrun_code/releases/latest');
		expect(HomeContent.REPOSITORY_URL).toBe('https://github.com/heidrun-org/heidrun_code');
		expect(HomeContent.ISSUES_URL).toBe('https://github.com/heidrun-org/heidrun_code/issues');
	});

	it('links to a page of the website that exists', () => {
		expect(SiteFiles.markdownFileOfLink(HomeContent.MYTHOLOGY.aboutLink.href)).not.toBeNull();
	});
});

describe('screenshots of the homepage', () => {
	for (const screenshot of screenshots) {
		const filePath = Path.join(SiteFiles.docsDir, 'public', screenshot.src);

		describe(screenshot.src, () => {
			it('exists in the folder docs/public', () => {
				expect(Fs.existsSync(filePath)).toBe(true);
			});

			it('has the width and the height that the content gives', () => {
				expect(HomeContentReader.pngSize(filePath)).toEqual({
					width: screenshot.width,
					height: screenshot.height,
				});
			});

			it('is described for screen readers', () => {
				expect(screenshot.alt.length).toBeGreaterThan(30);
			});
		});
	}
});
