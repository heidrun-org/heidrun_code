// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentInfo } from '../../lib/types';
import { HeidrunCodeDashboardModelBuilder } from '../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_builder';
import { HeidrunCodeDashboardTestFixtures } from '../../lib/heidrun_code_dashboard/heidrun_code_dashboard_test_fixtures';
import type { ClaudeSubagentObservation } from '../../lib/heidrun_code_dashboard/observation_types';
import { HeidrunCodeDashboardNavigation } from './heidrun_code_dashboard_navigation';

/** The node identifier of the Claude Code in the tab `w1:t1`. */
const CLAUDE = HeidrunCodeDashboardModelBuilder.codingAgentNodeId({
	terminal_id: 'term1',
	agent: 'claude',
});

/** The node identifier of the Codex in the tab `w1:t2`. */
const CODEX = HeidrunCodeDashboardModelBuilder.codingAgentNodeId({
	terminal_id: 'term2',
	agent: 'codex',
});

/** The node identifier of the Claude Code in the workspace `w2`. */
const OTHER = HeidrunCodeDashboardModelBuilder.codingAgentNodeId({
	terminal_id: 'term3',
	agent: 'claude',
});

/** The node identifiers of the two subagents of the Claude Code. */
const OLIVIER = HeidrunCodeDashboardModelBuilder.claudeSubagentNodeId('s1', 'a1');
const EXPLORE = HeidrunCodeDashboardModelBuilder.claudeSubagentNodeId('s1', 'a2');

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
		HeidrunCodeDashboardTestFixtures.pane('p1', 'term1', 'w1:t1', {
			agent: 'claude',
			agent_status: fields.claudeStatus ?? 'idle',
			tokens: {
				hd_sid: 's1',
			},
		}),
		HeidrunCodeDashboardTestFixtures.pane('p2', 'term2', 'w1:t2', {
			agent: 'codex',
			agent_status: 'blocked',
		}),
	];
	if (fields.isOtherPresent !== false) {
		panes.push(HeidrunCodeDashboardTestFixtures.pane('p3', 'term3', 'w2:t1', {
			agent: 'claude',
			agent_status: 'idle',
		}));
	}
	return HeidrunCodeDashboardModelBuilder.build(HeidrunCodeDashboardTestFixtures.input({
		workspaces: [HeidrunCodeDashboardTestFixtures.workspace('w1', 1, 'DashMenu V2'), HeidrunCodeDashboardTestFixtures.workspace('w2', 2, 'Connect')],
		tabs: [
			HeidrunCodeDashboardTestFixtures.tab('w1:t1', 'w1', 1, 'Claude'),
			HeidrunCodeDashboardTestFixtures.tab('w1:t2', 'w1', 2, 'DashStock'),
			HeidrunCodeDashboardTestFixtures.tab('w2:t1', 'w2', 1, 'connect'),
		],
		panes,
		observations: HeidrunCodeDashboardTestFixtures.observations({
			sessions: [
				HeidrunCodeDashboardTestFixtures.claudeSession('s1', {
					isStale: fields.isStale ?? false,
					subagents: fields.subagents ?? [
						HeidrunCodeDashboardTestFixtures.claudeSubagent('a1', {
							description: 'Olivier',
						}),
						HeidrunCodeDashboardTestFixtures.claudeSubagent('a2', {
							description: 'Explore',
							nativeStatus: 'completed',
						}),
					],
				}),
			],
		}),
	}));
}

describe('HeidrunCodeDashboardNavigation.path', () => {
	it('gives Heidrun, the workspace, the tab, the coding agent, and the subagent', () => {
		const index = HeidrunCodeDashboardNavigation.index(build());
		expect(HeidrunCodeDashboardNavigation.path(index, OLIVIER).map((entry) => entry.label))
			.toEqual(['Heidrun', 'DashMenu V2', 'Claude', 'Claude', 'Olivier']);
		expect(HeidrunCodeDashboardNavigation.path(index, 'missing')).toEqual([]);
	});
});

describe('HeidrunCodeDashboardNavigation.visibility', () => {
	it('shows everything with no filter', () => {
		const visibility = HeidrunCodeDashboardNavigation.visibility(build(), null);
		expect([...visibility.values()].every((value) => value === 'shown')).toBe(true);
	});

	it('hides the nonmatching items and the empty workspaces, and keeps faint ancestors of a matching subagent', () => {
		const visibility = HeidrunCodeDashboardNavigation.visibility(build(), 'working');
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
		const visibility = HeidrunCodeDashboardNavigation.visibility(build(), 'blocked');
		expect(visibility.get(CODEX)).toBe('shown');
		expect(visibility.get(CLAUDE)).toBe('hidden');
		expect(visibility.get(OLIVIER)).toBe('hidden');
	});
});

