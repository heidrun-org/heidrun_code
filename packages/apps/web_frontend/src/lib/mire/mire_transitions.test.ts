// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentInfo } from '../types';
import { MireMessages } from './mire_messages';
import { MireModelBuilder } from './mire_model_builder';
import type { MireTransitionState } from './mire_transitions';
import { MireTransitions } from './mire_transitions';
import type { ClaudeSubagentObservation, MessageObservation } from './observation_types';
import { MireTestFixtures, NOW_MS } from './mire_test_fixtures';

const fixtures = MireTestFixtures;

const CODING_AGENT = 'coding_agent:term_a:claude';
const SUBAGENT = 'subagent:claude:s1:a1';

/** The parts of one test scene. */
type Scene = {
	/** The status of Herdr of the Claude Code pane. */
	herdrStatus?: AgentInfo['agent_status'];
	/** The native status of the subagent a1, or null for no subagent. */
	subagentStatus?: ClaudeSubagentObservation['nativeStatus'] | null;
	/** The messages of the session s1. */
	messages?: MessageObservation[];
	/** False when no observation arrived. */
	isObserved?: boolean;
	/** True when the observations are stale. */
	isStale?: boolean;
};

/**
 * Builds the model and the messages of one Claude Code pane (session s1) with one subagent a1 in one workspace.
 * @param scene The parts of the scene.
 * @returns The model and the messages.
 */
function build(scene: Scene = {}) {
	const subagentStatus = scene.subagentStatus === undefined ? 'running' : scene.subagentStatus;
	const observations = scene.isObserved === false ? null : fixtures.observations({
		observedAtMs: scene.isStale === true ? NOW_MS - 60_000 : NOW_MS,
		sessions: [
			fixtures.claudeSession('s1', {
				isStale: scene.isStale === true,
				subagents: subagentStatus === null ? [] : [fixtures.claudeSubagent('a1', {
					nativeStatus: subagentStatus,
				})],
				messages: scene.messages ?? [],
			}),
		],
	});
	const model = MireModelBuilder.build(fixtures.input({
		workspaces: [fixtures.workspace('w1', 1, 'one')],
		tabs: [fixtures.tab('w1:t1', 'w1', 1, 'A')],
		panes: [
			fixtures.pane('w1:p1', 'term_a', 'w1:t1', {
				agent: 'claude',
				agent_status: scene.herdrStatus ?? 'working',
				tokens: {
					hd_sid: 's1',
				},
			}),
		],
		observations,
	}));
	return {
		model,
		messages: MireMessages.collect(observations, model),
	};
}

/**
 * Compares a list of scenes in order, from the first model of a view.
 * @param scenes The scenes.
 * @returns The kinds and the targets of the transitions of each step after the first one, and the last state.
 */
function run(scenes: Scene[]) {
	let state: MireTransitionState | null = null;
	const steps: string[][] = [];
	scenes.forEach((scene, index) => {
		const { model, messages } = build(scene);
		const result = MireTransitions.compare(state, model, messages);
		state = result.state;
		const step = result.transitions.map((transition) =>
			transition.kind === 'message' ? `message ${transition.message.nativeId}` : `${transition.kind} ${transition.nodeId}`);
		if (index > 0) {
			steps.push(step);
		} else {
			expect(step).toEqual([]);
		}
	});
	return {
		steps,
		state: state as MireTransitionState | null,
	};
}

