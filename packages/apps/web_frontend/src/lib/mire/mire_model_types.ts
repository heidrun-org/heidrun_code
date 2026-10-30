import type { AgentStatus } from '../types';
import type { ObservationError } from './observation_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Mire model types — the hierarchy, the facts, and the statuses that every Mire view draws
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The four visible statuses of the Mire, and `unknown` when the facts do not give one. */
export type MireVisibleStatus = 'working' | 'blocked' | 'finished' | 'idle' | 'unknown';

/**
 * How fresh the live observation of one item is.
 * - `fresh`: the source observed the item in the last collection.
 * - `stale`: the observation is old, or the chat identifier of the pane is old.
 * - `not_observed`: no source observes the item (the option is off, the mod is not loaded, or the source is down).
 * - `unmatched`: a source can observe this kind of item, but no explicit identifier links the pane to it.
 */
export type MireFreshness = 'fresh' | 'stale' | 'not_observed' | 'unmatched';

/** The source of one fact. */
export type MireSource = 'herdr' | 'claude_observer' | 'codex_server';

/** The outcome of the last turn or of the run of a subagent. It is a separate fact from the runtime status. */
export type MireTurnOutcome = 'completed' | 'failed' | 'killed' | 'interrupted' | 'in_progress' | 'unknown';

/** A fact that the Mire must keep visible, because the visible status alone hides it. */
export type MireNotice =
	| 'failed'
	| 'killed'
	| 'interrupted'
	| 'system_error'
	| 'unknown_status'
	| 'stale'
	| 'stale_chat'
	| 'not_observed'
	| 'unmatched'
	| 'children_truncated'
	| 'parent_not_observed';

/** The status as the source writes it, kept next to the visible status. */
export type MireNativeStatus = {
	/** The source that gives the status. */
	source: MireSource;
	/** The status, exactly as the source writes it. */
	value: string;
};

/** Who asks for the attention: the coding agent of the pane, or one of its subagents. */
export type MireRequester = {
	/** The identifier of the node in the Mire model, or null when the source names a subagent that it does not list. */
	nodeId: string | null;
	/** The kind of the node. */
	kind: 'coding_agent' | 'subagent';
	/** The identifier that the source gives to the requester, or null for the coding agent of the pane. */
	nativeId: string | null;
	/** The type of the Claude Code subagent or the role of the Codex chat, or null. */
	role: string | null;
	/** The name or the description of the requester, or null. It is a label, never an identity. */
	name: string | null;
};

/**
 * One question or one approval that waits for an answer. A wait is not always a request for the developer: an
 * automatic reviewer can answer an approval of Codex.
 */
export type MirePendingAttention = {
	/** The identifier of the request, unique in the Mire model. */
	id: string;
	/** The kind of the request. */
	kind: 'approval' | 'question';
	/** The source that observed the request. */
	source: MireSource;
	/** The tool that the request is about, or null. */
	tool: string | null;
	/** The short text of the request, or null when the source gives no text. */
	summary: string | null;
	/** When the request started, or null when the source gives only a flag. */
	atMs: number | null;
	/** Who asks. */
	requester: MireRequester;
	/**
	 * The context of the reviewer: the parent node of a subagent that asks, so that the Mire shows who can answer. Null
	 * when the coding agent of the pane asks.
	 */
	reviewerContext: {
		/** The node that started the requester. */
		parentNodeId: string;
		/** The role or the type of the requester, or null. */
		requesterRole: string | null;
	} | null;
	/**
	 * `required`: the source says that the developer must answer. `unknown`: the source gives only a wait, and an
	 * automatic reviewer can answer it.
	 */
	developerAction: 'required' | 'unknown';
	/** True when the observation of the request is stale. */
	isStale: boolean;
};

/** The facts of one coding agent or one subagent. Each fact stays separate from the others. */
export type MireFacts = {
	/** The native runtime status, or null when no source gives one. */
	nativeStatus: MireNativeStatus | null;
	/** The active flags of a Codex chat, for example `waitingOnApproval`. Empty for Claude Code. */
	activeFlags: string[];
	/** The outcome of the last turn or of the run, or null when no source gives one. */
	lastTurnOutcome: MireTurnOutcome | null;
	/** The questions and the approvals that wait. */
	pendingAttention: MirePendingAttention[];
	/** How fresh the live observation is. */
	freshness: MireFreshness;
};

