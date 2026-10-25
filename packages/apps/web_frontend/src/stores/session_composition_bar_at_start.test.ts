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
//	SessionCompositionBarAtStartTest — the composition bar of the coding agents that Herdr kept running (issue 865)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One pane of a test snapshot: its name and the coding agent that Herdr found in it. */
type TestPane = {
	/** Name of the pane in Herdr. */
	paneId: string;
	/** The coding agent that Herdr found in the pane, or null for a plain terminal. */
	agent: string | null;
};

/** Builds snapshots and starts the stores for the tests of the composition bar at the start. */
class SessionCompositionBarAtStartTest {
	/** The panes of the first snapshot: the three coding agents and one plain terminal. */
	static readonly PANES: TestPane[] = [
		{ paneId: 'w1:p1', agent: 'claude' },
		{ paneId: 'w1:p2', agent: 'codex' },
		{ paneId: 'w1:p3', agent: 'agy' },
		{ paneId: 'w1:p4', agent: null },
	];

	/**
	 * Builds a snapshot of one workspace and one tab that hold the given panes.
	 *
	 * @param panes - The panes of the snapshot.
	 * @returns The snapshot, as Herdr sends it.
	 */
	static buildSnapshot(panes: TestPane[]) {
		return {
			version: 'test',
			protocol: 1,
			focused_workspace_id: 'w1',
			workspaces: [
				{
					workspace_id: 'w1',
					number: 1,
					label: 'w1',
					focused: true,
					pane_count: panes.length,
					tab_count: 1,
					active_tab_id: 'w1:t1',
					agent_status: 'unknown',
				},
			],
			tabs: [
				{
					tab_id: 'w1:t1',
					workspace_id: 'w1',
					number: 1,
					label: 'w1:t1',
					focused: true,
					pane_count: panes.length,
					agent_status: 'unknown',
				},
			],
			panes: panes.map((pane) => ({
				pane_id: pane.paneId,
				terminal_id: `terminal-${pane.paneId}`,
				workspace_id: 'w1',
				tab_id: 'w1:t1',
				focused: false,
				agent: pane.agent,
				agent_status: 'unknown',
				revision: 1,
			})),
			layouts: [],
			agents: [],
		};
	}

	/**
	 * Starts the stores again, as a new run of Heidrun Code does, and reads the first snapshot.
	 *
	 * @param isCompositionBarShownOnAgentStart - The value of the switch "Show the composition bar when starting a coding agent".
	 * @returns The session store and the composition bar store.
	 */
	static async start(isCompositionBarShownOnAgentStart: boolean) {
		vi.resetModules();
		mocks.snapshot.mockResolvedValue(SessionCompositionBarAtStartTest.buildSnapshot(SessionCompositionBarAtStartTest.PANES));
		const { settings } = await import('./settings');
		settings.isCompositionBarShownOnAgentStart = isCompositionBarShownOnAgentStart;
		const session = await import('./session');
		const { CompositionBar } = await import('./composition_bar');
		await session.refresh();
		return { session, CompositionBar };
	}
}

beforeEach(() => {
	localStorage.clear();
	mocks.snapshot.mockReset();
});

describe('the composition bar of the coding agents that Herdr kept running', () => {
	it('opens the composition bar of Claude Code, Codex, and Antigravity when the switch is on', async () => {
		const { CompositionBar } = await SessionCompositionBarAtStartTest.start(true);
		expect(CompositionBar.forPane('w1:p1').isOpen).toBe(true);
		expect(CompositionBar.forPane('w1:p2').isOpen).toBe(true);
		expect(CompositionBar.forPane('w1:p3').isOpen).toBe(true);
	});

	it('leaves the composition bar of a plain terminal closed when the switch is on', async () => {
		const { CompositionBar } = await SessionCompositionBarAtStartTest.start(true);
		expect(CompositionBar.forPane('w1:p4').isOpen).toBe(false);
	});

	it('leaves every composition bar closed when the switch is off', async () => {
		const { CompositionBar } = await SessionCompositionBarAtStartTest.start(false);
		expect(CompositionBar.forPane('w1:p1').isOpen).toBe(false);
		expect(CompositionBar.forPane('w1:p2').isOpen).toBe(false);
		expect(CompositionBar.forPane('w1:p3').isOpen).toBe(false);
		expect(CompositionBar.forPane('w1:p4').isOpen).toBe(false);
	});

	it('does not open the composition bar of a pane that appears in a later snapshot', async () => {
		const { session, CompositionBar } = await SessionCompositionBarAtStartTest.start(true);
		const laterPanes = [...SessionCompositionBarAtStartTest.PANES, { paneId: 'w1:p5', agent: 'claude' }];
		mocks.snapshot.mockResolvedValue(SessionCompositionBarAtStartTest.buildSnapshot(laterPanes));
		await session.refresh();
		expect(CompositionBar.forPane('w1:p5').isOpen).toBe(false);
	});

	it('does not open again a composition bar that the developer closed after the start', async () => {
		const { session, CompositionBar } = await SessionCompositionBarAtStartTest.start(true);
		CompositionBar.forPane('w1:p1').isOpen = false;
		await session.refresh();
		expect(CompositionBar.forPane('w1:p1').isOpen).toBe(false);
	});
});
