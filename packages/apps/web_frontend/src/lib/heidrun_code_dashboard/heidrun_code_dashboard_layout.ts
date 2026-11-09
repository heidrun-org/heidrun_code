import type { HeidrunCodeDashboardCodingAgentNode, HeidrunCodeDashboardModel, HeidrunCodeDashboardSubagentNode, HeidrunCodeDashboardWorkspaceNode } from './heidrun_code_dashboard_model_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunCodeDashboardLayout — places Heidrun, the workspaces, the coding agents, and the subagents on the rings of the radial graph
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The largest half size of the square view box of the graph: the farthest place that a message arc may reach. The view
 * box itself fits the drawn graph, so that the graph fills the window.
 */
export const HEIDRUN_CODE_DASHBOARD_LAYOUT_HALF_SIZE = 560;

/** The free space around the drawn graph, inside the view box. */
const VIEW_MARGIN = 24;

/** The radius of the picture of Heidrun at the centre. */
export const HEIDRUN_CODE_DASHBOARD_HEIDRUN_RADIUS = 62;

/** The half size of the drawing of Heidrun with its selection circle and its name. */
const HEIDRUN_DRAWING_HALF_SIZE = HEIDRUN_CODE_DASHBOARD_HEIDRUN_RADIUS + 40;

/** The radius of the first ring: the workspace hexagons. */
export const HEIDRUN_CODE_DASHBOARD_WORKSPACE_RING = 215;

/** The radius of a workspace hexagon. */
export const HEIDRUN_CODE_DASHBOARD_HEXAGON_RADIUS = 20;

/** The radius of the second ring: one satellite for each coding agent. */
export const HEIDRUN_CODE_DASHBOARD_CODING_AGENT_RING = 295;

/** The radius of the third ring: the subagents that a coding agent started. */
export const HEIDRUN_CODE_DASHBOARD_SUBAGENT_RING = 405;

/** The extra radius of each nested level of subagents, after the first one. */
export const HEIDRUN_CODE_DASHBOARD_NESTED_SUBAGENT_STEP = 40;

/** The deepest nested level that gets its own radius. A deeper subagent stays on this radius. */
const MAXIMUM_DRAWN_DEPTH = 3;

/** The size of the text of the labels, in units of the view box. */
const LABEL_FONT_SIZE = 11;

/** The mean width of one character of a label, in units of the view box. */
const CHARACTER_WIDTH = LABEL_FONT_SIZE * 0.6;

/**
 * The size of the text of a workspace label that has room, in units of the view box. A longer name gets a smaller text,
 * so that the full name always shows (issue 982).
 */
export const HEIDRUN_CODE_DASHBOARD_WORKSPACE_LABEL_FONT_SIZE = 12;

/** The smallest size of the text of a workspace label. A name too long for this size makes its box go past its room. */
export const HEIDRUN_CODE_DASHBOARD_WORKSPACE_LABEL_MINIMUM_FONT_SIZE = 7;

/** The mean width of one character of a workspace label, for each unit of the size of its text. */
const WORKSPACE_LABEL_CHARACTER_SHARE = 0.6;

/** The height of the box of a workspace label, for each unit of the size of its text. */
const WORKSPACE_LABEL_HEIGHT_SHARE = 22 / 12;

/** The space between the text of a workspace label and the left or right border of its box, for each unit of size. */
const WORKSPACE_LABEL_PADDING_SHARE = 10 / 12;

/** The outer radius of Heidrun with the marks of its sight ring. */
const HEIDRUN_OUTER_RADIUS = HEIDRUN_CODE_DASHBOARD_HEIDRUN_RADIUS + 11;

/** The free space between a workspace label and the hexagon, or Heidrun. */
const WORKSPACE_LABEL_SPACE = 5;

/**
 * The inner radius of every workspace sector, near the workspace label, as in the proposal of issue 955: a wide empty
 * space stays between Heidrun and the sectors, so that the graph is easy to read.
 */
const SECTOR_INNER_RADIUS = HEIDRUN_CODE_DASHBOARD_WORKSPACE_RING - 70;

/** The empty angle between two workspace sectors, in radians, when there is room for it. */
const SECTOR_GAP = 0.24;

