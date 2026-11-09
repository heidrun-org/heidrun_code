import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import type { SessionSnapshot } from '../../lib/types';
import { HeidrunCodeDashboardModelBuilder } from '../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_builder';
import { HeidrunCodeDashboardTestFixtures } from '../../lib/heidrun_code_dashboard/heidrun_code_dashboard_test_fixtures';
import type { HeidrunCodeDashboardObservations } from '../../lib/heidrun_code_dashboard/observation_types';

/** The handler of the event of the observations, kept by the fake `listen`. */
let observationsHandler: ((event: { payload: HeidrunCodeDashboardObservations }) => void) | null = null;

/** The answer of the fake `heidrun_code_dashboard_subscribe`. */
let subscribeAnswer: HeidrunCodeDashboardObservations | null = null;

/** The Herdr snapshot that the fake `session.snapshot` gives, or null when Herdr does not answer. */
let herdrSnapshot: SessionSnapshot | null = null;

const invoke = vi.fn(async (command: string, _payload?: unknown): Promise<unknown> => {
	if (command === 'heidrun_code_dashboard_subscribe') {
		return subscribeAnswer;
	}
	if (command === 'herdr_request' && (_payload as { method?: string } | undefined)?.method === 'session.snapshot') {
		if (herdrSnapshot === null) {
			throw new Error('herdr_unreachable');
		}
		return {
			snapshot: herdrSnapshot,
		};
	}
	if (command === 'herdr_paths') {
		return {
			socket: '/home/.config/herdr/sessions/heidrun_development/herdr.sock',
			socket_exists: true,
			bin: '/bin/herdr',
			bin_exists: true,
		};
	}
	return null;
});
const unlisten = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
	invoke: (command: string, payload?: unknown) => invoke(command, payload),
}));
vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(async (name: string, handler: (event: { payload: HeidrunCodeDashboardObservations }) => void) => {
		if (name === 'heidrun_code_dashboard://observations') {
			observationsHandler = handler;
		}
		return unlisten;
	}),
}));
vi.mock('@tauri-apps/api/path', () => ({
	homeDir: vi.fn(async () => '/home'),
}));
vi.mock('@tauri-apps/api/webview', () => ({
	getCurrentWebview: () => ({
		setZoom: vi.fn(async () => {}),
	}),
}));

import { state } from '../session';
import { HeidrunCodeDashboardStore, HeidrunCodeDashboardViewConnection, heidrunCodeDashboardModel, heidrunCodeDashboardSelectedEntry, heidrunCodeDashboardState } from './heidrun_code_dashboard_store';

/** The node identifier of the Claude Code of the snapshot. */
const CLAUDE = HeidrunCodeDashboardModelBuilder.codingAgentNodeId({
	terminal_id: 'term1',
	agent: 'claude',
});

/** A Herdr snapshot with one workspace, one tab, and one Claude Code. */
function snapshot(): SessionSnapshot {
	const pane = HeidrunCodeDashboardTestFixtures.pane('p1', 'term1', 'w1:t1', {
		agent: 'claude',
		agent_status: 'working',
		tokens: {
			hd_sid: 's1',
		},
	});
	return {
		version: 'test',
		protocol: 1,
		workspaces: [HeidrunCodeDashboardTestFixtures.workspace('w1', 1, 'DashMenu V2')],
		tabs: [HeidrunCodeDashboardTestFixtures.tab('w1:t1', 'w1', 1, 'Claude')],
		panes: [pane],
		layouts: [],
		agents: [pane],
	};
}

/** Observations of the session `s1`, with the given subagents, at the current time. */
function observations(subagentIds: string[]): HeidrunCodeDashboardObservations {
	return HeidrunCodeDashboardTestFixtures.observations({
		observedAtMs: Date.now(),
		sessions: [
			HeidrunCodeDashboardTestFixtures.claudeSession('s1', {
				observedAtMs: Date.now(),
				subagents: subagentIds.map((id) => HeidrunCodeDashboardTestFixtures.claudeSubagent(id)),
			}),
		],
	});
}

/** Waits for the promises of the fake Tauri bridge. */
async function flush(): Promise<void> {
	for (let index = 0; index < 5; index += 1) {
		await Promise.resolve();
	}
	await nextTick();
}

beforeEach(() => {
	invoke.mockClear();
	unlisten.mockClear();
	observationsHandler = null;
	subscribeAnswer = null;
	state.snapshot = snapshot();
	herdrSnapshot = snapshot();
	heidrunCodeDashboardState.displayMode = 'modal';
	heidrunCodeDashboardState.observations = null;
	heidrunCodeDashboardState.filter = null;
	heidrunCodeDashboardState.selectedPath = ['heidrun'];
	heidrunCodeDashboardState.selectedFreshness = null;
});

