import type {
	HeidrunCodeDashboardCodingAgentNode,
	HeidrunCodeDashboardFreshness,
	HeidrunCodeDashboardModel,
	HeidrunCodeDashboardSubagentNode,
	HeidrunCodeDashboardTabNode,
	HeidrunCodeDashboardVisibleStatus,
	HeidrunCodeDashboardWorkspaceNode,
} from '../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_types';
import { HeidrunCodeDashboardLayout } from '../../lib/heidrun_code_dashboard/heidrun_code_dashboard_layout';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunCodeDashboardNavigation — the selection path, the filter, and the keyboard moves of a Heidrun Code Dashboard view
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** A node of the Heidrun Code Dashboard model that a view can select. */
export type HeidrunCodeDashboardSelectableNode = HeidrunCodeDashboardModel | HeidrunCodeDashboardWorkspaceNode | HeidrunCodeDashboardTabNode | HeidrunCodeDashboardCodingAgentNode | HeidrunCodeDashboardSubagentNode;

/** One node of the Heidrun Code Dashboard model, with its place in the hierarchy. */
export type HeidrunCodeDashboardNodeEntry = {
	/** The node identifier. */
	nodeId: string;
	/** The node. */
	node: HeidrunCodeDashboardSelectableNode;
	/** The parent in the path: the tab of a coding agent, the workspace of a tab. Null for Heidrun. */
	parentNodeId: string | null;
	/** The parent in the graph: the workspace of a coding agent, because the graph draws no node for a tab. */
	drawnParentNodeId: string | null;
	/** The children in the graph, in the order of the graph. A tab has none. */
	drawnChildNodeIds: string[];
	/** The name to show in the path. */
	label: string;
	/** The freshness of a coding agent or a subagent, or null for a group. */
	freshness: HeidrunCodeDashboardFreshness | null;
};

/** How a node shows under the active filter. */
export type HeidrunCodeDashboardVisibility = 'shown' | 'faint' | 'hidden';

/** A key that moves the keyboard focus in the graph. */
export type HeidrunCodeDashboardNavigationKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown';

/** Indexes the Heidrun Code Dashboard model, filters it, and moves in it. It reads no file and calls no Tauri command. */
export class HeidrunCodeDashboardNavigation {
	/**
	 * Indexes every node of the model by its node identifier.
	 * @param model The Heidrun Code Dashboard model.
	 * @returns Heidrun, the workspaces, the tabs, the coding agents, and the subagents, in the order of the hierarchy.
	 */
	static index(model: HeidrunCodeDashboardModel): Map<string, HeidrunCodeDashboardNodeEntry> {
		const index = new Map<string, HeidrunCodeDashboardNodeEntry>();
		index.set(model.nodeId, {
			nodeId: model.nodeId,
			node: model,
			parentNodeId: null,
			drawnParentNodeId: null,
			drawnChildNodeIds: model.workspaces.map((workspace) => workspace.nodeId),
			label: 'Heidrun',
			freshness: null,
		});
		for (const workspace of model.workspaces) {
			const codingAgents = workspace.tabs.flatMap((tab) => tab.codingAgents);
			index.set(workspace.nodeId, {
				nodeId: workspace.nodeId,
				node: workspace,
				parentNodeId: model.nodeId,
				drawnParentNodeId: model.nodeId,
				drawnChildNodeIds: codingAgents.map((codingAgent) => codingAgent.nodeId),
				label: workspace.label,
				freshness: null,
			});
			for (const tab of workspace.tabs) {
				index.set(tab.nodeId, {
					nodeId: tab.nodeId,
					node: tab,
					parentNodeId: workspace.nodeId,
					drawnParentNodeId: workspace.nodeId,
					drawnChildNodeIds: [],
					label: tab.label,
					freshness: null,
				});
				for (const codingAgent of tab.codingAgents) {
					index.set(codingAgent.nodeId, {
						nodeId: codingAgent.nodeId,
						node: codingAgent,
						parentNodeId: tab.nodeId,
						drawnParentNodeId: workspace.nodeId,
						drawnChildNodeIds: codingAgent.subagents.map((subagent) => subagent.nodeId),
						label: codingAgent.label ?? tab.label,
						freshness: codingAgent.facts.freshness,
					});
					HeidrunCodeDashboardNavigation._indexSubagents(codingAgent.subagents, codingAgent.nodeId, index);
				}
			}
		}
		return index;
	}

