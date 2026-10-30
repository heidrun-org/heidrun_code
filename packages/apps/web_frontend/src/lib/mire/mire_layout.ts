import type { MireCodingAgentNode, MireModel, MireSubagentNode, MireWorkspaceNode } from './mire_model_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MireLayout — places Heidrun, the workspaces, the coding agents, and the subagents on the rings of the radial graph
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The half size of the square view box of the graph. The graph scales with its view box, so it follows every resize. */
export const MIRE_LAYOUT_HALF_SIZE = 560;

/** The radius of the picture of Heidrun at the centre. */
export const MIRE_HEIDRUN_RADIUS = 62;

/** The radius of the first ring: the workspace hexagons. */
export const MIRE_WORKSPACE_RING = 165;

/** The radius of a workspace hexagon. */
export const MIRE_HEXAGON_RADIUS = 20;

/** The radius of the second ring: one satellite for each coding agent. */
export const MIRE_CODING_AGENT_RING = 295;

/** The radius of the third ring: the subagents that a coding agent started. */
export const MIRE_SUBAGENT_RING = 405;

/** The extra radius of each nested level of subagents, after the first one. */
export const MIRE_NESTED_SUBAGENT_STEP = 40;

/** The deepest nested level that gets its own radius. A deeper subagent stays on this radius. */
const MAXIMUM_DRAWN_DEPTH = 3;

/** The size of the text of the labels, in units of the view box. */
const LABEL_FONT_SIZE = 11;

/** The mean width of one character of a label, in units of the view box. */
const CHARACTER_WIDTH = LABEL_FONT_SIZE * 0.6;

/** The empty angle between two workspace sectors, in radians, when there is room for it. */
const SECTOR_GAP = 0.05;

/** The smallest angle of a workspace sector, in radians, when there is room for it. */
const MINIMUM_SECTOR_ANGLE = 0.42;

/** One workspace: its hexagon, its sector, and its label. */
export type MireLayoutWorkspace = {
	/** The node identifier of the workspace. */
	nodeId: string;
	/** The centre of the hexagon. */
	x: number;
	/** The centre of the hexagon. */
	y: number;
	/** The first angle of the sector, in radians, clockwise from the top. */
	startAngle: number;
	/** The last angle of the sector, in radians. */
	endAngle: number;
	/** The SVG path of the sector: the area that selects the workspace. */
	sectorPath: string;
	/** The SVG points of the hexagon. */
	hexagonPoints: string;
	/** The text of the label: the exact name, shortened with an ellipsis when it is too long. */
	labelText: string;
	/** True when the label is shortened: the full name is then in the title. */
	isLabelTruncated: boolean;
	/** The position of the label. */
	labelX: number;
	/** The position of the label. */
	labelY: number;
};

/** One coding agent: its satellite on the second ring, and its label shaped like a tab. */
export type MireLayoutCodingAgent = {
	/** The node identifier of the coding agent. */
	nodeId: string;
	/** The node identifier of its workspace. */
	workspaceNodeId: string;
	/** The node identifier of its tab. */
	tabNodeId: string;
	/** The centre of the satellite. */
	x: number;
	/** The centre of the satellite. */
	y: number;
	/** The angle of the satellite, in radians. */
	angle: number;
	/** The text of the label: the exact tab name, shortened with an ellipsis when it is too long. */
	labelText: string;
	/** True when the label is shortened: the full name is then in the title. */
	isLabelTruncated: boolean;
	/** False when the sector is too crowded for a label: the name stays in the title and in the sidebar. */
	isLabelShown: boolean;
	/** The width of the label shaped like a tab. */
	labelWidth: number;
	/** The position of the centre of the label. */
	labelX: number;
	/** The position of the top of the label. */
	labelY: number;
};

