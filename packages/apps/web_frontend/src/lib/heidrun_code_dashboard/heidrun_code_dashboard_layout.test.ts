// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { AgentInfo, TabInfo, WorkspaceInfo } from '../types';
import {
	HEIDRUN_CODE_DASHBOARD_CODING_AGENT_RING,
	HEIDRUN_CODE_DASHBOARD_HEIDRUN_RADIUS,
	HEIDRUN_CODE_DASHBOARD_HEXAGON_RADIUS,
	HEIDRUN_CODE_DASHBOARD_LAYOUT_HALF_SIZE,
	HEIDRUN_CODE_DASHBOARD_SUBAGENT_RING,
	HEIDRUN_CODE_DASHBOARD_WORKSPACE_LABEL_FONT_SIZE,
	HEIDRUN_CODE_DASHBOARD_WORKSPACE_LABEL_MINIMUM_FONT_SIZE,
	HEIDRUN_CODE_DASHBOARD_WORKSPACE_RING,
	HeidrunCodeDashboardLayout,
} from './heidrun_code_dashboard_layout';
import { HeidrunCodeDashboardModelBuilder } from './heidrun_code_dashboard_model_builder';
import { HeidrunCodeDashboardTestFixtures } from './heidrun_code_dashboard_test_fixtures';

