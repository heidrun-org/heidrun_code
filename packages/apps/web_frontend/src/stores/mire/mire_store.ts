import { computed, reactive, watch, type WatchStopHandle } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import * as api from '../../lib/api';
import { MireMessages } from '../../lib/mire/mire_messages';
import { MireModelBuilder } from '../../lib/mire/mire_model_builder';
import type { MireFreshness, MireMessage, MireModel, MireVisibleStatus } from '../../lib/mire/mire_model_types';
import type { MireObservations } from '../../lib/mire/observation_types';
import { allPanes, selectPane, state as sessionState } from '../session';
import { MireNavigation, type MireNodeEntry, type MireVisibility } from './mire_navigation';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MireStore — the live observations, the Mire model, the selection, and the filter of the Mire views
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The Tauri event that carries each collection of the live observations. */
export const MIRE_OBSERVATIONS_EVENT = 'mire://observations';

/** How often the view checks the age of the observations, in milliseconds, so that a silent collector shows stale. */
const CLOCK_INTERVAL_MS = 2_000;

/** The state of the Mire views of this window. */
export const mireState = reactive({
	/** The last live observations, or null when none arrived. */
	observations: null as MireObservations | null,
	/** The Herdr socket of Heidrun Code, or null before it is known. */
	herdrSocketPath: null as string | null,
	/** The Herdr session of Heidrun Code, or null when the socket path does not name it. */
	herdrSessionName: null as string | null,
	/** The time of the last check of the age of the observations. */
	nowMs: Date.now(),
	/** The error of the last subscription, or null. */
	connectionError: null as string | null,
	/** The node identifiers of the path of the selection, from Heidrun to the selected node. */
	selectedPath: ['heidrun'] as string[],
	/** The freshness of the selected node at the last check. */
	selectedFreshness: null as MireFreshness | null,
	/** The status of the active filter, or null for no filter. */
	filter: null as MireVisibleStatus | null,
});

/** The Mire model, built again when the Herdr data or the observations change. */
export const mireModel = computed<MireModel>(() => MireModelBuilder.build({
	workspaces: sessionState.snapshot?.workspaces ?? [],
	tabs: sessionState.snapshot?.tabs ?? [],
	panes: allPanes.value,
	observations: mireState.observations,
	herdrSessionName: mireState.herdrSessionName,
	herdrSocketPath: mireState.herdrSocketPath,
	nowMs: mireState.nowMs,
}));

/** Every node of the model, by node identifier. */
export const mireIndex = computed<Map<string, MireNodeEntry>>(() => MireNavigation.index(mireModel.value));

/** How each node shows under the active filter. */
export const mireVisibility = computed<Map<string, MireVisibility>>(
	() => MireNavigation.visibility(mireModel.value, mireState.filter),
);

/** The observed messages, each once. */
export const mireMessages = computed<MireMessage[]>(() => MireMessages.collect(mireState.observations, mireModel.value));

/** The selected node, or Heidrun when the selected node is not in the model. */
export const mireSelectedEntry = computed<MireNodeEntry>(() => {
	const selectedNodeId = mireState.selectedPath[mireState.selectedPath.length - 1] ?? 'heidrun';
	return mireIndex.value.get(selectedNodeId) ?? (mireIndex.value.get('heidrun') as MireNodeEntry);
});

/** The path of the selection, from Heidrun to the selected node. */
export const mireSelectedPath = computed<MireNodeEntry[]>(
	() => MireNavigation.path(mireIndex.value, mireSelectedEntry.value.nodeId),
);

/** The number of view connections, to give each view its own identifier. */
let connectionCount = 0;

/**
 * The connection of one Mire view to the shared collector of the desktop application. The collector reads the live
 * sources only while at least one view is registered, so a view opens its connection when it mounts and closes it
 * when it unmounts.
 */
export class MireViewConnection {
	/** The identifier of the view in the shared collector. */
	readonly viewId: string;
	/** True after `close`: a late answer of `open` is then undone at once. */
	private _isClosed = false;
	/** Stops the listening to the event of the observations. */
	private _unlisten: UnlistenFn | null = null;
	/** The timer of the clock. */
	private _clockTimer: number | null = null;
	/** Stops the follower of the selection. */
	private _stopSelectionFollower: WatchStopHandle | null = null;

	/** Builds a connection with a new view identifier. */
	constructor() {
		connectionCount += 1;
		this.viewId = `mire_view_${Date.now()}_${connectionCount}`;
	}

	/**
	 * Registers the view, listens to the observations, and reads the Herdr socket of Heidrun Code.
	 * @returns A promise that resolves when the view is registered.
	 */
	async open(): Promise<void> {
		this._stopSelectionFollower = MireStore.followSelection();
		this._clockTimer = window.setInterval(() => {
			mireState.nowMs = Date.now();
		}, CLOCK_INTERVAL_MS);
		const unlisten = await listen<MireObservations>(MIRE_OBSERVATIONS_EVENT, (event) => {
			mireState.observations = event.payload;
			mireState.nowMs = Date.now();
		});
		if (this.isClosed() === true) {
			unlisten();
			return;
		}
		this._unlisten = unlisten;
		await Promise.all([this._subscribe(), MireStore.readHerdrPaths()]);
		if (this.isClosed() === true) {
			await api.mireUnsubscribe(this.viewId).catch(() => undefined);
		}
	}

