// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { HeidrunCodeDashboardFacts } from './heidrun_code_dashboard_model_types';
import { HeidrunCodeDashboardStatus } from './heidrun_code_dashboard_status';
import { HeidrunCodeDashboardTestFixtures } from './heidrun_code_dashboard_test_fixtures';

/** Facts with nothing special, to change one field at a time. */
const FACTS: HeidrunCodeDashboardFacts = {
	nativeStatus: null,
	activeFlags: [],
	lastTurnOutcome: null,
	pendingAttention: [],
	freshness: 'fresh',
};

describe('HeidrunCodeDashboardStatus.fromHerdr', () => {
	it('keeps the status of Herdr, with done as Finished', () => {
		expect(HeidrunCodeDashboardStatus.fromHerdr('working')).toBe('working');
		expect(HeidrunCodeDashboardStatus.fromHerdr('blocked')).toBe('blocked');
		expect(HeidrunCodeDashboardStatus.fromHerdr('done')).toBe('finished');
		expect(HeidrunCodeDashboardStatus.fromHerdr('idle')).toBe('idle');
		expect(HeidrunCodeDashboardStatus.fromHerdr('unknown')).toBe('unknown');
	});
});

describe('HeidrunCodeDashboardStatus.forClaudeSubagent', () => {
	it('gives Working to a running subagent and Blocked to a running subagent with a request', () => {
		expect(HeidrunCodeDashboardStatus.forClaudeSubagent('running', false, false)).toBe('working');
		expect(HeidrunCodeDashboardStatus.forClaudeSubagent('running', true, false)).toBe('blocked');
	});

	it('gives Finished to a completed, failed, or killed subagent, and keeps the outcome separate', () => {
		expect(HeidrunCodeDashboardStatus.forClaudeSubagent('completed', false, false)).toBe('finished');
		expect(HeidrunCodeDashboardStatus.forClaudeSubagent('failed', false, false)).toBe('finished');
		expect(HeidrunCodeDashboardStatus.forClaudeSubagent('killed', false, false)).toBe('finished');
		expect(HeidrunCodeDashboardStatus.outcomeOfClaudeSubagent('failed')).toBe('failed');
		expect(HeidrunCodeDashboardStatus.outcomeOfClaudeSubagent('killed')).toBe('killed');
		expect(HeidrunCodeDashboardStatus.outcomeOfClaudeSubagent('running')).toBe('in_progress');
	});

	it('gives unknown to an unknown status and to a stale observation, whatever the native status', () => {
		expect(HeidrunCodeDashboardStatus.forClaudeSubagent('unknown', false, false)).toBe('unknown');
		expect(HeidrunCodeDashboardStatus.forClaudeSubagent('running', true, true)).toBe('unknown');
		expect(HeidrunCodeDashboardStatus.forClaudeSubagent('completed', false, true)).toBe('unknown');
	});
});