/** Builds a model with two workspaces: one with a split tab and Claude Code subagents, one with one Codex. */
function twoWorkspaces(herdrStatus: AgentInfo['agent_status'] = 'working') {
	const workspaces = [HeidrunCodeDashboardTestFixtures.workspace('w1', 1, 'DashMenu V2'), HeidrunCodeDashboardTestFixtures.workspace('w2', 2, 'Connect')];
	const tabs = [
		HeidrunCodeDashboardTestFixtures.tab('w1:t1', 'w1', 1, 'Claude'),
		HeidrunCodeDashboardTestFixtures.tab('w1:t2', 'w1', 2, 'DashStock'),
		HeidrunCodeDashboardTestFixtures.tab('w2:t1', 'w2', 1, 'connect'),
	];
	const panes = [
		HeidrunCodeDashboardTestFixtures.pane('p1', 'term1', 'w1:t1', {
			agent: 'claude',
			agent_status: herdrStatus,
			tokens: {
				hd_sid: 's1',
			},
		}),
		HeidrunCodeDashboardTestFixtures.pane('p2', 'term2', 'w1:t1', {
			agent: 'claude',
			agent_status: 'idle',
		}),
		HeidrunCodeDashboardTestFixtures.pane('p3', 'term3', 'w1:t2', {
			agent: 'codex',
			agent_status: 'blocked',
		}),
		HeidrunCodeDashboardTestFixtures.pane('p4', 'term4', 'w2:t1', {
			agent: 'codex',
			agent_status: 'done',
		}),
	];
	const observations = HeidrunCodeDashboardTestFixtures.observations({
		sessions: [
			HeidrunCodeDashboardTestFixtures.claudeSession('s1', {
				subagents: [
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
	});
	return HeidrunCodeDashboardModelBuilder.build(HeidrunCodeDashboardTestFixtures.input({
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
		workspaces.push(HeidrunCodeDashboardTestFixtures.workspace(`w${workspaceIndex}`, workspaceIndex, `workspace ${workspaceIndex}`));
		for (let tabIndex = 1; tabIndex <= tabCount; tabIndex += 1) {
			const tabId = `w${workspaceIndex}:t${tabIndex}`;
			tabs.push(HeidrunCodeDashboardTestFixtures.tab(tabId, `w${workspaceIndex}`, tabIndex, `a very long tab name number ${tabIndex}`));
			panes.push(HeidrunCodeDashboardTestFixtures.pane(`p${workspaceIndex}_${tabIndex}`, `term${workspaceIndex}_${tabIndex}`, tabId, {
				agent: 'claude',
			}));
		}
	}
	return HeidrunCodeDashboardModelBuilder.build(HeidrunCodeDashboardTestFixtures.input({
		workspaces,
		tabs,
		panes,
	}));
}

/** The distance from the centre. */
function radius(point: { x: number; y: number }): number {
	return Math.round(Math.hypot(point.x, point.y));
}

describe('HeidrunCodeDashboardLayout.compute', () => {
	it('gives an empty layout with the same view box when there is no workspace', () => {
		const layout = HeidrunCodeDashboardLayout.compute(HeidrunCodeDashboardModelBuilder.build(HeidrunCodeDashboardTestFixtures.input()));
		expect(layout.workspaces).toEqual([]);
		expect(layout.codingAgents).toEqual([]);
		expect(layout.links).toEqual([]);
		expect(layout.viewBox).toBe('-126 -126 252 252');
	});

	it('leaves a wide space between Heidrun and the sectors, and between two sectors', () => {
		const layout = HeidrunCodeDashboardLayout.compute(twoWorkspaces());
		for (const workspace of layout.workspaces) {
			const [x, y] = workspace.sectorPath.split(' ').slice(1, 3).map(Number);
			expect(Math.hypot(x, y)).toBeCloseTo(HEIDRUN_CODE_DASHBOARD_WORKSPACE_RING - 70, 1);
		}
		const [first, second] = layout.workspaces;
		expect(second.startAngle - first.endAngle).toBeCloseTo(0.24, 2);
	});

	it('gives every sector the same outer radius, the radius of the deepest workspace', () => {
		const layout = HeidrunCodeDashboardLayout.compute(twoWorkspaces());
		expect(layout.workspaces.map((workspace) => workspace.outerRadius)).toEqual([HEIDRUN_CODE_DASHBOARD_SUBAGENT_RING + 34, HEIDRUN_CODE_DASHBOARD_SUBAGENT_RING + 34]);
	});

	it('fits the view box to the drawn graph with a margin, so that the graph fills the window', () => {
		const layout = HeidrunCodeDashboardLayout.compute(twoWorkspaces());
		const halfSize = Math.max(...layout.workspaces.map((workspace) => workspace.outerRadius));
		const [x, y, width, height] = layout.viewBox.split(' ').map(Number);
		expect(width).toBe(height);
		expect(x).toBe(-width / 2);
		expect(y).toBe(-height / 2);
		expect(width / 2).toBeGreaterThanOrEqual(halfSize + 24);
		expect(width / 2).toBeLessThan(HEIDRUN_CODE_DASHBOARD_LAYOUT_HALF_SIZE);
	});

	it('puts the workspaces on the first ring, the coding agents on the second, and the subagents on the third', () => {
		const layout = HeidrunCodeDashboardLayout.compute(twoWorkspaces());
		expect(layout.workspaces.map((workspace) => radius(workspace))).toEqual([HEIDRUN_CODE_DASHBOARD_WORKSPACE_RING, HEIDRUN_CODE_DASHBOARD_WORKSPACE_RING]);
		expect(layout.codingAgents).toHaveLength(4);
		expect(layout.codingAgents.every((codingAgent) => radius(codingAgent) === HEIDRUN_CODE_DASHBOARD_CODING_AGENT_RING)).toBe(true);
		expect(layout.subagents.map((subagent) => radius(subagent))).toEqual([HEIDRUN_CODE_DASHBOARD_SUBAGENT_RING, HEIDRUN_CODE_DASHBOARD_SUBAGENT_RING]);
		const heidrunLinks = layout.links.filter((link) => link.fromNodeId === 'heidrun');
		expect(heidrunLinks).toHaveLength(2);
		expect(heidrunLinks.every((link) => link.x1 === 0 && link.y1 === 0)).toBe(true);
		expect(heidrunLinks.every((link) => link.path === `M 0 0 L ${link.x2} ${link.y2}`)).toBe(true);
		const otherLinks = layout.links.filter((link) => link.fromNodeId !== 'heidrun');
		expect(otherLinks.length).toBeGreaterThan(0);
		for (const link of otherLinks) {
			// A curve from the parent to the child, and the same curve back for the drops of mead.
			expect(link.path).toMatch(new RegExp(`^M ${link.x1} ${link.y1} Q .* ${link.x2} ${link.y2}$`));
			expect(link.climbPath).toMatch(new RegExp(`^M ${link.x2} ${link.y2} Q .* ${link.x1} ${link.y1}$`));
		}
	});

	it('gives the same layout for the same model, and moves nothing when only a status changes', () => {
		const first = HeidrunCodeDashboardLayout.compute(twoWorkspaces('working'));
		expect(HeidrunCodeDashboardLayout.compute(twoWorkspaces('working'))).toEqual(first);
		expect(HeidrunCodeDashboardLayout.compute(twoWorkspaces('blocked'))).toEqual(first);
		expect(HeidrunCodeDashboardLayout.compute(twoWorkspaces('done'))).toEqual(first);
	});

	it('sizes each sector by the coding agents and the subagents of its workspace', () => {
		const layout = HeidrunCodeDashboardLayout.compute(twoWorkspaces());
		const [dashMenu, connect] = layout.workspaces;
		expect(dashMenu.endAngle - dashMenu.startAngle).toBeGreaterThan(connect.endAngle - connect.startAngle);
		expect(dashMenu.endAngle).toBeLessThan(connect.startAngle);
		expect(dashMenu.sectorPath.startsWith('M ')).toBe(true);
	});

	it('keeps the coding agents of one tab side by side, in the order of the tabs, with the exact tab name', () => {
		const layout = HeidrunCodeDashboardLayout.compute(twoWorkspaces());
		const inFirstWorkspace = layout.codingAgents.filter((codingAgent) => codingAgent.workspaceNodeId === 'workspace:w1');
		expect(inFirstWorkspace.map((codingAgent) => codingAgent.labelText)).toEqual(['Claude', 'Claude', 'DashStock']);
		expect(inFirstWorkspace.map((codingAgent) => codingAgent.tabNodeId)).toEqual(['tab:w1:t1', 'tab:w1:t1', 'tab:w1:t2']);
		const angles = inFirstWorkspace.map((codingAgent) => codingAgent.angle);
		expect([...angles].sort((left, right) => left - right)).toEqual(angles);
	});

	it('links Heidrun to each workspace, each workspace to its coding agents, and each coding agent to its subagents', () => {
		const layout = HeidrunCodeDashboardLayout.compute(twoWorkspaces());
		expect(layout.links.filter((link) => link.fromNodeId === 'heidrun')).toHaveLength(2);
		const codingAgent = layout.codingAgents[0];
		expect(layout.links.filter((link) => link.fromNodeId === codingAgent.nodeId).map((link) => link.toNodeId))
			.toEqual(layout.subagents.map((subagent) => subagent.nodeId));
	});

	it('shortens long names with an ellipsis and hides the labels of a crowded sector', () => {
		const layout = HeidrunCodeDashboardLayout.compute(crowded(12, 8));
		expect(layout.workspaces).toHaveLength(12);
		expect(layout.codingAgents).toHaveLength(96);
		expect(layout.codingAgents.every((codingAgent) => codingAgent.isLabelTruncated)).toBe(true);
		expect(layout.codingAgents.every((codingAgent) => codingAgent.labelText.endsWith('…'))).toBe(true);
		expect(layout.codingAgents.some((codingAgent) => codingAgent.isLabelShown === false)).toBe(true);
		const few = HeidrunCodeDashboardLayout.compute(crowded(2, 1));
		expect(few.codingAgents.every((codingAgent) => codingAgent.isLabelShown)).toBe(true);
	});

	it('gives every workspace a sector, even when one workspace holds most of the coding agents', () => {
		const model = crowded(3, 1);
		const big = crowded(1, 40).workspaces[0];
		model.workspaces[0] = big;
		const layout = HeidrunCodeDashboardLayout.compute(model);
		for (const workspace of layout.workspaces.slice(1)) {
			expect(workspace.endAngle - workspace.startAngle).toBeGreaterThanOrEqual(0.4);
		}
	});
});

describe('HeidrunCodeDashboardLayout.compute, workspace labels', () => {
	it('puts the box of each workspace label on the line to Heidrun, at the first third from the hexagon, at every angle', () => {
		const names = ['project-management', 'coding_agent_plugin', 'Heidrun Notebook', 'website', 'heidrun_data', 'a', 'promotional_videos'];
		const workspaces = names.map((name, index) => HeidrunCodeDashboardTestFixtures.workspace(`w${index}`, index + 1, name));
		const layout = HeidrunCodeDashboardLayout.compute(HeidrunCodeDashboardModelBuilder.build(HeidrunCodeDashboardTestFixtures.input({
			workspaces,
		})));
		expect(layout.workspaces).toHaveLength(7);
		for (const workspace of layout.workspaces) {
			const distance = Math.hypot(workspace.labelX, workspace.labelY);
			const cross = workspace.labelX * workspace.y - workspace.labelY * workspace.x;
			expect(Math.abs(cross) / distance).toBeLessThan(0.05 * HEIDRUN_CODE_DASHBOARD_WORKSPACE_RING);
			expect(workspace.labelX * workspace.x + workspace.labelY * workspace.y).toBeGreaterThan(0);
			const across = Math.abs(workspace.labelX / distance);
			const along = Math.abs(workspace.labelY / distance);
			const reach = across * (workspace.labelWidth / 2) + along * (workspace.labelHeight / 2);
			expect(distance - reach).toBeGreaterThanOrEqual(HEIDRUN_CODE_DASHBOARD_HEIDRUN_RADIUS + 11);
			expect(distance + reach).toBeLessThanOrEqual(HEIDRUN_CODE_DASHBOARD_WORKSPACE_RING - HEIDRUN_CODE_DASHBOARD_HEXAGON_RADIUS);
			expect(workspace.labelFontSize).toBeGreaterThan(HEIDRUN_CODE_DASHBOARD_WORKSPACE_LABEL_MINIMUM_FONT_SIZE);
			expect(workspace.labelFontSize).toBeLessThanOrEqual(HEIDRUN_CODE_DASHBOARD_WORKSPACE_LABEL_FONT_SIZE);
			// At the first third of the line from the hexagon, or as near to the hexagon as the box allows.
			const firstThird = HEIDRUN_CODE_DASHBOARD_WORKSPACE_RING - (HEIDRUN_CODE_DASHBOARD_WORKSPACE_RING - HEIDRUN_CODE_DASHBOARD_HEIDRUN_RADIUS) / 3;
			const roomToHexagon = HEIDRUN_CODE_DASHBOARD_WORKSPACE_RING - HEIDRUN_CODE_DASHBOARD_HEXAGON_RADIUS - 5 - (distance + reach);
			expect(Math.min(Math.abs(firstThird - distance), roomToHexagon)).toBeLessThan(0.05);
		}
		// The full name always shows, never with an ellipsis (issue 982). A long name gets a smaller text.
		expect(layout.workspaces.map((workspace) => workspace.labelText)).toEqual(names);
		const shortName = layout.workspaces[names.indexOf('a')];
		expect(shortName.labelFontSize).toBe(HEIDRUN_CODE_DASHBOARD_WORKSPACE_LABEL_FONT_SIZE);
		const longName = layout.workspaces[names.indexOf('coding_agent_plugin')];
		expect(longName.labelFontSize).toBeLessThan(HEIDRUN_CODE_DASHBOARD_WORKSPACE_LABEL_FONT_SIZE);
	});

	it('keeps the full name of a very long workspace name, at the smallest size of text, in the middle of its room', () => {
		const name = 'a workspace with a very long name that never fits in the room of its label';
		const layout = HeidrunCodeDashboardLayout.compute(HeidrunCodeDashboardModelBuilder.build(HeidrunCodeDashboardTestFixtures.input({
			workspaces: [HeidrunCodeDashboardTestFixtures.workspace('w1', 1, name), HeidrunCodeDashboardTestFixtures.workspace('w2', 2, 'other')],
		})));
		const workspace = layout.workspaces[0];
		expect(workspace.labelText).toBe(name);
		expect(workspace.labelFontSize).toBe(HEIDRUN_CODE_DASHBOARD_WORKSPACE_LABEL_MINIMUM_FONT_SIZE);
	});
});

describe('HeidrunCodeDashboardLayout.truncate', () => {
	it('keeps a short text and cuts a long one with an ellipsis, by characters', () => {
		expect(HeidrunCodeDashboardLayout.truncate('Claude', 10)).toBe('Claude');
		expect(HeidrunCodeDashboardLayout.truncate('DashMenu V2', 6)).toBe('DashM…');
		expect(HeidrunCodeDashboardLayout.truncate('éééé', 3)).toBe('éé…');
	});
});

describe('HeidrunCodeDashboardLayout.hexagonPoints', () => {
	it('gives six points with a vertex at the top', () => {
		const points = HeidrunCodeDashboardLayout.hexagonPoints(0, 0, 10).split(' ');
		expect(points).toHaveLength(6);
		expect(points[0]).toBe('0,-10');
	});
});