afterEach(() => {
	state.snapshot = null;
});

describe('HeidrunCodeDashboardViewConnection', () => {
	it('subscribes with a unique view identifier and listens to the observations when a view opens', async () => {
		subscribeAnswer = observations(['a1']);
		const first = new HeidrunCodeDashboardViewConnection();
		const second = new HeidrunCodeDashboardViewConnection();
		expect(first.viewId).not.toBe(second.viewId);
		await first.open();
		expect(invoke).toHaveBeenCalledWith('heidrun_code_dashboard_subscribe', {
			viewId: first.viewId,
		});
		expect(observationsHandler).not.toBeNull();
		expect(heidrunCodeDashboardModel.value.counters.subagents.total).toBe(1);
		expect(heidrunCodeDashboardState.herdrSessionName).toBe('heidrun_development');
		await first.close();
	});

	it('builds the model again when new observations arrive', async () => {
		const connection = new HeidrunCodeDashboardViewConnection();
		await connection.open();
		expect(heidrunCodeDashboardModel.value.counters.subagents.total).toBe(0);
		observationsHandler?.({
			payload: observations(['a1', 'a2']),
		});
		expect(heidrunCodeDashboardModel.value.counters.subagents.total).toBe(2);
		await connection.close();
	});

	it('unsubscribes and stops listening when the view closes, and forgets the observations', async () => {
		subscribeAnswer = observations(['a1']);
		const connection = new HeidrunCodeDashboardViewConnection();
		await connection.open();
		await connection.close();
		expect(invoke).toHaveBeenCalledWith('heidrun_code_dashboard_unsubscribe', {
			viewId: connection.viewId,
		});
		expect(unlisten).toHaveBeenCalledTimes(1);
		expect(heidrunCodeDashboardState.observations).toBeNull();
	});

	it('leaves the collector at once when the view closes before the subscription ends', async () => {
		const connection = new HeidrunCodeDashboardViewConnection();
		const opening = connection.open();
		await connection.close();
		await opening;
		await flush();
		expect(unlisten).toHaveBeenCalledTimes(1);
		const subscribed = invoke.mock.calls.filter((call) => call[0] === 'heidrun_code_dashboard_subscribe').length;
		const unsubscribed = invoke.mock.calls.filter((call) => call[0] === 'heidrun_code_dashboard_unsubscribe').length;
		expect(unsubscribed).toBeGreaterThanOrEqual(subscribed);
	});
});

