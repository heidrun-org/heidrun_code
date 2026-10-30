///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Register — writes live Claude Code observations for the Mire of Heidrun Code
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The version of the snapshot file that the collector of Heidrun Code reads. */
const SNAPSHOT_SCHEMA_VERSION = 1;
/** The most messages that one snapshot keeps: the newest ones. */
const MAXIMUM_MESSAGES = 200;
/** The longest summary of a pending request, in characters. */
const MAXIMUM_SUMMARY_LENGTH = 500;
/** The longest initial instructions of a subagent, in characters. */
const MAXIMUM_INSTRUCTIONS_LENGTH = 4000;
/** The longest text of a message, in characters. */
const MAXIMUM_MESSAGE_LENGTH = 4000;
/** How often the mod writes the snapshot again, in milliseconds, so that the collector sees that the session is alive. */
const PUBLISH_INTERVAL_MS = 500;

/** @type {string} */
let observationFolder = '';
/** @type {string} */
let sessionId = '';
/** @type {string} */
let endedSessionId = '';
/** @type {string} */
let cwd = '';
/** @type {string | null} */
let herdrPaneId = null;
/** @type {string | null} */
let herdrSocketPath = null;
/** @type {number} */
let observerStartedAtMs = 0;
/** @type {number} */
let sequence = 0;
/** @type {import('claude-code').AgentInfo[]} */
let agents = [];
/** @type {Record<string, { startedAtMs: number, endedAtMs: number | null, initialInstructions: string }>} */
let spawns = {};
/** @type {Record<string, unknown>[]} */
let messages = [];
/** @type {Record<string, Record<string, unknown>>} */
let pendingRequests = {};
/** @type {Record<string, boolean>} */
const protectedFiles = {};

/**
 * Cuts a text to a maximum length.
 * @param {unknown} value The value to cut; a value that is not a text gives null.
 * @param {number} maximum The most characters to keep.
 * @returns {string | null} The text, cut, or null.
 */
function cut(value, maximum) {
	if (typeof value !== 'string') {
		return null;
	}
	return value.length > maximum ? value.slice(0, maximum) : value;
}

/**
 * Builds the short text of a pending request: the question, the command, or the input of the tool as JSON.
 * @param {string} tool The name of the tool.
 * @param {unknown} input The input of the tool.
 * @returns {string | null} The summary, at most 500 characters, or null.
 */
function summarize(tool, input) {
	if (input === null || typeof input !== 'object') {
		return null;
	}
	const record = /** @type {Record<string, unknown>} */ (input);
	if (tool === 'AskUserQuestion' && Array.isArray(record.questions)) {
		const texts = record.questions
			.map((question) => (question !== null && typeof question === 'object' ? /** @type {Record<string, unknown>} */ (question).question : null))
			.filter((text) => typeof text === 'string');
		return cut(texts.join(' / '), MAXIMUM_SUMMARY_LENGTH);
	}
	if (typeof record.command === 'string') {
		return cut(record.command, MAXIMUM_SUMMARY_LENGTH);
	}
	if (typeof record.file_path === 'string') {
		return cut(record.file_path, MAXIMUM_SUMMARY_LENGTH);
	}
	try {
		return cut(JSON.stringify(record), MAXIMUM_SUMMARY_LENGTH);
	} catch {
		return null;
	}
}

/**
 * Keeps only the characters of a session identifier that are safe in a file name.
 * @param {string} value The session identifier.
 * @returns {string} The safe file name part, empty when nothing is safe.
 */
function safeFileName(value) {
	return value.replace(/[^A-Za-z0-9_-]/g, '');
}

/**
 * Adds one message and keeps the newest 200.
 * @param {Record<string, unknown>} message The message observation.
 * @returns {void}
 */
function addMessage(message) {
	messages.push(message);
	messages.splice(0, Math.max(0, messages.length - MAXIMUM_MESSAGES));
}

/**
 * Starts the observation of a new session in the same process, after `/clear` or `/resume`. The file of the former
 * session stays: the collector marks it as stale.
 * @param {string} nextSessionId The identifier of the new session.
 * @param {number} nowMs The time of the change.
 * @returns {void}
 */