/** A text about the task of a node. Its label says what it is: neither text proves the current task. */
export type MireTaskText = {
	/** `initial_instructions`: the prompt given at the start. `last_prompt`: the last message received. */
	label: 'initial_instructions' | 'last_prompt';
	/** The text. */
	text: string;
	/** When the text was observed, or null. */
	atMs: number | null;
};

/** The link between a pane and its chat. */
export type MireChatIdentity = {
	/** The chat identifier, or null when the pane names none. */
	chatId: string | null;
	/**
	 * `matched`: an explicit identifier links the pane to an observed chat. `stale`: the pane names a chat that it left.
	 * `unmatched`: no explicit identifier, or the named chat is not observed. `not_observed`: no source observes it.
	 */
	state: 'matched' | 'stale' | 'unmatched' | 'not_observed';
};

/** One subagent: a Claude Code subagent or a Codex child chat. */
export type MireSubagentNode = {
	/** The identifier of the node in the Mire model. */
	nodeId: string;
	/** The kind of the node. */
	kind: 'subagent';
	/** The source that observes the subagent. */
	source: 'claude_observer' | 'codex_server';
	/** The identifier that the source gives: the subagent identifier, or the Codex chat identifier. */
	nativeId: string;
	/** The node of the parent: the coding agent, or a subagent. */
	parentNodeId: string;
	/** The node of the coding agent of the pane. */
	codingAgentNodeId: string;
	/** The name, the description, or the nickname. It is a label, never an identity. */
	name: string | null;
	/** The type of the Claude Code subagent or the role of the Codex chat. */
	role: string | null;
	/** The facts. */
	facts: MireFacts;
	/** The visible status. */
	status: MireVisibleStatus;
	/** The facts that the visible status alone hides. */
	notices: MireNotice[];
	/** When the subagent started, or null. */
	startedAtMs: number | null;
	/** When the subagent ended, or null. */
	endedAtMs: number | null;
	/** The texts about the task, each with its label. */
	taskTexts: MireTaskText[];
	/** The nested subagents. */
	children: MireSubagentNode[];
};

/** One pane where a coding agent runs. */
export type MireCodingAgentNode = {
	/** The identifier of the node: it follows the terminal and the coding agent, not the pane position. */
	nodeId: string;
	/** The kind of the node. */
	kind: 'coding_agent';
	/** The coding agent that Herdr detects in the pane, for example `claude` or `codex`. */
	agent: string;
	/** The name of the pane, or null. It is a label, never an identity. */
	label: string | null;
	/** The current pane identifier. It changes when the pane moves. */
	paneId: string;
	/** The terminal identifier. It stays when the pane moves. */
	terminalId: string;
	/** The current workspace identifier. */
	workspaceId: string;
	/** The current tab identifier. */
	tabId: string;
	/** The current working folder of the pane, or null. */
	cwd: string | null;
	/** The link between the pane and its chat. */
	chat: MireChatIdentity;
	/** The status that Herdr detects: the main source of the visible status. */
	herdrStatus: AgentStatus;
	/** The facts. */
	facts: MireFacts;
	/** The visible status. */
	status: MireVisibleStatus;
	/** The facts that the visible status alone hides. */
	notices: MireNotice[];
	/** When the Claude Code observer mod of the session started, or null. Earlier requests are not known. */
	observedSinceMs: number | null;
	/** The texts about the task, each with its label. */
	taskTexts: MireTaskText[];
	/** The subagents, nested by parent. */
	subagents: MireSubagentNode[];
};

/** How many items of a group have an incomplete observation. */
export type MireCoverage = {
	/** The number of coding agents and subagents in the group, each counted once. */
	total: number;
	/** The items whose visible status is unknown. */
	unknown: number;
	/** The items whose observation is stale. */
	stale: number;
	/** The items with no explicit link to their observation. */
	unmatched: number;
	/** The items that no source observes. */
	notObserved: number;
};

