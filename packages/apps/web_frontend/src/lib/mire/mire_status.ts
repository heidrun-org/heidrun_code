import type { AgentStatus } from '../types';
import type {
	MireCodingAgentNode,
	MireCoverage,
	MireFacts,
	MireNotice,
	MireStatusCounts,
	MireSubagentNode,
	MireTurnOutcome,
	MireVisibleStatus,
} from './mire_model_types';
import type { ClaudeSubagentObservation, CodexThreadObservation } from './observation_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MireStatus — derives the visible statuses from the separate facts, and aggregates them
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The Codex active flags that mean that a chat waits for an answer. */
export const CODEX_WAITING_FLAGS = ['waitingOnApproval', 'waitingOnUserInput'];

/** The order of the aggregation: the first status found in a group wins. */
export const MIRE_AGGREGATION_ORDER: MireVisibleStatus[] = ['blocked', 'working', 'finished', 'idle'];

/** Derives the visible statuses without hiding failed, killed, unknown, or stale facts. */
export class MireStatus {
	/**
	 * Gives the visible status of a pane from the status that Herdr detects. Herdr stays the main source for a pane.
	 * @param herdrStatus The status that Herdr gives to the pane.
	 * @returns The visible status: `done` is Finished.
	 */
	static fromHerdr(herdrStatus: AgentStatus): MireVisibleStatus {
		if (herdrStatus === 'done') {
			return 'finished';
		}
		return herdrStatus;
	}

	/**
	 * Gives the visible status of a Claude Code subagent.
	 * @param nativeStatus The status that Claude Code gives.
	 * @param hasPendingRequest True when a question or an approval of this subagent waits.
	 * @param isStale True when the observation of the session is stale.
	 * @returns The visible status: a stale observation is unknown, a running subagent with a request is Blocked, and a
	 * completed, failed, or killed subagent is Finished, with its outcome kept as a separate fact.
	 */
	static forClaudeSubagent(
		nativeStatus: ClaudeSubagentObservation['nativeStatus'],
		hasPendingRequest: boolean,
		isStale: boolean,
	): MireVisibleStatus {
		if (isStale === true) {
			return 'unknown';
		}
		if (nativeStatus === 'running') {
			return hasPendingRequest === true ? 'blocked' : 'working';
		}
		if (nativeStatus === 'completed' || nativeStatus === 'failed' || nativeStatus === 'killed') {
			return 'finished';
		}
		return 'unknown';
	}

	/**
	 * Gives the visible status of a Codex child chat.
	 * @param thread The observation of the chat.
	 * @param isStale True when the observation of the chat is stale.
	 * @returns The visible status: a completed child that becomes idle is Finished, never a failure, and an idle child
	 * with no completed turn is Idle.
	 */
	static forCodexChild(thread: CodexThreadObservation, isStale: boolean): MireVisibleStatus {
		if (isStale === true) {
			return 'unknown';
		}
		if (thread.nativeStatus === 'active') {
			const isWaiting = thread.activeFlags.some((flag) => CODEX_WAITING_FLAGS.includes(flag));
			return isWaiting === true ? 'blocked' : 'working';
		}
		if (thread.nativeStatus === 'idle' || thread.nativeStatus === 'notLoaded') {
			const lastStatus = thread.lastTurn?.status ?? null;
			if (lastStatus === 'completed' || lastStatus === 'failed') {
				return 'finished';
			}
			return 'idle';
		}
		return 'unknown';
	}

	/**
	 * Gives the outcome of the run of a Claude Code subagent.
	 * @param nativeStatus The status that Claude Code gives.
	 * @returns The outcome: a running subagent is still in progress.
	 */
	static outcomeOfClaudeSubagent(nativeStatus: ClaudeSubagentObservation['nativeStatus']): MireTurnOutcome {
		if (nativeStatus === 'running') {
			return 'in_progress';
		}
		return nativeStatus;
	}

	/**
	 * Gives the outcome of the last turn of a Codex chat.
	 * @param lastTurn The last turn of the chat, or null.
	 * @returns The outcome, or null when the chat has no last turn.
	 */
	static outcomeOfCodexTurn(lastTurn: CodexThreadObservation['lastTurn']): MireTurnOutcome | null {
		if (lastTurn === null) {
			return null;
		}
		if (lastTurn.status === 'inProgress') {
			return 'in_progress';
		}
		return lastTurn.status;
	}

