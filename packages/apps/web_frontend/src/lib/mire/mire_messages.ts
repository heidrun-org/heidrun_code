import type { MireMessage, MireMessageEndpoint, MireModel, MireSubagentNode } from './mire_model_types';
import type { MessageObservation, MireObservations } from './observation_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MireMessages — the observed messages, deduplicated, with their ends linked to the nodes of the Mire model
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The order of the delivery steps: a later step replaces an earlier one for the same message. */
const DELIVERY_RANK: Record<MireMessage['delivery'], number> = {
	unknown: 0,
	queued: 1,
	received: 2,
	failed: 2,
};

/** The result of a search of the new messages. */
export type MireNewMessages = {
	/** The messages that were not seen before, by time. */
	newMessages: MireMessage[];
	/** Every identifier seen until now, to give to the next search. */
	seenIds: Set<string>;
};

/** The identifiers that link an identifier of a source to a node of the Mire model. */
type EndpointIndex = {
	/** The subagent identifiers of each Claude Code session: `<session>\n<subagent>` to the node. */
	scoped: Map<string, string>;
	/** Every session, chat, and subagent identifier to its nodes. More than one node: the identifier is ambiguous. */
	global: Map<string, Set<string>>;
};

/** Collects the observed messages and finds the new ones. */
export class MireMessages {
	/**
	 * Lists the observed messages, each once, with their ends linked to the nodes of the model when an explicit
	 * identifier links them. A name never links a message to a node.
	 * @param observations The live observations, or null.
	 * @param model The Mire model built from the same observations.
	 * @returns The messages, by time, then by identifier.
	 */
	static collect(observations: MireObservations | null, model: MireModel): MireMessage[] {
		if (observations === null) {
			return [];
		}
		const index = MireMessages._index(model);
		const byId = new Map<string, MireMessage>();
		const add = (message: MireMessage): void => {
			const previous = byId.get(message.id);
			if (previous !== undefined && DELIVERY_RANK[previous.delivery] >= DELIVERY_RANK[message.delivery]) {
				return;
			}
			byId.set(message.id, message);
		};
		for (const session of observations.claude.sessions) {
			for (const message of session.messages) {
				add(MireMessages._message(message, 'claude_observer', session.sessionId, index));
			}
		}
		for (const thread of observations.codex.threads) {
			for (const message of thread.interactions) {
				add(MireMessages._message(message, 'codex_server', thread.threadId, index));
			}
		}
		return [...byId.values()].sort((left, right) => left.atMs - right.atMs || left.id.localeCompare(right.id));
	}

	/**
	 * Finds the messages that were not seen before. With no previous set (the first opening of a view, or a
	 * reconnection that lost the set), no message is new, so that old messages are never shown as new.
	 * @param messages The current messages.
	 * @param seenIds The identifiers seen until now, or null when there is no previous set.
	 * @returns The new messages and the identifiers seen until now.
	 */
	static newSince(messages: MireMessage[], seenIds: ReadonlySet<string> | null): MireNewMessages {
		const nextSeenIds = new Set(seenIds ?? []);
		const newMessages: MireMessage[] = [];
		for (const message of messages) {
			if (nextSeenIds.has(message.id) === true) {
				continue;
			}
			nextSeenIds.add(message.id);
			if (seenIds !== null) {
				newMessages.push(message);
			}
		}
		return {
			newMessages,
			seenIds: nextSeenIds,
		};
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Builds one message record.
	 * @param message The observation of the message.
	 * @param source The source of the message.
	 * @param containerId The Claude Code session or the Codex chat where the source observed the message.
	 * @param index The identifiers of the nodes.
	 * @returns The message record.
	 */
	private static _message(
		message: MessageObservation,
		source: MireMessage['source'],
		containerId: string,
		index: EndpointIndex,
	): MireMessage {
		const scope = source === 'claude_observer' ? containerId : null;
		return {
			id: `${source}:${containerId}:${message.id}`,
			nativeId: message.id,
			source,
			containerId,
			atMs: message.atMs,
			from: MireMessages._endpoint(message.fromId, scope, index),
			to: message.toId === null ? null : MireMessages._endpoint(message.toId, scope, index),
			text: message.contentAvailability === 'available' ? message.text : null,
			contentAvailability: message.contentAvailability,
			delivery: message.delivery,
		};
	}

	/**
	 * Links one identifier of a source to a node.
	 * @param nativeId The identifier that the source gives.
	 * @param sessionId The Claude Code session of the message, where a subagent identifier is unique, or null.
	 * @param index The identifiers of the nodes.
	 * @returns The end, resolved only when the identifier links to exactly one node.
	 */
	private static _endpoint(nativeId: string, sessionId: string | null, index: EndpointIndex): MireMessageEndpoint {
		const scopedNodeId = sessionId === null ? undefined : index.scoped.get(`${sessionId}\n${nativeId}`);
		if (scopedNodeId !== undefined) {
			return {
				nativeId,
				nodeId: scopedNodeId,
				state: 'resolved',
			};
		}
		const nodeIds = index.global.get(nativeId);
		if (nodeIds === undefined || nodeIds.size !== 1) {
			return {
				nativeId,
				nodeId: null,
				state: 'unmatched',
			};
		}
		return {
			nativeId,
			nodeId: [...nodeIds][0],
			state: 'resolved',
		};
	}

	/**
	 * Indexes the identifiers of the coding agents and of the subagents of the model.
	 * @param model The Mire model.
	 * @returns The index.
	 */
	private static _index(model: MireModel): EndpointIndex {
		const index: EndpointIndex = {
			scoped: new Map(),
			global: new Map(),
		};
		const addGlobal = (nativeId: string, nodeId: string): void => {
			const nodeIds = index.global.get(nativeId) ?? new Set<string>();
			nodeIds.add(nodeId);
			index.global.set(nativeId, nodeIds);
		};
		const addSubagent = (subagent: MireSubagentNode, sessionId: string | null): void => {
			if (subagent.source === 'claude_observer' && sessionId !== null) {
				index.scoped.set(`${sessionId}\n${subagent.nativeId}`, subagent.nodeId);
			}
			addGlobal(subagent.nativeId, subagent.nodeId);
			for (const child of subagent.children) {
				addSubagent(child, sessionId);
			}
		};
		for (const workspace of model.workspaces) {
			for (const tab of workspace.tabs) {
				for (const codingAgent of tab.codingAgents) {
					const chatId = codingAgent.chat.state === 'matched' ? codingAgent.chat.chatId : null;
					if (chatId !== null) {
						addGlobal(chatId, codingAgent.nodeId);
					}
					for (const subagent of codingAgent.subagents) {
						addSubagent(subagent, codingAgent.agent === 'claude' ? chatId : null);
					}
				}
			}
		}
		return index;
	}
}