describe('HeidrunCodeDashboardStatus.forCodexChild', () => {
	const thread = HeidrunCodeDashboardTestFixtures.codexThread;

	it('gives Working to an active child and Blocked to an active child that waits', () => {
		expect(HeidrunCodeDashboardStatus.forCodexChild(thread('c', 'r', 'r'), false)).toBe('working');
		expect(HeidrunCodeDashboardStatus.forCodexChild(thread('c', 'r', 'r', {
			activeFlags: ['waitingOnApproval'],
		}), false)).toBe('blocked');
		expect(HeidrunCodeDashboardStatus.forCodexChild(thread('c', 'r', 'r', {
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
		expect(HeidrunCodeDashboardStatus.forCodexChild(child, false)).toBe('finished');
		expect(HeidrunCodeDashboardStatus.outcomeOfCodexTurn(child.lastTurn)).toBe('completed');
	});

	it('gives Idle to an idle child with no completed turn, and to an interrupted turn', () => {
		expect(HeidrunCodeDashboardStatus.forCodexChild(thread('c', 'r', 'r', {
			nativeStatus: 'idle',
		}), false)).toBe('idle');
		expect(HeidrunCodeDashboardStatus.forCodexChild(thread('c', 'r', 'r', {
			nativeStatus: 'idle',
			lastTurn: {
				status: 'interrupted',
				completedAtMs: null,
			},
		}), false)).toBe('idle');
	});

	it('gives unknown to a system error, an unknown status, and a stale observation', () => {
		expect(HeidrunCodeDashboardStatus.forCodexChild(thread('c', 'r', 'r', {
			nativeStatus: 'systemError',
		}), false)).toBe('unknown');
		expect(HeidrunCodeDashboardStatus.forCodexChild(thread('c', 'r', 'r', {
			nativeStatus: 'unknown',
		}), false)).toBe('unknown');
		expect(HeidrunCodeDashboardStatus.forCodexChild(thread('c', 'r', 'r'), true)).toBe('unknown');
	});

	it('maps the turn in progress, and no turn to null', () => {
		expect(HeidrunCodeDashboardStatus.outcomeOfCodexTurn({
			status: 'inProgress',
			completedAtMs: null,
		})).toBe('in_progress');
		expect(HeidrunCodeDashboardStatus.outcomeOfCodexTurn(null)).toBeNull();
	});
});

describe('HeidrunCodeDashboardStatus.notices', () => {
	it('keeps failed, killed, interrupted, system error, unknown, and the freshness visible', () => {
		expect(HeidrunCodeDashboardStatus.notices({
			...FACTS,
			lastTurnOutcome: 'failed',
		}, 'finished', [])).toEqual(['failed']);
		expect(HeidrunCodeDashboardStatus.notices({
			...FACTS,
			lastTurnOutcome: 'killed',
		}, 'finished', [])).toEqual(['killed']);
		expect(HeidrunCodeDashboardStatus.notices({
			...FACTS,
			lastTurnOutcome: 'interrupted',
		}, 'idle', [])).toEqual(['interrupted']);
		expect(HeidrunCodeDashboardStatus.notices({
			...FACTS,
			nativeStatus: {
				source: 'codex_server',
				value: 'systemError',
			},
		}, 'unknown', [])).toEqual(['system_error', 'unknown_status']);
		expect(HeidrunCodeDashboardStatus.notices({
			...FACTS,
			freshness: 'stale',
		}, 'unknown', ['stale_chat'])).toEqual(['unknown_status', 'stale', 'stale_chat']);
		expect(HeidrunCodeDashboardStatus.notices({
			...FACTS,
			freshness: 'not_observed',
		}, 'idle', [])).toEqual(['not_observed']);
		expect(HeidrunCodeDashboardStatus.notices({
			...FACTS,
			freshness: 'unmatched',
		}, 'idle', [])).toEqual(['unmatched']);
	});

	it('gives no notice to a fresh item with a known status and a completed outcome', () => {
		expect(HeidrunCodeDashboardStatus.notices({
			...FACTS,
			lastTurnOutcome: 'completed',
		}, 'finished', [])).toEqual([]);
	});
});

describe('HeidrunCodeDashboardStatus.aggregate', () => {
	it('chooses Blocked, then Working, then Finished, then Idle', () => {
		expect(HeidrunCodeDashboardStatus.aggregate(['idle', 'finished', 'working', 'blocked'])).toBe('blocked');
		expect(HeidrunCodeDashboardStatus.aggregate(['idle', 'finished', 'working'])).toBe('working');
		expect(HeidrunCodeDashboardStatus.aggregate(['idle', 'finished'])).toBe('finished');
		expect(HeidrunCodeDashboardStatus.aggregate(['idle'])).toBe('idle');
	});

	it('aggregates the known statuses and ignores unknown when a known status exists', () => {
		expect(HeidrunCodeDashboardStatus.aggregate(['unknown', 'idle'])).toBe('idle');
		expect(HeidrunCodeDashboardStatus.aggregate(['unknown', 'unknown'])).toBe('unknown');
	});

	it('gives Idle to an empty group', () => {
		expect(HeidrunCodeDashboardStatus.aggregate([])).toBe('idle');
	});
});

describe('HeidrunCodeDashboardStatus.counts', () => {
	it('counts each visible status and the total', () => {
		expect(HeidrunCodeDashboardStatus.counts([
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
