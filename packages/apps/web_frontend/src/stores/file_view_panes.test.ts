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
vi.mock('../i18n/index', () => ({ t: (key: string) => key }));

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

	it('returns false, changes nothing, and asks for a pane in a toast when no pane is selected (issue #886)', async () => {
		selectedPane.value = null;
		const { FileViewPanes } = await import('./file_view_panes');
		expect(await FileViewPanes.open('/work/project/README.md')).toBe(false);
		expect(split).not.toHaveBeenCalled();
		expect(toast).toHaveBeenCalledWith('viewPanes.noSelectedPane', 'error');
	});

	it('returns false and shows the error in a toast when Herdr fails', async () => {
		split.mockRejectedValue(new Error('herdr_unreachable'));
		const { FileViewPanes } = await import('./file_view_panes');
		expect(await FileViewPanes.open('/work/project/README.md')).toBe(false);
		expect(toast).toHaveBeenCalledWith('Error: herdr_unreachable', 'error');
		expect(selectPane).not.toHaveBeenCalled();
	});

	it('keeps the line of a file name, so that the file view pane shows it, and forgets it for a file with no line (issue #898)', async () => {
		const { FileViewPanes, fileViewLineRequests } = await import('./file_view_panes');
		await FileViewPanes.open('/work/project/src/main.rs', 42);
		expect(fileViewLineRequests['/work/project/src/main.rs']?.line).toBe(42);
		const firstSequence = fileViewLineRequests['/work/project/src/main.rs']?.sequence ?? 0;
		await FileViewPanes.open('/work/project/src/main.rs', 42);
		expect(fileViewLineRequests['/work/project/src/main.rs']?.sequence).toBeGreaterThan(firstSequence);
		await FileViewPanes.open('/work/project/src/main.rs');
		expect(fileViewLineRequests['/work/project/src/main.rs']).toBeUndefined();
	});

	it('opens a new pane next to a file view pane with unsaved changes, so that the changes stay (issue #899)', async () => {
		selectedPane.value = { ...selectedPane.value, label: 'Heidrun file view: /work/project/README.md' };
		const { fileViewEdits } = await import('./file_view_edit_state');
		fileViewEdits['w1:p1'] = {
			root: '/work/project',
			path: 'README.md',
			original: 'a',
			hash: 'hash',
			current: 'a changed',
			isConflict: false,
			diskText: null,
			diskHash: null,
			isSaving: false,
		};
		const { FileViewPanes } = await import('./file_view_panes');
		await FileViewPanes.open('/work/project/src/main.ts');
		expect(split).toHaveBeenCalledWith('w1:p1', 'right', '/work/project');
		expect(renamePane).not.toHaveBeenCalledWith('w1:p1', expect.anything());
		split.mockClear();
		await FileViewPanes.open('/work/project/README.md', 3);
		expect(split).not.toHaveBeenCalled();
		delete fileViewEdits['w1:p1'];
	});
});