describe('MireTransitions.compare', () => {
	it('gives no transition for the first model of a view, even with Finished items and old messages', () => {
		const { model, messages } = build({
			herdrStatus: 'done',
			subagentStatus: 'completed',
			messages: [fixtures.message('m1', 's1', 'a1')],
		});
		const result = MireTransitions.compare(null, model, messages);
		expect(result.transitions).toEqual([]);
		expect(result.state.knownStatuses.get(CODING_AGENT)).toBe('finished');
		expect([...result.state.seenMessageIds ?? []]).toEqual(['claude_observer:s1:m1']);
	});

	it('gives one completion for each real change to Finished, and none for a rebuild with the same status', () => {
		const { steps } = run([
			{ subagentStatus: 'running' },
			{ subagentStatus: 'completed' },
			{ subagentStatus: 'completed' },
			{ subagentStatus: 'completed' },
		]);
		expect(steps).toEqual([[`completed ${SUBAGENT}`], [], []]);
	});

	it('gives a completion of the coding agent from the status of Herdr', () => {
		const { steps } = run([
			{ herdrStatus: 'working' },
			{ herdrStatus: 'done' },
			{ herdrStatus: 'done' },
		]);
		expect(steps).toEqual([[`completed ${CODING_AGENT}`], []]);
	});

	it('gives no completion again after a reconnection or a stale period of the collector', () => {
		const { steps } = run([
			{ subagentStatus: 'running' },
			{ subagentStatus: 'completed' },
			{ subagentStatus: 'completed', isStale: true },
			{ isObserved: false },
			{ subagentStatus: 'completed' },
		]);
		expect(steps).toEqual([[`completed ${SUBAGENT}`], [], [], []]);
	});

	it('gives no completion for an item that is already Finished when it first appears', () => {
		const { steps } = run([
			{ subagentStatus: null },
			{ subagentStatus: 'completed' },
		]);
		expect(steps).toEqual([[]]);
	});

	it('gives a new blocked item once', () => {
		const { steps } = run([
			{ herdrStatus: 'working' },
			{ herdrStatus: 'blocked' },
			{ herdrStatus: 'blocked' },
		]);
		expect(steps).toEqual([[`blocked ${CODING_AGENT}`], []]);
	});

	it('gives only the messages that are new since the first observation, each once', () => {
		const old = fixtures.message('m1', 's1', 'a1');
		const fresh = fixtures.message('m2', 'a1', 's1', {
			atMs: NOW_MS + 1,
		});
		const { steps } = run([
			{ messages: [old] },
			{ messages: [old] },
			{ messages: [old, fresh] },
			{ messages: [old, fresh] },
		]);
		expect(steps).toEqual([[], ['message m2'], []]);
	});

	it('replays no old message when the observations arrive after the first model, or come back after a loss', () => {
		const old = fixtures.message('m1', 's1', 'a1');
		const { steps, state } = run([
			{ isObserved: false },
			{ messages: [old] },
			{ isObserved: false },
			{ messages: [old, fixtures.message('m2', 's1', 'a1')] },
		]);
		expect(steps).toEqual([[], [], []]);
		expect(state?.seenMessageIds?.size).toBe(2);
	});

	it('keeps the delivery and the ends of a new message, and never links an unmatched end', () => {
		const queued = fixtures.message('m1', 's1', 'a1', {
			delivery: 'queued',
		});
		const unmatched = fixtures.message('m2', 's1', 'peer-address');
		const first = build({ messages: [] });
		const start = MireTransitions.compare(null, first.model, first.messages);
		const next = build({ messages: [queued, unmatched] });
		const result = MireTransitions.compare(start.state, next.model, next.messages);
		const messages = result.transitions.flatMap((transition) => transition.kind === 'message' ? [transition.message] : []);
		expect(messages.map((message) => [message.nativeId, message.delivery, message.to?.state, message.to?.nodeId])).toEqual([
			['m1', 'queued', 'resolved', SUBAGENT],
			['m2', 'received', 'unmatched', null],
		]);
	});
});

describe('MireTransitions.keyboardPeriodMs', () => {
	it('keeps the keyboard still with no working coding agent, and makes it faster with more of them', () => {
		expect(MireTransitions.keyboardPeriodMs(0)).toBeNull();
		expect(MireTransitions.keyboardPeriodMs(1)).toBe(1_600);
		expect(MireTransitions.keyboardPeriodMs(4)).toBe(400);
		expect(MireTransitions.keyboardPeriodMs(40)).toBe(250);
	});
});
