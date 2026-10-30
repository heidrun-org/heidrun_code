import type {
	MireCodingAgentNode,
	MireFreshness,
	MireMessage,
	MireMessageEndpoint,
	MireModel,
	MirePendingAttention,
	MireSubagentNode,
	MireVisibleStatus,
} from '../../lib/mire/mire_model_types';
import { MireStatus } from '../../lib/mire/mire_status';
import type { MireNodeEntry } from '../../stores/mire/mire_navigation';
import { locale, t } from '../../i18n/index';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MireViewTexts — the words, the badges, and the status cues that the Mire view shows
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One pending attention, with the coding agent or the subagent that holds it. */
export type MireAttentionEntry = {
	/** The request. */
	attention: MirePendingAttention;
	/** The coding agent or the subagent whose facts hold the request. */
	holder: MireCodingAgentNode | MireSubagentNode;
};

/** One blocked coding agent or subagent that has no observed question or approval. */
export type MireBlockedEntry = {
	/** The blocked item. */
	item: MireCodingAgentNode | MireSubagentNode;
};

/** The texts and the cues of the Mire view. */
export class MireViewTexts {
	/**
	 * Gives the name of a coding agent.
	 * @param agent The coding agent that Herdr detects, for example `claude`.
	 * @returns "Claude Code", "Codex", or the name that Herdr gives.
	 */
	static agentName(agent: string): string {
		if (agent === 'claude') {
			return 'Claude Code';
		}
		if (agent === 'codex') {
			return 'Codex';
		}
		return agent;
	}

	/**
	 * Gives the badge of a coding agent.
	 * @param agent The coding agent that Herdr detects.
	 * @returns C for Claude Code, X for Codex, or the first letter of the name.
	 */
	static agentBadge(agent: string): string {
		if (agent === 'claude') {
			return 'C';
		}
		if (agent === 'codex') {
			return 'X';
		}
		return (agent[0] ?? '?').toUpperCase();
	}

	/**
	 * Gives the sign drawn inside a node, so that the status never relies on the color alone.
	 * @param status The visible status.
	 * @returns One character.
	 */
	static statusGlyph(status: MireVisibleStatus): string {
		const glyphs: Record<MireVisibleStatus, string> = {
			working: '▸',
			blocked: '!',
			finished: '✓',
			idle: '–',
			unknown: '?',
		};
		return glyphs[status];
	}

	/**
	 * Gives the text of a freshness, or null for a fresh observation.
	 * @param freshness The freshness.
	 * @returns The text, or null.
	 */
	static freshnessText(freshness: MireFreshness): string | null {
		return freshness === 'fresh' ? null : t(`mire.freshness.${freshness}`);
	}

	/**
	 * Gives the accessible name of a coding agent or a subagent in the graph.
	 * @param name The name.
	 * @param status The visible status.
	 * @param freshness The freshness.
	 * @returns The name, the status, and the freshness when it is not fresh.
	 */
	static nodeDescription(name: string, status: MireVisibleStatus, freshness: MireFreshness | null): string {
		const parts = [name, t(`mire.status.${status}`)];
		const freshnessText = freshness === null ? null : MireViewTexts.freshnessText(freshness);
		if (freshnessText !== null) {
			parts.push(freshnessText);
		}
		return parts.join(' · ');
	}

	/**
	 * Gives a time of the computer as a short text.
	 * @param atMs The time, in milliseconds since 1970.
	 * @returns The hours, the minutes, and the seconds.
	 */
	static timeText(atMs: number): string {
		return new Date(atMs).toLocaleTimeString(locale.value);
	}

	/**
	 * Gives the name of one end of a message.
	 * @param endpoint The end.
	 * @param index The index of the model.
	 * @returns The name of the node, or the identifier of the source with the word "unmatched".
	 */
	static endpointName(endpoint: MireMessageEndpoint | null, index: Map<string, MireNodeEntry>): string {
		if (endpoint === null) {
			return t('mire.messages.unknownDestination');
		}
		const entry = endpoint.nodeId === null ? undefined : index.get(endpoint.nodeId);
		if (entry === undefined) {
			return t('mire.messages.unmatchedEndpoint', {
				id: endpoint.nativeId,
			});
		}
		return entry.label;
	}

