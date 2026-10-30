///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Mire observation types — the shape that the Rust collector sends to the frontend
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// These types copy the Mire observation contract of issue 968 exactly. Do not change one of them alone: the desktop
// application sends this shape in the Tauri event `mire://observations` and in the answer of `mire_subscribe`.

/** One collection of the live observations of the Claude Code observer mod and of the shared Codex server. */
export type MireObservations = {
	/** The version of this shape. */
	schemaVersion: 1;
	/** Time of this collection, by the clock of the computer. */
	observedAtMs: number;
	/** The observations of the Claude Code observer mod. */
	claude: {
		/** One item for each Claude Code session that the mod observes. */
		sessions: ClaudeSessionObservation[];
		/** The errors of the reading of the files of the mod. */
		errors: ObservationError[];
	};
	/** The observations of the shared Codex server. */
	codex: {
		/** `connected` when the collector reads the shared Codex server. */
		coverage: 'connected' | 'unavailable';
		/** Why the shared Codex server is not available, or null. */
		unavailableReason: string | null;
		/** The root chats of the Codex panes of Herdr, and their descendants. */
		threads: CodexThreadObservation[];
		/** The errors of the requests to the shared Codex server. */
		errors: ObservationError[];
		/** The limits of the enumeration of the descendants. */
		limits: {
			/** The maximum number of descendants read for one root chat. */
			maximumChildrenPerRoot: number;
			/** Roots with more descendants than the maximum. */
			truncatedRootThreadIds: string[];
		};
	};
};

/** One error of one source of the observations. */
export type ObservationError = {
	/** File path, socket path, or method name. */
	source: string;
	/** The text of the error. */
	message: string;
};

/** The observation of one Claude Code session by the observer mod. */
export type ClaudeSessionObservation = {
	/** The identifier of the Claude Code session. */
	sessionId: string;
	/** HERDR_PANE_ID seen by the mod in the pane process. */
	herdrPaneId: string | null;
	/** HERDR_SOCKET_PATH seen by the mod. */
	herdrSocketPath: string | null;
	/** The current working folder of the session. */
	cwd: string | null;
	/** Original time written by the mod. */
	observedAtMs: number;
	/** The sequence number of the observation, written by the mod. */
	sequence: number;
	/**
	 * Computed by the collector: observedAtMs older than 30 seconds while the session is not idle, or in the future.
	 */
	isStale: boolean;
	/** When this mod instance started; observations before it are not known. */
	observerStartedAtMs: number;
	/** The subagents of the session. */
	subagents: ClaudeSubagentObservation[];
	/** The questions and the approvals that wait for an answer. */
	pendingRequests: PendingRequestObservation[];
	/** The last 200 events at most. */
	messages: MessageObservation[];
};

/** One subagent of one Claude Code session. */
export type ClaudeSubagentObservation = {
	/** The identifier of the subagent in its session. */
	id: string;
	/** Name or description given at the start. */
	description: string | null;
	/** The type of the subagent. */
	type: string | null;
	/** The status that Claude Code gives. */
	nativeStatus: 'running' | 'completed' | 'failed' | 'killed' | 'unknown';
	/** When the subagent started. */
	startedAtMs: number | null;
	/** When the subagent ended. */
	endedAtMs: number | null;
	/** The prompt given at the start, when the mod saw it. */
	initialInstructions: string | null;
};

/** One question or one approval that waits for an answer. */
export type PendingRequestObservation = {
	/** The identifier of the request. */
	id: string;
	/** Null: the main coding agent of the session. */
	agentId: string | null;
	/** The kind of the request. */
	kind: 'approval' | 'question';
	/** The tool that the request is about. */
	tool: string | null;
	/** Short text of the request, at most 500 characters. */
	summary: string | null;
	/** When the request started. */
	atMs: number;
};

/** One message between two coding agents, or between a coding agent and a subagent. */
export type MessageObservation = {
	/** Stable identifier, unique in its session or thread. */
	id: string;
	/** When the message was observed. */
	atMs: number;
	/** Session, subagent, or thread identifier. */
	fromId: string;
	/** Session, subagent, or thread identifier, or null when the destination is not known. */
	toId: string | null;
	/** Null when the source does not give readable text. */
	text: string | null;
	/** Whether the source gives the text of the message. */
	contentAvailability: 'available' | 'not_exposed';
	/** The last observed step of the delivery. */
	delivery: 'queued' | 'received' | 'failed' | 'unknown';
};

/** One chat of the shared Codex server: a root chat of a pane, or one of its descendants. */
export type CodexThreadObservation = {
	/** The identifier of the chat. */
	threadId: string;
	/** The identifier of the parent chat, or null for a root chat. */
	parentThreadId: string | null;
	/** The identifier of the root chat. */
	rootThreadId: string;
	/** The nickname of the chat. */
	nickname: string | null;
	/** The role of the chat. */
	role: string | null;
	/** The status that the shared Codex server gives. */
	nativeStatus: 'idle' | 'active' | 'notLoaded' | 'systemError' | 'unknown';
	/** For example "waitingOnApproval", "waitingOnUserInput". */
	activeFlags: string[];
	/** The last turn of the chat. */
	lastTurn: {
		/** The status of the last turn. */
		status: 'completed' | 'interrupted' | 'failed' | 'inProgress' | 'unknown';
		/** When the last turn completed. */
		completedAtMs: number | null;
	} | null;
	/** Text is always null for Codex in the tested version. */
	interactions: MessageObservation[];
	/** When the collector read this chat. */
	observedAtMs: number;
};
