import { computed, reactive, watch, type WatchStopHandle } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import * as api from '../../lib/api';
import { HeidrunCodeDashboardMessages } from '../../lib/heidrun_code_dashboard/heidrun_code_dashboard_messages';
import { HeidrunCodeDashboardModelBuilder } from '../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_builder';
import type { HeidrunCodeDashboardFreshness, HeidrunCodeDashboardMessage, HeidrunCodeDashboardModel, HeidrunCodeDashboardVisibleStatus } from '../../lib/heidrun_code_dashboard/heidrun_code_dashboard_model_types';
import type { HeidrunCodeDashboardObservations } from '../../lib/heidrun_code_dashboard/observation_types';
import {
	allPanes,
	refresh as refreshSession,
	selectPane,
	selectTab,
	selectWorkspace,
	state as sessionState,
} from '../session';
import { HeidrunCodeDashboardWindowSession } from './heidrun_code_dashboard_window_session';
import { HeidrunCodeDashboardNavigation, type HeidrunCodeDashboardNodeEntry, type HeidrunCodeDashboardVisibility } from './heidrun_code_dashboard_navigation';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunCodeDashboardStore — the live observations, the Heidrun Code Dashboard model, the selection, and the filter of the Heidrun Code Dashboard views
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The Tauri event that carries each collection of the live observations. */
export const HEIDRUN_CODE_DASHBOARD_OBSERVATIONS_EVENT = 'heidrun_code_dashboard://observations';

/**
 * Where the Heidrun Code Dashboard views of this window show: in the modal over the main window, in the separate Heidrun Code Dashboard window, or in the web
 * browser of a phone or a tablet of the local network (`localNetwork`), which only reads the Heidrun Code Dashboard server (issue 978).
 */
export type HeidrunCodeDashboardDisplayMode = 'modal' | 'window' | 'localNetwork';

/**
 * What "Open in Heidrun Code" shows in the main window: a workspace, a tab, or the pane of a coding agent. A double click
 * on the graph opens the three kinds, and the button "Open in Heidrun Code" opens a pane.
 */
export type HeidrunCodeDashboardOpenTarget = {
	/** The kind of the target. */
	kind: 'workspace' | 'tab' | 'pane';
	/** The Herdr identifier of the workspace, of the tab, or of the pane. */
	id: string;
};

/**
 * What "Open in Heidrun Code" did: `opened` shows the target in the main window, `gone` found no such target in the
 * Herdr snapshot read just before, and `unavailable` could not read the Herdr snapshot.
 */
export type HeidrunCodeDashboardOpenResult = 'opened' | 'gone' | 'unavailable';

/** How often the view checks the age of the observations, in milliseconds, so that a silent collector shows stale. */
const CLOCK_INTERVAL_MS = 2_000;

/** The state of the Heidrun Code Dashboard views of this window. */
export const heidrunCodeDashboardState = reactive({
	/** The last live observations, or null when none arrived. */
	observations: null as HeidrunCodeDashboardObservations | null,
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
	selectedFreshness: null as HeidrunCodeDashboardFreshness | null,
	/** The status of the active filter, or null for no filter. */
	filter: null as HeidrunCodeDashboardVisibleStatus | null,
	/** Why the last "Open in Heidrun Code" opened nothing, or null. */
	openFailure: null as Exclude<HeidrunCodeDashboardOpenResult, 'opened'> | null,
	/** Where the Heidrun Code Dashboard views of this window show. `start_heidrun_code_dashboard_window.ts` sets `window` before it mounts the view. */
	displayMode: 'modal' as HeidrunCodeDashboardDisplayMode,
});

/** The Heidrun Code Dashboard model, built again when the Herdr data or the observations change. */
export const heidrunCodeDashboardModel = computed<HeidrunCodeDashboardModel>(() => HeidrunCodeDashboardModelBuilder.build({
	workspaces: sessionState.snapshot?.workspaces ?? [],
	tabs: sessionState.snapshot?.tabs ?? [],
	panes: allPanes.value,
	observations: heidrunCodeDashboardState.observations,
	herdrSessionName: heidrunCodeDashboardState.herdrSessionName,
	herdrSocketPath: heidrunCodeDashboardState.herdrSocketPath,
	nowMs: heidrunCodeDashboardState.nowMs,
}));

