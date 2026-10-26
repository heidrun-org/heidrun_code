import { describe, expect, it } from 'vitest';
import { DiffPaneLabel } from './diff_pane_label';
import { FileViewLabel } from './file_view_label';
import { paneName } from './format';

describe('DiffPaneLabel (issue #885)', () => {
	it('writes the marker, then the absolute path, and reads the path back', () => {
		const label = DiffPaneLabel.format('/work/project/src/main.ts');
		expect(label).toBe('Heidrun diff: /work/project/src/main.ts');
		expect(DiffPaneLabel.parse(label)).toBe('/work/project/src/main.ts');
		expect(DiffPaneLabel.fileName(label)).toBe('main.ts');
	});

	it('reads no path from a terminal label, an empty label, or the label of a file view pane', () => {
		expect(DiffPaneLabel.parse(null)).toBeNull();
		expect(DiffPaneLabel.parse(undefined)).toBeNull();
		expect(DiffPaneLabel.parse('build')).toBeNull();
		expect(DiffPaneLabel.parse('Heidrun diff: ')).toBeNull();
		expect(DiffPaneLabel.parse(FileViewLabel.format('/work/project/README.md'))).toBeNull();
		expect(FileViewLabel.parse(DiffPaneLabel.format('/work/project/README.md'))).toBeNull();
	});

	it('gives the name of the file as the name of the pane', () => {
		const pane = { pane_id: 'w1:p2', terminal_id: 't2', workspace_id: 'w1', tab_id: 'w1:t1', focused: false, agent_status: 'unknown', revision: 1, label: 'Heidrun diff: /work/project/docs/index.md' };
		expect(paneName(pane as Parameters<typeof paneName>[0])).toBe('index.md');
	});
});