	/**
	 * Gives the path from Heidrun to a node: Heidrun, workspace, tab, coding agent, and each parent subagent.
	 * @param index The index of the model.
	 * @param nodeId The node.
	 * @returns The entries from Heidrun to the node, or an empty list when the node is not in the model.
	 */
	static path(index: Map<string, HeidrunCodeDashboardNodeEntry>, nodeId: string): HeidrunCodeDashboardNodeEntry[] {
		const path: HeidrunCodeDashboardNodeEntry[] = [];
		let entry = index.get(nodeId);
		while (entry !== undefined) {
			path.unshift(entry);
			entry = entry.parentNodeId === null ? undefined : index.get(entry.parentNodeId);
		}
		return path;
	}

	/**
	 * Gives how each node shows under a status filter. A coding agent or a subagent with the status shows. Its
	 * ancestors that do not have the status stay faint, so that the hierarchy explains it. Every other coding agent
	 * and subagent hides, and a workspace with nothing that shows hides too. Heidrun always shows.
	 * @param model The Heidrun Code Dashboard model.
	 * @param filter The status of the filter, or null for no filter.
	 * @returns The visibility of every node, by node identifier.
	 */
	static visibility(model: HeidrunCodeDashboardModel, filter: HeidrunCodeDashboardVisibleStatus | null): Map<string, HeidrunCodeDashboardVisibility> {
		const visibility = new Map<string, HeidrunCodeDashboardVisibility>();
		visibility.set(model.nodeId, 'shown');
		for (const workspace of model.workspaces) {
			let isWorkspaceUsed = false;
			for (const tab of workspace.tabs) {
				let tabVisibility: HeidrunCodeDashboardVisibility = 'hidden';
				for (const codingAgent of tab.codingAgents) {
					const hasMatchingSubagent = HeidrunCodeDashboardNavigation._subagentsVisibility(
						codingAgent.subagents,
						filter,
						visibility,
					);
					const codingAgentVisibility = HeidrunCodeDashboardNavigation._itemVisibility(
						codingAgent.status,
						filter,
						hasMatchingSubagent,
					);
					visibility.set(codingAgent.nodeId, codingAgentVisibility);
					tabVisibility = HeidrunCodeDashboardNavigation._strongest(tabVisibility, codingAgentVisibility);
				}
				if (filter === null) {
					tabVisibility = 'shown';
				}
				visibility.set(tab.nodeId, tabVisibility);
				isWorkspaceUsed = isWorkspaceUsed || tabVisibility !== 'hidden';
			}
			visibility.set(workspace.nodeId, filter === null || isWorkspaceUsed === true ? 'shown' : 'hidden');
		}
		return visibility;
	}

	/**
	 * Finds the node to keep selected after a change of the model or of the filter. The selection stays on its node
	 * while the node shows. When the node disappears, hides under the filter, or becomes stale, the selection moves to
	 * its nearest ancestor that shows.
	 * @param selectedPath The node identifiers of the path of the selection, from Heidrun to the selected node.
	 * @param previousFreshness The freshness of the selected node at the last check, or null.
	 * @param index The index of the new model.
	 * @param visibility The visibility under the active filter.
	 * @returns The node identifier to select.
	 */
	static resolveSelection(
		selectedPath: string[],
		previousFreshness: HeidrunCodeDashboardFreshness | null,
		index: Map<string, HeidrunCodeDashboardNodeEntry>,
		visibility: Map<string, HeidrunCodeDashboardVisibility>,
	): string {
		for (let position = selectedPath.length - 1; position >= 0; position -= 1) {
			const nodeId = selectedPath[position];
			const entry = index.get(nodeId);
			if (entry === undefined || visibility.get(nodeId) === 'hidden') {
				continue;
			}
			const isSelectedNode = position === selectedPath.length - 1;
			const hasBecomeStale = entry.freshness === 'stale' && previousFreshness !== null && previousFreshness !== 'stale';
			if (isSelectedNode === true && hasBecomeStale === true) {
				continue;
			}
			return nodeId;
		}
		return 'heidrun';
	}

	/**
	 * Lists the nodes that the graph draws and that show, in the order of the keyboard focus.
	 * @param index The index of the model.
	 * @param visibility The visibility under the active filter.
	 * @returns Heidrun, then each workspace followed by its coding agents and their subagents.
	 */
	static focusOrder(index: Map<string, HeidrunCodeDashboardNodeEntry>, visibility: Map<string, HeidrunCodeDashboardVisibility>): string[] {
		const order: string[] = [];
		const visit = (nodeId: string): void => {
			const entry = index.get(nodeId);
			if (entry === undefined || visibility.get(nodeId) === 'hidden') {
				return;
			}
			order.push(nodeId);
			for (const childNodeId of entry.drawnChildNodeIds) {
				visit(childNodeId);
			}
		};
		visit('heidrun');
		return order;
	}