/** One subagent: its dot on the third ring, or further out for a nested subagent. */
export type MireLayoutSubagent = {
	/** The node identifier of the subagent. */
	nodeId: string;
	/** The node identifier of its parent: a coding agent or a subagent. */
	parentNodeId: string;
	/** The node identifier of its coding agent. */
	codingAgentNodeId: string;
	/** The node identifier of its workspace. */
	workspaceNodeId: string;
	/** The nested level: 1 for a subagent of the coding agent, 2 for a subagent of a subagent. */
	depth: number;
	/** The centre of the dot. */
	x: number;
	/** The centre of the dot. */
	y: number;
	/** The angle of the dot, in radians. */
	angle: number;
	/** The text of the label, shortened with an ellipsis when it is too long. */
	labelText: string;
	/** True when the label is shortened: the full name is then in the title. */
	isLabelTruncated: boolean;
	/** False when the sector is too crowded for a label. */
	isLabelShown: boolean;
	/** The side of the label: `start` on the right half of the graph, `end` on the left half. */
	labelAnchor: 'start' | 'end';
	/** The position of the label. */
	labelX: number;
	/** The position of the label. */
	labelY: number;
};

/** One line between two nodes. */
export type MireLayoutLink = {
	/** The parent node. */
	fromNodeId: string;
	/** The child node. */
	toNodeId: string;
	/** The start of the line. */
	x1: number;
	/** The start of the line. */
	y1: number;
	/** The end of the line. */
	x2: number;
	/** The end of the line. */
	y2: number;
};

/** The positions of every node of the graph. The same model gives the same layout. */
export type MireLayoutResult = {
	/** The SVG view box. */
	viewBox: string;
	/** The workspaces, in the order of the model. */
	workspaces: MireLayoutWorkspace[];
	/** The coding agents, in the order of the model. */
	codingAgents: MireLayoutCodingAgent[];
	/** The subagents, in the order of the hierarchy. */
	subagents: MireLayoutSubagent[];
	/** The lines: Heidrun to each workspace, each workspace to its coding agents, and each parent to its subagents. */
	links: MireLayoutLink[];
};

/**
 * Places the nodes of the Mire on the rings of the radial graph. The layout reads only the hierarchy, the identifiers,
 * and the names: a status change never moves a node. It reads no file and draws nothing.
 */
export class MireLayout {
	/**
	 * Computes the layout of the graph.
	 * @param model The Mire model.
	 * @returns The positions of the nodes, the sectors, the labels, and the lines.
	 */
	static compute(model: MireModel): MireLayoutResult {
		const result: MireLayoutResult = {
			viewBox: `${-MIRE_LAYOUT_HALF_SIZE} ${-MIRE_LAYOUT_HALF_SIZE} ${2 * MIRE_LAYOUT_HALF_SIZE} ${2 * MIRE_LAYOUT_HALF_SIZE}`,
			workspaces: [],
			codingAgents: [],
			subagents: [],
			links: [],
		};
		const workspaceCount = model.workspaces.length;
		if (workspaceCount === 0) {
			return result;
		}
		const gap = workspaceCount === 1 ? SECTOR_GAP : Math.min(SECTOR_GAP, Math.PI / 2 / workspaceCount);
		const available = 2 * Math.PI - gap * workspaceCount;
		const minimumAngle = Math.min(MINIMUM_SECTOR_ANGLE, available / workspaceCount);
		const weights = model.workspaces.map((workspace) => MireLayout.workspaceWeight(workspace));
		const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
		const sharedAngle = available - minimumAngle * workspaceCount;
		let angle = -Math.PI / 2 + gap / 2;
		model.workspaces.forEach((workspace, index) => {
			const sectorAngle = minimumAngle + sharedAngle * weights[index] / totalWeight;
			MireLayout._placeWorkspace(workspace, angle, angle + sectorAngle, result);
			angle += sectorAngle + gap;
		});
		return result;
	}

	/**
	 * Gives the weight of a workspace: the share of the circle that its sector needs.
	 * @param workspace The workspace.
	 * @returns One slot for each coding agent, or one for each of its subagents when it has more; at least 1.
	 */
	static workspaceWeight(workspace: MireWorkspaceNode): number {
		const codingAgents = workspace.tabs.flatMap((tab) => tab.codingAgents);
		const weight = codingAgents.reduce((sum, codingAgent) => sum + MireLayout._codingAgentWeight(codingAgent), 0);
		return Math.max(1, weight);
	}