/**
 * True on the page of a device of the local network: the page reaches no pane, so "Open in Heidrun Code", the terminal
 * preview, and the transcript preview do not show.
 */
export const heidrunCodeDashboardIsOnLocalNetwork = computed<boolean>(() => heidrunCodeDashboardState.displayMode === 'localNetwork');

/** Every node of the model, by node identifier. */
export const heidrunCodeDashboardIndex = computed<Map<string, HeidrunCodeDashboardNodeEntry>>(() => HeidrunCodeDashboardNavigation.index(heidrunCodeDashboardModel.value));

/** How each node shows under the active filter. */
export const heidrunCodeDashboardVisibility = computed<Map<string, HeidrunCodeDashboardVisibility>>(
	() => HeidrunCodeDashboardNavigation.visibility(heidrunCodeDashboardModel.value, heidrunCodeDashboardState.filter),
);

/** The observed messages, each once. */
export const heidrunCodeDashboardMessages = computed<HeidrunCodeDashboardMessage[]>(() => HeidrunCodeDashboardMessages.collect(heidrunCodeDashboardState.observations, heidrunCodeDashboardModel.value));

/** The selected node, or Heidrun when the selected node is not in the model. */
export const heidrunCodeDashboardSelectedEntry = computed<HeidrunCodeDashboardNodeEntry>(() => {
	const selectedNodeId = heidrunCodeDashboardState.selectedPath[heidrunCodeDashboardState.selectedPath.length - 1] ?? 'heidrun';
	return heidrunCodeDashboardIndex.value.get(selectedNodeId) ?? (heidrunCodeDashboardIndex.value.get('heidrun') as HeidrunCodeDashboardNodeEntry);
});

/** The path of the selection, from Heidrun to the selected node. */
export const heidrunCodeDashboardSelectedPath = computed<HeidrunCodeDashboardNodeEntry[]>(
	() => HeidrunCodeDashboardNavigation.path(heidrunCodeDashboardIndex.value, heidrunCodeDashboardSelectedEntry.value.nodeId),
);

/** The number of view connections, to give each view its own identifier. */
let connectionCount = 0;

/**
 * The connection of one Heidrun Code Dashboard view to the shared collector of the desktop application. The collector reads the live
 * sources only while at least one view is registered, so a view opens its connection when it mounts and closes it
 * when it unmounts.
 */
export class HeidrunCodeDashboardViewConnection {
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
		this.viewId = `heidrun_code_dashboard_view_${heidrunCodeDashboardState.displayMode}_${Date.now()}_${connectionCount}`;
	}

	/**
	 * Registers the view, listens to the observations, and reads the Herdr socket of Heidrun Code.
	 * @returns A promise that resolves when the view is registered.
	 */
	async open(): Promise<void> {
		this._stopSelectionFollower = HeidrunCodeDashboardStore.followSelection();
		this._clockTimer = window.setInterval(() => {
			heidrunCodeDashboardState.nowMs = Date.now();
		}, CLOCK_INTERVAL_MS);
		if (heidrunCodeDashboardState.displayMode === 'localNetwork') {
			// The page of a device has no Tauri bridge: `HeidrunCodeDashboardLocalNetworkSession` reads the Heidrun Code Dashboard server.
			return;
		}
		const unlisten = await listen<HeidrunCodeDashboardObservations>(HEIDRUN_CODE_DASHBOARD_OBSERVATIONS_EVENT, (event) => {
			heidrunCodeDashboardState.observations = event.payload;
			heidrunCodeDashboardState.nowMs = Date.now();
		});
		if (this.isClosed() === true) {
			unlisten();
			return;
		}
		this._unlisten = unlisten;
		await Promise.all([this._subscribe(), HeidrunCodeDashboardStore.readHerdrPaths()]);
		if (this.isClosed() === true) {
			await api.heidrunCodeDashboardUnsubscribe(this.viewId).catch(() => undefined);
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
			await api.heidrunCodeDashboardUnsubscribe(this.viewId).catch(() => undefined);
		}
		heidrunCodeDashboardState.observations = null;
		heidrunCodeDashboardState.openFailure = null;
	}

	/**
	 * Registers the view and keeps the first observations.
	 * @returns A promise that resolves when the answer arrives.
	 */
	private async _subscribe(): Promise<void> {
		try {
			const observations = await api.heidrunCodeDashboardSubscribe<HeidrunCodeDashboardObservations | null>(this.viewId);
			heidrunCodeDashboardState.connectionError = null;
			if (observations !== null && observations !== undefined && this._isClosed === false) {
				heidrunCodeDashboardState.observations = observations;
				heidrunCodeDashboardState.nowMs = Date.now();
			}
		} catch (error) {
			heidrunCodeDashboardState.connectionError = String(error);
		}
	}
}

