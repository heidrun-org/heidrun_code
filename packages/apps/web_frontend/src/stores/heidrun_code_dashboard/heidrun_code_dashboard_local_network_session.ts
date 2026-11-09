import { reactive } from 'vue';
import type { SessionSnapshot } from '../../lib/types';
import type { HeidrunCodeDashboardObservations } from '../../lib/heidrun_code_dashboard/observation_types';
import { state as sessionState } from '../session';
import { HeidrunCodeDashboardStore, heidrunCodeDashboardState } from './heidrun_code_dashboard_store';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunCodeDashboardLocalNetworkSession — the state of the Heidrun Code Dashboard on the page of a phone or a tablet of the local network
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The address of the state of the Heidrun Code Dashboard on the Heidrun Code Dashboard server. The cookie of the pairing key goes with each request. */
export const HEIDRUN_CODE_DASHBOARD_LOCAL_NETWORK_STATE_PATH = '/heidrun_code_dashboard/api/state';

/** The time between two readings of the state, in milliseconds. */
const READ_INTERVAL_MS = 1_000;

/** The time before the next try after a failed reading, in milliseconds. */
const RETRY_INTERVAL_MS = 3_000;

/** The answer of the Heidrun Code Dashboard server. */
export type HeidrunCodeDashboardLocalNetworkState = {
	/** The Herdr snapshot of Heidrun Code, with the saved workspace folders. */
	snapshot: SessionSnapshot | null;
	/** The latest observations of the one shared collector of the desktop application. */
	observations: HeidrunCodeDashboardObservations | null;
	/** The Herdr socket of Heidrun Code, which the Heidrun Code Dashboard model needs to match a Claude Code session to its pane. */
	herdrSocketPath: string | null;
};

/** The state of the connection of the page to the Heidrun Code Dashboard server. */
export const heidrunCodeDashboardLocalNetworkPageState = reactive({
	/** True after a failed reading, until the next successful reading. */
	isConnectionLost: false,
});

/**
 * Reads the state of the Heidrun Code Dashboard from the Heidrun Code Dashboard server, again and again, and keeps it in the session state and in the Heidrun Code Dashboard
 * state, so that the Heidrun Code Dashboard model reads it as in the desktop application. It only reads: the page has no Tauri bridge, and
 * the Heidrun Code Dashboard server has no route that changes anything.
 */
export class HeidrunCodeDashboardLocalNetworkSession {
	/** The timer of the next reading, or null. */
	private static _timer: number | null = null;
	/** True between `start` and `stop`. */
	private static _isRunning = false;

	/**
	 * Reads the state once, then again every second.
	 * @returns A promise that resolves after the first reading.
	 */
	static async start(): Promise<void> {
		HeidrunCodeDashboardLocalNetworkSession._isRunning = true;
		await HeidrunCodeDashboardLocalNetworkSession._readAndSchedule();
	}

	/** Stops the readings. The tests use it. */
	static stop(): void {
		HeidrunCodeDashboardLocalNetworkSession._isRunning = false;
		if (HeidrunCodeDashboardLocalNetworkSession._timer !== null) {
			window.clearTimeout(HeidrunCodeDashboardLocalNetworkSession._timer);
			HeidrunCodeDashboardLocalNetworkSession._timer = null;
		}
	}

	/**
	 * Reads the state now, and keeps it.
	 * @returns True when the Heidrun Code Dashboard server answered with a state.
	 */
	static async read(): Promise<boolean> {
		try {
			const response = await fetch(HEIDRUN_CODE_DASHBOARD_LOCAL_NETWORK_STATE_PATH, {
				cache: 'no-store',
				credentials: 'same-origin',
			});
			if (response.ok === false) {
				throw new Error(`${response.status}`);
			}
			HeidrunCodeDashboardLocalNetworkSession.apply(await response.json() as HeidrunCodeDashboardLocalNetworkState, Date.now());
			return true;
		} catch (error) {
			sessionState.connected = false;
			sessionState.error = String(error);
			heidrunCodeDashboardLocalNetworkPageState.isConnectionLost = true;
			return false;
		}
	}

	/**
	 * Keeps one answer of the Heidrun Code Dashboard server.
	 * @param answer The answer.
	 * @param nowMs The time of the answer.
	 */
	static apply(answer: HeidrunCodeDashboardLocalNetworkState, nowMs: number): void {
		sessionState.snapshot = answer.snapshot;
		sessionState.connected = true;
		sessionState.error = '';
		heidrunCodeDashboardState.observations = answer.observations;
		heidrunCodeDashboardState.nowMs = nowMs;
		heidrunCodeDashboardState.herdrSocketPath = answer.herdrSocketPath;
		heidrunCodeDashboardState.herdrSessionName = answer.herdrSocketPath === null ? null : HeidrunCodeDashboardStore.sessionNameOfSocket(answer.herdrSocketPath);
		heidrunCodeDashboardLocalNetworkPageState.isConnectionLost = false;
	}

	/**
	 * Reads the state, then plans the next reading: sooner after a success, later after a failure.
	 * @returns A promise that resolves after the reading.
	 */
	private static async _readAndSchedule(): Promise<void> {
		const isRead = await HeidrunCodeDashboardLocalNetworkSession.read();
		if (HeidrunCodeDashboardLocalNetworkSession._isRunning === false) {
			return;
		}
		HeidrunCodeDashboardLocalNetworkSession._timer = window.setTimeout(() => {
			HeidrunCodeDashboardLocalNetworkSession._timer = null;
			void HeidrunCodeDashboardLocalNetworkSession._readAndSchedule();
		}, isRead === true ? READ_INTERVAL_MS : RETRY_INTERVAL_MS);
	}
}
