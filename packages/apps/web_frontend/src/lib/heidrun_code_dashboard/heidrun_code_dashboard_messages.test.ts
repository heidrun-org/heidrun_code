// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { HeidrunCodeDashboardMessages } from './heidrun_code_dashboard_messages';
import { HeidrunCodeDashboardModelBuilder } from './heidrun_code_dashboard_model_builder';
import type { HeidrunCodeDashboardObservations } from './observation_types';
import { HeidrunCodeDashboardTestFixtures, NOW_MS } from './heidrun_code_dashboard_test_fixtures';

const fixtures = HeidrunCodeDashboardTestFixtures;

/**
 * Builds observations with one Claude Code pane (session s1, subagent a1) and one Codex pane (root r1, child c1), with
 * the messages given.
 * @param claudeMessages The messages of the Claude Code session.
 * @param codexInteractions The interactions of the Codex child chat.
 * @returns The observations and the model built from them.
 */
function scene(
	claudeMessages: HeidrunCodeDashboardObservations['claude']['sessions'][number]['messages'],
	codexInteractions: HeidrunCodeDashboardObservations['codex']['threads'][number]['interactions'] = [],
) {
	const observations = fixtures.observations({
		sessions: [
			fixtures.claudeSession('s1', {
				subagents: [fixtures.claudeSubagent('a1')],
				messages: claudeMessages,
			}),
			fixtures.claudeSession('s9', {
				subagents: [fixtures.claudeSubagent('a1')],
			}),
		],
		threads: [
			fixtures.codexThread('r1', 'r1', null),
			fixtures.codexThread('c1', 'r1', 'r1', {
				interactions: codexInteractions,
			}),
		],
	});
	const model = HeidrunCodeDashboardModelBuilder.build(fixtures.input({
		workspaces: [fixtures.workspace('w1', 1, 'one'), fixtures.workspace('w2', 2, 'two')],
		tabs: [fixtures.tab('w1:t1', 'w1', 1, 'A'), fixtures.tab('w2:t1', 'w2', 1, 'B')],
		panes: [
			fixtures.pane('w1:p1', 'term_a', 'w1:t1', {
				agent: 'claude',
				tokens: {
					hd_sid: 's1',
				},
			}),
			fixtures.pane('w1:p2', 'term_b', 'w1:t1', {
				agent: 'claude',
				tokens: {
					hd_sid: 's9',
				},
			}),
			fixtures.pane('w2:p1', 'term_c', 'w2:t1', {
				agent: 'codex',
				agent_session: {
					source: 'herdr',
					agent: 'codex',
					kind: 'thread',
					value: 'r1',
				},
			}),
		],
		observations,
	}));
	return {
		observations,
		model,
	};
}

describe('HeidrunCodeDashboardMessages.collect', () => {
	it('links the ends of a message to the nodes, with the subagent of the same session', () => {
		const { observations, model } = scene([fixtures.message('m1', 's1', 'a1', {
			delivery: 'queued',
		})]);
		const [message] = HeidrunCodeDashboardMessages.collect(observations, model);
		expect(message.id).toBe('claude_observer:s1:m1');
		expect(message.from).toEqual({
			nativeId: 's1',
			nodeId: 'coding_agent:term_a:claude',
			state: 'resolved',
		});
		expect(message.to).toEqual({
			nativeId: 'a1',
			nodeId: 'subagent:claude:s1:a1',
			state: 'resolved',
		});
		expect(message.delivery).toBe('queued');
	});

	it('keeps an unknown or ambiguous end explicitly unmatched, and never links it by name', () => {
		const { observations, model } = scene([], [
			fixtures.message('i1', 'c1', 'a1', {
				text: null,
				contentAvailability: 'not_exposed',
			}),
			fixtures.message('i2', 'c1', 'peer-address', {
				text: null,
				contentAvailability: 'not_exposed',
			}),
		]);
		const messages = HeidrunCodeDashboardMessages.collect(observations, model);
		expect(messages.map((message) => message.to?.state)).toEqual(['unmatched', 'unmatched']);
		expect(messages[0].from.nodeId).toBe('subagent:codex:c1');
		expect(messages[0].text).toBeNull();
		expect(messages[0].contentAvailability).toBe('not_exposed');
	});

	it('keeps one record for each identifier, with the latest step of the delivery', () => {
		const { observations, model } = scene([
			fixtures.message('m1', 's1', 'a1', {
				delivery: 'received',
				atMs: NOW_MS - 10,
			}),
			fixtures.message('m1', 's1', 'a1', {
				delivery: 'queued',
				atMs: NOW_MS - 20,
			}),
			fixtures.message('m2', 'a1', 's1', {
				atMs: NOW_MS - 5,
			}),
		]);
		const messages = HeidrunCodeDashboardMessages.collect(observations, model);
		expect(messages.map((message) => [message.nativeId, message.delivery])).toEqual([
			['m1', 'received'],
			['m2', 'received'],
		]);
	});

	it('gives no message when there is no observation', () => {
		const { model } = scene([]);
		expect(HeidrunCodeDashboardMessages.collect(null, model)).toEqual([]);
	});
});

describe('HeidrunCodeDashboardMessages.newSince', () => {
	it('gives no new message at the first opening, then only the messages not seen before', () => {
		const first = scene([fixtures.message('m1', 's1', 'a1')]);
		const opening = HeidrunCodeDashboardMessages.newSince(HeidrunCodeDashboardMessages.collect(first.observations, first.model), null);
		expect(opening.newMessages).toEqual([]);
		expect([...opening.seenIds]).toEqual(['claude_observer:s1:m1']);
		const second = scene([fixtures.message('m1', 's1', 'a1'), fixtures.message('m2', 'a1', 's1')]);
		const update = HeidrunCodeDashboardMessages.newSince(HeidrunCodeDashboardMessages.collect(second.observations, second.model), opening.seenIds);
		expect(update.newMessages.map((message) => message.nativeId)).toEqual(['m2']);
	});

	it('does not replay the old messages after a reconnection with the same seen identifiers', () => {
		const { observations, model } = scene([fixtures.message('m1', 's1', 'a1'), fixtures.message('m2', 'a1', 's1')]);
		const messages = HeidrunCodeDashboardMessages.collect(observations, model);
		const seen = HeidrunCodeDashboardMessages.newSince(messages, null).seenIds;
		expect(HeidrunCodeDashboardMessages.newSince(messages, seen).newMessages).toEqual([]);
	});
});
