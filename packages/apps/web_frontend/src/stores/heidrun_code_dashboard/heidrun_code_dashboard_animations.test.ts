import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import type { AgentInfo, SessionSnapshot } from '../../lib/types';
import type { HeidrunCodeDashboardObservations } from '../../lib/heidrun_code_dashboard/observation_types';
import { HeidrunCodeDashboardViewTestSupport, TEST_NODES, TEST_NOW_MS } from '../../components/heidrun_code_dashboard/heidrun_code_dashboard_view_test_support';

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

import { state } from '../session';
import { HeidrunCodeDashboardAnimations, heidrunCodeDashboardAnimationState } from './heidrun_code_dashboard_animations';
import { heidrunCodeDashboardState } from './heidrun_code_dashboard_store';

/** Stops the follower of the test, when one runs. */
let stop: (() => void) | null = null;

/**
 * Gives the test snapshot with another status of Herdr for one pane.
 * @param paneId The pane identifier.
 * @param status The new status.
 * @returns The snapshot.
 */
function snapshotWith(paneId: string, status: AgentInfo['agent_status']): SessionSnapshot {
	const snapshot = HeidrunCodeDashboardViewTestSupport.snapshot();
	const panes = snapshot.panes.map((pane) => pane.pane_id === paneId ? {
		...pane,
		agent_status: status,
	} : pane);
	return {
		...snapshot,
		panes,
		agents: panes,
	};
}

/**
 * Gives the test observations with more messages in the Claude Code session s1.
 * @param messageIds The identifiers of the messages to add, from the subagent a1 to the session.
 * @param delivery The delivery of the added messages.
 * @returns The observations.
 */
function observationsWith(messageIds: string[], delivery: 'queued' | 'received' = 'received'): HeidrunCodeDashboardObservations {
	const observations = HeidrunCodeDashboardViewTestSupport.observations();
	for (const id of messageIds) {
		observations.claude.sessions[0].messages.push({
			id,
			atMs: TEST_NOW_MS,
			fromId: 'a1',
			toId: 's1',
			text: `text ${id}`,
			contentAvailability: 'available',
			delivery,
		});
	}
	return observations;
}

/** The kinds and the targets of the effects that are shown. */
function effects(): string[] {
	return heidrunCodeDashboardAnimationState.effects.map((effect) =>
		effect.kind === 'message' ? `message ${effect.message.nativeId}` : `${effect.kind} ${effect.nodeId}`);
}

/**
 * Mocks the media query of reduced motion.
 * @param matches True when the system asks for reduced motion.
 */
function mockReducedMotion(matches: boolean) {
	window.matchMedia = vi.fn((query: string) => ({
		matches: matches && query === '(prefers-reduced-motion: reduce)',
	})) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
	mockReducedMotion(false);
	heidrunCodeDashboardAnimationState.isPaused = false;
	state.snapshot = HeidrunCodeDashboardViewTestSupport.snapshot();
	heidrunCodeDashboardState.observations = HeidrunCodeDashboardViewTestSupport.observations();
	heidrunCodeDashboardState.nowMs = TEST_NOW_MS;
});

afterEach(() => {
	stop?.();
	stop = null;
	state.snapshot = null;
	heidrunCodeDashboardState.observations = null;
});

