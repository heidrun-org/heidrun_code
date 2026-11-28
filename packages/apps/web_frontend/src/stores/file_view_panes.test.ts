// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const split = vi.hoisted(() => vi.fn());
const newTab = vi.hoisted(() => vi.fn());
const closePane = vi.hoisted(() => vi.fn(async () => ({})));
const renamePane = vi.hoisted(() => vi.fn(async () => ({})));
const run = vi.hoisted(() => vi.fn(async () => ''));
const refresh = vi.hoisted(() => vi.fn(async () => {}));
const selectPane = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());
const state = vi.hoisted(() => ({
	selectedWorkspaceId: null as string | null,
}));
const callOrder = vi.hoisted(() => [] as string[]);

vi.mock('../lib/api', () => ({ split, newTab, closePane, renamePane, run }));
vi.mock('./session', () => ({ refresh, selectPane, state, toast }));
vi.mock('./workspace_folders', () => ({ WorkspaceFolders: { require: () => '/work/project' } }));
vi.mock('../i18n/index', () => ({ t: (key: string) => key }));

const NEW_TAB_PANE = {
	pane_id: 'w1:p3',
	tab_id: 'w1:t2',
	workspace_id: 'w1',
};

beforeEach(() => {
	newTab.mockReset();
	newTab.mockResolvedValue(NEW_TAB_PANE);
	closePane.mockClear();
	callOrder.length = 0;
	split.mockReset();
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
	state.selectedWorkspaceId = 'w1';
});

describe('FileViewPanes (issue #714)', () => {
	it('opens and focuses a new file tab from the selected workspace without splitting the current tab', async () => {
		const { FileViewPanes } = await import('./file_view_panes');
		expect(await FileViewPanes.open('/work/project/README.md')).toBe(true);
		expect(newTab).toHaveBeenCalledWith('w1', '/work/project', 'README.md');
		expect(split).not.toHaveBeenCalled();
		expect(renamePane).toHaveBeenCalledWith('w1:p3', 'Heidrun file view: /work/project/README.md');
		expect(run).toHaveBeenCalledWith('w1:p3', "echo 'Below the file view of Heidrun'; sleep 99999999");
		expect(callOrder).toEqual(['rename', 'run', 'refresh']);
		expect(selectPane).toHaveBeenCalledWith(NEW_TAB_PANE);
	});

	it('returns false, changes nothing, and asks for a workspace when no workspace is selected (issue #886)', async () => {
		state.selectedWorkspaceId = null;
		const { FileViewPanes } = await import('./file_view_panes');
		expect(await FileViewPanes.open('/work/project/README.md')).toBe(false);
		expect(split).not.toHaveBeenCalled();
		expect(newTab).not.toHaveBeenCalled();
		expect(toast).toHaveBeenCalledWith('viewPanes.noSelectedWorkspace', 'error');
	});

	it('returns false and shows the error in a toast when Herdr fails', async () => {
		newTab.mockRejectedValueOnce(new Error('herdr_unreachable'));
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

	it('keeps the anchor of a Markdown link, and forgets it for a file with no anchor (issue #928)', async () => {
		const { FileViewPanes, fileViewAnchorRequests } = await import('./file_view_panes');
		await FileViewPanes.open('/work/project/docs/rules.md', null, 'the-rules');
		expect(fileViewAnchorRequests['/work/project/docs/rules.md']).toBe('the-rules');
		await FileViewPanes.open('/work/project/docs/rules.md');
		expect(fileViewAnchorRequests['/work/project/docs/rules.md']).toBeUndefined();
	});

});

describe('FileViewPanes.openInNewTab (issue #1062)', () => {
	it('creates and selects a file tab without changing the selected pane', async () => {
		const { FileViewPanes } = await import('./file_view_panes');
		expect(await FileViewPanes.openInNewTab('w1', '/work/project/README.md')).toBe(true);
		expect(newTab).toHaveBeenCalledWith('w1', '/work/project', 'README.md');
		expect(split).not.toHaveBeenCalled();
		expect(renamePane).toHaveBeenCalledTimes(1);
		expect(renamePane).toHaveBeenCalledWith('w1:p3', 'Heidrun file view: /work/project/README.md');
		expect(callOrder).toEqual(['rename', 'run', 'refresh']);
		expect(selectPane).toHaveBeenCalledWith(NEW_TAB_PANE);
	});

	it('closes the new pane and reports an error when setup fails', async () => {
		run.mockRejectedValueOnce(new Error('cannot start waiting command'));
		const { FileViewPanes } = await import('./file_view_panes');
		expect(await FileViewPanes.openInNewTab('w1', '/work/project/README.md')).toBe(false);
		expect(closePane).toHaveBeenCalledWith('w1:p3');
		expect(selectPane).not.toHaveBeenCalled();
		expect(toast).toHaveBeenCalledWith('Error: cannot start waiting command', 'error');
	});
});
