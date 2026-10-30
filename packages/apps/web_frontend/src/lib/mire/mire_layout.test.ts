// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentInfo, TabInfo, WorkspaceInfo } from '../types';
import {
	MIRE_CODING_AGENT_RING,
	MIRE_LAYOUT_HALF_SIZE,
	MIRE_SUBAGENT_RING,
	MIRE_WORKSPACE_RING,
	MireLayout,
} from './mire_layout';
import { MireModelBuilder } from './mire_model_builder';
import { MireTestFixtures } from './mire_test_fixtures';

/** Builds a model with two workspaces: one with a split tab and Claude Code subagents, one with one Codex. */
function twoWorkspaces(herdrStatus: AgentInfo['agent_status'] = 'working') {
	const workspaces = [MireTestFixtures.workspace('w1', 1, 'DashMenu V2'), MireTestFixtures.workspace('w2', 2, 'Connect')];
	const tabs = [
		MireTestFixtures.tab('w1:t1', 'w1', 1, 'Claude'),
		MireTestFixtures.tab('w1:t2', 'w1', 2, 'DashStock'),
		MireTestFixtures.tab('w2:t1', 'w2', 1, 'connect'),
	];
	const panes = [
		MireTestFixtures.pane('p1', 'term1', 'w1:t1', {
			agent: 'claude',
			agent_status: herdrStatus,
			tokens: {
				hd_sid: 's1',
			},
		}),
		MireTestFixtures.pane('p2', 'term2', 'w1:t1', {
			agent: 'claude',
			agent_status: 'idle',
		}),
		MireTestFixtures.pane('p3', 'term3', 'w1:t2', {
			agent: 'codex',
			agent_status: 'blocked',
		}),
		MireTestFixtures.pane('p4', 'term4', 'w2:t1', {
			agent: 'codex',
			agent_status: 'done',
		}),
	];
	const observations = MireTestFixtures.observations({
		sessions: [
			MireTestFixtures.claudeSession('s1', {
				subagents: [
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
	});
	return MireModelBuilder.build(MireTestFixtures.input({
		workspaces,
		tabs,
		panes,
		observations,
	}));
}

/** Builds a crowded model: `workspaceCount` workspaces of `tabCount` tabs, each tab with one Claude Code. */
function crowded(workspaceCount: number, tabCount: number) {
	const workspaces: WorkspaceInfo[] = [];
	const tabs: TabInfo[] = [];
	const panes: AgentInfo[] = [];
	for (let workspaceIndex = 1; workspaceIndex <= workspaceCount; workspaceIndex += 1) {
		workspaces.push(MireTestFixtures.workspace(`w${workspaceIndex}`, workspaceIndex, `workspace ${workspaceIndex}`));
		for (let tabIndex = 1; tabIndex <= tabCount; tabIndex += 1) {
			const tabId = `w${workspaceIndex}:t${tabIndex}`;
			tabs.push(MireTestFixtures.tab(tabId, `w${workspaceIndex}`, tabIndex, `a very long tab name number ${tabIndex}`));
			panes.push(MireTestFixtures.pane(`p${workspaceIndex}_${tabIndex}`, `term${workspaceIndex}_${tabIndex}`, tabId, {
				agent: 'claude',
			}));
		}
	}
	return MireModelBuilder.build(MireTestFixtures.input({
		workspaces,
		tabs,
		panes,
	}));
}

/** The distance from the centre. */
function radius(point: { x: number; y: number }): number {
	return Math.round(Math.hypot(point.x, point.y));
}

describe('MireLayout.compute', () => {
	it('gives an empty layout with the same view box when there is no workspace', () => {
		const layout = MireLayout.compute(MireModelBuilder.build(MireTestFixtures.input()));
		expect(layout.workspaces).toEqual([]);
		expect(layout.codingAgents).toEqual([]);
		expect(layout.links).toEqual([]);
		expect(layout.viewBox).toBe(`-${MIRE_LAYOUT_HALF_SIZE} -${MIRE_LAYOUT_HALF_SIZE} ${2 * MIRE_LAYOUT_HALF_SIZE} ${2 * MIRE_LAYOUT_HALF_SIZE}`);
	});

	it('puts the workspaces on the first ring, the coding agents on the second, and the subagents on the third', () => {
		const layout = MireLayout.compute(twoWorkspaces());
		expect(layout.workspaces.map((workspace) => radius(workspace))).toEqual([MIRE_WORKSPACE_RING, MIRE_WORKSPACE_RING]);
		expect(layout.codingAgents).toHaveLength(4);
		expect(layout.codingAgents.every((codingAgent) => radius(codingAgent) === MIRE_CODING_AGENT_RING)).toBe(true);
		expect(layout.subagents.map((subagent) => radius(subagent))).toEqual([MIRE_SUBAGENT_RING, MIRE_SUBAGENT_RING]);
	});

	it('gives the same layout for the same model, and moves nothing when only a status changes', () => {
		const first = MireLayout.compute(twoWorkspaces('working'));
		expect(MireLayout.compute(twoWorkspaces('working'))).toEqual(first);
		expect(MireLayout.compute(twoWorkspaces('blocked'))).toEqual(first);
		expect(MireLayout.compute(twoWorkspaces('done'))).toEqual(first);
	});

	it('sizes each sector by the coding agents and the subagents of its workspace', () => {
		const layout = MireLayout.compute(twoWorkspaces());
		const [dashMenu, connect] = layout.workspaces;
		expect(dashMenu.endAngle - dashMenu.startAngle).toBeGreaterThan(connect.endAngle - connect.startAngle);
		expect(dashMenu.endAngle).toBeLessThan(connect.startAngle);
		expect(dashMenu.sectorPath.startsWith('M ')).toBe(true);
	});

	it('keeps the coding agents of one tab side by side, in the order of the tabs, with the exact tab name', () => {
		const layout = MireLayout.compute(twoWorkspaces());
		const inFirstWorkspace = layout.codingAgents.filter((codingAgent) => codingAgent.workspaceNodeId === 'workspace:w1');
		expect(inFirstWorkspace.map((codingAgent) => codingAgent.labelText)).toEqual(['Claude', 'Claude', 'DashStock']);
		expect(inFirstWorkspace.map((codingAgent) => codingAgent.tabNodeId)).toEqual(['tab:w1:t1', 'tab:w1:t1', 'tab:w1:t2']);
		const angles = inFirstWorkspace.map((codingAgent) => codingAgent.angle);
		expect([...angles].sort((left, right) => left - right)).toEqual(angles);
	});

	it('links Heidrun to each workspace, each workspace to its coding agents, and each coding agent to its subagents', () => {
		const layout = MireLayout.compute(twoWorkspaces());
		expect(layout.links.filter((link) => link.fromNodeId === 'heidrun')).toHaveLength(2);
		const codingAgent = layout.codingAgents[0];
		expect(layout.links.filter((link) => link.fromNodeId === codingAgent.nodeId).map((link) => link.toNodeId))
			.toEqual(layout.subagents.map((subagent) => subagent.nodeId));
	});

	it('shortens long names with an ellipsis and hides the labels of a crowded sector', () => {
		const layout = MireLayout.compute(crowded(12, 8));
		expect(layout.workspaces).toHaveLength(12);
		expect(layout.codingAgents).toHaveLength(96);
		expect(layout.codingAgents.every((codingAgent) => codingAgent.isLabelTruncated)).toBe(true);
		expect(layout.codingAgents.every((codingAgent) => codingAgent.labelText.endsWith('…'))).toBe(true);
		expect(layout.codingAgents.some((codingAgent) => codingAgent.isLabelShown === false)).toBe(true);
		const few = MireLayout.compute(crowded(2, 1));
		expect(few.codingAgents.every((codingAgent) => codingAgent.isLabelShown)).toBe(true);
	});

	it('gives every workspace a sector, even when one workspace holds most of the coding agents', () => {
		const model = crowded(3, 1);
		const big = crowded(1, 40).workspaces[0];
		model.workspaces[0] = big;
		const layout = MireLayout.compute(model);
		for (const workspace of layout.workspaces.slice(1)) {
			expect(workspace.endAngle - workspace.startAngle).toBeGreaterThanOrEqual(0.4);
		}
	});
});

describe('MireLayout.truncate', () => {
	it('keeps a short text and cuts a long one with an ellipsis, by characters', () => {
		expect(MireLayout.truncate('Claude', 10)).toBe('Claude');
		expect(MireLayout.truncate('DashMenu V2', 6)).toBe('DashM…');
		expect(MireLayout.truncate('éééé', 3)).toBe('éé…');
	});
});

describe('MireLayout.hexagonPoints', () => {
	it('gives six points with a vertex at the top', () => {
		const points = MireLayout.hexagonPoints(0, 0, 10).split(' ');
		expect(points).toHaveLength(6);
		expect(points[0]).toBe('0,-10');
	});
});
