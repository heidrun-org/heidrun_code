import type { AgentInfo, SessionSnapshot } from '../../lib/types';
import { HeidrunCodeDashboardModelBuilder } from '../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_builder';
import type { HeidrunCodeDashboardObservations } from '../../lib/heidrun_code_dashboard/observation_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunCodeDashboardViewTestSupport — the Herdr snapshot and the observations of the tests of the Heidrun Code Dashboard view, for the tests only
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The time of the observations of the tests. */
export const TEST_NOW_MS = 1_700_000_000_000;

/** The node identifiers of the test model. */
export const TEST_NODES = {
	/** The Claude Code with an observed session, in the tab Claude of DashMenu V2. */
	claude: HeidrunCodeDashboardModelBuilder.codingAgentNodeId({
		terminal_id: 'term1',
		agent: 'claude',
	}),
	/** The second Claude Code of the same tab, with no observation. */
	claudeNotObserved: HeidrunCodeDashboardModelBuilder.codingAgentNodeId({
		terminal_id: 'term2',
		agent: 'claude',
	}),
	/** The Codex of the tab DashStock, linked to its root chat. */
	codex: HeidrunCodeDashboardModelBuilder.codingAgentNodeId({
		terminal_id: 'term3',
		agent: 'codex',
	}),
	/** The Codex of the workspace Connect, with no chat identifier. */
	codexUnmatched: HeidrunCodeDashboardModelBuilder.codingAgentNodeId({
		terminal_id: 'term4',
		agent: 'codex',
	}),
	/** The running Claude Code subagent Olivier. */
	olivier: HeidrunCodeDashboardModelBuilder.claudeSubagentNodeId('s1', 'a1'),
	/** The completed Claude Code subagent Explore. */
	explore: HeidrunCodeDashboardModelBuilder.claudeSubagentNodeId('s1', 'a2'),
	/** The Codex child chat Bruno, which waits for an approval. */
	bruno: HeidrunCodeDashboardModelBuilder.codexSubagentNodeId('t1c'),
};

/** Builds the test data of the Heidrun Code Dashboard view. Only the test files import this class. */
export class HeidrunCodeDashboardViewTestSupport {
	/**
	 * Builds a Herdr snapshot: DashMenu V2 with a split tab Claude (two Claude Code) and a tab DashStock (one Codex),
	 * and Connect with one Codex that names no chat.
	 * @returns The snapshot.
	 */
	static snapshot(): SessionSnapshot {
		const panes: AgentInfo[] = [
			HeidrunCodeDashboardViewTestSupport._pane('p1', 'term1', 'w1', 'w1:t1', 'claude', 'working', {
				tokens: {
					hd_sid: 's1',
				},
			}),
			HeidrunCodeDashboardViewTestSupport._pane('p2', 'term2', 'w1', 'w1:t1', 'claude', 'idle', {}),
			HeidrunCodeDashboardViewTestSupport._pane('p3', 'term3', 'w1', 'w1:t2', 'codex', 'blocked', {
				agent_session: {
					source: 'herdr',
					agent: 'codex',
					kind: 'thread',
					value: 't1',
				},
			}),
			HeidrunCodeDashboardViewTestSupport._pane('p4', 'term4', 'w2', 'w2:t1', 'codex', 'done', {}),
		];
		return {
			version: 'test',
			protocol: 1,
			workspaces: [
				HeidrunCodeDashboardViewTestSupport._workspace('w1', 1, 'DashMenu V2', '/projects/dashmenu-v2'),
				HeidrunCodeDashboardViewTestSupport._workspace('w2', 2, 'Connect', null),
			],
			tabs: [
				HeidrunCodeDashboardViewTestSupport._tab('w1:t1', 'w1', 1, 'Claude'),
				HeidrunCodeDashboardViewTestSupport._tab('w1:t2', 'w1', 2, 'DashStock'),
				HeidrunCodeDashboardViewTestSupport._tab('w2:t1', 'w2', 1, 'a tab name that is much too long for the graph'),
			],
			panes,
			layouts: [],
			agents: panes,
		};
	}

