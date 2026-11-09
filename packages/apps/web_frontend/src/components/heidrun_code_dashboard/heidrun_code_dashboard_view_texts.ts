import type {
	HeidrunCodeDashboardCodingAgentNode,
	HeidrunCodeDashboardFreshness,
	HeidrunCodeDashboardMessage,
	HeidrunCodeDashboardMessageEndpoint,
	HeidrunCodeDashboardModel,
	HeidrunCodeDashboardPendingAttention,
	HeidrunCodeDashboardSubagentNode,
	HeidrunCodeDashboardVisibleStatus,
} from '../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_types';
import { HeidrunCodeDashboardStatus } from '../../lib/heidrun_code_dashboard/heidrun_code_dashboard_status';
import type { HeidrunCodeDashboardNodeEntry } from '../../stores/heidrun_code_dashboard/heidrun_code_dashboard_navigation';
import { locale, t } from '../../i18n/index';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunCodeDashboardViewTexts — the words, the badges, and the status cues that the Heidrun Code Dashboard view shows
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One pending attention, with the coding agent or the subagent that holds it. */
export type HeidrunCodeDashboardAttentionEntry = {
	/** The request. */
	attention: HeidrunCodeDashboardPendingAttention;
	/** The coding agent or the subagent whose facts hold the request. */
	holder: HeidrunCodeDashboardCodingAgentNode | HeidrunCodeDashboardSubagentNode;
};

/** One blocked coding agent or subagent that has no observed question or approval. */
export type HeidrunCodeDashboardBlockedEntry = {
	/** The blocked item. */
	item: HeidrunCodeDashboardCodingAgentNode | HeidrunCodeDashboardSubagentNode;
};

/** The characters of the icons `claude` and `openai` in the font of Bootstrap Icons (`bootstrap-icons.json`). */
const AGENT_ICON_GLYPHS = {
	claude: '\uF914',
	openai: '\uF915',
};

/** The texts and the cues of the Heidrun Code Dashboard view. */
export class HeidrunCodeDashboardViewTexts {
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
	 * Gives the Bootstrap Icons name of a coding agent, the same icon as the tabs of Heidrun Code.
	 * @param agent The coding agent that Herdr detects.
	 * @returns `claude` for Claude Code, `openai` for Codex (OpenAI makes Codex), or null for another coding agent.
	 */
	static agentIcon(agent: string): 'claude' | 'openai' | null {
		if (agent === 'claude') {
			return 'claude';
		}
		if (agent === 'codex') {
			return 'openai';
		}
		return null;
	}

	/**
	 * Gives the character of the icon of a coding agent in the font of Bootstrap Icons, for the SVG graph.
	 * @param agent The coding agent that Herdr detects.
	 * @returns The character of the icon, or the first letter of the name for a coding agent without an icon.
	 */
	static agentIconGlyph(agent: string): string {
		const icon = HeidrunCodeDashboardViewTexts.agentIcon(agent);
		if (icon === null) {
			return HeidrunCodeDashboardViewTexts.agentBadge(agent);
		}
		return AGENT_ICON_GLYPHS[icon];
	}

	/**
	 * Gives the badge of a coding agent that has no icon.
	 * @param agent The coding agent that Herdr detects.
	 * @returns The first letter of the name.
	 */
	static agentBadge(agent: string): string {
		return (agent[0] ?? '?').toUpperCase();
	}