	/**
	 * Shortens a label with an ellipsis.
	 * @param text The full text.
	 * @param maximumCharacters The largest number of characters, ellipsis included.
	 * @returns The text, or its start followed by an ellipsis.
	 */
	static truncate(text: string, maximumCharacters: number): string {
		const characters = [...text];
		if (characters.length <= maximumCharacters) {
			return text;
		}
		return `${characters.slice(0, Math.max(1, maximumCharacters - 1)).join('')}…`;
	}

	/**
	 * Gives the name of a subagent: its name, else its role, else its identifier.
	 * @param subagent The subagent.
	 * @returns The name to show.
	 */
	static subagentName(subagent: MireSubagentNode): string {
		return subagent.name ?? subagent.role ?? subagent.nativeId;
	}

	/**
	 * Gives the SVG points of a hexagon with a vertex at the top.
	 * @param x The centre.
	 * @param y The centre.
	 * @param radius The distance from the centre to a vertex.
	 * @returns The points, for the attribute `points` of an SVG polygon.
	 */
	static hexagonPoints(x: number, y: number, radius: number): string {
		const points: string[] = [];
		for (let index = 0; index < 6; index += 1) {
			const angle = -Math.PI / 2 + index * Math.PI / 3;
			points.push(`${MireLayout._round(x + radius * Math.cos(angle))},${MireLayout._round(y + radius * Math.sin(angle))}`);
		}
		return points.join(' ');
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Placement
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Places one workspace, its coding agents, and their subagents in their sector.
	 * @param workspace The workspace.
	 * @param startAngle The first angle of the sector.
	 * @param endAngle The last angle of the sector.
	 * @param result The layout to fill.
	 */
	private static _placeWorkspace(
		workspace: MireWorkspaceNode,
		startAngle: number,
		endAngle: number,
		result: MireLayoutResult,
	): void {
		const middle = (startAngle + endAngle) / 2;
		const centre = MireLayout._point(MIRE_WORKSPACE_RING, middle);
		const arcLength = (endAngle - startAngle) * MIRE_WORKSPACE_RING;
		const maximumCharacters = MireLayout._clamp(Math.floor(arcLength / CHARACTER_WIDTH), 4, 24);
		const labelText = MireLayout.truncate(workspace.label, maximumCharacters);
		const codingAgentEntries = workspace.tabs.flatMap((tab) => tab.codingAgents.map((codingAgent) => ({
			tab,
			codingAgent,
		})));
		const maximumDepth = Math.max(0, ...codingAgentEntries.map((entry) => MireLayout._depth(entry.codingAgent.subagents)));
		const outerRadius = maximumDepth > 0
			? MIRE_SUBAGENT_RING + (Math.min(maximumDepth, MAXIMUM_DRAWN_DEPTH) - 1) * MIRE_NESTED_SUBAGENT_STEP + 34
			: codingAgentEntries.length > 0 ? MIRE_CODING_AGENT_RING + 52 : MIRE_WORKSPACE_RING + 48;
		result.workspaces.push({
			nodeId: workspace.nodeId,
			x: centre.x,
			y: centre.y,
			startAngle: MireLayout._round(startAngle),
			endAngle: MireLayout._round(endAngle),
			sectorPath: MireLayout._sectorPath(MIRE_HEIDRUN_RADIUS + 34, outerRadius, startAngle, endAngle),
			hexagonPoints: MireLayout.hexagonPoints(centre.x, centre.y, MIRE_HEXAGON_RADIUS),
			labelText,
			isLabelTruncated: labelText !== workspace.label,
			labelX: centre.x,
			labelY: MireLayout._round(centre.y + MIRE_HEXAGON_RADIUS + 16),
		});
		const heidrunEdge = MireLayout._point(MIRE_HEIDRUN_RADIUS, middle);
		result.links.push({
			fromNodeId: 'heidrun',
			toNodeId: workspace.nodeId,
			x1: heidrunEdge.x,
			y1: heidrunEdge.y,
			x2: centre.x,
			y2: centre.y,
		});
		const totalWeight = Math.max(1, codingAgentEntries.reduce(
			(sum, entry) => sum + MireLayout._codingAgentWeight(entry.codingAgent),
			0,
		));
		const range = endAngle - startAngle;
		let angle = startAngle;
		for (const entry of codingAgentEntries) {
			const codingAgentRange = range * MireLayout._codingAgentWeight(entry.codingAgent) / totalWeight;
			MireLayout._placeCodingAgent(
				entry.codingAgent,
				entry.tab.nodeId,
				entry.tab.label,
				workspace.nodeId,
				centre,
				angle,
				angle + codingAgentRange,
				result,
			);
			angle += codingAgentRange;
		}
	}

	/**
	 * Places one coding agent at the middle of its part of the sector, and its subagents side by side further out.
	 * @param codingAgent The coding agent.
	 * @param tabNodeId The node identifier of its tab.
	 * @param tabLabel The exact name of its tab.
	 * @param workspaceNodeId The node identifier of its workspace.
	 * @param workspaceCentre The centre of the hexagon of its workspace.
	 * @param startAngle The first angle of its part of the sector.
	 * @param endAngle The last angle of its part of the sector.
	 * @param result The layout to fill.
	 */
	private static _placeCodingAgent(
		codingAgent: MireCodingAgentNode,
		tabNodeId: string,
		tabLabel: string,
		workspaceNodeId: string,
		workspaceCentre: { x: number; y: number },
		startAngle: number,
		endAngle: number,
		result: MireLayoutResult,
	): void {
		const middle = (startAngle + endAngle) / 2;
		const centre = MireLayout._point(MIRE_CODING_AGENT_RING, middle);
		const arcLength = (endAngle - startAngle) * MIRE_CODING_AGENT_RING;
		const textRoom = arcLength - 30;
		const maximumCharacters = MireLayout._clamp(Math.floor(textRoom / CHARACTER_WIDTH), 3, 18);
		const labelText = MireLayout.truncate(tabLabel, maximumCharacters);
		result.codingAgents.push({
			nodeId: codingAgent.nodeId,
			workspaceNodeId,
			tabNodeId,
			x: centre.x,
			y: centre.y,
			angle: MireLayout._round(middle),
			labelText,
			isLabelTruncated: labelText !== tabLabel,
			isLabelShown: arcLength >= 44,
			labelWidth: MireLayout._round([...labelText].length * CHARACTER_WIDTH + 30),
			labelX: centre.x,
			labelY: MireLayout._round(centre.y + 17),
		});
		result.links.push({
			fromNodeId: workspaceNodeId,
			toNodeId: codingAgent.nodeId,
			x1: workspaceCentre.x,
			y1: workspaceCentre.y,
			x2: centre.x,
			y2: centre.y,
		});
		const flattened = MireLayout._flatten(codingAgent.subagents, codingAgent.nodeId, 1);
		if (flattened.length === 0) {
			return;
		}
		const slot = (endAngle - startAngle) / flattened.length;
		const parentCentres = new Map<string, { x: number; y: number }>([[codingAgent.nodeId, centre]]);
		flattened.forEach((entry, index) => {
			const angle = startAngle + slot * (index + 0.5);
			const drawnDepth = Math.min(entry.depth, MAXIMUM_DRAWN_DEPTH);
			const radius = MIRE_SUBAGENT_RING + (drawnDepth - 1) * MIRE_NESTED_SUBAGENT_STEP;
			const point = MireLayout._point(radius, angle);
			const labelPoint = MireLayout._point(radius + 10, angle);
			const name = MireLayout.subagentName(entry.subagent);
			const labelText = MireLayout.truncate(name, 16);
			parentCentres.set(entry.subagent.nodeId, point);
			result.subagents.push({
				nodeId: entry.subagent.nodeId,
				parentNodeId: entry.parentNodeId,
				codingAgentNodeId: codingAgent.nodeId,
				workspaceNodeId,
				depth: entry.depth,
				x: point.x,
				y: point.y,
				angle: MireLayout._round(angle),
				labelText,
				isLabelTruncated: labelText !== name,
				isLabelShown: slot * radius >= LABEL_FONT_SIZE + 3,
				labelAnchor: Math.cos(angle) >= 0 ? 'start' : 'end',
				labelX: labelPoint.x,
				labelY: MireLayout._round(labelPoint.y + LABEL_FONT_SIZE / 3),
			});
			const parent = parentCentres.get(entry.parentNodeId) ?? centre;
			result.links.push({
				fromNodeId: entry.parentNodeId,
				toNodeId: entry.subagent.nodeId,
				x1: parent.x,
				y1: parent.y,
				x2: point.x,
				y2: point.y,
			});
		});
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Gives the weight of a coding agent.
	 * @param codingAgent The coding agent.
	 * @returns The number of its subagents at all levels, or 1 when it has none.
	 */
	private static _codingAgentWeight(codingAgent: MireCodingAgentNode): number {
		return Math.max(1, MireLayout._flatten(codingAgent.subagents, codingAgent.nodeId, 1).length);
	}

	/**
	 * Lists the subagents depth first, so that a nested subagent sits next to its parent.
	 * @param subagents The subagents of one parent.
	 * @param parentNodeId The node identifier of the parent.
	 * @param depth The nested level of these subagents.
	 * @returns Each subagent once, with its parent and its level.
	 */
	private static _flatten(
		subagents: MireSubagentNode[],
		parentNodeId: string,
		depth: number,
	): { subagent: MireSubagentNode; parentNodeId: string; depth: number }[] {
		return subagents.flatMap((subagent) => [
			{
				subagent,
				parentNodeId,
				depth,
			},
			...MireLayout._flatten(subagent.children, subagent.nodeId, depth + 1),
		]);
	}

	/**
	 * Gives the deepest nested level of a list of subagents.
	 * @param subagents The subagents.
	 * @returns 0 for an empty list, 1 for subagents with no children, and so on.
	 */
	private static _depth(subagents: MireSubagentNode[]): number {
		if (subagents.length === 0) {
			return 0;
		}
		return 1 + Math.max(...subagents.map((subagent) => MireLayout._depth(subagent.children)));
	}

	/**
	 * Gives the SVG path of a ring sector.
	 * @param innerRadius The inner radius.
	 * @param outerRadius The outer radius.
	 * @param startAngle The first angle.
	 * @param endAngle The last angle.
	 * @returns The path.
	 */
	private static _sectorPath(innerRadius: number, outerRadius: number, startAngle: number, endAngle: number): string {
		const isLarge = endAngle - startAngle > Math.PI ? 1 : 0;
		const innerStart = MireLayout._point(innerRadius, startAngle);
		const outerStart = MireLayout._point(outerRadius, startAngle);
		const outerEnd = MireLayout._point(outerRadius, endAngle);
		const innerEnd = MireLayout._point(innerRadius, endAngle);
		return [
			`M ${innerStart.x} ${innerStart.y}`,
			`L ${outerStart.x} ${outerStart.y}`,
			`A ${outerRadius} ${outerRadius} 0 ${isLarge} 1 ${outerEnd.x} ${outerEnd.y}`,
			`L ${innerEnd.x} ${innerEnd.y}`,
			`A ${innerRadius} ${innerRadius} 0 ${isLarge} 0 ${innerStart.x} ${innerStart.y}`,
			'Z',
		].join(' ');
	}

	/**
	 * Gives the point at a radius and an angle from the centre.
	 * @param radius The radius.
	 * @param angle The angle, in radians.
	 * @returns The point, rounded to two decimals.
	 */
	private static _point(radius: number, angle: number): { x: number; y: number } {
		return {
			x: MireLayout._round(radius * Math.cos(angle)),
			y: MireLayout._round(radius * Math.sin(angle)),
		};
	}

	/**
	 * Rounds a number to two decimals, so that the same model always gives the same text.
	 * @param value The number.
	 * @returns The rounded number.
	 */
	private static _round(value: number): number {
		const rounded = Math.round(value * 100) / 100;
		return Object.is(rounded, -0) ? 0 : rounded;
	}

	/**
	 * Keeps a number between two limits.
	 * @param value The number.
	 * @param minimum The lower limit.
	 * @param maximum The upper limit.
	 * @returns The number between the limits.
	 */
	private static _clamp(value: number, minimum: number, maximum: number): number {
		return Math.min(maximum, Math.max(minimum, value));
	}
}
