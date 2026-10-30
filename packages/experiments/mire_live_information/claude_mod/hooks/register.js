///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Register — exports live Claude Code information without changing decisions
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** @type {string} */
let sessionId = '';
/** @type {string} */
let cwd = '';
/** @type {number} */
let sequence = 0;
/** @type {import('claude-code').AgentInfo[]} */
let agents = [];
/** @type {Record<string, unknown>[]} */
const messages = [];
/** @type {Record<string, Record<string, unknown>>} */
const pendingRequests = {};

/**
 * Publishes one complete snapshot; the reader retries a file still being written.
 * @param {import('claude-code').EngineInterface} $ The mod methods supplied by Claude Code.
 * @returns {Promise<void>} Completion of the observation attempt.
 */
async function publish($) {
	if (sessionId === '') {
		return;
	}
	sequence += 1;
	try {
		await $.fs.write(`/tmp/heidrun_mire_live/${sessionId}.json`, JSON.stringify({
			schemaVersion: 1,
			codingAgent: 'claude',
			sessionId,
			cwd,
			observedAtMs: await $.clock.now(),
			sequence,
			agents,
			messages,
			pendingRequests: Object.values(pendingRequests),
		}));
	} catch {
		// Observation cannot change a tool or approval result. The reader detects a stale or absent file.
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
		sessionId = await $.session.id();
		cwd = await $.session.cwd();
		agents = await $.agent.list();
		await publish($);
		$.clock.every(500, async () => {
			agents = await $.agent.list();
			await publish($);
		});
		return next(event);
	});

	on('session.end', async ($, event, next) => {
		await publish($);
		return next(event);
	});

	on('session.send', async ($, event, next) => {
		const message = {
			id: `${sessionId}:${sequence + 1}:send`,
			atMs: await $.clock.now(),
			direction: 'send',
			data: event,
			delivery: 'attempted',
		};
		messages.push(message);
		messages.splice(0, Math.max(0, messages.length - 200));
		await publish($);
		try {
			const result = await next(event);
			message.delivery = result.isDelivered === false ? 'failed' : 'queued';
			await publish($);
			return result;
		} catch (error) {
			message.delivery = 'failed';
			await publish($);
			throw error;
		}
	});

	on('session.receive', async ($, event, next) => {
		messages.push({
			id: `${sessionId}:${sequence + 1}:receive`,
			atMs: await $.clock.now(),
			direction: 'receive',
			data: event,
			delivery: 'received_by_hook',
		});
		messages.splice(0, Math.max(0, messages.length - 200));
		await publish($);
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
				input: event.input,
				atMs: await $.clock.now(),
			};
			await publish($);
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
				input: {
					questions: event.questions,
				},
				atMs: await $.clock.now(),
			};
			await publish($);
		}
		try {
			return await next(event);
		} finally {
			delete pendingRequests[event.tool_use_id];
			await publish($);
		}
	});

	on('turn.complete', async ($, event, next) => {
		for (const [id, request] of Object.entries(pendingRequests)) {
			if (request.agentId === (event.agentId ?? null)) {
				delete pendingRequests[id];
			}
		}
		agents = await $.agent.list();
		await publish($);
		return next(event);
	});
	return undefined;
};