function startSession(nextSessionId, nowMs) {
	sessionId = nextSessionId;
	observerStartedAtMs = nowMs;
	sequence = 0;
	spawns = {};
	messages = [];
	pendingRequests = {};
}

/**
 * Reads the folder of the observations and the Herdr pane of this process from the environment.
 * @param {import('claude-code').EngineInterface} $ The mod methods supplied by Claude Code.
 * @returns {Promise<void>} Completion of the read.
 */
async function readEnvironment($) {
	const folder = await $.env.get('HEIDRUN_MIRE_OBSERVATION_DIR');
	if (folder !== undefined && folder.startsWith('/')) {
		observationFolder = folder.replace(/\/+$/, '');
	} else {
		const home = await $.env.get('HOME');
		observationFolder = home === undefined ? '' : `${home}/.config/heidrun_code/mire_claude_observations`;
	}
	herdrPaneId = (await $.env.get('HERDR_PANE_ID')) ?? null;
	herdrSocketPath = (await $.env.get('HERDR_SOCKET_PATH')) ?? null;
}

/**
 * Gives the folder permissions 700 and a new file permissions 600, once per file. A failure changes nothing else.
 * @param {import('claude-code').EngineInterface} $ The mod methods supplied by Claude Code.
 * @param {string} path The snapshot file.
 * @returns {Promise<void>} Completion of the change.
 */
async function protect($, path) {
	if (protectedFiles[path] === true) {
		return;
	}
	protectedFiles[path] = true;
	try {
		await $.process.run(['/bin/chmod', '700', observationFolder]);
		await $.process.run(['/bin/chmod', '600', path]);
	} catch {
		// The collector of Heidrun Code also sets these permissions.
	}
}

/**
 * Writes one complete snapshot of the session. A new session identifier starts a new file.
 * @param {import('claude-code').EngineInterface} $ The mod methods supplied by Claude Code.
 * @param {{ endedAtMs: number, endReason: string } | null} end The end of the session, or null while it runs.
 * @returns {Promise<void>} Completion of the observation attempt.
 */
async function publish($, end) {
	if (sessionId === '' || observationFolder === '') {
		return;
	}
	const nowMs = await $.clock.now();
	if (end === null) {
		const currentSessionId = await $.session.id();
		if (currentSessionId === endedSessionId) {
			return;
		}
		if (currentSessionId !== sessionId) {
			startSession(currentSessionId, nowMs);
		}
	}
	const fileName = safeFileName(sessionId);
	if (fileName === '') {
		return;
	}
	sequence += 1;
	const path = `${observationFolder}/${fileName}.json`;
	const subagents = agents.map((agent) => {
		const spawn = spawns[agent.id];
		return {
			id: agent.id,
			description: agent.name ?? agent.description ?? null,
			type: agent.type ?? null,
			nativeStatus: agent.status,
			startedAtMs: spawn === undefined ? null : spawn.startedAtMs,
			endedAtMs: spawn === undefined ? null : spawn.endedAtMs,
			initialInstructions: spawn === undefined ? null : spawn.initialInstructions,
		};
	});
	try {
		await $.fs.write(path, JSON.stringify({
			schemaVersion: SNAPSHOT_SCHEMA_VERSION,
			codingAgent: 'claude',
			sessionId,
			herdrPaneId,
			herdrSocketPath,
			cwd,
			observedAtMs: nowMs,
			sequence,
			observerStartedAtMs,
			endedAtMs: end === null ? null : end.endedAtMs,
			endReason: end === null ? null : end.endReason,
			subagents,
			pendingRequests: Object.values(pendingRequests),
			messages,
		}));
		await protect($, path);
	} catch {
		// Observation cannot change a tool or approval result. The collector detects a stale or absent file.
	}
}

/**
 * Registers pass-through runtime observers in the form required by the mod compiler.
 * @param {import('claude-code').On} on The event registration function.
 * @returns {undefined} No startup value.
 * @type {import('claude-code').Register}
 */
