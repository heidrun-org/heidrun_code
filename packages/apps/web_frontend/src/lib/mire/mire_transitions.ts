import { MireMessages } from './mire_messages';
import type { MireMessage, MireModel, MireSubagentNode, MireVisibleStatus } from './mire_model_types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MireTransitions — the real changes between two successive Mire models of one open view
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The shortest time between two light-ups of one key of the keyboard of Heidrun, in milliseconds. */
const KEYBOARD_SHORTEST_PERIOD_MS = 250;

/** The time between two light-ups of one key with one working coding agent, in milliseconds. */
const KEYBOARD_PERIOD_FOR_ONE_MS = 1_600;

/** What the transitions keep from the previous models of one open view. */
export type MireTransitionState = {
	/**
	 * The last known status of each coding agent and each subagent seen since the view opened. The status `unknown`
	 * never replaces a known status, and a node that disappears keeps its last known status, so that a stale period or
	 * a reconnection of the collector does not give a second completion.
	 */
	knownStatuses: Map<string, MireVisibleStatus>;
	/** The message identifiers seen since the first observation of the view, or null before the first observation. */
	seenMessageIds: Set<string> | null;
};

/** One real change, observed between two successive models. */
export type MireTransition =
	| {
		/** A coding agent or a subagent changed from a known status that is not Finished to Finished. */
		kind: 'completed';
		/** The node identifier. */
		nodeId: string;
	}
	| {
		/** A coding agent or a subagent changed from a known status that is not Blocked to Blocked. */
		kind: 'blocked';
		/** The node identifier. */
		nodeId: string;
	}
	| {
		/** A message that was not seen before. */
		kind: 'message';
		/** The message. */
		message: MireMessage;
	};

/** The result of one comparison. */
export type MireTransitionResult = {
	/** The real changes, the status changes first, then the messages by time. */
	transitions: MireTransition[];
	/** The state to give to the next comparison. */
	state: MireTransitionState;
};

/**
 * Turns two successive Mire models into the list of the real transitions: a new completion, a new blocked item, and a
 * new message. The first model of a view gives no transition, so that an opening or a reconnection replays nothing.
 */
export class MireTransitions {
	/**
	 * Compares a model with the state of the previous models.
	 * @param previous The state of the previous models of the view, or null for the first model of the view.
	 * @param model The new Mire model.
	 * @param messages The messages collected from the same observations.
	 * @returns The transitions and the next state.
	 */
	static compare(previous: MireTransitionState | null, model: MireModel, messages: MireMessage[]): MireTransitionResult {
		const transitions: MireTransition[] = [];
		const knownStatuses = new Map(previous?.knownStatuses ?? []);
		for (const [nodeId, status] of MireTransitions.itemStatuses(model)) {
			if (status === 'unknown') {
				continue;
			}
			const knownStatus = knownStatuses.get(nodeId);
			knownStatuses.set(nodeId, status);
			if (previous === null || knownStatus === undefined || knownStatus === status) {
				continue;
			}
			if (status === 'finished') {
				transitions.push({
					kind: 'completed',
					nodeId,
				});
			} else if (status === 'blocked') {
				transitions.push({
					kind: 'blocked',
					nodeId,
				});
			}
		}
		const seenMessageIds = MireTransitions._seenMessageIds(previous, model, messages, transitions);
		return {
			transitions,
			state: {
				knownStatuses,
				seenMessageIds,
			},
		};
	}

	/**
	 * Lists the visible status of each coding agent and each subagent of a model.
	 * @param model The Mire model.
	 * @returns The status of each node, by node identifier.
	 */
	static itemStatuses(model: MireModel): Map<string, MireVisibleStatus> {
		const statuses = new Map<string, MireVisibleStatus>();
		const addSubagent = (subagent: MireSubagentNode): void => {
			statuses.set(subagent.nodeId, subagent.status);
			for (const child of subagent.children) {
				addSubagent(child);
			}
		};
		for (const workspace of model.workspaces) {
			for (const tab of workspace.tabs) {
				for (const codingAgent of tab.codingAgents) {
					statuses.set(codingAgent.nodeId, codingAgent.status);
					for (const subagent of codingAgent.subagents) {
						addSubagent(subagent);
					}
				}
			}
		}
		return statuses;
	}

	/**
	 * Gives the time between two light-ups of one key of the keyboard of Heidrun: the more coding agents work, the
	 * faster the keys light up.
	 * @param workingCodingAgents The number of working coding agents.
	 * @returns The time in milliseconds, or null when no coding agent works and the keyboard stays still.
	 */
	static keyboardPeriodMs(workingCodingAgents: number): number | null {
		if (workingCodingAgents <= 0) {
			return null;
		}
		return Math.max(KEYBOARD_SHORTEST_PERIOD_MS, Math.round(KEYBOARD_PERIOD_FOR_ONE_MS / workingCodingAgents));
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Finds the new messages and adds them to the transitions. Before the first observation, and each time that no
	 * observation is left, the seen identifiers are forgotten, so that the next observation gives no new message.
	 * @param previous The state of the previous models, or null.
	 * @param model The new Mire model.
	 * @param messages The messages.
	 * @param transitions The list where the new messages go.
	 * @returns The message identifiers seen until now, or null when no observation is there.
	 */
	private static _seenMessageIds(
		previous: MireTransitionState | null,
		model: MireModel,
		messages: MireMessage[],
		transitions: MireTransition[],
	): Set<string> | null {
		if (model.observationsState === 'none') {
			return null;
		}
		const result = MireMessages.newSince(messages, previous?.seenMessageIds ?? null);
		for (const message of result.newMessages) {
			transitions.push({
				kind: 'message',
				message,
			});
		}
		return result.seenIds;
	}
}
