import type { AgentInfo, AgentStatus, SessionSnapshot } from './types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FinishedStatus — completion acknowledgements and the resulting status indicators
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Applies Heidrun Code acknowledgements without changing Herdr focus or lifecycle reports. */
export class FinishedStatus {
	/**
	 * Identifies one status of one terminal, including completions missed between snapshots.
	 * @param pane - The pane enriched with its coding agent information.
	 * @returns The key of the status that a dismissal acknowledges.
	 */
	static key(pane: AgentInfo): string {
		const sequence = pane.agent_status === 'done'
			? pane.completion_seq ?? pane.state_change_seq ?? 0
			: pane.state_change_seq ?? 0;
		return `${pane.terminal_id}:${pane.agent_status}:${sequence}`;
	}

	/**
	 * Builds the displayed snapshot, recalculating only groups with acknowledged completions.
	 * @param snapshot - The unmodified Herdr snapshot.
	 * @param dismissed - The acknowledged status key for each pane.
	 * @returns A snapshot whose pane, tab, and workspace statuses agree.
	 */
	static apply(snapshot: SessionSnapshot, dismissed: Record<string, string>): SessionSnapshot {
		const agents = new Map(snapshot.agents.map((pane) => [pane.pane_id, pane]));
		const changed = new Set<string>();
		const panes = snapshot.panes.map((pane) => {
			const view = {
				...pane,
				...agents.get(pane.pane_id),
			};
			if (view.agent_status !== 'done' || dismissed[pane.pane_id] !== FinishedStatus.key(view)) {
				return pane;
			}
			changed.add(pane.pane_id);
			return {
				...pane,
				agent_status: 'idle' as const,
			};
		});
		if (changed.size === 0) {
			return snapshot;
		}
		const tabIds = new Set(panes.filter((pane) => changed.has(pane.pane_id)).map((pane) => pane.tab_id));
		const workspaceIds = new Set(panes.filter((pane) => changed.has(pane.pane_id))
			.map((pane) => pane.workspace_id));
		return {
			...snapshot,
			panes,
			agents: snapshot.agents.map((pane) => changed.has(pane.pane_id) ? {
				...pane,
				agent_status: 'idle',
			} : pane),
			tabs: snapshot.tabs.map((tab) => tabIds.has(tab.tab_id) ? {
				...tab,
				agent_status: FinishedStatus._aggregate(panes.filter((pane) => pane.tab_id === tab.tab_id)
					.map((pane) => pane.agent_status)),
			} : tab),
			workspaces: snapshot.workspaces.map((workspace) => workspaceIds.has(workspace.workspace_id) ? {
				...workspace,
				agent_status: FinishedStatus._aggregate(panes
					.filter((pane) => pane.workspace_id === workspace.workspace_id).map((pane) => pane.agent_status)),
			} : workspace),
		};
	}

	/**
	 * Chooses the highest priority remaining status.
	 * @param statuses - The statuses of the panes in the group.
	 * @returns Blocked, Working, Finished, Idle, or Unknown in that priority order.
	 */
	private static _aggregate(statuses: AgentStatus[]): AgentStatus {
		const priority: AgentStatus[] = ['blocked', 'working', 'done', 'idle', 'unknown'];
		return priority.find((status) => statuses.includes(status)) ?? 'unknown';
	}
}
