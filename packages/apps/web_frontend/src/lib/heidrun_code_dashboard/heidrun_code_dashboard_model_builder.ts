import type { AgentInfo, TabInfo, WorkspaceInfo } from '../types';
import type {
	HeidrunCodeDashboardChatIdentity,
	HeidrunCodeDashboardCodingAgentNode,
	HeidrunCodeDashboardFacts,
	HeidrunCodeDashboardFreshness,
	HeidrunCodeDashboardModel,
	HeidrunCodeDashboardNotice,
	HeidrunCodeDashboardPendingAttention,
	HeidrunCodeDashboardSubagentNode,
	HeidrunCodeDashboardTabNode,
	HeidrunCodeDashboardTaskText,
	HeidrunCodeDashboardWorkspaceNode,
} from './heidrun_code_dashboard_model_types';
import type {
	ClaudeSessionObservation,
	CodexThreadObservation,
	MessageObservation,
	HeidrunCodeDashboardObservations,
} from './observation_types';
import { CODEX_WAITING_FLAGS, HeidrunCodeDashboardStatus } from './heidrun_code_dashboard_status';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunCodeDashboardModelBuilder — builds the Heidrun Code Dashboard hierarchy from the Herdr data and the live observations
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** An observation older than this is stale: the collector sends one every 2 seconds while a Heidrun Code Dashboard view is open. */
export const HEIDRUN_CODE_DASHBOARD_OBSERVATIONS_STALE_AFTER_MS = 10_000;

/** What the builder needs: the Herdr data that the frontend already has, and the live observations. */
export type HeidrunCodeDashboardModelInput = {
	/** The workspaces of Herdr, with their saved workspace folder. */
	workspaces: WorkspaceInfo[];
	/** The tabs of Herdr. */
	tabs: TabInfo[];
	/** The panes of Herdr, with the information of their coding agent. */
	panes: AgentInfo[];
	/** The last live observations, or null when none arrived. */
	observations: HeidrunCodeDashboardObservations | null;
	/** The Herdr session of the panes, or null when the frontend does not know it. */
	herdrSessionName: string | null;
	/**
	 * The Herdr socket of the panes, or null when the frontend does not know it. A Claude Code session with no `hd_sid`
	 * on its pane belongs to the pane only when the mod saw this same socket.
	 */
	herdrSocketPath: string | null;
	/** The current time, by the clock of the computer. */
	nowMs: number;
};

/** What the builder knows about the observations while it builds one model. */
type BuildContext = {
	/** The input. */
	input: HeidrunCodeDashboardModelInput;
	/** True when the last observations are older than the limit. */
	isObservationsStale: boolean;
	/** The Claude Code sessions that a pane claims. */
	claimedSessionIds: Set<string>;
	/** The Codex root chats that a pane claims. */
	claimedRootThreadIds: Set<string>;
};