describe('HeidrunCodeDashboardAnimations', () => {
	it('gives no effect for the first model, one burst for a real completion, and none for a rebuild', async () => {
		stop = HeidrunCodeDashboardAnimations.start();
		expect(effects()).toEqual([]);
		state.snapshot = snapshotWith('p1', 'done');
		await nextTick();
		expect(effects()).toEqual([`completed ${TEST_NODES.claude}`]);
		heidrunCodeDashboardState.nowMs = TEST_NOW_MS + 2_000;
		await nextTick();
		state.snapshot = snapshotWith('p1', 'done');
		await nextTick();
		expect(effects()).toEqual([`completed ${TEST_NODES.claude}`]);
	});

	it('gives a red flash for a new blocked item', async () => {
		stop = HeidrunCodeDashboardAnimations.start();
		state.snapshot = snapshotWith('p1', 'blocked');
		await nextTick();
		expect(effects()).toEqual([`blocked ${TEST_NODES.claude}`]);
	});

	it('animates only the messages that are new since the view opened, and replays none at a new opening', async () => {
		stop = HeidrunCodeDashboardAnimations.start();
		heidrunCodeDashboardState.observations = observationsWith(['m2']);
		await nextTick();
		expect(effects()).toEqual(['message m2']);
		stop();
		heidrunCodeDashboardState.observations = null;
		stop = HeidrunCodeDashboardAnimations.start();
		expect(effects()).toEqual([]);
		heidrunCodeDashboardState.observations = observationsWith(['m2', 'm3']);
		await nextTick();
		expect(effects()).toEqual([]);
		heidrunCodeDashboardState.observations = observationsWith(['m2', 'm3', 'm4'], 'queued');
		await nextTick();
		expect(effects()).toEqual(['message m4']);
		expect(heidrunCodeDashboardAnimationState.effects[0].kind === 'message' && heidrunCodeDashboardAnimationState.effects[0].message.delivery).toBe('queued');
	});

	it('draws no effect for a message whose two ends are unmatched', async () => {
		stop = HeidrunCodeDashboardAnimations.start();
		const observations = HeidrunCodeDashboardViewTestSupport.observations();
		observations.claude.sessions[0].messages.push({
			id: 'm9',
			atMs: TEST_NOW_MS,
			fromId: 'peer-a',
			toId: 'peer-b',
			text: 'hello',
			contentAvailability: 'available',
			delivery: 'received',
		});
		heidrunCodeDashboardState.observations = observations;
		await nextTick();
		expect(effects()).toEqual([]);
	});

	it('removes an effect at the end of its animation, or at the next model after its longest life', async () => {
		stop = HeidrunCodeDashboardAnimations.start();
		state.snapshot = snapshotWith('p1', 'done');
		await nextTick();
		HeidrunCodeDashboardAnimations.removeEffect(heidrunCodeDashboardAnimationState.effects[0].id);
		expect(effects()).toEqual([]);
		state.snapshot = snapshotWith('p1', 'working');
		await nextTick();
		state.snapshot = snapshotWith('p1', 'done');
		await nextTick();
		expect(effects()).toHaveLength(1);
		heidrunCodeDashboardState.nowMs = TEST_NOW_MS + 10_000;
		await nextTick();
		expect(effects()).toEqual([]);
	});

	it('adds no effect during a pause while the data keeps updating, and replays nothing at the resume', async () => {
		stop = HeidrunCodeDashboardAnimations.start();
		HeidrunCodeDashboardAnimations.togglePause();
		expect(heidrunCodeDashboardAnimationState.isPaused).toBe(true);
		state.snapshot = snapshotWith('p1', 'done');
		heidrunCodeDashboardState.observations = observationsWith(['m2']);
		await nextTick();
		expect(effects()).toEqual([]);
		HeidrunCodeDashboardAnimations.togglePause();
		await nextTick();
		expect(effects()).toEqual([]);
		state.snapshot = snapshotWith('p1', 'done');
		await nextTick();
		expect(effects()).toEqual([]);
	});

	it('starts paused when the system asks for reduced motion', () => {
		mockReducedMotion(true);
		stop = HeidrunCodeDashboardAnimations.start();
		expect(heidrunCodeDashboardAnimationState.isPaused).toBe(true);
	});

	it('follows nothing and keeps no effect after the stop', async () => {
		stop = HeidrunCodeDashboardAnimations.start();
		state.snapshot = snapshotWith('p1', 'done');
		await nextTick();
		stop();
		stop = null;
		expect(effects()).toEqual([]);
		state.snapshot = snapshotWith('p1', 'blocked');
		await nextTick();
		expect(effects()).toEqual([]);
	});
});