describe('HeidrunCodeDashboardStore', () => {
	it('reads the session name from the socket path, and gives null for another form', () => {
		expect(HeidrunCodeDashboardStore.sessionNameOfSocket('/home/.config/herdr/sessions/heidrun/herdr.sock')).toBe('heidrun');
		expect(HeidrunCodeDashboardStore.sessionNameOfSocket('/tmp/custom.sock')).toBeNull();
	});

	it('turns a filter on, off with a second click, and off with All', () => {
		HeidrunCodeDashboardStore.toggleFilter('working');
		expect(heidrunCodeDashboardState.filter).toBe('working');
		HeidrunCodeDashboardStore.toggleFilter('working');
		expect(heidrunCodeDashboardState.filter).toBeNull();
		HeidrunCodeDashboardStore.toggleFilter('blocked');
		HeidrunCodeDashboardStore.clearFilter();
		expect(heidrunCodeDashboardState.filter).toBeNull();
	});

	it('moves the selection to the nearest ancestor that shows when the selected subagent disappears', async () => {
		const connection = new HeidrunCodeDashboardViewConnection();
		await connection.open();
		observationsHandler?.({
			payload: observations(['a1']),
		});
		HeidrunCodeDashboardStore.select(HeidrunCodeDashboardModelBuilder.claudeSubagentNodeId('s1', 'a1'));
		expect(heidrunCodeDashboardSelectedEntry.value.label).toBe('subagent a1');
		observationsHandler?.({
			payload: observations([]),
		});
		await nextTick();
		expect(heidrunCodeDashboardSelectedEntry.value.nodeId).toBe(CLAUDE);
		HeidrunCodeDashboardStore.clearSelection();
		expect(heidrunCodeDashboardSelectedEntry.value.nodeId).toBe('heidrun');
		await connection.close();
	});

	it('selects the exact pane in the main window for "Open in Heidrun Code"', async () => {
		expect(await HeidrunCodeDashboardStore.openInHeidrunCode({
			kind: 'pane',
			id: 'p1',
		})).toBe('opened');
		expect(state.selectedWorkspaceId).toBe('w1');
		expect(state.selectedTabId).toBe('w1:t1');
		expect(state.selectedPaneId).toBe('p1');
		expect(invoke).toHaveBeenCalledWith('herdr_request', {
			method: 'session.snapshot',
			params: {},
		});
	});

	it('selects a workspace, or a tab with its workspace, in the main window, and opens nothing when it is gone', async () => {
		const withTwoTabs = snapshot();
		withTwoTabs.tabs.push(HeidrunCodeDashboardTestFixtures.tab('w1:t2', 'w1', 2, 'Second'));
		herdrSnapshot = withTwoTabs;
		state.selectedWorkspaceId = null;
		expect(await HeidrunCodeDashboardStore.openInHeidrunCode({
			kind: 'workspace',
			id: 'w1',
		})).toBe('opened');
		expect(state.selectedWorkspaceId).toBe('w1');
		expect(await HeidrunCodeDashboardStore.openInHeidrunCode({
			kind: 'tab',
			id: 'w1:t2',
		})).toBe('opened');
		expect(state.selectedWorkspaceId).toBe('w1');
		expect(state.selectedTabId).toBe('w1:t2');
		expect(await HeidrunCodeDashboardStore.openInHeidrunCode({
			kind: 'tab',
			id: 'w1:t9',
		})).toBe('gone');
		expect(await HeidrunCodeDashboardStore.openInHeidrunCode({
			kind: 'workspace',
			id: 'w9',
		})).toBe('gone');
		expect(state.selectedTabId).toBe('w1:t2');
		expect(heidrunCodeDashboardState.openFailure).toBe('gone');
	});

	it('reads the Herdr snapshot again before "Open in Heidrun Code": a moved pane opens at its current place', async () => {
		const moved = snapshot();
		moved.tabs.push(HeidrunCodeDashboardTestFixtures.tab('w1:t2', 'w1', 2, 'Moved'));
		moved.panes = moved.panes.map((pane) => ({
			...pane,
			tab_id: 'w1:t2',
		}));
		moved.agents = moved.panes;
		herdrSnapshot = moved;
		expect(await HeidrunCodeDashboardStore.openInHeidrunCode({
			kind: 'pane',
			id: 'p1',
		})).toBe('opened');
		expect(state.selectedTabId).toBe('w1:t2');
		expect(state.selectedPaneId).toBe('p1');
	});

	it('does nothing for a pane that is gone, or when Herdr does not answer', async () => {
		state.selectedPaneId = null;
		herdrSnapshot = {
			...snapshot(),
			panes: [],
			agents: [],
		};
		expect(await HeidrunCodeDashboardStore.openInHeidrunCode({
			kind: 'pane',
			id: 'p1',
		})).toBe('gone');
		expect(state.selectedPaneId).toBe(null);
		herdrSnapshot = null;
		expect(await HeidrunCodeDashboardStore.openInHeidrunCode({
			kind: 'pane',
			id: 'p1',
		})).toBe('unavailable');
		expect(state.selectedPaneId).toBe(null);
	});

	it('in the separate window, asks the main window after the new reading, and never changes the selection itself', async () => {
		heidrunCodeDashboardState.displayMode = 'window';
		state.selectedPaneId = null;
		expect(await HeidrunCodeDashboardStore.openInHeidrunCode({
			kind: 'pane',
			id: 'p1',
		})).toBe('opened');
		expect(invoke).toHaveBeenCalledWith('heidrun_code_dashboard_open_in_main_window', {
			kind: 'pane',
			id: 'p1',
		});
		expect(state.selectedPaneId).toBe(null);
		invoke.mockClear();
		herdrSnapshot = {
			...snapshot(),
			panes: [],
			agents: [],
		};
		expect(await HeidrunCodeDashboardStore.openInHeidrunCode({
			kind: 'pane',
			id: 'p1',
		})).toBe('gone');
		expect(invoke.mock.calls.some((call) => call[0] === 'heidrun_code_dashboard_open_in_main_window')).toBe(false);
	});

	it('gives each view of each display mode its own identifier', () => {
		heidrunCodeDashboardState.displayMode = 'window';
		const windowView = new HeidrunCodeDashboardViewConnection();
		heidrunCodeDashboardState.displayMode = 'modal';
		const modalView = new HeidrunCodeDashboardViewConnection();
		expect(windowView.viewId.startsWith('heidrun_code_dashboard_view_window_')).toBe(true);
		expect(modalView.viewId.startsWith('heidrun_code_dashboard_view_modal_')).toBe(true);
	});
});