describe('HeidrunCodeDashboardNavigation.resolveSelection', () => {
	it('keeps a selected node that still shows', () => {
		const model = build();
		const index = HeidrunCodeDashboardNavigation.index(model);
		const path = HeidrunCodeDashboardNavigation.path(index, OLIVIER).map((entry) => entry.nodeId);
		expect(HeidrunCodeDashboardNavigation.resolveSelection(path, 'fresh', index, HeidrunCodeDashboardNavigation.visibility(model, null))).toBe(OLIVIER);
	});

	it('moves to the nearest ancestor that shows when the node disappears', () => {
		const before = HeidrunCodeDashboardNavigation.index(build());
		const path = HeidrunCodeDashboardNavigation.path(before, OLIVIER).map((entry) => entry.nodeId);
		const after = build({
			subagents: [],
		});
		expect(HeidrunCodeDashboardNavigation.resolveSelection(path, 'fresh', HeidrunCodeDashboardNavigation.index(after), HeidrunCodeDashboardNavigation.visibility(after, null)))
			.toBe(CLAUDE);
		const otherPath = HeidrunCodeDashboardNavigation.path(before, OTHER).map((entry) => entry.nodeId);
		const withoutOther = build({
			isOtherPresent: false,
		});
		expect(HeidrunCodeDashboardNavigation.resolveSelection(
			otherPath,
			'not_observed',
			HeidrunCodeDashboardNavigation.index(withoutOther),
			HeidrunCodeDashboardNavigation.visibility(withoutOther, null),
		)).toBe('tab:w2:t1');
	});

	it('moves to the nearest ancestor that shows when the filter hides the node', () => {
		const model = build();
		const index = HeidrunCodeDashboardNavigation.index(model);
		const path = HeidrunCodeDashboardNavigation.path(index, EXPLORE).map((entry) => entry.nodeId);
		expect(HeidrunCodeDashboardNavigation.resolveSelection(path, 'fresh', index, HeidrunCodeDashboardNavigation.visibility(model, 'working'))).toBe(CLAUDE);
		expect(HeidrunCodeDashboardNavigation.resolveSelection(
			HeidrunCodeDashboardNavigation.path(index, OTHER).map((entry) => entry.nodeId),
			'not_observed',
			index,
			HeidrunCodeDashboardNavigation.visibility(model, 'working'),
		)).toBe('heidrun');
	});

	it('moves to the parent when the selected node becomes stale, and stays on a node selected while stale', () => {
		const stale = build({
			isStale: true,
		});
		const index = HeidrunCodeDashboardNavigation.index(stale);
		const path = HeidrunCodeDashboardNavigation.path(index, OLIVIER).map((entry) => entry.nodeId);
		const visibility = HeidrunCodeDashboardNavigation.visibility(stale, null);
		expect(HeidrunCodeDashboardNavigation.resolveSelection(path, 'fresh', index, visibility)).toBe(CLAUDE);
		expect(HeidrunCodeDashboardNavigation.resolveSelection(path, 'stale', index, visibility)).toBe(OLIVIER);
	});
});

describe('HeidrunCodeDashboardNavigation keyboard moves', () => {
	it('lists the drawn nodes that show in the order of the graph', () => {
		const model = build();
		const index = HeidrunCodeDashboardNavigation.index(model);
		expect(HeidrunCodeDashboardNavigation.focusOrder(index, HeidrunCodeDashboardNavigation.visibility(model, null)))
			.toEqual(['heidrun', 'workspace:w1', CLAUDE, OLIVIER, EXPLORE, CODEX, 'workspace:w2', OTHER]);
		expect(HeidrunCodeDashboardNavigation.focusOrder(index, HeidrunCodeDashboardNavigation.visibility(model, 'blocked')))
			.toEqual(['heidrun', 'workspace:w1', CODEX]);
	});

	it('goes to the siblings with Left and Right, to the parent with Up, and to the first child with Down', () => {
		const model = build();
		const index = HeidrunCodeDashboardNavigation.index(model);
		const visibility = HeidrunCodeDashboardNavigation.visibility(model, null);
		expect(HeidrunCodeDashboardNavigation.move(index, visibility, 'heidrun', 'ArrowDown')).toBe('workspace:w1');
		expect(HeidrunCodeDashboardNavigation.move(index, visibility, 'workspace:w1', 'ArrowRight')).toBe('workspace:w2');
		expect(HeidrunCodeDashboardNavigation.move(index, visibility, 'workspace:w1', 'ArrowLeft')).toBe('workspace:w2');
		expect(HeidrunCodeDashboardNavigation.move(index, visibility, 'workspace:w1', 'ArrowDown')).toBe(CLAUDE);
		expect(HeidrunCodeDashboardNavigation.move(index, visibility, CLAUDE, 'ArrowRight')).toBe(CODEX);
		expect(HeidrunCodeDashboardNavigation.move(index, visibility, CLAUDE, 'ArrowUp')).toBe('workspace:w1');
		expect(HeidrunCodeDashboardNavigation.move(index, visibility, OLIVIER, 'ArrowRight')).toBe(EXPLORE);
		expect(HeidrunCodeDashboardNavigation.move(index, visibility, OLIVIER, 'ArrowDown')).toBeNull();
		expect(HeidrunCodeDashboardNavigation.move(index, visibility, 'heidrun', 'ArrowRight')).toBeNull();
	});
});
