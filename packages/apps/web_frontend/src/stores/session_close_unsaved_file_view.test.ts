import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	snapshot: vi.fn(),
	closePane: vi.fn(async () => ({})),
	closeTab: vi.fn(async () => ({})),
	closeWorkspace: vi.fn(async () => ({})),
	askConfirm: vi.fn(async (_title: string, _confirmLabel: string) => false),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock('@tauri-apps/api/path', () => ({ homeDir: vi.fn(async () => '/home') }));
vi.mock('@tauri-apps/api/webview', () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock('../lib/api', () => ({
	snapshot: mocks.snapshot,
	watchPanes: vi.fn(async () => {}),
	codexUsage: vi.fn(async () => ({ available: false, sessions: {} })),
	closePane: mocks.closePane,
	closeTab: mocks.closeTab,
	closeWorkspace: mocks.closeWorkspace,
}));
vi.mock('./confirm', () => ({ askConfirm: mocks.askConfirm }));

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SessionCloseUnsavedFileViewTest — closing a file view pane with unsaved changes asks first (issue #899)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The panes of the test snapshot: `w1:p2` is a file view pane in the tab `w1:t1`, with a terminal next to it. */
const PANES = [
	{ pane_id: 'w1:p1', tab_id: 'w1:t1', workspace_id: 'w1' },
	{ pane_id: 'w1:p2', tab_id: 'w1:t1', workspace_id: 'w1' },
	{ pane_id: 'w1:p3', tab_id: 'w1:t2', workspace_id: 'w1' },
];

/** Starts the stores with the test snapshot and gives the file view pane `w1:p2` an unsaved change. */
async function start() {
	vi.resetModules();
	mocks.snapshot.mockResolvedValue({
		version: 'test',
		protocol: 1,
		focused_workspace_id: 'w1',
		workspaces: [{ workspace_id: 'w1', number: 1, label: 'w1', focused: true, pane_count: 3, tab_count: 2, active_tab_id: 'w1:t1', agent_status: 'unknown' }],
		tabs: [
			{ tab_id: 'w1:t1', workspace_id: 'w1', number: 1, label: 't1', focused: true, pane_count: 2, agent_status: 'unknown' },
			{ tab_id: 'w1:t2', workspace_id: 'w1', number: 2, label: 't2', focused: false, pane_count: 1, agent_status: 'unknown' },
		],
		panes: PANES.map((pane) => ({ ...pane, terminal_id: `terminal-${pane.pane_id}`, focused: false, agent_status: 'unknown', revision: 1 })),
		layouts: [],
		agents: [],
	});
	const session = await import('./session');
	const { fileViewEdits } = await import('./file_view_edit_state');
	await session.refresh();
	fileViewEdits['w1:p2'] = {
		root: '/work/project',
		path: 'src/a.ts',
		original: 'a',
		hash: 'hash',
		current: 'a changed',
		isConflict: false,
		diskText: null,
		diskHash: null,
		isSaving: false,
	};
	return { session, fileViewEdits };
}

beforeEach(() => {
	mocks.closePane.mockClear();
	mocks.closeTab.mockClear();
	mocks.closeWorkspace.mockClear();
	mocks.askConfirm.mockReset();
	mocks.askConfirm.mockResolvedValue(false);
});

describe('SessionCloseUnsavedFileViewTest', () => {
	it('keeps the pane open when the developer cancels the question', async () => {
		const { session } = await start();
		await session.closePane('w1:p2');
		expect(mocks.askConfirm).toHaveBeenCalledWith('1 file has unsaved changes: a.ts. Close without saving?', 'Close without saving');
		expect(mocks.closePane).not.toHaveBeenCalled();
	});

	it('closes the pane and drops the changes when the developer closes without saving', async () => {
		mocks.askConfirm.mockResolvedValue(true);
		const { session, fileViewEdits } = await start();
		await session.closePane('w1:p2');
		expect(mocks.closePane).toHaveBeenCalledWith('w1:p2');
		expect(fileViewEdits['w1:p2']).toBeUndefined();
	});

	it('asks nothing for a pane without unsaved changes', async () => {
		const { session } = await start();
		await session.closePane('w1:p1');
		expect(mocks.askConfirm).not.toHaveBeenCalled();
		expect(mocks.closePane).toHaveBeenCalledWith('w1:p1');
	});

	it('asks before the tab and before the workspace of the pane close, and not before another tab closes', async () => {
		const { session } = await start();
		await session.closeTab('w1:t2');
		expect(mocks.askConfirm).not.toHaveBeenCalled();
		expect(mocks.closeTab).toHaveBeenCalledWith('w1:t2');
		await session.closeTab('w1:t1');
		expect(mocks.closeTab).not.toHaveBeenCalledWith('w1:t1');
		await session.closeWorkspace('w1');
		expect(mocks.askConfirm).toHaveBeenCalledTimes(2);
		expect(mocks.closeWorkspace).not.toHaveBeenCalled();
	});
});