/** Builds the Heidrun Code Dashboard model. It reads no file, calls no Tauri command, and draws nothing. */
export class HeidrunCodeDashboardModelBuilder {
	/**
	 * Builds the Heidrun Code Dashboard model: Heidrun, then the workspaces, the tabs, the coding agents, and the subagents.
	 * @param input The Herdr data and the live observations.
	 * @returns The Heidrun Code Dashboard model. It follows the current Herdr data, so a moved pane is in its new workspace and tab.
	 */
	static build(input: HeidrunCodeDashboardModelInput): HeidrunCodeDashboardModel {
		const observations = input.observations;
		const context: BuildContext = {
			input,
			isObservationsStale: observations !== null
				&& input.nowMs - observations.observedAtMs > HEIDRUN_CODE_DASHBOARD_OBSERVATIONS_STALE_AFTER_MS,
			claimedSessionIds: new Set(),
			claimedRootThreadIds: new Set(),
		};
		const workspaces = [...input.workspaces]
			.sort((left, right) => left.number - right.number)
			.map((workspace) => HeidrunCodeDashboardModelBuilder._workspace(workspace, context));
		const codingAgents = workspaces.flatMap((workspace) => workspace.tabs.flatMap((tab) => tab.codingAgents));
		const items = HeidrunCodeDashboardStatus.flatten(codingAgents);
		const subagents = items.filter((item) => item.kind === 'subagent');
		const claudeSessions = observations?.claude.sessions ?? [];
		const codexThreads = observations?.codex.threads ?? [];
		return {
			nodeId: 'heidrun',
			kind: 'heidrun',
			herdrSessionName: input.herdrSessionName,
			observedAtMs: observations?.observedAtMs ?? null,
			observationsState: observations === null ? 'none' : context.isObservationsStale === true ? 'stale' : 'fresh',
			codexCoverage: observations?.codex.coverage ?? null,
			codexUnavailableReason: observations?.codex.unavailableReason ?? null,
			errors: [...(observations?.claude.errors ?? []), ...(observations?.codex.errors ?? [])],
			workspaces,
			status: HeidrunCodeDashboardStatus.aggregate(items.map((item) => item.status)),
			coverage: HeidrunCodeDashboardStatus.coverage(items),
			counters: {
				codingAgents: HeidrunCodeDashboardStatus.counts(codingAgents),
				subagents: HeidrunCodeDashboardStatus.counts(subagents),
			},
			unmatchedObservations: {
				claudeSessionIds: claudeSessions
					.map((session) => session.sessionId)
					.filter((sessionId) => context.claimedSessionIds.has(sessionId) === false),
				codexRootThreadIds: codexThreads
					.filter((thread) => thread.parentThreadId === null)
					.map((thread) => thread.threadId)
					.filter((threadId) => context.claimedRootThreadIds.has(threadId) === false),
			},
		};
	}

	/**
	 * Gives the node identifier of a coding agent. It follows the terminal and the coding agent, so it stays the same
	 * when the pane moves, and it changes when another coding agent starts in the same terminal.
	 * @param pane The pane.
	 * @returns The node identifier.
	 */
	static codingAgentNodeId(pane: Pick<AgentInfo, 'terminal_id' | 'agent'>): string {
		return `coding_agent:${pane.terminal_id}:${pane.agent ?? ''}`;
	}

	/**
	 * Gives the node identifier of a Claude Code subagent. A subagent identifier is unique only in its session.
	 * @param sessionId The Claude Code session.
	 * @param subagentId The subagent identifier.
	 * @returns The node identifier.
	 */
	static claudeSubagentNodeId(sessionId: string, subagentId: string): string {
		return `subagent:claude:${sessionId}:${subagentId}`;
	}