	/**
	 * Gives the node that an arrow key moves the keyboard focus to. Left and Right go to the previous and the next
	 * sibling on the same ring, Up goes to the parent in the graph, and Down goes to the first child.
	 * @param index The index of the model.
	 * @param visibility The visibility under the active filter.
	 * @param nodeId The node that has the keyboard focus.
	 * @param key The arrow key.
	 * @returns The node to focus, or null when the key leads nowhere.
	 */
	static move(
		index: Map<string, HeidrunCodeDashboardNodeEntry>,
		visibility: Map<string, HeidrunCodeDashboardVisibility>,
		nodeId: string,
		key: HeidrunCodeDashboardNavigationKey,
	): string | null {
		const entry = index.get(nodeId);
		if (entry === undefined) {
			return null;
		}
		const isShown = (candidate: string): boolean => visibility.get(candidate) !== 'hidden';
		if (key === 'ArrowUp') {
			return entry.drawnParentNodeId;
		}
		if (key === 'ArrowDown') {
			return entry.drawnChildNodeIds.find(isShown) ?? null;
		}
		if (entry.drawnParentNodeId === null) {
			return null;
		}
		const siblings = (index.get(entry.drawnParentNodeId)?.drawnChildNodeIds ?? []).filter(isShown);
		const position = siblings.indexOf(nodeId);
		if (position === -1 || siblings.length < 2) {
			return null;
		}
		const step = key === 'ArrowRight' ? 1 : -1;
		return siblings[(position + step + siblings.length) % siblings.length];
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Indexes the subagents of one parent, and their children.
	 * @param subagents The subagents.
	 * @param parentNodeId The parent node.
	 * @param index The index to fill.
	 */
	private static _indexSubagents(
		subagents: HeidrunCodeDashboardSubagentNode[],
		parentNodeId: string,
		index: Map<string, HeidrunCodeDashboardNodeEntry>,
	): void {
		for (const subagent of subagents) {
			if (index.has(subagent.nodeId) === true) {
				continue;
			}
			index.set(subagent.nodeId, {
				nodeId: subagent.nodeId,
				node: subagent,
				parentNodeId,
				drawnParentNodeId: parentNodeId,
				drawnChildNodeIds: subagent.children.map((child) => child.nodeId),
				label: HeidrunCodeDashboardLayout.subagentName(subagent),
				freshness: subagent.facts.freshness,
			});
			HeidrunCodeDashboardNavigation._indexSubagents(subagent.children, subagent.nodeId, index);
		}
	}

	/**
	 * Sets the visibility of a list of subagents and of their children.
	 * @param subagents The subagents.
	 * @param filter The status of the filter, or null.
	 * @param visibility The visibility to fill.
	 * @returns True when one of the subagents or of their children shows.
	 */
	private static _subagentsVisibility(
		subagents: HeidrunCodeDashboardSubagentNode[],
		filter: HeidrunCodeDashboardVisibleStatus | null,
		visibility: Map<string, HeidrunCodeDashboardVisibility>,
	): boolean {
		let hasShown = false;
		for (const subagent of subagents) {
			const hasMatchingChild = HeidrunCodeDashboardNavigation._subagentsVisibility(subagent.children, filter, visibility);
			const subagentVisibility = HeidrunCodeDashboardNavigation._itemVisibility(subagent.status, filter, hasMatchingChild);
			visibility.set(subagent.nodeId, subagentVisibility);
			hasShown = hasShown || subagentVisibility !== 'hidden';
		}
		return hasShown;
	}

	/**
	 * Gives the visibility of one coding agent or one subagent.
	 * @param status The visible status of the item.
	 * @param filter The status of the filter, or null.
	 * @param hasMatchingDescendant True when a descendant shows.
	 * @returns `shown` when the item matches, `faint` when only a descendant matches, `hidden` otherwise.
	 */
	private static _itemVisibility(
		status: HeidrunCodeDashboardVisibleStatus,
		filter: HeidrunCodeDashboardVisibleStatus | null,
		hasMatchingDescendant: boolean,
	): HeidrunCodeDashboardVisibility {
		if (filter === null || status === filter) {
			return 'shown';
		}
		return hasMatchingDescendant === true ? 'faint' : 'hidden';
	}

	/**
	 * Gives the stronger of two visibilities.
	 * @param left The first visibility.
	 * @param right The second visibility.
	 * @returns `shown` before `faint` before `hidden`.
	 */
	private static _strongest(left: HeidrunCodeDashboardVisibility, right: HeidrunCodeDashboardVisibility): HeidrunCodeDashboardVisibility {
		if (left === 'shown' || right === 'shown') {
			return 'shown';
		}
		return left === 'faint' || right === 'faint' ? 'faint' : 'hidden';
	}
}
