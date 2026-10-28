// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { FileViewLabel } from './file_view_label';

describe('FileViewLabel (issue #714)', () => {
	it('writes the marker followed by the absolute path, and reads the same path back', () => {
		const label = FileViewLabel.format('/Users/someone/project/README.md');
		expect(label).toBe('Heidrun file view: /Users/someone/project/README.md');
		expect(FileViewLabel.parse(label)).toBe('/Users/someone/project/README.md');
	});

	it('keeps a path that holds spaces and colons', () => {
		const absolutePath = '/Users/someone/my project/notes: today.md';
		expect(FileViewLabel.parse(FileViewLabel.format(absolutePath))).toBe(absolutePath);
	});

	it.each([null, undefined, '', 'build', 'jetienne@host:~/project', 'Heidrun file view:', 'Heidrun file view: '])(
		'reads no path from the label %j, so the pane stays a terminal',
		(label) => {
			expect(FileViewLabel.parse(label)).toBeNull();
			expect(FileViewLabel.fileName(label)).toBeNull();
		},
	);

	it('reads the name of the file as the last part of the path', () => {
		expect(FileViewLabel.fileName(FileViewLabel.format('/Users/someone/project/docs/README.md'))).toBe('README.md');
	});
});
