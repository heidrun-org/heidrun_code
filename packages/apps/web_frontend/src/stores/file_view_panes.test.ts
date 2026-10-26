// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const split = vi.hoisted(() => vi.fn());
const renamePane = vi.hoisted(() => vi.fn(async () => ({})));
const run = vi.hoisted(() => vi.fn(async () => ''));
const refresh = vi.hoisted(() => vi.fn(async () => {}));
const selectPane = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
const selectedPane = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }));
const callOrder = vi.hoisted(() => [] as string[]);

vi.mock('../lib/api', () => ({ split, renamePane, run }));
vi.mock('./session', () => ({ refresh, selectPane, selectedPane, toast }));
vi.mock('./workspace_folders', () => ({ WorkspaceFolders: { require: () => '/work/project' } }));

const NEW_PANE = { pane_id: 'w1:p2', tab_id: 'w1:t1', workspace_id: 'w1' };

beforeEach(() => {
	callOrder.length = 0;
	split.mockReset();
	split.mockImplementation(async () => {
		callOrder.push('split');
		return NEW_PANE;
	});
	renamePane.mockReset();
	renamePane.mockImplementation(async () => {
		callOrder.push('rename');
		return {};
	});
	run.mockReset();
	run.mockImplementation(async () => {
		callOrder.push('run');
		return '';
	});
	refresh.mockReset();
	refresh.mockImplementation(async () => {
		callOrder.push('refresh');
	});
	selectPane.mockReset();
	toast.mockReset();
	selectedPane.value = { pane_id: 'w1:p1', tab_id: 'w1:t1', workspace_id: 'w1', label: null };
});

describe('FileViewPanes (issue #714)', () => {
	it('opens a new pane to the right of a terminal, and leaves the terminal as it is', async () => {
		const { FileViewPanes } = await import('./file_view_panes');
		expect(await FileViewPanes.open('/work/project/README.md')).toBe(true);
		expect(split).toHaveBeenCalledWith('w1:p1', 'right', '/work/project');
		expect(renamePane).toHaveBeenCalledTimes(1);
		expect(renamePane).toHaveBeenCalledWith('w1:p2', 'Heidrun file view: /work/project/README.md');
		expect(renamePane).not.toHaveBeenCalledWith('w1:p1', expect.anything());
		expect(selectPane).toHaveBeenCalledWith(NEW_PANE);
	});

	it('gives the label before the first refresh, so that the new pane never shows a terminal', async () => {
		const { FileViewPanes } = await import('./file_view_panes');
		await FileViewPanes.open('/work/project/README.md');
		expect(callOrder).toEqual(['split', 'rename', 'run', 'refresh']);
	});

	it('runs a command under the file view that prints a line and then only waits', async () => {
		const { FileViewPanes } = await import('./file_view_panes');
		await FileViewPanes.open('/work/project/README.md');
		expect(run).toHaveBeenCalledWith('w1:p2', "echo 'Below the file view of Heidrun'; sleep 99999999");
	});

	it('replaces the file of the selected pane when it is a file view pane, and opens no new pane', async () => {
		selectedPane.value = { ...selectedPane.value, label: 'Heidrun file view: /work/project/README.md' };
		const { FileViewPanes } = await import('./file_view_panes');
		expect(await FileViewPanes.open('/work/project/src/main.ts')).toBe(true);
		expect(renamePane).toHaveBeenCalledWith('w1:p1', 'Heidrun file view: /work/project/src/main.ts');
		expect(split).not.toHaveBeenCalled();
		expect(run).not.toHaveBeenCalled();
		expect(refresh).toHaveBeenCalledTimes(1);
	});

	it('opens a new pane when the selected pane has a label that is only a name', async () => {
		selectedPane.value = { ...selectedPane.value, label: 'build' };
		const { FileViewPanes } = await import('./file_view_panes');
		await FileViewPanes.open('/work/project/README.md');
		expect(split).toHaveBeenCalledTimes(1);
	});

	it('returns false and changes nothing when no pane is selected', async () => {
		selectedPane.value = null;
		const { FileViewPanes } = await import('./file_view_panes');
		expect(await FileViewPanes.open('/work/project/README.md')).toBe(false);
		expect(split).not.toHaveBeenCalled();
		expect(toast).not.toHaveBeenCalled();
	});

	it('returns false and shows the error in a toast when Herdr fails', async () => {
		split.mockRejectedValue(new Error('herdr_unreachable'));
		const { FileViewPanes } = await import('./file_view_panes');
		expect(await FileViewPanes.open('/work/project/README.md')).toBe(false);
		expect(toast).toHaveBeenCalledWith('Error: herdr_unreachable', 'error');
		expect(selectPane).not.toHaveBeenCalled();
	});
});
