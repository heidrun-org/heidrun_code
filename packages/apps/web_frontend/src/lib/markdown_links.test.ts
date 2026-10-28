// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { MarkdownLinks } from './markdown_links';

const FILE = '/work/project/docs/rules/index.md';
const ROOT = '/work/project';

describe('MarkdownLinks.resolve (issue #928)', () => {
	it('opens a web address in the browser', () => {
		expect(MarkdownLinks.resolve('https://example.com/a#b', FILE, ROOT)).toEqual({
			kind: 'web',
			url: 'https://example.com/a#b',
		});
	});

	it('gives a heading of the same file for a link that is only an anchor', () => {
		expect(MarkdownLinks.resolve('#the-rules', FILE, ROOT)).toEqual({
			kind: 'heading',
			anchor: 'the-rules',
		});
	});

	it.each([
		['panes.md', '/work/project/docs/rules/panes.md', null],
		['./panes.md#opening-a-file', '/work/project/docs/rules/panes.md', 'opening-a-file'],
		['../../README.md', '/work/project/README.md', null],
		['sub/my%20notes.md', '/work/project/docs/rules/sub/my notes.md', null],
		['/src/main.ts#L42', '/work/project/src/main.ts', 'L42'],
		['panes.md?plain=1#', '/work/project/docs/rules/panes.md', null],
	])('resolves the relative link %j from the folder of the file, or from the root for a leading slash', (href, absolutePath, anchor) => {
		expect(MarkdownLinks.resolve(href, FILE, ROOT)).toEqual({
			kind: 'file',
			absolutePath,
			anchor,
		});
	});

	it.each(['mailto:someone@example.com', 'ftp://example.com/file', '', '#'])('opens nothing for the link %j', (href) => {
		expect(MarkdownLinks.resolve(href, FILE, ROOT)).toBeNull();
	});
});

describe('MarkdownLinks anchors (issue #928)', () => {
	it('writes the anchor of a heading as GitHub does', () => {
		expect(MarkdownLinks.slug('Opening a file')).toBe('opening-a-file');
		expect(MarkdownLinks.slug('What the `file view pane` shows?')).toBe('what-the-file-view-pane-shows');
		expect(MarkdownLinks.slug('Issue Fix Workflow values')).toBe('issue-fix-workflow-values');
		expect(MarkdownLinks.slug('Étape 2: déployer')).toBe('étape-2-déployer');
	});

	it('finds a heading by its anchor, a repeated heading with its number, and an element by its identifier', () => {
		const container = document.createElement('div');
		container.innerHTML = /* html */`
			<h1>Title</h1>
			<h2>Notes</h2>
			<h2>Notes</h2>
			<p><a name="old-anchor">here</a></p>
		`;
		const headings = container.querySelectorAll('h2');
		expect(MarkdownLinks.findAnchor(container, 'title')).toBe(container.querySelector('h1'));
		expect(MarkdownLinks.findAnchor(container, 'notes')).toBe(headings[0]);
		expect(MarkdownLinks.findAnchor(container, 'notes-1')).toBe(headings[1]);
		expect(MarkdownLinks.findAnchor(container, 'Notes')).toBe(headings[0]);
		expect(MarkdownLinks.findAnchor(container, 'old-anchor')).toBe(container.querySelector('a'));
		expect(MarkdownLinks.findAnchor(container, 'missing')).toBeNull();
	});

	it('reads the line of a GitHub line anchor', () => {
		expect(MarkdownLinks.lineOfAnchor('L42')).toBe(42);
		expect(MarkdownLinks.lineOfAnchor('L10-L20')).toBe(10);
		expect(MarkdownLinks.lineOfAnchor('notes')).toBeNull();
	});
});