	/**
	 * Gives the node identifier of a Codex child chat.
	 * @param threadId The chat identifier.
	 * @returns The node identifier.
	 */
	static codexSubagentNodeId(threadId: string): string {
		return `subagent:codex:${threadId}`;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Hierarchy
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Builds one workspace and its tabs.
	 * @param workspace The workspace of Herdr.
	 * @param context The build context.
	 * @returns The workspace node.
	 */
	private static _workspace(workspace: WorkspaceInfo, context: BuildContext): HeidrunCodeDashboardWorkspaceNode {
		const tabs = context.input.tabs
			.filter((tab) => tab.workspace_id === workspace.workspace_id)
			.sort((left, right) => left.number - right.number)
			.map((tab) => HeidrunCodeDashboardModelBuilder._tab(tab, context));
		const items = HeidrunCodeDashboardStatus.flatten(tabs.flatMap((tab) => tab.codingAgents));
		return {
			nodeId: `workspace:${workspace.workspace_id}`,
			kind: 'workspace',
			workspaceId: workspace.workspace_id,
			number: workspace.number,
			label: workspace.label,
			folder: workspace.workspace_folder ?? null,
			tabs,
			status: HeidrunCodeDashboardStatus.aggregate(items.map((item) => item.status)),
			coverage: HeidrunCodeDashboardStatus.coverage(items),
		};
	}

	/**
	 * Builds one tab and one coding agent for each pane of the tab where a coding agent runs.
	 * @param tab The tab of Herdr.
	 * @param context The build context.
	 * @returns The tab node.
	 */
	private static _tab(tab: TabInfo, context: BuildContext): HeidrunCodeDashboardTabNode {
		const codingAgents = context.input.panes
			.filter((pane) => pane.tab_id === tab.tab_id && pane.workspace_id === tab.workspace_id)
			.filter((pane) => typeof pane.agent === 'string' && pane.agent !== '')
			.map((pane) => HeidrunCodeDashboardModelBuilder._codingAgent(pane, context));
		const items = HeidrunCodeDashboardStatus.flatten(codingAgents);
		return {
			nodeId: `tab:${tab.tab_id}`,
			kind: 'tab',
			tabId: tab.tab_id,
			workspaceId: tab.workspace_id,
			number: tab.number,
			label: tab.label,
			codingAgents,
			status: HeidrunCodeDashboardStatus.aggregate(items.map((item) => item.status)),
			coverage: HeidrunCodeDashboardStatus.coverage(items),
		};
	}

	/**
	 * Builds one coding agent with its observation.
	 * @param pane The pane where the coding agent runs.
	 * @param context The build context.
	 * @returns The coding agent node.
	 */
	private static _codingAgent(pane: AgentInfo, context: BuildContext): HeidrunCodeDashboardCodingAgentNode {
		const nodeId = HeidrunCodeDashboardModelBuilder.codingAgentNodeId(pane);
		const base: Omit<HeidrunCodeDashboardCodingAgentNode, 'chat' | 'facts' | 'status' | 'notices' | 'observedSinceMs'
			| 'taskTexts' | 'subagents'> = {
			nodeId,
			kind: 'coding_agent',
			agent: pane.agent ?? '',
			label: pane.label ?? pane.name ?? null,
			paneId: pane.pane_id,
			terminalId: pane.terminal_id,
			workspaceId: pane.workspace_id,
			tabId: pane.tab_id,
			cwd: pane.cwd ?? null,
			herdrStatus: pane.agent_status,
		};
		if (pane.agent === 'claude') {
			return HeidrunCodeDashboardModelBuilder._claudeCodingAgent(base, pane, context);
		}
		if (pane.agent === 'codex') {
			return HeidrunCodeDashboardModelBuilder._codexCodingAgent(base, pane, context);
		}
		return HeidrunCodeDashboardModelBuilder._finishCodingAgent(base, {
			chat: {
				chatId: null,
				state: 'not_observed',
			},
			facts: HeidrunCodeDashboardModelBuilder._herdrFacts(pane, 'not_observed'),
			extraNotices: [],
			observedSinceMs: null,
			taskTexts: [],
			subagents: [],
		});
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Claude Code
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Builds a Claude Code coding agent. The session belongs to the pane through `hd_sid`, or, when the pane has no
	 * `hd_sid`, through the pane identifier and the same Herdr socket. Never through a title or a folder.
	 * @param base The fields that every coding agent has.
	 * @param pane The pane.
	 * @param context The build context.
	 * @returns The coding agent node.
	 */
	private static _claudeCodingAgent(
		base: Omit<HeidrunCodeDashboardCodingAgentNode, 'chat' | 'facts' | 'status' | 'notices' | 'observedSinceMs' | 'taskTexts'
			| 'subagents'>,
		pane: AgentInfo,
		context: BuildContext,
	): HeidrunCodeDashboardCodingAgentNode {
		const session = HeidrunCodeDashboardModelBuilder._claudeSession(pane, context);
		const hdSid = pane.tokens?.hd_sid ?? '';
		if (session === null) {
			return HeidrunCodeDashboardModelBuilder._finishCodingAgent(base, {
				chat: {
					chatId: hdSid === '' ? null : hdSid,
					state: 'not_observed',
				},
				facts: HeidrunCodeDashboardModelBuilder._herdrFacts(pane, 'not_observed'),
				extraNotices: [],
				observedSinceMs: null,
				taskTexts: [],
				subagents: [],
			});
		}
		context.claimedSessionIds.add(session.sessionId);
		const isStale = session.isStale === true || context.isObservationsStale === true;
		const subagentIds = new Set(session.subagents.map((subagent) => subagent.id));
		const pendingAttention: HeidrunCodeDashboardPendingAttention[] = session.pendingRequests
			.filter((request) => request.agentId === null || subagentIds.has(request.agentId) === false)
			.map((request) => ({
				id: `claude:${session.sessionId}:${request.id}`,
				kind: request.kind,
				source: 'claude_observer',
				tool: request.tool,
				summary: request.summary,
				atMs: request.atMs,
				requester: {
					nodeId: request.agentId === null ? base.nodeId : null,
					kind: request.agentId === null ? 'coding_agent' : 'subagent',
					nativeId: request.agentId,
					role: null,
					name: null,
				},
				reviewerContext: request.agentId === null ? null : {
					parentNodeId: base.nodeId,
					requesterRole: null,
				},
				developerAction: 'required',
				isStale,
			}));
		const subagents = [...session.subagents]
			.sort((left, right) => HeidrunCodeDashboardModelBuilder._compareStart(left.startedAtMs, right.startedAtMs, left.id, right.id))
			.map((subagent) => {
				const nodeId = HeidrunCodeDashboardModelBuilder.claudeSubagentNodeId(session.sessionId, subagent.id);
				const requests = session.pendingRequests.filter((request) => request.agentId === subagent.id);
				const subagentAttention: HeidrunCodeDashboardPendingAttention[] = requests.map((request) => ({
					id: `claude:${session.sessionId}:${request.id}`,
					kind: request.kind,
					source: 'claude_observer',
					tool: request.tool,
					summary: request.summary,
					atMs: request.atMs,
					requester: {
						nodeId,
						kind: 'subagent',
						nativeId: subagent.id,
						role: subagent.type,
						name: subagent.description,
					},
					reviewerContext: {
						parentNodeId: base.nodeId,
						requesterRole: subagent.type,
					},
					developerAction: 'required',
					isStale,
				}));
				const facts: HeidrunCodeDashboardFacts = {
					nativeStatus: {
						source: 'claude_observer',
						value: subagent.nativeStatus,
					},
					activeFlags: [],
					lastTurnOutcome: HeidrunCodeDashboardStatus.outcomeOfClaudeSubagent(subagent.nativeStatus),
					pendingAttention: subagentAttention,
					freshness: isStale === true ? 'stale' : 'fresh',
				};
				const status = HeidrunCodeDashboardStatus.forClaudeSubagent(subagent.nativeStatus, requests.length > 0, isStale);
				const taskTexts: HeidrunCodeDashboardTaskText[] = [];
				if (subagent.initialInstructions !== null && subagent.initialInstructions !== '') {
					taskTexts.push({
						label: 'initial_instructions',
						text: subagent.initialInstructions,
						atMs: subagent.startedAtMs,
					});
				}
				taskTexts.push(...HeidrunCodeDashboardModelBuilder._lastPrompt(session.messages, subagent.id));
				const node: HeidrunCodeDashboardSubagentNode = {
					nodeId,
					kind: 'subagent',
					source: 'claude_observer',
					nativeId: subagent.id,
					parentNodeId: base.nodeId,
					codingAgentNodeId: base.nodeId,
					name: subagent.description,
					role: subagent.type,
					facts,
					status,
					notices: HeidrunCodeDashboardStatus.notices(facts, status, []),
					startedAtMs: subagent.startedAtMs,
					endedAtMs: subagent.endedAtMs,
					taskTexts,
					children: [],
				};
				return node;
			});
		const facts = HeidrunCodeDashboardModelBuilder._herdrFacts(pane, isStale === true ? 'stale' : 'fresh');
		facts.pendingAttention = pendingAttention;
		return HeidrunCodeDashboardModelBuilder._finishCodingAgent(base, {
			chat: {
				chatId: session.sessionId,
				state: 'matched',
			},
			facts,
			extraNotices: [],
			observedSinceMs: session.observerStartedAtMs,
			taskTexts: HeidrunCodeDashboardModelBuilder._lastPrompt(session.messages, session.sessionId),
			subagents,
		});
	}

	/**
	 * Finds the Claude Code session of a pane.
	 * @param pane The pane.
	 * @param context The build context.
	 * @returns The session, or null when no explicit identifier links the pane to an observed session.
	 */
	private static _claudeSession(pane: AgentInfo, context: BuildContext): ClaudeSessionObservation | null {
		const sessions = context.input.observations?.claude.sessions ?? [];
		const hdSid = pane.tokens?.hd_sid ?? '';
		if (hdSid !== '') {
			return sessions.find((session) => session.sessionId === hdSid) ?? null;
		}
		const socketPath = context.input.herdrSocketPath;
		if (socketPath === null) {
			return null;
		}
		const candidates = sessions
			.filter((session) => session.herdrPaneId === pane.pane_id && session.herdrSocketPath === socketPath)
			.sort((left, right) => right.observedAtMs - left.observedAtMs);
		return candidates[0] ?? null;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Codex
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Builds a Codex coding agent. The root chat belongs to the pane only through the `agent_session` of the pane.
	 * @param base The fields that every coding agent has.
	 * @param pane The pane.
	 * @param context The build context.
	 * @returns The coding agent node.
	 */
	private static _codexCodingAgent(
		base: Omit<HeidrunCodeDashboardCodingAgentNode, 'chat' | 'facts' | 'status' | 'notices' | 'observedSinceMs' | 'taskTexts'
			| 'subagents'>,
		pane: AgentInfo,
		context: BuildContext,
	): HeidrunCodeDashboardCodingAgentNode {
		const observations = context.input.observations;
		const session = pane.agent_session ?? null;
		const isCodexSession = session !== null && session.value !== ''
			&& (session.agent === '' || session.agent === 'codex');
		const chatId = isCodexSession === true && session !== null ? session.value : null;
		const empty = {
			observedSinceMs: null,
			taskTexts: [],
			subagents: [],
		};
		if (chatId === null) {
			return HeidrunCodeDashboardModelBuilder._finishCodingAgent(base, {
				...empty,
				chat: {
					chatId: null,
					state: 'unmatched',
				},
				facts: HeidrunCodeDashboardModelBuilder._herdrFacts(pane, 'unmatched'),
				extraNotices: [],
			});
		}
		const threads = observations?.codex.threads ?? [];
		const root = threads.find((thread) => thread.threadId === chatId) ?? null;
		const isConnected = observations !== null && observations.codex.coverage === 'connected';
		if (root === null) {
			const state: HeidrunCodeDashboardChatIdentity['state'] = isConnected === true ? 'unmatched' : 'not_observed';
			return HeidrunCodeDashboardModelBuilder._finishCodingAgent(base, {
				...empty,
				chat: {
					chatId,
					state,
				},
				facts: HeidrunCodeDashboardModelBuilder._herdrFacts(pane, state),
				extraNotices: [],
			});
		}
		context.claimedRootThreadIds.add(root.threadId);
		if (root.nativeStatus === 'notLoaded') {
			const facts = HeidrunCodeDashboardModelBuilder._codexFacts(root, base.nodeId, null, 'stale');
			return HeidrunCodeDashboardModelBuilder._finishCodingAgent(base, {
				...empty,
				chat: {
					chatId,
					state: 'stale',
				},
				facts,
				extraNotices: ['stale_chat'],
			});
		}
		const isStale = context.isObservationsStale === true || isConnected === false
			|| HeidrunCodeDashboardModelBuilder._isThreadStale(root, context);
		const facts = HeidrunCodeDashboardModelBuilder._codexFacts(root, base.nodeId, null, isStale === true ? 'stale' : 'fresh');
		const extraNotices: HeidrunCodeDashboardNotice[] = [];
		if (observations !== null && observations.codex.limits.truncatedRootThreadIds.includes(root.threadId)) {
			extraNotices.push('children_truncated');
		}
		return HeidrunCodeDashboardModelBuilder._finishCodingAgent(base, {
			chat: {
				chatId,
				state: 'matched',
			},
			facts,
			extraNotices,
			observedSinceMs: null,
			taskTexts: HeidrunCodeDashboardModelBuilder._lastPrompt(root.interactions, root.threadId),
			subagents: HeidrunCodeDashboardModelBuilder._codexChildren(root, threads, base.nodeId, context),
		});
	}

	/**
	 * Builds the descendants of a Codex root chat, nested by parent.
	 * @param root The root chat of the pane.
	 * @param threads Every observed chat.
	 * @param codingAgentNodeId The node of the coding agent of the pane.
	 * @param context The build context.
	 * @returns The subagents whose parent is the root chat, or whose parent is not observed.
	 */
	private static _codexChildren(
		root: CodexThreadObservation,
		threads: CodexThreadObservation[],
		codingAgentNodeId: string,
		context: BuildContext,
	): HeidrunCodeDashboardSubagentNode[] {
		const descendants = threads
			.filter((thread) => thread.rootThreadId === root.threadId && thread.threadId !== root.threadId)
			.sort((left, right) => left.threadId.localeCompare(right.threadId));
		const knownIds = new Set([root.threadId, ...descendants.map((thread) => thread.threadId)]);
		const builtIds = new Set<string>();
		const build = (thread: CodexThreadObservation, parentNodeId: string, extraNotices: HeidrunCodeDashboardNotice[]):
			HeidrunCodeDashboardSubagentNode => {
			builtIds.add(thread.threadId);
			const nodeId = HeidrunCodeDashboardModelBuilder.codexSubagentNodeId(thread.threadId);
			const isStale = context.isObservationsStale === true
				|| context.input.observations?.codex.coverage !== 'connected'
				|| HeidrunCodeDashboardModelBuilder._isThreadStale(thread, context);
			const facts = HeidrunCodeDashboardModelBuilder._codexFacts(thread, nodeId, parentNodeId, isStale === true ? 'stale' : 'fresh');
			const status = HeidrunCodeDashboardStatus.forCodexChild(thread, isStale);
			const children = descendants
				.filter((child) => child.parentThreadId === thread.threadId && builtIds.has(child.threadId) === false)
				.map((child) => build(child, nodeId, []));
			return {
				nodeId,
				kind: 'subagent',
				source: 'codex_server',
				nativeId: thread.threadId,
				parentNodeId,
				codingAgentNodeId,
				name: thread.nickname,
				role: thread.role,
				facts,
				status,
				notices: HeidrunCodeDashboardStatus.notices(facts, status, extraNotices),
				startedAtMs: null,
				endedAtMs: thread.lastTurn?.completedAtMs ?? null,
				taskTexts: HeidrunCodeDashboardModelBuilder._lastPrompt(thread.interactions, thread.threadId),
				children,
			};
		};
		const nodes: HeidrunCodeDashboardSubagentNode[] = [];
		for (const thread of descendants) {
			if (builtIds.has(thread.threadId) === true) {
				continue;
			}
			if (thread.parentThreadId === root.threadId) {
				nodes.push(build(thread, codingAgentNodeId, []));
			}
		}
		for (const thread of descendants) {
			if (builtIds.has(thread.threadId) === true) {
				continue;
			}
			const parentId = thread.parentThreadId;
			if (parentId === null || knownIds.has(parentId) === false) {
				nodes.push(build(thread, codingAgentNodeId, ['parent_not_observed']));
			}
		}
		return nodes;
	}

	/**
	 * Gives the facts of one Codex chat.
	 * @param thread The chat.
	 * @param nodeId The node of the chat in the Heidrun Code Dashboard model.
	 * @param parentNodeId The node of the parent, or null for the root chat of the pane.
	 * @param freshness The freshness of the observation.
	 * @returns The facts, with the waits of the active flags as pending attention.
	 */
	private static _codexFacts(
		thread: CodexThreadObservation,
		nodeId: string,
		parentNodeId: string | null,
		freshness: HeidrunCodeDashboardFreshness,
	): HeidrunCodeDashboardFacts {
		const pendingAttention: HeidrunCodeDashboardPendingAttention[] = thread.activeFlags
			.filter((flag) => CODEX_WAITING_FLAGS.includes(flag))
			.map((flag) => ({
				id: `codex:${thread.threadId}:${flag}`,
				kind: flag === 'waitingOnUserInput' ? 'question' : 'approval',
				source: 'codex_server',
				tool: null,
				summary: null,
				atMs: null,
				requester: {
					nodeId,
					kind: parentNodeId === null ? 'coding_agent' : 'subagent',
					nativeId: thread.threadId,
					role: thread.role,
					name: thread.nickname,
				},
				reviewerContext: parentNodeId === null ? null : {
					parentNodeId,
					requesterRole: thread.role,
				},
				// A flag `waitingOnApproval` alone does not say who answers: an automatic reviewer can answer it.
				developerAction: flag === 'waitingOnUserInput' ? 'required' : 'unknown',
				isStale: freshness === 'stale',
			}));
		return {
			nativeStatus: {
				source: 'codex_server',
				value: thread.nativeStatus,
			},
			activeFlags: [...thread.activeFlags],
			lastTurnOutcome: HeidrunCodeDashboardStatus.outcomeOfCodexTurn(thread.lastTurn),
			pendingAttention,
			freshness,
		};
	}

	/**
	 * Tells whether the observation of one Codex chat is too old.
	 * @param thread The chat.
	 * @param context The build context.
	 * @returns True when the chat was read more than the limit ago.
	 */
	private static _isThreadStale(thread: CodexThreadObservation, context: BuildContext): boolean {
		return context.input.nowMs - thread.observedAtMs > HEIDRUN_CODE_DASHBOARD_OBSERVATIONS_STALE_AFTER_MS;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Gives the facts of a pane when only Herdr observes its coding agent.
	 * @param pane The pane.
	 * @param freshness The freshness of the live observation.
	 * @returns The facts, with the status of Herdr as the native status.
	 */
	private static _herdrFacts(pane: AgentInfo, freshness: HeidrunCodeDashboardFreshness): HeidrunCodeDashboardFacts {
		return {
			nativeStatus: {
				source: 'herdr',
				value: pane.agent_status,
			},
			activeFlags: [],
			lastTurnOutcome: null,
			pendingAttention: [],
			freshness,
		};
	}

	/**
	 * Completes a coding agent node: the visible status comes from Herdr, the observations add the other facts.
	 * @param base The fields that every coding agent has.
	 * @param rest The fields that the observation gives.
	 * @returns The coding agent node.
	 */
	private static _finishCodingAgent(
		base: Omit<HeidrunCodeDashboardCodingAgentNode, 'chat' | 'facts' | 'status' | 'notices' | 'observedSinceMs' | 'taskTexts'
			| 'subagents'>,
		rest: {
			/** The link between the pane and its chat. */
			chat: HeidrunCodeDashboardChatIdentity;
			/** The facts. */
			facts: HeidrunCodeDashboardFacts;
			/** The notices that only the builder knows. */
			extraNotices: HeidrunCodeDashboardNotice[];
			/** When the Claude Code observer mod started, or null. */
			observedSinceMs: number | null;
			/** The texts about the task. */
			taskTexts: HeidrunCodeDashboardTaskText[];
			/** The subagents. */
			subagents: HeidrunCodeDashboardSubagentNode[];
		},
	): HeidrunCodeDashboardCodingAgentNode {
		const status = HeidrunCodeDashboardStatus.fromHerdr(base.herdrStatus);
		return {
			...base,
			chat: rest.chat,
			facts: rest.facts,
			status,
			notices: HeidrunCodeDashboardStatus.notices(rest.facts, status, rest.extraNotices),
			observedSinceMs: rest.observedSinceMs,
			taskTexts: rest.taskTexts,
			subagents: rest.subagents,
		};
	}

	/**
	 * Finds the last readable message sent to one identifier.
	 * @param messages The messages of the session or of the chat.
	 * @param destinationId The identifier of the destination.
	 * @returns The text labelled as the last prompt, or nothing.
	 */
	private static _lastPrompt(messages: MessageObservation[], destinationId: string): HeidrunCodeDashboardTaskText[] {
		const received = messages
			.filter((message) => message.toId === destinationId && message.text !== null && message.text !== '')
			.sort((left, right) => right.atMs - left.atMs);
		const last = received[0];
		if (last === undefined || last.text === null) {
			return [];
		}
		return [{
			label: 'last_prompt',
			text: last.text,
			atMs: last.atMs,
		}];
	}

	/**
	 * Orders two subagents by start time, then by identifier, so that the order stays the same between two builds.
	 * @param leftStart The start of the first subagent, or null.
	 * @param rightStart The start of the second subagent, or null.
	 * @param leftId The identifier of the first subagent.
	 * @param rightId The identifier of the second subagent.
	 * @returns A negative number when the first subagent comes first.
	 */
	private static _compareStart(
		leftStart: number | null,
		rightStart: number | null,
		leftId: string,
		rightId: string,
	): number {
		const left = leftStart ?? Number.MAX_SAFE_INTEGER;
		const right = rightStart ?? Number.MAX_SAFE_INTEGER;
		if (left !== right) {
			return left - right;
		}
		return leftId.localeCompare(rightId);
	}
}
