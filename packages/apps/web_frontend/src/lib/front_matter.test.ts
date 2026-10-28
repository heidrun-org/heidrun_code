// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { FrontMatter } from './front_matter';

describe('FrontMatter (issue #784)', () => {
	it('splits the block between the two lines of dashes from the body, and keeps the block unchanged', () => {
		const block = 'type: project\nname: subitoflash\nscope_in:\n  - first\n  - second';
		const split = FrontMatter.split(`---\n${block}\n---\n\n# Title\n\nText.`);
		expect(split.frontMatter).toBe(block);
		expect(split.body).toBe('\n# Title\n\nText.');
	});

	it('gives the block of a file that ends right after the closing line of dashes', () => {
		const split = FrontMatter.split('---\ntype: project\n---');
		expect(split.frontMatter).toBe('type: project');
		expect(split.body).toBe('');
	});

	it('does not parse the block, so a block with an error still shows', () => {
		const split = FrontMatter.split('---\ntype: [unclosed\n  bad: : :\n---\nBody');
		expect(split.frontMatter).toBe('type: [unclosed\n  bad: : :');
		expect(split.body).toBe('Body');
	});

	it('reads a file with Windows line ends, and gives the block with plain line ends', () => {
		const split = FrontMatter.split('---\r\ntype: project\r\nname: a\r\n---\r\n# Title');
		expect(split.frontMatter).toBe('type: project\nname: a');
		expect(split.body).toBe('# Title');
	});

	it('reads a first line of dashes that has a byte order mark or trailing spaces', () => {
		const split = FrontMatter.split('﻿---  \ntype: project\n---\t\nBody');
		expect(split.frontMatter).toBe('type: project');
		expect(split.body).toBe('Body');
	});

	it('closes the block at the first line of dashes, and keeps a later line of dashes in the body', () => {
		const split = FrontMatter.split('---\ntype: project\n---\nText\n\n---\n\nMore');
		expect(split.frontMatter).toBe('type: project');
		expect(split.body).toBe('Text\n\n---\n\nMore');
	});

	it.each([
		['a file with no block', '# Title\n\nText.'],
		['an empty file', ''],
		['an empty block', '---\n---\n\n# Title\n\n---\n\nText.'],
		['a block of blank lines', '---\n\n  \n---\n# Title'],
		['a first line of dashes with no closing line of dashes', '---\ntype: project\n\n# Title'],
		['a block that does not start on the first line', '\n---\ntype: project\n---\n# Title'],
		['a first line with more than three dashes', '----\ntype: project\n----\n# Title'],
		['a first line of three dashes followed by text', '---x\ntype: project\n---\n# Title'],
	])('gives no front matter for %s, and the whole file as the body', (_name, text) => {
		const split = FrontMatter.split(text);
		expect(split.frontMatter).toBeNull();
		expect(split.body).toBe(text);
	});
});