	/**
	 * Gives the sign drawn inside a node, so that the status never relies on the color alone.
	 * @param status The visible status.
	 * @returns One character.
	 */
	static statusGlyph(status: HeidrunCodeDashboardVisibleStatus): string {
		const glyphs: Record<HeidrunCodeDashboardVisibleStatus, string> = {
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
	static freshnessText(freshness: HeidrunCodeDashboardFreshness): string | null {
		return freshness === 'fresh' ? null : t(`heidrunCodeDashboard.freshness.${freshness}`);
	}

	/**
	 * Gives the accessible name of a coding agent or a subagent in the graph.
	 * @param name The name.
	 * @param status The visible status.
	 * @param freshness The freshness.
	 * @returns The name, the status, and the freshness when it is not fresh.
	 */
	static nodeDescription(name: string, status: HeidrunCodeDashboardVisibleStatus, freshness: HeidrunCodeDashboardFreshness | null): string {
		const parts = [name, t(`heidrunCodeDashboard.status.${status}`)];
		const freshnessText = freshness === null ? null : HeidrunCodeDashboardViewTexts.freshnessText(freshness);
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
	static endpointName(endpoint: HeidrunCodeDashboardMessageEndpoint | null, index: Map<string, HeidrunCodeDashboardNodeEntry>): string {
		if (endpoint === null) {
			return t('heidrunCodeDashboard.messages.unknownDestination');
		}
		const entry = endpoint.nodeId === null ? undefined : index.get(endpoint.nodeId);
		if (entry === undefined) {
			return t('heidrunCodeDashboard.messages.unmatchedEndpoint', {
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
	static messageText(message: HeidrunCodeDashboardMessage): string {
		if (message.text !== null) {
			return message.text;
		}
		if (message.contentAvailability === 'not_exposed' && message.source === 'codex_server') {
			return t('heidrunCodeDashboard.messages.notExposedByCodex');
		}
		return t('heidrunCodeDashboard.messages.notExposed');
	}

	/**
	 * Lists the pending attention of the whole model: the requests that the developer must answer first, then the
	 * others, the oldest first in each group.
	 * @param model The Heidrun Code Dashboard model.
	 * @returns Each request once, with its holder.
	 */
	static pendingAttention(model: HeidrunCodeDashboardModel): HeidrunCodeDashboardAttentionEntry[] {
		const entries: HeidrunCodeDashboardAttentionEntry[] = [];
		const seen = new Set<string>();
		for (const holder of HeidrunCodeDashboardViewTexts.items(model)) {
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
	 * @param model The Heidrun Code Dashboard model.
	 * @returns The blocked items, in the order of the hierarchy.
	 */
	static blockedWithoutRequest(model: HeidrunCodeDashboardModel): HeidrunCodeDashboardBlockedEntry[] {
		return HeidrunCodeDashboardViewTexts.items(model)
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
	static subtreeNodeIds(node: HeidrunCodeDashboardNodeEntry['node']): Set<string> {
		const nodeIds = new Set<string>();
		const visit = (current: HeidrunCodeDashboardNodeEntry['node']): void => {
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
	static recentMessages(messages: HeidrunCodeDashboardMessage[], nodeIds: Set<string>, limit: number): HeidrunCodeDashboardMessage[] {
		const isInside = (endpoint: HeidrunCodeDashboardMessageEndpoint | null): boolean =>
			endpoint !== null && endpoint.nodeId !== null && nodeIds.has(endpoint.nodeId);
		return messages
			.filter((message) => isInside(message.from) || isInside(message.to))
			.reverse()
			.slice(0, limit);
	}

	/**
	 * Lists every coding agent and every subagent of the model, each once.
	 * @param model The Heidrun Code Dashboard model.
	 * @returns The items, in the order of the hierarchy.
	 */
	static items(model: HeidrunCodeDashboardModel): (HeidrunCodeDashboardCodingAgentNode | HeidrunCodeDashboardSubagentNode)[] {
		const codingAgents = model.workspaces.flatMap((workspace) => workspace.tabs.flatMap((tab) => tab.codingAgents));
		return HeidrunCodeDashboardStatus.flatten(codingAgents);
	}

	/**
	 * Lists the pending attention of one node and of the nodes under it, with the requests that the developer must
	 * answer first.
	 * @param model The Heidrun Code Dashboard model.
	 * @param nodeIds The node identifiers of the node and of the nodes under it.
	 * @returns The requests whose holder is in the set.
	 */
	static pendingAttentionOf(model: HeidrunCodeDashboardModel, nodeIds: Set<string>): HeidrunCodeDashboardAttentionEntry[] {
		return HeidrunCodeDashboardViewTexts.pendingAttention(model).filter((entry) => nodeIds.has(entry.holder.nodeId));
	}
}