	/**
	 * Builds the observations: the Claude Code session `s1` with two subagents, a question, and a message, and the
	 * Codex root chat `t1` with one child that waits for an approval.
	 * @param observedAtMs The time of the collection.
	 * @returns The observations.
	 */
	static observations(observedAtMs: number = TEST_NOW_MS): HeidrunCodeDashboardObservations {
		return {
			schemaVersion: 1,
			observedAtMs,
			claude: {
				sessions: [
					{
						sessionId: 's1',
						herdrPaneId: 'p1',
						herdrSocketPath: '/tmp/herdr.sock',
						cwd: '/projects/dashmenu-v2',
						observedAtMs,
						sequence: 3,
						isStale: false,
						observerStartedAtMs: observedAtMs - 60_000,
						subagents: [
							{
								id: 'a1',
								description: 'Olivier',
								type: 'general-purpose',
								nativeStatus: 'running',
								startedAtMs: observedAtMs - 30_000,
								endedAtMs: null,
								initialInstructions: 'Draw the mock-ups of the menu screen.',
							},
							{
								id: 'a2',
								description: 'Explore',
								type: 'Explore',
								nativeStatus: 'completed',
								startedAtMs: observedAtMs - 20_000,
								endedAtMs: observedAtMs - 10_000,
								initialInstructions: null,
							},
						],
						pendingRequests: [
							{
								id: 'r1',
								agentId: null,
								kind: 'question',
								tool: 'AskUserQuestion',
								summary: 'Two options for the schema of the table menu_items: which one?',
								atMs: observedAtMs - 5_000,
							},
						],
						messages: [
							{
								id: 'm1',
								atMs: observedAtMs - 4_000,
								fromId: 'a1',
								toId: 's1',
								text: 'The mock-ups are ready.',
								contentAvailability: 'available',
								delivery: 'received',
							},
						],
					},
				],
				errors: [],
			},
			codex: {
				coverage: 'connected',
				unavailableReason: null,
				threads: [
					{
						threadId: 't1',
						parentThreadId: null,
						rootThreadId: 't1',
						nickname: null,
						role: null,
						nativeStatus: 'active',
						activeFlags: [],
						lastTurn: null,
						interactions: [
							{
								id: 'i1',
								atMs: observedAtMs - 3_000,
								fromId: 't1',
								toId: 't1c',
								text: null,
								contentAvailability: 'not_exposed',
								delivery: 'queued',
							},
						],
						observedAtMs,
					},
					{
						threadId: 't1c',
						parentThreadId: 't1',
						rootThreadId: 't1',
						nickname: 'Bruno',
						role: 'reviewer',
						nativeStatus: 'active',
						activeFlags: ['waitingOnApproval'],
						lastTurn: null,
						interactions: [],
						observedAtMs,
					},
				],
				errors: [],
				limits: {
					maximumChildrenPerRoot: 50,
					truncatedRootThreadIds: [],
				},
			},
		};
	}

	/**
	 * Builds a workspace.
	 * @param workspaceId The workspace identifier.
	 * @param number The number.
	 * @param label The name.
	 * @param folder The saved workspace folder, or null.
	 * @returns The workspace.
	 */
	private static _workspace(workspaceId: string, number: number, label: string, folder: string | null) {
		return {
			workspace_id: workspaceId,
			number,
			label,
			focused: false,
			pane_count: 1,
			tab_count: 1,
			active_tab_id: '',
			agent_status: 'idle' as const,
			workspace_folder: folder,
		};
	}

	/**
	 * Builds a tab.
	 * @param tabId The tab identifier.
	 * @param workspaceId The workspace identifier.
	 * @param number The number.
	 * @param label The name.
	 * @returns The tab.
	 */
	private static _tab(tabId: string, workspaceId: string, number: number, label: string) {
		return {
			tab_id: tabId,
			workspace_id: workspaceId,
			number,
			label,
			focused: false,
			pane_count: 1,
			agent_status: 'idle' as const,
		};
	}

	/**
	 * Builds a pane with a coding agent.
	 * @param paneId The pane identifier.
	 * @param terminalId The terminal identifier.
	 * @param workspaceId The workspace identifier.
	 * @param tabId The tab identifier.
	 * @param agent The coding agent.
	 * @param status The status of Herdr.
	 * @param fields The other fields.
	 * @returns The pane.
	 */
	private static _pane(
		paneId: string,
		terminalId: string,
		workspaceId: string,
		tabId: string,
		agent: string,
		status: AgentInfo['agent_status'],
		fields: Partial<AgentInfo>,
	): AgentInfo {
		return {
			pane_id: paneId,
			terminal_id: terminalId,
			workspace_id: workspaceId,
			tab_id: tabId,
			focused: false,
			agent_status: status,
			revision: 1,
			agent,
			label: null,
			...fields,
		};
	}
}
