import { reactive } from 'vue';
import type { SessionSnapshot } from '../../lib/types';
import type { MireObservations } from '../../lib/mire/observation_types';
import { state as sessionState } from '../session';
import { MireStore, mireState } from './mire_store';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MireLocalNetworkSession — the state of the Mire on the page of a phone or a tablet of the local network
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The address of the state of the Mire on the Mire server. The cookie of the pairing key goes with each request. */
export const MIRE_LOCAL_NETWORK_STATE_PATH = '/mire/api/state';

/** The time between two readings of the state, in milliseconds. */
const READ_INTERVAL_MS = 1_000;

/** The time before the next try after a failed reading, in milliseconds. */
const RETRY_INTERVAL_MS = 3_000;

/** The answer of the Mire server. */
export type MireLocalNetworkState = {
	/** The Herdr snapshot of Heidrun Code, with the saved workspace folders. */
	snapshot: SessionSnapshot | null;
	/** The latest observations of the one shared collector of the desktop application. */
	observations: MireObservations | null;
	/** The Herdr socket of Heidrun Code, which the Mire model needs to match a Claude Code session to its pane. */
	herdrSocketPath: string | null;
};

/** The state of the connection of the page to the Mire server. */
export const mireLocalNetworkPageState = reactive({
	/** True after a failed reading, until the next successful reading. */
	isConnectionLost: false,
});

/**
 * Reads the state of the Mire from the Mire server, again and again, and keeps it in the session state and in the Mire
 * state, so that the Mire model reads it as in the desktop application. It only reads: the page has no Tauri bridge, and
 * the Mire server has no route that changes anything.
 */
export class MireLocalNetworkSession {
	/** The timer of the next reading, or null. */
	private static _timer: number | null = null;
	/** True between `start` and `stop`. */
	private static _isRunning = false;

	/**
	 * Reads the state once, then again every second.
	 * @returns A promise that resolves after the first reading.
	 */
	static async start(): Promise<void> {
		MireLocalNetworkSession._isRunning = true;
		await MireLocalNetworkSession._readAndSchedule();
	}

	/** Stops the readings. The tests use it. */
	static stop(): void {
		MireLocalNetworkSession._isRunning = false;
		if (MireLocalNetworkSession._timer !== null) {
			window.clearTimeout(MireLocalNetworkSession._timer);
			MireLocalNetworkSession._timer = null;
		}
	}

	/**
	 * Reads the state now, and keeps it.
	 * @returns True when the Mire server answered with a state.
	 */
	static async read(): Promise<boolean> {
		try {
			const response = await fetch(MIRE_LOCAL_NETWORK_STATE_PATH, {
				cache: 'no-store',
				credentials: 'same-origin',
			});
			if (response.ok === false) {
				throw new Error(`${response.status}`);
			}
			MireLocalNetworkSession.apply(await response.json() as MireLocalNetworkState, Date.now());
			return true;
		} catch (error) {
			sessionState.connected = false;
			sessionState.error = String(error);
			mireLocalNetworkPageState.isConnectionLost = true;
			return false;
		}
	}

	/**
	 * Keeps one answer of the Mire server.
	 * @param answer The answer.
	 * @param nowMs The time of the answer.
	 */
	static apply(answer: MireLocalNetworkState, nowMs: number): void {
		sessionState.snapshot = answer.snapshot;
		sessionState.connected = true;
		sessionState.error = '';
		mireState.observations = answer.observations;
		mireState.nowMs = nowMs;
		mireState.herdrSocketPath = answer.herdrSocketPath;
		mireState.herdrSessionName = answer.herdrSocketPath === null ? null : MireStore.sessionNameOfSocket(answer.herdrSocketPath);
		mireLocalNetworkPageState.isConnectionLost = false;
	}

	/**
	 * Reads the state, then plans the next reading: sooner after a success, later after a failure.
	 * @returns A promise that resolves after the reading.
	 */
	private static async _readAndSchedule(): Promise<void> {
		const isRead = await MireLocalNetworkSession.read();
		if (MireLocalNetworkSession._isRunning === false) {
			return;
		}
		MireLocalNetworkSession._timer = window.setTimeout(() => {
			MireLocalNetworkSession._timer = null;
			void MireLocalNetworkSession._readAndSchedule();
		}, isRead === true ? READ_INTERVAL_MS : RETRY_INTERVAL_MS);
	}
}
