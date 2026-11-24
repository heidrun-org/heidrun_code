// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiffPanes } from './diff_panes';

const newTab = vi.hoisted(() => vi.fn());
const split = vi.hoisted(() => vi.fn());
const renamePane = vi.hoisted(() => vi.fn());
const run = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const selectPane = vi.hoisted(() => vi.fn());
const closePane = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => vi.fn());

vi.mock('../lib/api', () => ({
	newTab,
	split,
	renamePane,
	run,
	closePane,
}));
vi.mock('./session', () => ({
	refresh,
	selectPane,
	toast,
	selectedPane: {
		value: null,
	},
}));
vi.mock('./workspace_folders', () => ({
	WorkspaceFolders: {
		require: () => '/work/project',
	},
}));

vi.mock('../i18n/index', () => ({
	t: (key: string) => key,
}));

const NEW_PANE = {
	pane_id: 'w1:p2',
	tab_id: 'w1:t2',
	workspace_id: 'w1',
};

beforeEach(() => {
	vi.resetAllMocks();
	newTab.mockResolvedValue(NEW_PANE);
});

describe('DiffPanes.openInNewTab (issue #1074)', () => {
	it('opens and focuses a tab for the selected diff without splitting a pane', async () => {
		expect(await DiffPanes.openInNewTab('w1', '/work/project/src/main.ts')).toBe(true);
		expect(newTab).toHaveBeenCalledWith('w1', '/work/project', 'main.ts');
		expect(split).not.toHaveBeenCalled();
		expect(renamePane).toHaveBeenCalledWith('w1:p2', 'Heidrun diff: /work/project/src/main.ts');
		expect(run).toHaveBeenCalledWith('w1:p2', "echo 'Below the diff pane of Heidrun'; sleep 99999999");
		expect(selectPane).toHaveBeenCalledWith(NEW_PANE);
	});

	it('closes the new pane and reports the error if the diff cannot open', async () => {
		renamePane.mockRejectedValueOnce(new Error('rename failed'));
		expect(await DiffPanes.openInNewTab('w1', '/work/project/README.md')).toBe(false);
		expect(closePane).toHaveBeenCalledWith('w1:p2');
		expect(selectPane).not.toHaveBeenCalled();
		expect(toast).toHaveBeenCalledWith('Error: rename failed', 'error');
	});
});
