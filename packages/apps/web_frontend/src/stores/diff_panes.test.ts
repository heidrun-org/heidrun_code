// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const split = vi.hoisted(() => vi.fn());
const renamePane = vi.hoisted(() => vi.fn(async () => ({})));
const run = vi.hoisted(() => vi.fn(async () => ''));
const refresh = vi.hoisted(() => vi.fn(async () => {}));
const selectPane = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
const selectedPane = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }));

vi.mock('../lib/api', () => ({ split, renamePane, run }));
vi.mock('./session', () => ({ refresh, selectPane, selectedPane, toast }));
vi.mock('./workspace_folders', () => ({ WorkspaceFolders: { require: () => '/work/project' } }));

const NEW_PANE = { pane_id: 'w1:p2', tab_id: 'w1:t1', workspace_id: 'w1' };

beforeEach(() => {
	split.mockReset();
	split.mockImplementation(async () => NEW_PANE);
	renamePane.mockClear();
	run.mockClear();
	refresh.mockClear();
	selectPane.mockReset();
	toast.mockReset();
	selectedPane.value = { pane_id: 'w1:p1', tab_id: 'w1:t1', workspace_id: 'w1', label: null };
});

describe('DiffPanes (issue #885)', () => {
	it('opens a new pane to the right of a terminal, and leaves the terminal as it is', async () => {
		const { DiffPanes } = await import('./diff_panes');
		expect(await DiffPanes.open('/work/project/src/main.ts')).toBe(true);
		expect(split).toHaveBeenCalledWith('w1:p1', 'right', '/work/project');
		expect(renamePane).toHaveBeenCalledTimes(1);
		expect(renamePane).toHaveBeenCalledWith('w1:p2', 'Heidrun diff: /work/project/src/main.ts');
		expect(run).toHaveBeenCalledWith('w1:p2', "echo 'Below the diff pane of Heidrun'; sleep 99999999");
		expect(selectPane).toHaveBeenCalledWith(NEW_PANE);
	});

	it('replaces the file of the selected pane when it is a diff pane, and opens no new pane', async () => {
		selectedPane.value = { ...selectedPane.value, label: 'Heidrun diff: /work/project/README.md' };
		const { DiffPanes } = await import('./diff_panes');
		expect(await DiffPanes.open('/work/project/src/main.ts')).toBe(true);
		expect(renamePane).toHaveBeenCalledWith('w1:p1', 'Heidrun diff: /work/project/src/main.ts');
		expect(split).not.toHaveBeenCalled();
		expect(run).not.toHaveBeenCalled();
	});

	it('opens a new pane next to a file view pane, and keeps the file of the file view pane', async () => {
		selectedPane.value = { ...selectedPane.value, label: 'Heidrun file view: /work/project/README.md' };
		const { DiffPanes } = await import('./diff_panes');
		await DiffPanes.open('/work/project/README.md');
		expect(split).toHaveBeenCalledTimes(1);
		expect(renamePane).not.toHaveBeenCalledWith('w1:p1', expect.anything());
	});

	it('returns false and changes nothing when no pane is selected', async () => {
		selectedPane.value = null;
		const { DiffPanes } = await import('./diff_panes');
		expect(await DiffPanes.open('/work/project/README.md')).toBe(false);
		expect(split).not.toHaveBeenCalled();
	});

	it('returns false and shows the error in a toast when Herdr fails', async () => {
		split.mockRejectedValue(new Error('herdr_unreachable'));
		const { DiffPanes } = await import('./diff_panes');
		expect(await DiffPanes.open('/work/project/README.md')).toBe(false);
		expect(toast).toHaveBeenCalledWith('Error: herdr_unreachable', 'error');
	});
});
