// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentInfo } from '../../lib/types';
import { MireModelBuilder } from '../../lib/mire/mire_model_builder';
import { MireTestFixtures } from '../../lib/mire/mire_test_fixtures';
import type { ClaudeSubagentObservation } from '../../lib/mire/observation_types';
import { MireNavigation } from './mire_navigation';

/** The node identifier of the Claude Code in the tab `w1:t1`. */
const CLAUDE = MireModelBuilder.codingAgentNodeId({
	terminal_id: 'term1',
	agent: 'claude',
});

/** The node identifier of the Codex in the tab `w1:t2`. */
const CODEX = MireModelBuilder.codingAgentNodeId({
	terminal_id: 'term2',
	agent: 'codex',
});

/** The node identifier of the Claude Code in the workspace `w2`. */
const OTHER = MireModelBuilder.codingAgentNodeId({
	terminal_id: 'term3',
	agent: 'claude',
});

/** The node identifiers of the two subagents of the Claude Code. */
const OLIVIER = MireModelBuilder.claudeSubagentNodeId('s1', 'a1');
const EXPLORE = MireModelBuilder.claudeSubagentNodeId('s1', 'a2');

/**
 * Builds a model: workspace w1 with a working Claude Code (two subagents) and a blocked Codex, workspace w2 with an
 * idle Claude Code.
 */
function build(fields: {
	claudeStatus?: AgentInfo['agent_status'];
	subagents?: ClaudeSubagentObservation[];
	isStale?: boolean;
	isOtherPresent?: boolean;
} = {}) {
	const panes = [
		MireTestFixtures.pane('p1', 'term1', 'w1:t1', {
			agent: 'claude',
			agent_status: fields.claudeStatus ?? 'idle',
			tokens: {
				hd_sid: 's1',
			},
		}),
		MireTestFixtures.pane('p2', 'term2', 'w1:t2', {
			agent: 'codex',
			agent_status: 'blocked',
		}),
	];
	if (fields.isOtherPresent !== false) {
		panes.push(MireTestFixtures.pane('p3', 'term3', 'w2:t1', {
			agent: 'claude',
			agent_status: 'idle',
		}));
	}
	return MireModelBuilder.build(MireTestFixtures.input({
		workspaces: [MireTestFixtures.workspace('w1', 1, 'DashMenu V2'), MireTestFixtures.workspace('w2', 2, 'Connect')],
		tabs: [
			MireTestFixtures.tab('w1:t1', 'w1', 1, 'Claude'),
			MireTestFixtures.tab('w1:t2', 'w1', 2, 'DashStock'),
			MireTestFixtures.tab('w2:t1', 'w2', 1, 'connect'),
		],
		panes,
		observations: MireTestFixtures.observations({
			sessions: [
				MireTestFixtures.claudeSession('s1', {
					isStale: fields.isStale ?? false,
					subagents: fields.subagents ?? [
						MireTestFixtures.claudeSubagent('a1', {
							description: 'Olivier',
						}),
						MireTestFixtures.claudeSubagent('a2', {
							description: 'Explore',
							nativeStatus: 'completed',
						}),
					],
				}),
			],
		}),
	}));
}

describe('MireNavigation.path', () => {
	it('gives Heidrun, the workspace, the tab, the coding agent, and the subagent', () => {
		const index = MireNavigation.index(build());
		expect(MireNavigation.path(index, OLIVIER).map((entry) => entry.label))
			.toEqual(['Heidrun', 'DashMenu V2', 'Claude', 'Claude', 'Olivier']);
		expect(MireNavigation.path(index, 'missing')).toEqual([]);
	});
});

describe('MireNavigation.visibility', () => {
	it('shows everything with no filter', () => {
		const visibility = MireNavigation.visibility(build(), null);
		expect([...visibility.values()].every((value) => value === 'shown')).toBe(true);
	});

	it('hides the nonmatching items and the empty workspaces, and keeps faint ancestors of a matching subagent', () => {
		const visibility = MireNavigation.visibility(build(), 'working');
		expect(visibility.get(OLIVIER)).toBe('shown');
		expect(visibility.get(EXPLORE)).toBe('hidden');
		expect(visibility.get(CLAUDE)).toBe('faint');
		expect(visibility.get('tab:w1:t1')).toBe('faint');
		expect(visibility.get(CODEX)).toBe('hidden');
		expect(visibility.get('workspace:w1')).toBe('shown');
		expect(visibility.get('workspace:w2')).toBe('hidden');
		expect(visibility.get('heidrun')).toBe('shown');
	});

	it('shows a matching coding agent and hides its nonmatching subagents', () => {
		const visibility = MireNavigation.visibility(build(), 'blocked');
		expect(visibility.get(CODEX)).toBe('shown');
		expect(visibility.get(CLAUDE)).toBe('hidden');
		expect(visibility.get(OLIVIER)).toBe('hidden');
	});
});