	/**
	 * Gives the text of a message, or why the text is not shown.
	 * @param message The message.
	 * @returns The text, or a sentence that says that the source does not give it.
	 */
	static messageText(message: MireMessage): string {
		if (message.text !== null) {
			return message.text;
		}
		if (message.contentAvailability === 'not_exposed' && message.source === 'codex_server') {
			return t('mire.messages.notExposedByCodex');
		}
		return t('mire.messages.notExposed');
	}

	/**
	 * Lists the pending attention of the whole model: the requests that the developer must answer first, then the
	 * others, the oldest first in each group.
	 * @param model The Mire model.
	 * @returns Each request once, with its holder.
	 */
	static pendingAttention(model: MireModel): MireAttentionEntry[] {
		const entries: MireAttentionEntry[] = [];
		const seen = new Set<string>();
		for (const holder of MireViewTexts.items(model)) {
			for (const attention of holder.facts.pendingAttention) {
				if (seen.has(attention.id) === true) {
					continue;
				}
				seen.add(attention.id);
				entries.push({
					attention,
					holder,
				});
			}
		}
		return entries.sort((left, right) => {
			const leftRank = left.attention.developerAction === 'required' ? 0 : 1;
			const rightRank = right.attention.developerAction === 'required' ? 0 : 1;
			if (leftRank !== rightRank) {
				return leftRank - rightRank;
			}
			return (left.attention.atMs ?? Number.MAX_SAFE_INTEGER) - (right.attention.atMs ?? Number.MAX_SAFE_INTEGER);
		});
	}

	/**
	 * Lists the blocked coding agents and subagents that have no observed question or approval.
	 * @param model The Mire model.
	 * @returns The blocked items, in the order of the hierarchy.
	 */
	static blockedWithoutRequest(model: MireModel): MireBlockedEntry[] {
		return MireViewTexts.items(model)
			.filter((item) => item.status === 'blocked' && item.facts.pendingAttention.length === 0)
			.map((item) => ({
				item,
			}));
	}

	/**
	 * Lists the node identifiers of a node and of every node under it.
	 * @param node A workspace, a tab, a coding agent, or a subagent.
	 * @returns The node identifiers.
	 */
	static subtreeNodeIds(node: MireNodeEntry['node']): Set<string> {
		const nodeIds = new Set<string>();
		const visit = (current: MireNodeEntry['node']): void => {
			nodeIds.add(current.nodeId);
			if (current.kind === 'heidrun') {
				current.workspaces.forEach(visit);
			} else if (current.kind === 'workspace') {
				current.tabs.forEach(visit);
			} else if (current.kind === 'tab') {
				current.codingAgents.forEach(visit);
			} else if (current.kind === 'coding_agent') {
				current.subagents.forEach(visit);
			} else {
				current.children.forEach(visit);
			}
		};
		visit(node);
		return nodeIds;
	}

	/**
	 * Lists the recent messages that one end of which is in a set of nodes.
	 * @param messages The messages, by time.
	 * @param nodeIds The node identifiers.
	 * @param limit The largest number of messages.
	 * @returns The most recent messages first.
	 */
	static recentMessages(messages: MireMessage[], nodeIds: Set<string>, limit: number): MireMessage[] {
		const isInside = (endpoint: MireMessageEndpoint | null): boolean =>
			endpoint !== null && endpoint.nodeId !== null && nodeIds.has(endpoint.nodeId);
		return messages
			.filter((message) => isInside(message.from) || isInside(message.to))
			.reverse()
			.slice(0, limit);
	}

	/**
	 * Lists every coding agent and every subagent of the model, each once.
	 * @param model The Mire model.
	 * @returns The items, in the order of the hierarchy.
	 */
	static items(model: MireModel): (MireCodingAgentNode | MireSubagentNode)[] {
		const codingAgents = model.workspaces.flatMap((workspace) => workspace.tabs.flatMap((tab) => tab.codingAgents));
		return MireStatus.flatten(codingAgents);
	}

	/**
	 * Lists the pending attention of one node and of the nodes under it, with the requests that the developer must
	 * answer first.
	 * @param model The Mire model.
	 * @param nodeIds The node identifiers of the node and of the nodes under it.
	 * @returns The requests whose holder is in the set.
	 */
	static pendingAttentionOf(model: MireModel, nodeIds: Set<string>): MireAttentionEntry[] {
		return MireViewTexts.pendingAttention(model).filter((entry) => nodeIds.has(entry.holder.nodeId));
	}
}
