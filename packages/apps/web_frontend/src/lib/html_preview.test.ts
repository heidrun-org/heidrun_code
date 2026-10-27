// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { HtmlPreview } from './html_preview';

describe('HtmlPreview.isHtml', () => {
	it('accepts the extensions html and htm in any case', () => {
		expect(HtmlPreview.isHtml('reports/index.html')).toBe(true);
		expect(HtmlPreview.isHtml('REPORT.HTM')).toBe(true);
	});

	it('refuses other files and null', () => {
		expect(HtmlPreview.isHtml('README.md')).toBe(false);
		expect(HtmlPreview.isHtml('page.html.txt')).toBe(false);
		expect(HtmlPreview.isHtml('page.xhtml')).toBe(false);
		expect(HtmlPreview.isHtml(null)).toBe(false);
	});
});

describe('HtmlPreview.fileAddress', () => {
	const PROJECT_ADDRESS = 'http://127.0.0.1:52000/0123456789abcdef0123456789abcdef/';

	it('adds the path to the address of the project folder, with each folder encoded', () => {
		expect(HtmlPreview.fileAddress(PROJECT_ADDRESS, 'reports/a b/index.html')).toBe(
			'http://127.0.0.1:52000/0123456789abcdef0123456789abcdef/reports/a%20b/index.html',
		);
	});

	it('keeps a relative address of the page under the secret key', () => {
		const address = HtmlPreview.fileAddress(PROJECT_ADDRESS, 'reports/index.html');
		expect(new URL('assets/chart.js', address).href).toBe(
			'http://127.0.0.1:52000/0123456789abcdef0123456789abcdef/reports/assets/chart.js',
		);
		expect(new URL('../../../outside.html', address).href).toBe('http://127.0.0.1:52000/outside.html');
	});
});

describe('HtmlPreview.openUrlOf', () => {
	it('gives the web site of a click on a link', () => {
		expect(
			HtmlPreview.openUrlOf({
				type: 'heidrun-html-preview-open-url',
				url: 'https://example.com/page',
			}),
		).toBe('https://example.com/page');
	});

	it('refuses another message, another address scheme, and a value that is not an object', () => {
		expect(
			HtmlPreview.openUrlOf({
				type: 'other',
				url: 'https://example.com',
			}),
		).toBeNull();
		expect(
			HtmlPreview.openUrlOf({
				type: 'heidrun-html-preview-open-url',
				url: 'file:///etc/hosts',
			}),
		).toBeNull();
		expect(HtmlPreview.openUrlOf('https://example.com')).toBeNull();
		expect(HtmlPreview.openUrlOf(null)).toBeNull();
	});
});