export const register = (on) => {
	on('session.start', async ($, event, next) => {
		await readEnvironment($);
		startSession(await $.session.id(), await $.clock.now());
		cwd = await $.session.cwd();
		agents = await $.agent.list();
		await publish($, null);
		$.clock.every(PUBLISH_INTERVAL_MS, async () => {
			agents = await $.agent.list();
			await publish($, null);
		});
		return next(event);
	});

	on('session.end', async ($, event, next) => {
		await publish($, {
			endedAtMs: await $.clock.now(),
			endReason: event.reason,
		});
		endedSessionId = sessionId;
		return next(event);
	});

	on('agent.spawn', async ($, event, next) => {
		const startedAtMs = await $.clock.now();
		const result = await next(event);
		if ('agentId' in result && typeof result.agentId === 'string') {
			spawns[result.agentId] = {
				startedAtMs,
				endedAtMs: null,
				initialInstructions: cut(event.prompt, MAXIMUM_INSTRUCTIONS_LENGTH) ?? '',
			};
			agents = await $.agent.list();
			await publish($, null);
		}
		return result;
	});

	on('session.send', async ($, event, next) => {
		const message = {
			id: `${sessionId}:${sequence + 1}:send`,
			atMs: await $.clock.now(),
			fromId: event.agentId ?? sessionId,
			toId: event.to,
			text: cut(event.text, MAXIMUM_MESSAGE_LENGTH),
			delivery: 'unknown',
		};
		addMessage(message);
		await publish($, null);
		try {
			const result = await next(event);
			message.delivery = result.isDelivered === false ? 'failed' : 'queued';
			await publish($, null);
			return result;
		} catch (error) {
			message.delivery = 'failed';
			await publish($, null);
			throw error;
		}
	});

	on('session.receive', async ($, event, next) => {
		const origin = /** @type {Record<string, unknown>} */ (event.origin);
		addMessage({
			id: `${sessionId}:${sequence + 1}:receive`,
			atMs: await $.clock.now(),
			fromId: typeof origin.teammate === 'string' ? origin.teammate : origin.kind === 'coordinator' ? sessionId : String(origin.kind),
			toId: event.agentId ?? sessionId,
			text: cut(event.text, MAXIMUM_MESSAGE_LENGTH),
			delivery: 'received',
		});
		await publish($, null);
		return next(event);
	});

	on('tool.check', async ($, event, next) => {
		const result = await next(event);
		if (result.decision === 'ask' && event.tool_use_id !== undefined) {
			pendingRequests[event.tool_use_id] = {
				id: event.tool_use_id,
				agentId: event.agentId ?? null,
				kind: event.tool === 'AskUserQuestion' ? 'question' : 'approval',
				tool: event.tool,
				summary: summarize(event.tool, event.input),
				atMs: await $.clock.now(),
			};
			await publish($, null);
		}
		return result;
	});

	on('tool.call', async ($, event, next) => {
		if (event.tool === 'AskUserQuestion') {
			pendingRequests[event.tool_use_id] = {
				id: event.tool_use_id,
				agentId: event.agentId ?? null,
				kind: 'question',
				tool: event.tool,
				summary: summarize(event.tool, {
					questions: event.questions,
				}),
				atMs: await $.clock.now(),
			};
			await publish($, null);
		}
		try {
			return await next(event);
		} finally {
			delete pendingRequests[event.tool_use_id];
			await publish($, null);
		}
	});

	on('turn.complete', async ($, event, next) => {
		const agentId = event.agentId ?? null;
		for (const [id, request] of Object.entries(pendingRequests)) {
			if (request.agentId === agentId) {
				delete pendingRequests[id];
			}
		}
		agents = await $.agent.list();
		if (agentId !== null && spawns[agentId] !== undefined) {
			const agent = agents.find((candidate) => candidate.id === agentId);
			const isRunning = agent !== undefined && (agent.status === 'running' || agent.status === 'pending');
			spawns[agentId].endedAtMs = isRunning ? null : await $.clock.now();
		}
		await publish($, null);
		return next(event);
	});
	return undefined;
};
