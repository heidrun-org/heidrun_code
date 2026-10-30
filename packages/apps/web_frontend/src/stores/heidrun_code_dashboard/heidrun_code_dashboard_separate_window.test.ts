import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import type { SessionSnapshot } from '../../lib/types';
import { HeidrunCodeDashboardViewTestSupport } from '../../components/heidrun_code_dashboard/heidrun_code_dashboard_view_test_support';

/** The handlers of the fake `listen`, by event name. */
const handlers = new Map<string, (event: { payload: unknown }) => void>();

/** The Herdr snapshot that the fake `session.snapshot` gives. */
let herdrSnapshot: SessionSnapshot = HeidrunCodeDashboardViewTestSupport.snapshot();

/** The answers of the fake `heidrun_code_dashboard_window_open`, one for each call. */
let windowOpenAnswers: unknown[] = [];

const invoke = vi.fn(async (command: string, payload?: unknown): Promise<unknown> => {
	if (command === 'herdr_request' && (payload as { method?: string } | undefined)?.method === 'session.snapshot') {
		return {
			snapshot: herdrSnapshot,
		};
	}
	if (command === 'heidrun_code_dashboard_window_open') {
		const answer = windowOpenAnswers.shift();
		if (answer instanceof Error) {
			throw answer;
		}
		return answer;
	}
	return null;
});

vi.mock('@tauri-apps/api/core', () => ({
	invoke: (command: string, payload?: unknown) => invoke(command, payload),
}));
vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
		handlers.set(name, handler);
		return () => handlers.delete(name);
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
import { HEIDRUN_CODE_DASHBOARD_OPEN_IN_MAIN_WINDOW_EVENT, HeidrunCodeDashboardSeparateWindow } from './heidrun_code_dashboard_separate_window';
import { heidrunCodeDashboardState } from './heidrun_code_dashboard_store';

beforeEach(() => {
	invoke.mockClear();
	handlers.clear();
	herdrSnapshot = HeidrunCodeDashboardViewTestSupport.snapshot();
	windowOpenAnswers = [];
	state.snapshot = HeidrunCodeDashboardViewTestSupport.snapshot();
	state.selectedPaneId = null;
	state.toast = '';
	heidrunCodeDashboardState.displayMode = 'modal';
});

afterEach(() => {
	state.snapshot = null;
});

describe('HeidrunCodeDashboardSeparateWindow', () => {
	it('opens the window once, and a second request focuses the same window', async () => {
		windowOpenAnswers = ['opened', 'focused'];
		expect(await HeidrunCodeDashboardSeparateWindow.open()).toBe(true);
		expect(await HeidrunCodeDashboardSeparateWindow.open()).toBe(true);
		expect(invoke.mock.calls.filter((call) => call[0] === 'heidrun_code_dashboard_window_open')).toHaveLength(2);
	});

	it('says false when the window cannot open', async () => {
		windowOpenAnswers = [new Error('heidrun_code_dashboard_window_open_failed')];
		expect(await HeidrunCodeDashboardSeparateWindow.open()).toBe(false);
	});

	it('shows in the main window the pane that the separate window asks for, after a new reading of Herdr', async () => {
		await HeidrunCodeDashboardSeparateWindow.listenToOpenRequests();
		handlers.get(HEIDRUN_CODE_DASHBOARD_OPEN_IN_MAIN_WINDOW_EVENT)?.({
			payload: {
				kind: 'pane',
				id: 'p3',
			},
		});
		await flushPromises();
		expect(invoke).toHaveBeenCalledWith('herdr_request', {
			method: 'session.snapshot',
			params: {},
		});
		expect(state.selectedWorkspaceId).toBe('w1');
		expect(state.selectedTabId).toBe('w1:t2');
		expect(state.selectedPaneId).toBe('p3');
		expect(state.toast).toBe('');
	});

	it('shows a message in the main window and selects nothing when the pane is gone', async () => {
		herdrSnapshot = {
			...HeidrunCodeDashboardViewTestSupport.snapshot(),
			panes: HeidrunCodeDashboardViewTestSupport.snapshot().panes.filter((pane) => pane.pane_id !== 'p3'),
			agents: [],
		};
		expect(await HeidrunCodeDashboardSeparateWindow.openRequestedTarget({
			kind: 'pane',
			id: 'p3',
		})).toBe('gone');
		expect(state.selectedPaneId).not.toBe('p3');
		expect(state.toast).toBe('It is not in the Herdr session any more: nothing was opened.');
	});
});
