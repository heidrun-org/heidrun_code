import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionSnapshot } from '../../lib/types';
import { MireTestFixtures } from '../../lib/mire/mire_test_fixtures';

/** The handlers of the fake `listen`, by event name. */
const handlers = new Map<string, (event: { payload: unknown }) => void>();

/** The Herdr snapshot that the fake `session.snapshot` gives, or null when Herdr does not answer. */
let herdrSnapshot: SessionSnapshot | null = null;

const invoke = vi.fn(async (command: string, payload?: unknown): Promise<unknown> => {
	if (command === 'herdr_request' && (payload as { method?: string } | undefined)?.method === 'session.snapshot') {
		if (herdrSnapshot === null) {
			throw new Error('herdr_unreachable');
		}
		return {
			snapshot: herdrSnapshot,
		};
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
import { MireWindowSession } from './mire_window_session';

/** A Herdr snapshot with one workspace, one tab, and one Claude Code that finished. */
function snapshot(): SessionSnapshot {
	const pane = MireTestFixtures.pane('p1', 'term1', 'w1:t1', {
		agent: 'claude',
		agent_status: 'done',
	});
	return {
		version: 'test',
		protocol: 1,
		workspaces: [MireTestFixtures.workspace('w1', 1, 'DashMenu V2')],
		tabs: [MireTestFixtures.tab('w1:t1', 'w1', 1, 'Claude')],
		panes: [pane],
		layouts: [],
		agents: [pane],
	};
}

/** The number of readings of the Herdr snapshot. */
function readingCount(): number {
	return invoke.mock.calls.filter((call) => call[0] === 'herdr_request').length;
}

beforeEach(() => {
	vi.useFakeTimers();
	invoke.mockClear();
	handlers.clear();
	herdrSnapshot = snapshot();
	state.snapshot = null;
	state.dismissed = {};
	state.selectedPaneId = null;
});

afterEach(() => {
	MireWindowSession.stop();
	vi.useRealTimers();
	state.snapshot = null;
});

describe('MireWindowSession', () => {
	it('reads the Herdr snapshot at the start, and calls no other command of the desktop application', async () => {
		await MireWindowSession.start();
		expect(state.snapshot?.panes.map((pane) => pane.pane_id)).toEqual(['p1']);
		expect(state.connected).toBe(true);
		expect(invoke.mock.calls.map((call) => call[0])).toEqual(['herdr_request']);
		expect(state.selectedPaneId).toBe(null);
		expect(state.activity).toEqual([]);
	});

	it('listens to the Herdr events that every window gets, and reads once for many events in a row', async () => {
		await MireWindowSession.start();
		expect([...handlers.keys()].sort()).toEqual([
			'herdr://connected',
			'herdr://disconnected',
			'herdr://event',
			'herdr://resync',
		]);
		const before = readingCount();
		handlers.get('herdr://event')?.({
			payload: {},
		});
		handlers.get('herdr://event')?.({
			payload: {},
		});
		handlers.get('herdr://resync')?.({
			payload: {},
		});
		await vi.runAllTimersAsync();
		expect(readingCount()).toBe(before + 1);
	});

	it('says that Herdr is not connected when the snapshot cannot be read', async () => {
		herdrSnapshot = null;
		expect(await MireWindowSession.refresh()).toBe(false);
		expect(state.connected).toBe(false);
		expect(state.error).toContain('herdr_unreachable');
	});

	it('follows the Finished cards that the developer closes in the main window', async () => {
		await MireWindowSession.start();
		expect(state.snapshot?.panes[0].agent_status).toBe('done');
		const dismissed = JSON.stringify({
			p1: 'term1:done:0',
		});
		window.dispatchEvent(new StorageEvent('storage', {
			key: 'heidrun.dismissed',
			newValue: dismissed,
		}));
		await vi.runAllTimersAsync();
		expect(state.dismissed).toEqual({
			p1: 'term1:done:0',
		});
		expect(readingCount()).toBe(2);
		expect(state.snapshot?.panes[0].agent_status).not.toBe('done');
	});
});