/** The actions of a Heidrun Code Dashboard view on the selection, the filter, and the main window. */
export class HeidrunCodeDashboardStore {
	/**
	 * Selects a node.
	 * @param nodeId The node identifier.
	 */
	static select(nodeId: string): void {
		const path = HeidrunCodeDashboardNavigation.path(heidrunCodeDashboardIndex.value, nodeId);
		if (path.length === 0) {
			return;
		}
		heidrunCodeDashboardState.selectedPath = path.map((entry) => entry.nodeId);
		heidrunCodeDashboardState.selectedFreshness = path[path.length - 1].freshness;
	}

	/** Selects Heidrun again. */
	static clearSelection(): void {
		HeidrunCodeDashboardStore.select('heidrun');
	}

	/**
	 * Turns a status filter on, or off when the same status is chosen again.
	 * @param status The status.
	 */
	static toggleFilter(status: HeidrunCodeDashboardVisibleStatus): void {
		heidrunCodeDashboardState.filter = heidrunCodeDashboardState.filter === status ? null : status;
	}

	/** Shows every node again. */
	static clearFilter(): void {
		heidrunCodeDashboardState.filter = null;
	}

	/**
	 * Follows the model and the filter: when the selected node disappears, hides, or becomes stale, the selection moves
	 * to its nearest ancestor that shows.
	 * @returns The function that stops the follower.
	 */
	static followSelection(): WatchStopHandle {
		return watch([heidrunCodeDashboardIndex, heidrunCodeDashboardVisibility], ([index, visibility]) => {
			const nodeId = HeidrunCodeDashboardNavigation.resolveSelection(
				heidrunCodeDashboardState.selectedPath,
				heidrunCodeDashboardState.selectedFreshness,
				index,
				visibility,
			);
			const path = HeidrunCodeDashboardNavigation.path(index, nodeId).map((entry) => entry.nodeId);
			if (path.join('\n') !== heidrunCodeDashboardState.selectedPath.join('\n')) {
				heidrunCodeDashboardState.selectedPath = path;
			}
			heidrunCodeDashboardState.selectedFreshness = index.get(nodeId)?.freshness ?? null;
		});
	}

