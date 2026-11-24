import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentStatus, SessionSnapshot } from '../lib/types';

const mocks = vi.hoisted(() => ({
	snapshot: vi.fn(),
	read: vi.fn(async (): Promise<string> => ''),
}));

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(async () => null),
}));
vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(async () => () => {}),
}));
vi.mock('@tauri-apps/api/path', () => ({
	homeDir: vi.fn(async () => '/home'),
}));
vi.mock('@tauri-apps/api/webview', () => ({
	getCurrentWebview: () => ({
		setZoom: vi.fn(async () => {}),
	}),
}));
vi.mock('../lib/notify', () => ({
	notify: vi.fn(),
	notifyPhone: vi.fn(async () => {}),
}));
vi.mock('../lib/api', () => ({
	snapshot: mocks.snapshot,
	read: mocks.read,
	watchPanes: vi.fn(async () => {}),
	codexUsage: vi.fn(async () => ({
		available: false,
		sessions: {},
	})),
}));

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	SessionTextDetectionTest — the family "questionsAndChoices" follows its switch (issue #638)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The screen text of a coding agent that finished its answer with a question. */
const SCREEN_WITH_QUESTION = ['● Done with the change.', '', '  Should I open a pull request?'].join('\n');

/** The screen text of a coding agent that waits for a choice. */
const SCREEN_WITH_MENU = ['Do you want to run this command?', '  git status', '❯ 1. Yes', '  2. No'].join('\n');

/** Builds snapshots and starts the session store for the tests of the switch of the questions and the choices. */
class SessionTextDetectionTest {
	/**
	 * Builds a snapshot with one pane of a coding agent.
	 *
	 * @param status - The status of the pane.
	 * @param sequence - The sequence number of the lifecycle of the pane.
	 * @returns The snapshot.
	 */
	static snapshot(status: AgentStatus, sequence: number): SessionSnapshot {
		const pane = {
			pane_id: 'p1',
			terminal_id: 'terminal1',
			workspace_id: 'w1',
			tab_id: 't1',
			focused: false,
			agent: 'claude',
			agent_status: status,
			revision: sequence,
		};
		return {
			version: 'test',
			protocol: 22,
			workspaces: [
				{
					workspace_id: 'w1',
					number: 1,
					label: 'Test workspace',
					focused: false,
					pane_count: 1,
					tab_count: 1,
					active_tab_id: 't1',
					agent_status: status,
				},
			],
			tabs: [
				{
					tab_id: 't1',
					workspace_id: 'w1',
					number: 1,
					label: 'Test tab',
					focused: false,
					pane_count: 1,
					agent_status: status,
				},
			],
			panes: [pane],
			agents: [
				{
					...pane,
					state_change_seq: sequence,
					completion_seq: status === 'done' ? sequence : undefined,
				},
			],
			layouts: [],
		};
	}

	/**
	 * Starts a fresh session store, and applies a first snapshot.
	 *
	 * @param status - The status of the pane in the first snapshot.
	 * @returns The session store and the settings.
	 */
	static async start(status: AgentStatus) {
		const session = await import('./session');
		const { settings } = await import('./settings');
		mocks.snapshot.mockResolvedValue(SessionTextDetectionTest.snapshot(status, 1));
		await session.refresh();
		return { session, settings };
	}

	/**
	 * Applies the next snapshot, and lets the reading of the screen end.
	 *
	 * @param session - The session store.
	 * @param status - The status of the pane in the snapshot.
	 * @param sequence - The sequence number of the lifecycle of the pane.
	 */
	static async next(session: typeof import('./session'), status: AgentStatus, sequence: number): Promise<void> {
		mocks.snapshot.mockResolvedValue(SessionTextDetectionTest.snapshot(status, sequence));
		await session.refresh();
		await vi.advanceTimersByTimeAsync(3000);
	}
}

beforeEach(() => {
	vi.resetModules();
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-10-22T10:00:00Z'));
	localStorage.clear();
	mocks.snapshot.mockReset();
	mocks.read.mockReset();
});

afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
});

describe('the question at the end of the answer of a coding agent', () => {
	it('is read when terminal reference detection is off', async () => {
		mocks.read.mockResolvedValue(SCREEN_WITH_QUESTION);
		const { session, settings } = await SessionTextDetectionTest.start('working');
		settings.terminalTextDetection = false;
		await SessionTextDetectionTest.next(session, 'done', 2);
		expect(session.state.questions.p1?.text).toBe('Should I open a pull request?');
	});
});

describe('the numbered menu of a blocked coding agent', () => {
	it('is read when terminal reference detection is off', async () => {
		mocks.read.mockResolvedValue(SCREEN_WITH_MENU);
		const { session, settings } = await SessionTextDetectionTest.start('working');
		settings.terminalTextDetection = false;
		await SessionTextDetectionTest.next(session, 'blocked', 2);
		expect(session.state.choices.p1?.options).toHaveLength(2);
	});
});