describe('MireNavigation.resolveSelection', () => {
	it('keeps a selected node that still shows', () => {
		const model = build();
		const index = MireNavigation.index(model);
		const path = MireNavigation.path(index, OLIVIER).map((entry) => entry.nodeId);
		expect(MireNavigation.resolveSelection(path, 'fresh', index, MireNavigation.visibility(model, null))).toBe(OLIVIER);
	});

	it('moves to the nearest ancestor that shows when the node disappears', () => {
		const before = MireNavigation.index(build());
		const path = MireNavigation.path(before, OLIVIER).map((entry) => entry.nodeId);
		const after = build({
			subagents: [],
		});
		expect(MireNavigation.resolveSelection(path, 'fresh', MireNavigation.index(after), MireNavigation.visibility(after, null)))
			.toBe(CLAUDE);
		const otherPath = MireNavigation.path(before, OTHER).map((entry) => entry.nodeId);
		const withoutOther = build({
			isOtherPresent: false,
		});
		expect(MireNavigation.resolveSelection(
			otherPath,
			'not_observed',
			MireNavigation.index(withoutOther),
			MireNavigation.visibility(withoutOther, null),
		)).toBe('tab:w2:t1');
	});

	it('moves to the nearest ancestor that shows when the filter hides the node', () => {
		const model = build();
		const index = MireNavigation.index(model);
		const path = MireNavigation.path(index, EXPLORE).map((entry) => entry.nodeId);
		expect(MireNavigation.resolveSelection(path, 'fresh', index, MireNavigation.visibility(model, 'working'))).toBe(CLAUDE);
		expect(MireNavigation.resolveSelection(
			MireNavigation.path(index, OTHER).map((entry) => entry.nodeId),
			'not_observed',
			index,
			MireNavigation.visibility(model, 'working'),
		)).toBe('heidrun');
	});

	it('moves to the parent when the selected node becomes stale, and stays on a node selected while stale', () => {
		const stale = build({
			isStale: true,
		});
		const index = MireNavigation.index(stale);
		const path = MireNavigation.path(index, OLIVIER).map((entry) => entry.nodeId);
		const visibility = MireNavigation.visibility(stale, null);
		expect(MireNavigation.resolveSelection(path, 'fresh', index, visibility)).toBe(CLAUDE);
		expect(MireNavigation.resolveSelection(path, 'stale', index, visibility)).toBe(OLIVIER);
	});
});

describe('MireNavigation keyboard moves', () => {
	it('lists the drawn nodes that show in the order of the graph', () => {
		const model = build();
		const index = MireNavigation.index(model);
		expect(MireNavigation.focusOrder(index, MireNavigation.visibility(model, null)))
			.toEqual(['heidrun', 'workspace:w1', CLAUDE, OLIVIER, EXPLORE, CODEX, 'workspace:w2', OTHER]);
		expect(MireNavigation.focusOrder(index, MireNavigation.visibility(model, 'blocked')))
			.toEqual(['heidrun', 'workspace:w1', CODEX]);
	});

	it('goes to the siblings with Left and Right, to the parent with Up, and to the first child with Down', () => {
		const model = build();
		const index = MireNavigation.index(model);
		const visibility = MireNavigation.visibility(model, null);
		expect(MireNavigation.move(index, visibility, 'heidrun', 'ArrowDown')).toBe('workspace:w1');
		expect(MireNavigation.move(index, visibility, 'workspace:w1', 'ArrowRight')).toBe('workspace:w2');
		expect(MireNavigation.move(index, visibility, 'workspace:w1', 'ArrowLeft')).toBe('workspace:w2');
		expect(MireNavigation.move(index, visibility, 'workspace:w1', 'ArrowDown')).toBe(CLAUDE);
		expect(MireNavigation.move(index, visibility, CLAUDE, 'ArrowRight')).toBe(CODEX);
		expect(MireNavigation.move(index, visibility, CLAUDE, 'ArrowUp')).toBe('workspace:w1');
		expect(MireNavigation.move(index, visibility, OLIVIER, 'ArrowRight')).toBe(EXPLORE);
		expect(MireNavigation.move(index, visibility, OLIVIER, 'ArrowDown')).toBeNull();
		expect(MireNavigation.move(index, visibility, 'heidrun', 'ArrowRight')).toBeNull();
	});
});