	/**
	 * Reads the Herdr socket of Heidrun Code, and the session name that the socket path holds.
	 * @returns A promise that resolves when the paths are read.
	 */
	static async readHerdrPaths(): Promise<void> {
		try {
			const paths = await api.paths();
			heidrunCodeDashboardState.herdrSocketPath = paths.socket;
			heidrunCodeDashboardState.herdrSessionName = HeidrunCodeDashboardStore.sessionNameOfSocket(paths.socket);
		} catch {
			heidrunCodeDashboardState.herdrSocketPath = null;
			heidrunCodeDashboardState.herdrSessionName = null;
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
	 * Shows a workspace, a tab, or the pane of a coding agent in the main window. The Herdr snapshot is read again just
	 * before, so that a pane that moved opens at its current place, and a target that is gone opens nothing. The separate
	 * Heidrun Code Dashboard window asks the main window, which reads the snapshot again before it selects the target.
	 * @param target The workspace, the tab, or the pane.
	 * @returns What happened.
	 */
	static async openInHeidrunCode(target: HeidrunCodeDashboardOpenTarget): Promise<HeidrunCodeDashboardOpenResult> {
		heidrunCodeDashboardState.openFailure = null;
		const result = await HeidrunCodeDashboardStore._openInHeidrunCode(target);
		heidrunCodeDashboardState.openFailure = result === 'opened' ? null : result;
		return result;
	}

	/** Removes the message of the last "Open in Heidrun Code" that opened nothing. */
	static clearOpenFailure(): void {
		heidrunCodeDashboardState.openFailure = null;
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

	/**
	 * Sets where the Heidrun Code Dashboard views of this window show. `start_heidrun_code_dashboard_window.ts` calls it with `window`.
	 * @param displayMode The display mode of this window.
	 */
	static useDisplayMode(displayMode: HeidrunCodeDashboardDisplayMode): void {
		heidrunCodeDashboardState.displayMode = displayMode;
	}

	/**
	 * Reads the Herdr snapshot of the main window again.
	 * @returns True when Herdr answered.
	 */
	private static async _refreshMainWindow(): Promise<boolean> {
		await refreshSession();
		return sessionState.connected;
	}

	/**
	 * Reads the Herdr snapshot again, then shows the target in the main window, or asks the main window to show it.
	 * @param target The workspace, the tab, or the pane.
	 * @returns What happened.
	 */
	private static async _openInHeidrunCode(target: HeidrunCodeDashboardOpenTarget): Promise<HeidrunCodeDashboardOpenResult> {
		if (heidrunCodeDashboardState.displayMode === 'localNetwork') {
			return 'unavailable';
		}
		const isRead = heidrunCodeDashboardState.displayMode === 'window' ? await HeidrunCodeDashboardWindowSession.refresh() : await HeidrunCodeDashboardStore._refreshMainWindow();
		if (isRead === false) {
			return 'unavailable';
		}
		if (HeidrunCodeDashboardStore._exists(target) === false) {
			return 'gone';
		}
		if (heidrunCodeDashboardState.displayMode === 'window') {
			try {
				await api.heidrunCodeDashboardOpenInMainWindow(target);
			} catch {
				return 'unavailable';
			}
			return 'opened';
		}
		HeidrunCodeDashboardStore._select(target);
		return 'opened';
	}

	/**
	 * Tells whether the target is in the Herdr snapshot.
	 * @param target The workspace, the tab, or the pane.
	 * @returns True when the snapshot has the target.
	 */
	private static _exists(target: HeidrunCodeDashboardOpenTarget): boolean {
		if (target.kind === 'pane') {
			return allPanes.value.some((pane) => pane.pane_id === target.id);
		}
		if (target.kind === 'tab') {
			return (sessionState.snapshot?.tabs ?? []).some((tab) => tab.tab_id === target.id);
		}
		return (sessionState.snapshot?.workspaces ?? []).some((workspace) => workspace.workspace_id === target.id);
	}

	/**
	 * Selects the target in the main window: the workspace, the tab with its workspace, or the pane with its tab and its
	 * workspace. The target must be in the Herdr snapshot.
	 * @param target The workspace, the tab, or the pane.
	 */
	private static _select(target: HeidrunCodeDashboardOpenTarget): void {
		if (target.kind === 'pane') {
			const pane = allPanes.value.find((candidate) => candidate.pane_id === target.id);
			if (pane !== undefined) {
				selectPane(pane);
			}
			return;
		}
		if (target.kind === 'tab') {
			const tab = (sessionState.snapshot?.tabs ?? []).find((candidate) => candidate.tab_id === target.id);
			if (tab !== undefined) {
				selectWorkspace(tab.workspace_id);
				selectTab(tab.tab_id);
			}
			return;
		}
		selectWorkspace(target.id);
	}
}