	/**
	 * Tells whether the view closed its connection.
	 * @returns True after `close`.
	 */
	isClosed(): boolean {
		return this._isClosed;
	}

	/**
	 * Removes the view from the shared collector and stops listening.
	 * @returns A promise that resolves when the view is removed.
	 */
	async close(): Promise<void> {
		if (this._isClosed === true) {
			return;
		}
		this._isClosed = true;
		this._stopSelectionFollower?.();
		this._stopSelectionFollower = null;
		if (this._clockTimer !== null) {
			window.clearInterval(this._clockTimer);
			this._clockTimer = null;
		}
		if (this._unlisten !== null) {
			this._unlisten();
			this._unlisten = null;
			await api.mireUnsubscribe(this.viewId).catch(() => undefined);
		}
		mireState.observations = null;
	}

	/**
	 * Registers the view and keeps the first observations.
	 * @returns A promise that resolves when the answer arrives.
	 */
	private async _subscribe(): Promise<void> {
		try {
			const observations = await api.mireSubscribe<MireObservations | null>(this.viewId);
			mireState.connectionError = null;
			if (observations !== null && observations !== undefined && this._isClosed === false) {
				mireState.observations = observations;
				mireState.nowMs = Date.now();
			}
		} catch (error) {
			mireState.connectionError = String(error);
		}
	}
}

/** The actions of a Mire view on the selection, the filter, and the main window. */
export class MireStore {
	/**
	 * Selects a node.
	 * @param nodeId The node identifier.
	 */
	static select(nodeId: string): void {
		const path = MireNavigation.path(mireIndex.value, nodeId);
		if (path.length === 0) {
			return;
		}
		mireState.selectedPath = path.map((entry) => entry.nodeId);
		mireState.selectedFreshness = path[path.length - 1].freshness;
	}

	/** Selects Heidrun again. */
	static clearSelection(): void {
		MireStore.select('heidrun');
	}

	/**
	 * Turns a status filter on, or off when the same status is chosen again.
	 * @param status The status.
	 */
	static toggleFilter(status: MireVisibleStatus): void {
		mireState.filter = mireState.filter === status ? null : status;
	}

	/** Shows every node again. */
	static clearFilter(): void {
		mireState.filter = null;
	}

	/**
	 * Follows the model and the filter: when the selected node disappears, hides, or becomes stale, the selection moves
	 * to its nearest ancestor that shows.
	 * @returns The function that stops the follower.
	 */
	static followSelection(): WatchStopHandle {
		return watch([mireIndex, mireVisibility], ([index, visibility]) => {
			const nodeId = MireNavigation.resolveSelection(
				mireState.selectedPath,
				mireState.selectedFreshness,
				index,
				visibility,
			);
			const path = MireNavigation.path(index, nodeId).map((entry) => entry.nodeId);
			if (path.join('\n') !== mireState.selectedPath.join('\n')) {
				mireState.selectedPath = path;
			}
			mireState.selectedFreshness = index.get(nodeId)?.freshness ?? null;
		});
	}

	/**
	 * Reads the Herdr socket of Heidrun Code, and the session name that the socket path holds.
	 * @returns A promise that resolves when the paths are read.
	 */
	static async readHerdrPaths(): Promise<void> {
		try {
			const paths = await api.paths();
			mireState.herdrSocketPath = paths.socket;
			mireState.herdrSessionName = MireStore.sessionNameOfSocket(paths.socket);
		} catch {
			mireState.herdrSocketPath = null;
			mireState.herdrSessionName = null;
		}
	}

	/**
	 * Gives the Herdr session name that a socket path holds: `<configuration>/sessions/<name>/herdr.sock`.
	 * @param socketPath The socket path.
	 * @returns The session name, or null when the path has another form, for example a path set by `HERDR_SOCKET_PATH`.
	 */
	static sessionNameOfSocket(socketPath: string): string | null {
		const match = /\/sessions\/([^/]+)\/herdr\.sock$/.exec(socketPath);
		return match === null ? null : match[1];
	}

	/**
	 * Shows the pane of a coding agent in the main window: its workspace, its tab, and the pane itself.
	 * @param paneId The pane identifier.
	 * @returns True when the pane exists and is selected.
	 */
	static openInHeidrunCode(paneId: string): boolean {
		const pane = allPanes.value.find((candidate) => candidate.pane_id === paneId);
		if (pane === undefined) {
			return false;
		}
		selectPane(pane);
		return true;
	}

	/**
	 * Reads the end of the transcript of one Claude Code subagent, from the chat session files of Claude Code.
	 * @param sessionId The Claude Code session of the coding agent.
	 * @param subagentId The identifier of the subagent in its session.
	 * @returns The last lines of the transcript, or null when the transcript is not found.
	 */
	static async readClaudeSubagentTranscript(sessionId: string, subagentId: string): Promise<string[] | null> {
		const transcripts = await invoke<{ id: string; lines: string[] }[]>('claude_session_agents', {
			sessionId,
			lines: 40,
		});
		return transcripts.find((transcript) => transcript.id === subagentId)?.lines ?? null;
	}
}
