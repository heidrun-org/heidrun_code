import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	snapshot: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock('@tauri-apps/api/path', () => ({ homeDir: vi.fn(async () => '/home') }));
vi.mock('@tauri-apps/api/webview', () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock('../lib/api', () => ({
	snapshot: mocks.snapshot,
	watchPanes: vi.fn(async () => {}),
	codexUsage: vi.fn(async () => ({ available: false, sessions: {} })),
}));

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SessionTabCloseFocusTest — the pane that gets the focus when the selected tab closes (issue 862)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One pane of a test snapshot: its name, its tab, and its workspace. */
type TestPane = {
	/** Name of the pane in Herdr. */
	paneId: string;
	/** Name of the tab that holds the pane. */
	tabId: string;
	/** Name of the workspace that holds the tab. */
	workspaceId: string;
};

/** Builds snapshots and starts the stores for the tests of the tab closing. */
class SessionTabCloseFocusTest {
	/** The panes of the first workspace `w1`: the tabs `w1:t1`, `w1:t2`, and `w1:t3`, and the workspace `w2`. */
	static readonly PANES: TestPane[] = [
		{ paneId: 'w1:p1', tabId: 'w1:t1', workspaceId: 'w1' },
		{ paneId: 'w1:p2', tabId: 'w1:t2', workspaceId: 'w1' },
		{ paneId: 'w1:p3', tabId: 'w1:t3', workspaceId: 'w1' },
		{ paneId: 'w1:p4', tabId: 'w1:t3', workspaceId: 'w1' },
		{ paneId: 'w2:p5', tabId: 'w2:t5', workspaceId: 'w2' },
	];

	/**
	 * Builds a snapshot with the given panes, and with the tabs and the workspaces that these panes need.
	 *
	 * @param panes - The panes of the snapshot.
	 * @param activeTabIdOfWorkspace1 - The tab that Herdr makes active in the workspace `w1`.
	 * @returns The snapshot, as Herdr sends it.
	 */
	static buildSnapshot(panes: TestPane[], activeTabIdOfWorkspace1: string) {
		const tabIds = [...new Set(panes.map((pane) => pane.tabId))];
		const workspaceIds = [...new Set(panes.map((pane) => pane.workspaceId))];
		return {
			version: 'test',
			protocol: 1,
			focused_workspace_id: 'w1',
			workspaces: workspaceIds.map((workspaceId, index) => ({
				workspace_id: workspaceId,
				number: index + 1,
				label: workspaceId,
				focused: workspaceId === 'w1',
				pane_count: panes.filter((pane) => pane.workspaceId === workspaceId).length,
				tab_count: 1,
				active_tab_id: workspaceId === 'w1' ? activeTabIdOfWorkspace1 : `${workspaceId}:t5`,
				agent_status: 'unknown',
			})),
			tabs: tabIds.map((tabId, index) => ({
				tab_id: tabId,
				workspace_id: tabId.split(':')[0],
				number: index + 1,
				label: tabId,
				focused: false,
				pane_count: panes.filter((pane) => pane.tabId === tabId).length,
				agent_status: 'unknown',
			})),
			panes: panes.map((pane) => ({
				pane_id: pane.paneId,
				terminal_id: `terminal-${pane.paneId}`,
				workspace_id: pane.workspaceId,
				tab_id: pane.tabId,
				focused: false,
				agent_status: 'unknown',
				revision: 1,
			})),
			layouts: [],
			agents: [],
		};
	}

	/**
	 * Starts the stores again, as a new run of Heidrun Code does, reads the full snapshot, and selects the tab `w1:t3`.
	 *
	 * @param focusedPaneIds - The panes that had the focus, the oldest first, as the pane focus history holds them.
	 * @returns The session store and the pane focus history.
	 */
	static async start(focusedPaneIds: string[]) {
		vi.resetModules();
		mocks.snapshot.mockResolvedValue(SessionTabCloseFocusTest.buildSnapshot(SessionTabCloseFocusTest.PANES, 'w1:t1'));
		const session = await import('./session');
		const { paneFocusHistory } = await import('./pane_focus_history_state');
		await session.refresh();
		for (const paneId of focusedPaneIds) {
			paneFocusHistory.record(paneId);
		}
		session.selectTab('w1:t3');
		return { session, paneFocusHistory };
	}

	/**
	 * Closes a tab in Herdr: the next snapshot has no pane of that tab.
	 *
	 * @param session - The session store.
	 * @param closedTabId - The tab that Herdr closes.
	 * @param activeTabIdOfWorkspace1 - The tab that Herdr makes active in the workspace `w1` after the close.
	 */
	static async closeTab(session: typeof import('./session'), closedTabId: string, activeTabIdOfWorkspace1: string) {
		const remainingPanes = SessionTabCloseFocusTest.PANES.filter((pane) => pane.tabId !== closedTabId);
		mocks.snapshot.mockResolvedValue(
			SessionTabCloseFocusTest.buildSnapshot(remainingPanes, activeTabIdOfWorkspace1),
		);
		await session.refresh();
	}
}

beforeEach(() => {
	localStorage.clear();
	mocks.snapshot.mockReset();
});

describe('the focus after the close of the selected tab', () => {
	it('selects the tab and the pane that had the focus most recently in another tab', async () => {
		const { session } = await SessionTabCloseFocusTest.start(['w1:p1', 'w1:p2', 'w1:p3']);
		await SessionTabCloseFocusTest.closeTab(session, 'w1:t3', 'w1:t1');
		expect(session.state.selectedTabId).toBe('w1:t2');
		expect(session.state.selectedPaneId).toBe('w1:p2');
	});

	it('skips every entry of the closed tab, when the closed tab holds several panes of the history', async () => {
		const { session } = await SessionTabCloseFocusTest.start(['w1:p2', 'w1:p1', 'w1:p3', 'w1:p4', 'w1:p3']);
		await SessionTabCloseFocusTest.closeTab(session, 'w1:t3', 'w1:t2');
		expect(session.state.selectedTabId).toBe('w1:t1');
		expect(session.state.selectedPaneId).toBe('w1:p1');
	});

	it('selects the tab that Herdr makes active when the history holds no pane of another tab', async () => {
		const { session } = await SessionTabCloseFocusTest.start(['w1:p3', 'w1:p4']);
		await SessionTabCloseFocusTest.closeTab(session, 'w1:t3', 'w1:t2');
		expect(session.state.selectedTabId).toBe('w1:t2');
	});

	it('selects the tab that Herdr makes active when the history is empty', async () => {
		const { session } = await SessionTabCloseFocusTest.start([]);
		await SessionTabCloseFocusTest.closeTab(session, 'w1:t3', 'w1:t1');
		expect(session.state.selectedTabId).toBe('w1:t1');
	});

	it('stays in the workspace of the closed tab, though a pane of another workspace is more recent', async () => {
		const { session } = await SessionTabCloseFocusTest.start(['w1:p1', 'w2:p5', 'w1:p3']);
		await SessionTabCloseFocusTest.closeTab(session, 'w1:t3', 'w1:t2');
		expect(session.state.selectedWorkspaceId).toBe('w1');
		expect(session.state.selectedTabId).toBe('w1:t1');
	});

	it('keeps the selected tab when another tab closes', async () => {
		const { session } = await SessionTabCloseFocusTest.start(['w1:p1', 'w1:p2', 'w1:p3']);
		await SessionTabCloseFocusTest.closeTab(session, 'w1:t2', 'w1:t3');
		expect(session.state.selectedTabId).toBe('w1:t3');
	});
});
