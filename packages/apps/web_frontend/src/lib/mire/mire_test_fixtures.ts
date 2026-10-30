import type { AgentInfo, TabInfo, WorkspaceInfo } from '../types';
import type { MireModelInput } from './mire_model_builder';
import type {
	ClaudeSessionObservation,
	ClaudeSubagentObservation,
	CodexThreadObservation,
	MessageObservation,
	MireObservations,
} from './observation_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MireTestFixtures — small Herdr data and observations for the tests of the Mire model, never for the application
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The time of every fixture observation. */
export const NOW_MS = 1_000_000;

/** The Herdr socket of the fixture panes. */
export const SOCKET_PATH = '/tmp/herdr_development.sock';

/** Builds the fixtures of the tests. Only the test files import this class. */
export class MireTestFixtures {
	/**
	 * Builds a workspace.
	 * @param workspaceId The workspace identifier.
	 * @param number The number of the workspace.
	 * @param label The name of the workspace.
	 * @returns The workspace.
	 */
	static workspace(workspaceId: string, number: number, label: string): WorkspaceInfo {
		return {
			workspace_id: workspaceId,
			number,
			label,
			focused: false,
			pane_count: 0,
			tab_count: 0,
			active_tab_id: '',
			agent_status: 'idle',
			workspace_folder: `/projects/${label}`,
		};
	}

	/**
	 * Builds a tab.
	 * @param tabId The tab identifier.
	 * @param workspaceId The workspace identifier.
	 * @param number The number of the tab.
	 * @param label The name of the tab.
	 * @returns The tab.
	 */
	static tab(tabId: string, workspaceId: string, number: number, label: string): TabInfo {
		return {
			tab_id: tabId,
			workspace_id: workspaceId,
			number,
			label,
			focused: false,
			pane_count: 1,
			agent_status: 'idle',
		};
	}

	/**
	 * Builds a pane.
	 * @param paneId The pane identifier.
	 * @param terminalId The terminal identifier.
	 * @param tabId The tab identifier; the workspace identifier is the part before the colon.
	 * @param fields The other fields.
	 * @returns The pane.
	 */
	static pane(paneId: string, terminalId: string, tabId: string, fields: Partial<AgentInfo> = {}): AgentInfo {
		return {
			pane_id: paneId,
			terminal_id: terminalId,
			workspace_id: tabId.split(':')[0],
			tab_id: tabId,
			focused: false,
			agent_status: 'idle',
			revision: 1,
			...fields,
		};
	}

	/**
	 * Builds observations with no session and no chat, connected to the shared Codex server.
	 * @param fields The fields of Claude Code and Codex to replace.
	 * @returns The observations.
	 */
	static observations(fields: {
		/** The Claude Code sessions. */
		sessions?: ClaudeSessionObservation[];
		/** The Codex chats. */
		threads?: CodexThreadObservation[];
		/** The coverage of the shared Codex server. */
		coverage?: 'connected' | 'unavailable';
		/** The roots with more descendants than the maximum. */
		truncatedRootThreadIds?: string[];
		/** The time of the collection. */
		observedAtMs?: number;
	} = {}): MireObservations {
		return {
			schemaVersion: 1,
			observedAtMs: fields.observedAtMs ?? NOW_MS,
			claude: {
				sessions: fields.sessions ?? [],
				errors: [],
			},
			codex: {
				coverage: fields.coverage ?? 'connected',
				unavailableReason: fields.coverage === 'unavailable' ? 'no socket' : null,
				threads: fields.threads ?? [],
				errors: [],
				limits: {
					maximumChildrenPerRoot: 50,
					truncatedRootThreadIds: fields.truncatedRootThreadIds ?? [],
				},
			},
		};
	}

	/**
	 * Builds a Claude Code session.
	 * @param sessionId The session identifier.
	 * @param fields The other fields.
	 * @returns The session.
	 */
	static claudeSession(sessionId: string, fields: Partial<ClaudeSessionObservation> = {}): ClaudeSessionObservation {
		return {
			sessionId,
			herdrPaneId: null,
			herdrSocketPath: SOCKET_PATH,
			cwd: '/projects',
			observedAtMs: NOW_MS,
			sequence: 1,
			isStale: false,
			observerStartedAtMs: NOW_MS - 60_000,
			subagents: [],
			pendingRequests: [],
			messages: [],
			...fields,
		};
	}

	/**
	 * Builds a Claude Code subagent.
	 * @param id The subagent identifier.
	 * @param fields The other fields.
	 * @returns The subagent.
	 */
	static claudeSubagent(id: string, fields: Partial<ClaudeSubagentObservation> = {}): ClaudeSubagentObservation {
		return {
			id,
			description: `subagent ${id}`,
			type: 'general-purpose',
			nativeStatus: 'running',
			startedAtMs: NOW_MS - 1000,
			endedAtMs: null,
			initialInstructions: null,
			...fields,
		};
	}

	/**
	 * Builds a Codex chat.
	 * @param threadId The chat identifier.
	 * @param rootThreadId The root chat identifier.
	 * @param parentThreadId The parent chat identifier, or null for a root chat.
	 * @param fields The other fields.
	 * @returns The chat.
	 */
	static codexThread(
		threadId: string,
		rootThreadId: string,
		parentThreadId: string | null,
		fields: Partial<CodexThreadObservation> = {},
	): CodexThreadObservation {
		return {
			threadId,
			parentThreadId,
			rootThreadId,
			nickname: null,
			role: null,
			nativeStatus: 'active',
			activeFlags: [],
			lastTurn: null,
			interactions: [],
			observedAtMs: NOW_MS,
			...fields,
		};
	}

	/**
	 * Builds a message.
	 * @param id The message identifier.
	 * @param fromId The sender identifier.
	 * @param toId The destination identifier, or null.
	 * @param fields The other fields.
	 * @returns The message.
	 */
	static message(id: string, fromId: string, toId: string | null, fields: Partial<MessageObservation> = {}):
		MessageObservation {
		return {
			id,
			atMs: NOW_MS,
			fromId,
			toId,
			text: `text ${id}`,
			contentAvailability: 'available',
			delivery: 'received',
			...fields,
		};
	}

	/**
	 * Builds the input of the builder.
	 * @param fields The fields to replace.
	 * @returns The input.
	 */
	static input(fields: Partial<MireModelInput> = {}): MireModelInput {
		return {
			workspaces: [],
			tabs: [],
			panes: [],
			observations: null,
			herdrSessionName: 'heidrun_development',
			herdrSocketPath: SOCKET_PATH,
			nowMs: NOW_MS,
			...fields,
		};
	}
}
