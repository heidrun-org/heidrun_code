import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	snapshot: vi.fn(),
	handlers: {} as Record<string, (event: { payload: unknown }) => Promise<void>>,
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }));
vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(async (name: string, handler: (event: { payload: unknown }) => Promise<void>) => {
		mocks.handlers[name] = handler;
		return () => {};
	}),
}));
vi.mock('@tauri-apps/api/path', () => ({ homeDir: vi.fn(async () => '/home') }));
vi.mock('@tauri-apps/api/webview', () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock('../lib/api', () => ({
	snapshot: mocks.snapshot,
	watchPanes: vi.fn(async () => {}),
	codexUsage: vi.fn(async () => ({ available: false, sessions: {} })),
}));

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SessionFocusRequestPaneTest — the window selects the tab and the pane that heidrun_code_ctrl focuses (issue 999)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One pane of a test snapshot: its id, its tab, and its workspace. */
type TestPane = {
	/** The id of the pane in Herdr. */
	paneId: string;
	/** The id of the tab that holds the pane. */
	tabId: string;
	/** The id of the workspace that holds the tab. */
	workspaceId: string;
};

/** Builds snapshots, starts the stores, and sends the events of Herdr for the tests of a focus request with a pane. */
class SessionFocusRequestPaneTest {
	/** Two workspaces: `w1` with the tabs `w1:t1` and `w1:t2`, the second one with two panes, and `w2` with one tab. */
	static readonly PANES: TestPane[] = [
		{ paneId: 'w1:p1', tabId: 'w1:t1', workspaceId: 'w1' },
		{ paneId: 'w1:p2', tabId: 'w1:t2', workspaceId: 'w1' },
		{ paneId: 'w1:p3', tabId: 'w1:t2', workspaceId: 'w1' },
		{ paneId: 'w2:p4', tabId: 'w2:t4', workspaceId: 'w2' },
	];

	/**
	 * Builds a snapshot with the panes, and with the tabs and the workspaces that these panes need. Herdr focuses `w1`.
	 * @param panes - the panes of the snapshot
	 * @returns the snapshot, as Herdr sends it
	 */
	static buildSnapshot(panes: TestPane[]) {
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
				tab_count: tabIds.filter((tabId) => tabId.startsWith(`${workspaceId}:`)).length,
				active_tab_id: tabIds.find((tabId) => tabId.startsWith(`${workspaceId}:`)) ?? '',
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
	 * Starts the stores again, as a new run of Heidrun Code does, reads the snapshot of all the panes, and listens to the
	 * events of Herdr.
	 * @returns the session store
	 */
	static async start() {
		vi.resetModules();
		mocks.snapshot.mockResolvedValue(SessionFocusRequestPaneTest.buildSnapshot(SessionFocusRequestPaneTest.PANES));
		const session = await import('./session');
		await session.refresh();
		await session.start();
		return session;
	}

	/**
	 * Sends the event that Herdr sends when `heidrun_code_ctrl` publishes a focus request on a workspace.
	 * @param workspaceId - the workspace of the request
	 * @param request - the new value of the token `heidrun_focus_request`
	 * @returns nothing, after the window has read the new snapshot
	 */
	static async sendFocusRequest(workspaceId: string, request: string): Promise<void> {
		await mocks.handlers['herdr://event']({
			payload: {
				event: 'workspace_metadata_updated',
				data: {
					workspace: {
						workspace_id: workspaceId,
						tokens: {
							heidrun_focus_request: request,
						},
					},
				},
			},
		});
	}

	/**
	 * Sends the event that Herdr sends when the focus of a workspace changes.
	 * @param workspaceId - the workspace that Herdr focuses
	 * @returns nothing, after the window has read the new snapshot
	 */
	static async sendWorkspaceFocused(workspaceId: string): Promise<void> {
		await mocks.handlers['herdr://event']({
			payload: {
				event: 'workspace_focused',
				data: {
					workspace_id: workspaceId,
				},
			},
		});
	}
}

beforeEach(() => {
	localStorage.clear();
	mocks.snapshot.mockReset();
});

describe('focus request of a pane from heidrun_code_ctrl', () => {
	it('selects the workspace, the tab, and the pane of the request', async () => {
		const session = await SessionFocusRequestPaneTest.start();
		session.selectWorkspace('w2');
		await SessionFocusRequestPaneTest.sendFocusRequest('w1', '1-1;pane=w1:p3');
		expect(session.state.selectedWorkspaceId).toBe('w1');
		expect(session.state.selectedTabId).toBe('w1:t2');
		expect(session.state.selectedPaneId).toBe('w1:p3');
	});

	it('selects another pane of the selected tab for a new request', async () => {
		const session = await SessionFocusRequestPaneTest.start();
		await SessionFocusRequestPaneTest.sendFocusRequest('w1', '1-1;pane=w1:p2');
		expect(session.state.selectedPaneId).toBe('w1:p2');
		await SessionFocusRequestPaneTest.sendFocusRequest('w1', '1-2;pane=w1:p3');
		expect(session.state.selectedTabId).toBe('w1:t2');
		expect(session.state.selectedPaneId).toBe('w1:p3');
	});

	it('keeps the pane when Herdr announces the focus of the workspace after the request', async () => {
		const session = await SessionFocusRequestPaneTest.start();
		session.selectWorkspace('w2');
		await SessionFocusRequestPaneTest.sendFocusRequest('w1', '1-1;pane=w1:p3');
		await SessionFocusRequestPaneTest.sendWorkspaceFocused('w1');
		expect(session.state.selectedTabId).toBe('w1:t2');
		expect(session.state.selectedPaneId).toBe('w1:p3');
	});

	it('keeps the pane of a request that waits for a snapshot when Herdr announces the focus of the workspace', async () => {
		const session = await SessionFocusRequestPaneTest.start();
		session.selectWorkspace('w2');
		let complete: ((snapshot: ReturnType<typeof SessionFocusRequestPaneTest.buildSnapshot>) => void) | undefined;
		mocks.snapshot.mockImplementationOnce(() => new Promise((resolve) => {
			complete = resolve;
		}));
		const refresh = session.refresh();
		await SessionFocusRequestPaneTest.sendFocusRequest('w1', '1-1;pane=w1:p3');
		await SessionFocusRequestPaneTest.sendWorkspaceFocused('w1');
		complete?.(SessionFocusRequestPaneTest.buildSnapshot(SessionFocusRequestPaneTest.PANES));
		await refresh;
		expect(session.state.selectedWorkspaceId).toBe('w1');
		expect(session.state.selectedPaneId).toBe('w1:p3');
	});

	it('selects the workspace alone when the pane of the request is not in the workspace', async () => {
		const session = await SessionFocusRequestPaneTest.start();
		session.selectWorkspace('w2');
		await SessionFocusRequestPaneTest.sendFocusRequest('w1', '1-1;pane=w2:p4');
		expect(session.state.selectedWorkspaceId).toBe('w1');
		expect(session.state.selectedPaneId).not.toBe('w2:p4');
	});

	it('never selects the pane of an older request for a later request of the workspace alone', async () => {
		const session = await SessionFocusRequestPaneTest.start();
		await SessionFocusRequestPaneTest.sendFocusRequest('w1', '1-1;pane=w1:p3');
		const firstPane = session.state.snapshot?.panes.find((pane) => pane.pane_id === 'w1:p1');
		expect(firstPane).toBeDefined();
		if (firstPane === undefined) {
			return;
		}
		session.selectPane(firstPane);
		await Promise.resolve();
		session.selectWorkspace('w2');
		await SessionFocusRequestPaneTest.sendFocusRequest('w1', '1-2');
		expect(session.state.selectedWorkspaceId).toBe('w1');
		expect(session.state.selectedPaneId).toBe('w1:p1');
	});

	it('does not repeat the selection of a pane when unrelated metadata carries the same request', async () => {
		const session = await SessionFocusRequestPaneTest.start();
		await SessionFocusRequestPaneTest.sendFocusRequest('w1', '1-1;pane=w1:p3');
		session.selectWorkspace('w2');
		await SessionFocusRequestPaneTest.sendFocusRequest('w1', '1-1;pane=w1:p3');
		expect(session.state.selectedWorkspaceId).toBe('w2');
	});
});