/** One tab of a workspace. */
export type MireTabNode = {
	/** The identifier of the node in the Mire model. */
	nodeId: string;
	/** The kind of the node. */
	kind: 'tab';
	/** The tab identifier of Herdr. */
	tabId: string;
	/** The workspace identifier of Herdr. */
	workspaceId: string;
	/** The number of the tab. */
	number: number;
	/** The exact name of the tab. */
	label: string;
	/** The coding agents of the tab: one for each pane where a coding agent runs. */
	codingAgents: MireCodingAgentNode[];
	/** The aggregated visible status. */
	status: MireVisibleStatus;
	/** The coverage of the tab. */
	coverage: MireCoverage;
};

/** One workspace. */
export type MireWorkspaceNode = {
	/** The identifier of the node in the Mire model. */
	nodeId: string;
	/** The kind of the node. */
	kind: 'workspace';
	/** The workspace identifier of Herdr. */
	workspaceId: string;
	/** The number of the workspace. */
	number: number;
	/** The exact name of the workspace. */
	label: string;
	/** The saved workspace folder, or null when it needs recovery. */
	folder: string | null;
	/** The tabs. */
	tabs: MireTabNode[];
	/** The aggregated visible status. */
	status: MireVisibleStatus;
	/** The coverage of the workspace. */
	coverage: MireCoverage;
};

/** The number of items for each visible status. */
export type MireStatusCounts = Record<MireVisibleStatus, number> & {
	/** All the items. */
	total: number;
};

/** The counters of the Mire: each coding agent and each subagent counted once, with no filter. */
export type MireCounters = {
	/** The coding agents. */
	codingAgents: MireStatusCounts;
	/** The subagents. */
	subagents: MireStatusCounts;
};

/** The observations that no pane claims. They stay visible as a list, never as a drawn link. */
export type MireUnmatchedObservations = {
	/** The Claude Code sessions that no pane claims. */
	claudeSessionIds: string[];
	/** The Codex root chats that no pane names. */
	codexRootThreadIds: string[];
};

/** The whole Mire: Heidrun at the centre, then the workspaces, the tabs, the coding agents, and the subagents. */
export type MireModel = {
	/** The identifier of the node of Heidrun. */
	nodeId: 'heidrun';
	/** The kind of the node. */
	kind: 'heidrun';
	/** The Herdr session of the panes, or null when the frontend does not know it. */
	herdrSessionName: string | null;
	/** The time of the observations, or null when there is none. */
	observedAtMs: number | null;
	/** `none`: no observation arrived. `stale`: the last observation is too old. */
	observationsState: 'none' | 'fresh' | 'stale';
	/** The coverage of the shared Codex server, or null when there is no observation. */
	codexCoverage: 'connected' | 'unavailable' | null;
	/** Why the shared Codex server is not available, or null. */
	codexUnavailableReason: string | null;
	/** The errors of the sources. */
	errors: ObservationError[];
	/** The workspaces, by number. */
	workspaces: MireWorkspaceNode[];
	/** The aggregated visible status. */
	status: MireVisibleStatus;
	/** The coverage of the whole Mire. */
	coverage: MireCoverage;
	/** The counters. */
	counters: MireCounters;
	/** The observations that no pane claims. */
	unmatchedObservations: MireUnmatchedObservations;
};

/** One end of a message. */
export type MireMessageEndpoint = {
	/** The identifier that the source gives: a session, a subagent, or a chat identifier. */
	nativeId: string;
	/** The node of the Mire model, or null when the identifier links to no node. */
	nodeId: string | null;
	/** `resolved` when the identifier links to exactly one node. */
	state: 'resolved' | 'unmatched';
};

/** One observed message. */
export type MireMessage = {
	/** The identifier, unique in the Mire: the source, the session or chat, and the identifier of the source. */
	id: string;
	/** The identifier that the source gives, unique in its session or chat. */
	nativeId: string;
	/** The source of the message. */
	source: 'claude_observer' | 'codex_server';
	/** The Claude Code session or the Codex chat where the source observed the message. */
	containerId: string;
	/** When the message was observed. */
	atMs: number;
	/** The sender. */
	from: MireMessageEndpoint;
	/** The destination, or null when the source does not give it. */
	to: MireMessageEndpoint | null;
	/** The text, or null when the source does not give readable text. */
	text: string | null;
	/** Whether the source gives the text. */
	contentAvailability: 'available' | 'not_exposed';
	/** The last observed step of the delivery. Queued does not prove that the destination read it. */
	delivery: 'queued' | 'received' | 'failed' | 'unknown';
};
