// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { MireFacts } from './mire_model_types';
import { MireStatus } from './mire_status';
import { MireTestFixtures } from './mire_test_fixtures';

/** Facts with nothing special, to change one field at a time. */
const FACTS: MireFacts = {
	nativeStatus: null,
	activeFlags: [],
	lastTurnOutcome: null,
	pendingAttention: [],
	freshness: 'fresh',
};

describe('MireStatus.fromHerdr', () => {
	it('keeps the status of Herdr, with done as Finished', () => {
		expect(MireStatus.fromHerdr('working')).toBe('working');
		expect(MireStatus.fromHerdr('blocked')).toBe('blocked');
		expect(MireStatus.fromHerdr('done')).toBe('finished');
		expect(MireStatus.fromHerdr('idle')).toBe('idle');
		expect(MireStatus.fromHerdr('unknown')).toBe('unknown');
	});
});

describe('MireStatus.forClaudeSubagent', () => {
	it('gives Working to a running subagent and Blocked to a running subagent with a request', () => {
		expect(MireStatus.forClaudeSubagent('running', false, false)).toBe('working');
		expect(MireStatus.forClaudeSubagent('running', true, false)).toBe('blocked');
	});

	it('gives Finished to a completed, failed, or killed subagent, and keeps the outcome separate', () => {
		expect(MireStatus.forClaudeSubagent('completed', false, false)).toBe('finished');
		expect(MireStatus.forClaudeSubagent('failed', false, false)).toBe('finished');
		expect(MireStatus.forClaudeSubagent('killed', false, false)).toBe('finished');
		expect(MireStatus.outcomeOfClaudeSubagent('failed')).toBe('failed');
		expect(MireStatus.outcomeOfClaudeSubagent('killed')).toBe('killed');
		expect(MireStatus.outcomeOfClaudeSubagent('running')).toBe('in_progress');
	});

	it('gives unknown to an unknown status and to a stale observation, whatever the native status', () => {
		expect(MireStatus.forClaudeSubagent('unknown', false, false)).toBe('unknown');
		expect(MireStatus.forClaudeSubagent('running', true, true)).toBe('unknown');
		expect(MireStatus.forClaudeSubagent('completed', false, true)).toBe('unknown');
	});
});

describe('MireStatus.forCodexChild', () => {
	const thread = MireTestFixtures.codexThread;

	it('gives Working to an active child and Blocked to an active child that waits', () => {
		expect(MireStatus.forCodexChild(thread('c', 'r', 'r'), false)).toBe('working');
		expect(MireStatus.forCodexChild(thread('c', 'r', 'r', {
			activeFlags: ['waitingOnApproval'],
		}), false)).toBe('blocked');
		expect(MireStatus.forCodexChild(thread('c', 'r', 'r', {
			activeFlags: ['waitingOnUserInput'],
		}), false)).toBe('blocked');
	});

	it('gives Finished, never a failure, to a completed child that became idle', () => {
		const child = thread('c', 'r', 'r', {
			nativeStatus: 'idle',
			lastTurn: {
				status: 'completed',
				completedAtMs: 5,
			},
		});
		expect(MireStatus.forCodexChild(child, false)).toBe('finished');
		expect(MireStatus.outcomeOfCodexTurn(child.lastTurn)).toBe('completed');
	});

	it('gives Idle to an idle child with no completed turn, and to an interrupted turn', () => {
		expect(MireStatus.forCodexChild(thread('c', 'r', 'r', {
			nativeStatus: 'idle',
		}), false)).toBe('idle');
		expect(MireStatus.forCodexChild(thread('c', 'r', 'r', {
			nativeStatus: 'idle',
			lastTurn: {
				status: 'interrupted',
				completedAtMs: null,
			},
		}), false)).toBe('idle');
	});

	it('gives unknown to a system error, an unknown status, and a stale observation', () => {
		expect(MireStatus.forCodexChild(thread('c', 'r', 'r', {
			nativeStatus: 'systemError',
		}), false)).toBe('unknown');
		expect(MireStatus.forCodexChild(thread('c', 'r', 'r', {
			nativeStatus: 'unknown',
		}), false)).toBe('unknown');
		expect(MireStatus.forCodexChild(thread('c', 'r', 'r'), true)).toBe('unknown');
	});

	it('maps the turn in progress, and no turn to null', () => {
		expect(MireStatus.outcomeOfCodexTurn({
			status: 'inProgress',
			completedAtMs: null,
		})).toBe('in_progress');
		expect(MireStatus.outcomeOfCodexTurn(null)).toBeNull();
	});
});

describe('MireStatus.notices', () => {
	it('keeps failed, killed, interrupted, system error, unknown, and the freshness visible', () => {
		expect(MireStatus.notices({
			...FACTS,
			lastTurnOutcome: 'failed',
		}, 'finished', [])).toEqual(['failed']);
		expect(MireStatus.notices({
			...FACTS,
			lastTurnOutcome: 'killed',
		}, 'finished', [])).toEqual(['killed']);
		expect(MireStatus.notices({
			...FACTS,
			lastTurnOutcome: 'interrupted',
		}, 'idle', [])).toEqual(['interrupted']);
		expect(MireStatus.notices({
			...FACTS,
			nativeStatus: {
				source: 'codex_server',
				value: 'systemError',
			},
		}, 'unknown', [])).toEqual(['system_error', 'unknown_status']);
		expect(MireStatus.notices({
			...FACTS,
			freshness: 'stale',
		}, 'unknown', ['stale_chat'])).toEqual(['unknown_status', 'stale', 'stale_chat']);
		expect(MireStatus.notices({
			...FACTS,
			freshness: 'not_observed',
		}, 'idle', [])).toEqual(['not_observed']);
		expect(MireStatus.notices({
			...FACTS,
			freshness: 'unmatched',
		}, 'idle', [])).toEqual(['unmatched']);
	});

	it('gives no notice to a fresh item with a known status and a completed outcome', () => {
		expect(MireStatus.notices({
			...FACTS,
			lastTurnOutcome: 'completed',
		}, 'finished', [])).toEqual([]);
	});
});

describe('MireStatus.aggregate', () => {
	it('chooses Blocked, then Working, then Finished, then Idle', () => {
		expect(MireStatus.aggregate(['idle', 'finished', 'working', 'blocked'])).toBe('blocked');
		expect(MireStatus.aggregate(['idle', 'finished', 'working'])).toBe('working');
		expect(MireStatus.aggregate(['idle', 'finished'])).toBe('finished');
		expect(MireStatus.aggregate(['idle'])).toBe('idle');
	});

	it('aggregates the known statuses and ignores unknown when a known status exists', () => {
		expect(MireStatus.aggregate(['unknown', 'idle'])).toBe('idle');
		expect(MireStatus.aggregate(['unknown', 'unknown'])).toBe('unknown');
	});

	it('gives Idle to an empty group', () => {
		expect(MireStatus.aggregate([])).toBe('idle');
	});
});

describe('MireStatus.counts', () => {
	it('counts each visible status and the total', () => {
		expect(MireStatus.counts([
			{
				status: 'working',
			},
			{
				status: 'working',
			},
			{
				status: 'unknown',
			},
		])).toEqual({
			working: 2,
			blocked: 0,
			finished: 0,
			idle: 0,
			unknown: 1,
			total: 3,
		});
	});
});