/** The smallest angle of a workspace sector, in radians, when there is room for it. */
const MINIMUM_SECTOR_ANGLE = 0.42;

/** One workspace: its hexagon, its sector, and its label. */
export type HeidrunCodeDashboardLayoutWorkspace = {
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
	/** The outer radius of the sector. */
	outerRadius: number;
	/** The SVG path of the sector: the area that selects the workspace. */
	sectorPath: string;
	/** The SVG points of the hexagon. */
	hexagonPoints: string;
	/** The text of the label: the exact and full name, never shortened. */
	labelText: string;
	/** The size of the text of the label: smaller for a long name. */
	labelFontSize: number;
	/** The width of the box of the label. */
	labelWidth: number;
	/** The height of the box of the label. */
	labelHeight: number;
	/** The centre of the box of the label, on the line between Heidrun and the hexagon. */
	labelX: number;
	/** The centre of the box of the label, on the line between Heidrun and the hexagon. */
	labelY: number;
};

/** One coding agent: its satellite on the second ring, and its label shaped like a tab. */
export type HeidrunCodeDashboardLayoutCodingAgent = {
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
export type HeidrunCodeDashboardLayoutSubagent = {
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
export type HeidrunCodeDashboardLayoutLink = {
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
	/**
	 * The SVG path of the line, from the parent to the child: straight from Heidrun to a workspace, and a curve from a
	 * workspace to a coding agent and from a coding agent to a subagent, as in the proposal of issue 955.
	 */
	path: string;
	/** The same line from the child to the parent, for the drops of mead that climb it. */
	climbPath: string;
};

/** The positions of every node of the graph. The same model gives the same layout. */
export type HeidrunCodeDashboardLayoutResult = {
	/** The SVG view box. */
	viewBox: string;
	/** The workspaces, in the order of the model. */
	workspaces: HeidrunCodeDashboardLayoutWorkspace[];
	/** The coding agents, in the order of the model. */
	codingAgents: HeidrunCodeDashboardLayoutCodingAgent[];
	/** The subagents, in the order of the hierarchy. */
	subagents: HeidrunCodeDashboardLayoutSubagent[];
	/** The lines: Heidrun to each workspace, each workspace to its coding agents, and each parent to its subagents. */
	links: HeidrunCodeDashboardLayoutLink[];
};

/**
 * Places the nodes of the Heidrun Code Dashboard on the rings of the radial graph. The layout reads only the hierarchy, the identifiers,
 * and the names: a status change never moves a node. It reads no file and draws nothing.
 */
export class HeidrunCodeDashboardLayout {
	/**
	 * Computes the layout of the graph.
	 * @param model The Heidrun Code Dashboard model.
	 * @returns The positions of the nodes, the sectors, the labels, and the lines.
	 */
	static compute(model: HeidrunCodeDashboardModel): HeidrunCodeDashboardLayoutResult {
		const result: HeidrunCodeDashboardLayoutResult = {
			viewBox: '',
			workspaces: [],
			codingAgents: [],
			subagents: [],
			links: [],
		};
		const workspaceCount = model.workspaces.length;
		if (workspaceCount === 0) {
			result.viewBox = HeidrunCodeDashboardLayout._viewBox(result);
			return result;
		}
		const gap = workspaceCount === 1 ? SECTOR_GAP : Math.min(SECTOR_GAP, Math.PI / 2 / workspaceCount);
		const available = 2 * Math.PI - gap * workspaceCount;
		const minimumAngle = Math.min(MINIMUM_SECTOR_ANGLE, available / workspaceCount);
		const weights = model.workspaces.map((workspace) => HeidrunCodeDashboardLayout.workspaceWeight(workspace));
		const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
		const sharedAngle = available - minimumAngle * workspaceCount;
		// Every sector reaches the same radius: the radius that the deepest workspace needs.
		const outerRadius = Math.max(...model.workspaces.map((workspace) => HeidrunCodeDashboardLayout._outerRadius(workspace)));
		let angle = -Math.PI / 2 + gap / 2;
		model.workspaces.forEach((workspace, index) => {
			const sectorAngle = minimumAngle + sharedAngle * weights[index] / totalWeight;
			HeidrunCodeDashboardLayout._placeWorkspace(workspace, angle, angle + sectorAngle, outerRadius, result);
			angle += sectorAngle + gap;
		});
		result.viewBox = HeidrunCodeDashboardLayout._viewBox(result);
		return result;
	}

	/**
	 * Gives the weight of a workspace: the share of the circle that its sector needs.
	 * @param workspace The workspace.
	 * @returns One slot for each coding agent, or one for each of its subagents when it has more; at least 1.
	 */
	static workspaceWeight(workspace: HeidrunCodeDashboardWorkspaceNode): number {
		const codingAgents = workspace.tabs.flatMap((tab) => tab.codingAgents);
		const weight = codingAgents.reduce((sum, codingAgent) => sum + HeidrunCodeDashboardLayout._codingAgentWeight(codingAgent), 0);
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
	static subagentName(subagent: HeidrunCodeDashboardSubagentNode): string {
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
			points.push(`${HeidrunCodeDashboardLayout._round(x + radius * Math.cos(angle))},${HeidrunCodeDashboardLayout._round(y + radius * Math.sin(angle))}`);
		}
		return points.join(' ');
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Placement
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Places the label of a workspace on the line between Heidrun and the hexagon, as in the proposal of issue 955: at the
	 * first third of the line from the hexagon, or nearer to Heidrun when the box would touch the hexagon. The full name
	 * always shows: the text gets smaller so that its box fits between the two, whatever the angle of the line, and fits
	 * in the arc of the sector. Below the smallest size, the box goes past its room (issue 982).
	 * @param name The name of the workspace.
	 * @param angle The angle of the line, in radians.
	 * @param arcLength The length of the arc of the sector on the workspace ring.
	 * @returns The size of the text, the width and the height of the box, and the centre of the box.
	 */
	private static _placeWorkspaceLabel(
		name: string,
		angle: number,
		arcLength: number,
	): { fontSize: number; width: number; height: number; x: number; y: number } {
		const innerLimit = HEIDRUN_OUTER_RADIUS + WORKSPACE_LABEL_SPACE;
		const outerLimit = HEIDRUN_CODE_DASHBOARD_WORKSPACE_RING - HEIDRUN_CODE_DASHBOARD_HEXAGON_RADIUS - WORKSPACE_LABEL_SPACE;
		const halfRoom = (outerLimit - innerLimit) / 2;
		const across = Math.abs(Math.cos(angle));
		const along = Math.abs(Math.sin(angle));
		const characterCount = [...name].length;
		// For a text of size 1: the box reaches `across * halfWidth + along * halfHeight` along a line at this angle.
		const unitWidth = characterCount * WORKSPACE_LABEL_CHARACTER_SHARE + 2 * WORKSPACE_LABEL_PADDING_SHARE;
		const unitReach = across * (unitWidth / 2) + along * (WORKSPACE_LABEL_HEIGHT_SHARE / 2);
		const lineFontSize = halfRoom / unitReach;
		const arcFontSize = arcLength / unitWidth;
		// Rounded down, so that the rounding never makes the box larger than its room.
		const fontSize = Math.floor(HeidrunCodeDashboardLayout._clamp(
			Math.min(lineFontSize, arcFontSize),
			HEIDRUN_CODE_DASHBOARD_WORKSPACE_LABEL_MINIMUM_FONT_SIZE,
			HEIDRUN_CODE_DASHBOARD_WORKSPACE_LABEL_FONT_SIZE,
		) * 100) / 100;
		const width = HeidrunCodeDashboardLayout._round(unitWidth * fontSize);
		const height = HeidrunCodeDashboardLayout._round(WORKSPACE_LABEL_HEIGHT_SHARE * fontSize);
		const reach = across * (width / 2) + along * (height / 2);
		const firstThird = HEIDRUN_CODE_DASHBOARD_WORKSPACE_RING - (HEIDRUN_CODE_DASHBOARD_WORKSPACE_RING - HEIDRUN_CODE_DASHBOARD_HEIDRUN_RADIUS) / 3;
		// A box larger than its room stays centred in the room.
		const distance = reach > halfRoom
			? innerLimit + halfRoom
			: HeidrunCodeDashboardLayout._clamp(firstThird, innerLimit + reach, outerLimit - reach);
		const centre = HeidrunCodeDashboardLayout._point(distance, angle);
		return {
			fontSize,
			width,
			height,
			x: centre.x,
			y: centre.y,
		};
	}

	/**
	 * Gives the outer radius that the sector of a workspace needs to hold its coding agents and their subagents.
	 * @param workspace The workspace.
	 * @returns The radius.
	 */
	private static _outerRadius(workspace: HeidrunCodeDashboardWorkspaceNode): number {
		const codingAgents = workspace.tabs.flatMap((tab) => tab.codingAgents);
		const maximumDepth = Math.max(0, ...codingAgents.map((codingAgent) => HeidrunCodeDashboardLayout._depth(codingAgent.subagents)));
		if (maximumDepth > 0) {
			return HEIDRUN_CODE_DASHBOARD_SUBAGENT_RING + (Math.min(maximumDepth, MAXIMUM_DRAWN_DEPTH) - 1) * HEIDRUN_CODE_DASHBOARD_NESTED_SUBAGENT_STEP + 34;
		}
		return codingAgents.length > 0 ? HEIDRUN_CODE_DASHBOARD_CODING_AGENT_RING + 52 : HEIDRUN_CODE_DASHBOARD_WORKSPACE_RING + 48;
	}

	/**
	 * Places one workspace, its coding agents, and their subagents in their sector.
	 * @param workspace The workspace.
	 * @param startAngle The first angle of the sector.
	 * @param endAngle The last angle of the sector.
	 * @param outerRadius The outer radius of every sector.
	 * @param result The layout to fill.
	 */
	private static _placeWorkspace(
		workspace: HeidrunCodeDashboardWorkspaceNode,
		startAngle: number,
		endAngle: number,
		outerRadius: number,
		result: HeidrunCodeDashboardLayoutResult,
	): void {
		const middle = (startAngle + endAngle) / 2;
		const centre = HeidrunCodeDashboardLayout._point(HEIDRUN_CODE_DASHBOARD_WORKSPACE_RING, middle);
		const arcLength = (endAngle - startAngle) * HEIDRUN_CODE_DASHBOARD_WORKSPACE_RING;
		const label = HeidrunCodeDashboardLayout._placeWorkspaceLabel(workspace.label, middle, arcLength);
		const codingAgentEntries = workspace.tabs.flatMap((tab) => tab.codingAgents.map((codingAgent) => ({
			tab,
			codingAgent,
		})));
		result.workspaces.push({
			nodeId: workspace.nodeId,
			x: centre.x,
			y: centre.y,
			startAngle: HeidrunCodeDashboardLayout._round(startAngle),
			endAngle: HeidrunCodeDashboardLayout._round(endAngle),
			outerRadius,
			sectorPath: HeidrunCodeDashboardLayout._sectorPath(SECTOR_INNER_RADIUS, outerRadius, startAngle, endAngle),
			hexagonPoints: HeidrunCodeDashboardLayout.hexagonPoints(centre.x, centre.y, HEIDRUN_CODE_DASHBOARD_HEXAGON_RADIUS),
			labelText: workspace.label,
			labelFontSize: label.fontSize,
			labelWidth: label.width,
			labelHeight: label.height,
			labelX: label.x,
			labelY: label.y,
		});
		// The line starts at the centre, behind the goat, as in the proposal of issue 955.
		result.links.push({
			fromNodeId: 'heidrun',
			toNodeId: workspace.nodeId,
			x1: 0,
			y1: 0,
			x2: centre.x,
			y2: centre.y,
			path: `M 0 0 L ${centre.x} ${centre.y}`,
			climbPath: `M ${centre.x} ${centre.y} L 0 0`,
		});
		const totalWeight = Math.max(1, codingAgentEntries.reduce(
			(sum, entry) => sum + HeidrunCodeDashboardLayout._codingAgentWeight(entry.codingAgent),
			0,
		));
		const range = endAngle - startAngle;
		let angle = startAngle;
		for (const entry of codingAgentEntries) {
			const codingAgentRange = range * HeidrunCodeDashboardLayout._codingAgentWeight(entry.codingAgent) / totalWeight;
			HeidrunCodeDashboardLayout._placeCodingAgent(
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
		codingAgent: HeidrunCodeDashboardCodingAgentNode,
		tabNodeId: string,
		tabLabel: string,
		workspaceNodeId: string,
		workspaceCentre: { x: number; y: number },
		startAngle: number,
		endAngle: number,
		result: HeidrunCodeDashboardLayoutResult,
	): void {
		const middle = (startAngle + endAngle) / 2;
		const centre = HeidrunCodeDashboardLayout._point(HEIDRUN_CODE_DASHBOARD_CODING_AGENT_RING, middle);
		const arcLength = (endAngle - startAngle) * HEIDRUN_CODE_DASHBOARD_CODING_AGENT_RING;
		const textRoom = arcLength - 30;
		const maximumCharacters = HeidrunCodeDashboardLayout._clamp(Math.floor(textRoom / CHARACTER_WIDTH), 3, 18);
		const labelText = HeidrunCodeDashboardLayout.truncate(tabLabel, maximumCharacters);
		result.codingAgents.push({
			nodeId: codingAgent.nodeId,
			workspaceNodeId,
			tabNodeId,
			x: centre.x,
			y: centre.y,
			angle: HeidrunCodeDashboardLayout._round(middle),
			labelText,
			isLabelTruncated: labelText !== tabLabel,
			isLabelShown: arcLength >= 44,
			labelWidth: HeidrunCodeDashboardLayout._round([...labelText].length * CHARACTER_WIDTH + 30),
			labelX: centre.x,
			labelY: HeidrunCodeDashboardLayout._round(centre.y + 17),
		});
		result.links.push({
			fromNodeId: workspaceNodeId,
			toNodeId: codingAgent.nodeId,
			x1: workspaceCentre.x,
			y1: workspaceCentre.y,
			x2: centre.x,
			y2: centre.y,
			...HeidrunCodeDashboardLayout._curvedLinkPaths(workspaceCentre, centre),
		});
		const flattened = HeidrunCodeDashboardLayout._flatten(codingAgent.subagents, codingAgent.nodeId, 1);
		if (flattened.length === 0) {
			return;
		}
		const slot = (endAngle - startAngle) / flattened.length;
		const parentCentres = new Map<string, { x: number; y: number }>([[codingAgent.nodeId, centre]]);
		flattened.forEach((entry, index) => {
			const angle = startAngle + slot * (index + 0.5);
			const drawnDepth = Math.min(entry.depth, MAXIMUM_DRAWN_DEPTH);
			const radius = HEIDRUN_CODE_DASHBOARD_SUBAGENT_RING + (drawnDepth - 1) * HEIDRUN_CODE_DASHBOARD_NESTED_SUBAGENT_STEP;
			const point = HeidrunCodeDashboardLayout._point(radius, angle);
			const labelPoint = HeidrunCodeDashboardLayout._point(radius + 10, angle);
			const name = HeidrunCodeDashboardLayout.subagentName(entry.subagent);
			const labelText = HeidrunCodeDashboardLayout.truncate(name, 16);
			parentCentres.set(entry.subagent.nodeId, point);
			result.subagents.push({
				nodeId: entry.subagent.nodeId,
				parentNodeId: entry.parentNodeId,
				codingAgentNodeId: codingAgent.nodeId,
				workspaceNodeId,
				depth: entry.depth,
				x: point.x,
				y: point.y,
				angle: HeidrunCodeDashboardLayout._round(angle),
				labelText,
				isLabelTruncated: labelText !== name,
				isLabelShown: slot * radius >= LABEL_FONT_SIZE + 3,
				labelAnchor: Math.cos(angle) >= 0 ? 'start' : 'end',
				labelX: labelPoint.x,
				labelY: HeidrunCodeDashboardLayout._round(labelPoint.y + LABEL_FONT_SIZE / 3),
			});
			const parent = parentCentres.get(entry.parentNodeId) ?? centre;
			result.links.push({
				fromNodeId: entry.parentNodeId,
				toNodeId: entry.subagent.nodeId,
				x1: parent.x,
				y1: parent.y,
				x2: point.x,
				y2: point.y,
				...HeidrunCodeDashboardLayout._curvedLinkPaths(parent, point),
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
	private static _codingAgentWeight(codingAgent: HeidrunCodeDashboardCodingAgentNode): number {
		return Math.max(1, HeidrunCodeDashboardLayout._flatten(codingAgent.subagents, codingAgent.nodeId, 1).length);
	}

	/**
	 * Lists the subagents depth first, so that a nested subagent sits next to its parent.
	 * @param subagents The subagents of one parent.
	 * @param parentNodeId The node identifier of the parent.
	 * @param depth The nested level of these subagents.
	 * @returns Each subagent once, with its parent and its level.
	 */
	private static _flatten(
		subagents: HeidrunCodeDashboardSubagentNode[],
		parentNodeId: string,
		depth: number,
	): { subagent: HeidrunCodeDashboardSubagentNode; parentNodeId: string; depth: number }[] {
		return subagents.flatMap((subagent) => [
			{
				subagent,
				parentNodeId,
				depth,
			},
			...HeidrunCodeDashboardLayout._flatten(subagent.children, subagent.nodeId, depth + 1),
		]);
	}

	/**
	 * Gives the deepest nested level of a list of subagents.
	 * @param subagents The subagents.
	 * @returns 0 for an empty list, 1 for subagents with no children, and so on.
	 */
	private static _depth(subagents: HeidrunCodeDashboardSubagentNode[]): number {
		if (subagents.length === 0) {
			return 0;
		}
		return 1 + Math.max(...subagents.map((subagent) => HeidrunCodeDashboardLayout._depth(subagent.children)));
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
		const innerStart = HeidrunCodeDashboardLayout._point(innerRadius, startAngle);
		const outerStart = HeidrunCodeDashboardLayout._point(outerRadius, startAngle);
		const outerEnd = HeidrunCodeDashboardLayout._point(outerRadius, endAngle);
		const innerEnd = HeidrunCodeDashboardLayout._point(innerRadius, endAngle);
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
	 * Gives the curve between a parent and a child, as in the proposal of issue 955: the curve leaves the parent along
	 * the ring of the parent, towards the angle of the child, and bends to reach the child along the ray of the child.
	 * @param parent The centre of the parent.
	 * @param child The centre of the child.
	 * @returns The path from the parent to the child, and the same path from the child to the parent.
	 */
	private static _curvedLinkPaths(
		parent: { x: number; y: number },
		child: { x: number; y: number },
	): { path: string; climbPath: string } {
		const bend = HeidrunCodeDashboardLayout._point(Math.hypot(parent.x, parent.y), Math.atan2(child.y, child.x));
		return {
			path: `M ${parent.x} ${parent.y} Q ${bend.x} ${bend.y} ${child.x} ${child.y}`,
			climbPath: `M ${child.x} ${child.y} Q ${bend.x} ${bend.y} ${parent.x} ${parent.y}`,
		};
	}

	/**
	 * Gives the square view box that fits the drawn graph with a margin, centred on Heidrun, so that the graph fills the
	 * window: the sectors, and the labels of the subagents, which can reach past their sector.
	 * @param result The placed graph.
	 * @returns The SVG view box.
	 */
	private static _viewBox(result: HeidrunCodeDashboardLayoutResult): string {
		let halfSize = HEIDRUN_DRAWING_HALF_SIZE;
		for (const workspace of result.workspaces) {
			halfSize = Math.max(halfSize, workspace.outerRadius);
		}
		for (const subagent of result.subagents) {
			const labelWidth = [...subagent.labelText].length * CHARACTER_WIDTH;
			const labelEnd = subagent.labelAnchor === 'start' ? subagent.labelX + labelWidth : subagent.labelX - labelWidth;
			halfSize = Math.max(halfSize, Math.abs(labelEnd), Math.abs(subagent.labelY) + LABEL_FONT_SIZE);
		}
		halfSize = Math.min(HEIDRUN_CODE_DASHBOARD_LAYOUT_HALF_SIZE, Math.ceil(halfSize + VIEW_MARGIN));
		return `${-halfSize} ${-halfSize} ${2 * halfSize} ${2 * halfSize}`;
	}

	/**
	 * Gives the point at a radius and an angle from the centre.
	 * @param radius The radius.
	 * @param angle The angle, in radians.
	 * @returns The point, rounded to two decimals.
	 */
	private static _point(radius: number, angle: number): { x: number; y: number } {
		return {
			x: HeidrunCodeDashboardLayout._round(radius * Math.cos(angle)),
			y: HeidrunCodeDashboardLayout._round(radius * Math.sin(angle)),
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