	/**
	 * Lists the facts that the visible status alone hides.
	 * @param facts The facts of the node.
	 * @param status The visible status of the node.
	 * @param extraNotices The notices that only the builder knows, for example a stale chat identifier.
	 * @returns The notices, each once, in a fixed order.
	 */
	static notices(facts: MireFacts, status: MireVisibleStatus, extraNotices: MireNotice[]): MireNotice[] {
		const notices: MireNotice[] = [];
		if (facts.lastTurnOutcome === 'failed') {
			notices.push('failed');
		}
		if (facts.lastTurnOutcome === 'killed') {
			notices.push('killed');
		}
		if (facts.lastTurnOutcome === 'interrupted') {
			notices.push('interrupted');
		}
		if (facts.nativeStatus !== null && facts.nativeStatus.value === 'systemError') {
			notices.push('system_error');
		}
		if (status === 'unknown') {
			notices.push('unknown_status');
		}
		if (facts.freshness === 'stale') {
			notices.push('stale');
		}
		if (facts.freshness === 'not_observed') {
			notices.push('not_observed');
		}
		if (facts.freshness === 'unmatched') {
			notices.push('unmatched');
		}
		for (const notice of extraNotices) {
			if (notices.includes(notice) === false) {
				notices.push(notice);
			}
		}
		return notices;
	}

	/**
	 * Aggregates the visible statuses of a group: Blocked, then Working, then Finished, then Idle.
	 * @param statuses The visible statuses of the items of the group.
	 * @returns The first known status in the order of the aggregation; `unknown` when the group has items but no known
	 * status; `idle` for an empty group.
	 */
	static aggregate(statuses: MireVisibleStatus[]): MireVisibleStatus {
		const known = MIRE_AGGREGATION_ORDER.find((status) => statuses.includes(status));
		if (known !== undefined) {
			return known;
		}
		return statuses.length === 0 ? 'idle' : 'unknown';
	}

	/**
	 * Lists the coding agents and every nested subagent, each once.
	 * @param codingAgents The coding agents.
	 * @returns The coding agents and the subagents, each node once, in the order of the hierarchy.
	 */
	static flatten(codingAgents: MireCodingAgentNode[]): (MireCodingAgentNode | MireSubagentNode)[] {
		const items: (MireCodingAgentNode | MireSubagentNode)[] = [];
		const seenNodeIds = new Set<string>();
		const add = (node: MireCodingAgentNode | MireSubagentNode): void => {
			if (seenNodeIds.has(node.nodeId) === true) {
				return;
			}
			seenNodeIds.add(node.nodeId);
			items.push(node);
			const children = node.kind === 'coding_agent' ? node.subagents : node.children;
			for (const child of children) {
				add(child);
			}
		};
		for (const codingAgent of codingAgents) {
			add(codingAgent);
		}
		return items;
	}

	/**
	 * Counts the items of a group whose observation is incomplete.
	 * @param items The coding agents and the subagents of the group, each once.
	 * @returns The coverage of the group.
	 */
	static coverage(items: (MireCodingAgentNode | MireSubagentNode)[]): MireCoverage {
		return {
			total: items.length,
			unknown: items.filter((item) => item.status === 'unknown').length,
			stale: items.filter((item) => item.facts.freshness === 'stale').length,
			unmatched: items.filter((item) => item.facts.freshness === 'unmatched').length,
			notObserved: items.filter((item) => item.facts.freshness === 'not_observed').length,
		};
	}

	/**
	 * Counts the items for each visible status.
	 * @param items The items, each once.
	 * @returns The number of items for each visible status, and the total.
	 */
	static counts(items: { status: MireVisibleStatus }[]): MireStatusCounts {
		const counts: MireStatusCounts = {
			working: 0,
			blocked: 0,
			finished: 0,
			idle: 0,
			unknown: 0,
			total: items.length,
		};
		for (const item of items) {
			counts[item.status] += 1;
		}
		return counts;
	}
}
