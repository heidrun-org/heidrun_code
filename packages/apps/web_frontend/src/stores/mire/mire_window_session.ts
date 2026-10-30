import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import * as api from '../../lib/api';
import { FinishedStatus } from '../../lib/finished_status';
import { state as sessionState } from '../session';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MireWindowSession — the Herdr snapshot of the separate Mire window, with none of the side effects of the main window
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The key of `localStorage` where the main window keeps the Finished cards that the developer closed. */
const DISMISSED_KEY = 'heidrun.dismissed';

/** The delay between a Herdr event and the reading of the snapshot, so that many events in a row give one reading. */
const EVENT_DELAY_MS = 120;

/** The Herdr events that the desktop application sends to every window. */
const HERDR_EVENTS = ['herdr://event', 'herdr://connected', 'herdr://resync'] as const;

/**
 * Keeps the Herdr snapshot of the separate Mire window in the session state, so that the Mire model reads it as in the
 * main window. It only reads: it never notifies, never pushes to the phone, never reads the menus of a blocked agent,
 * never changes the selection, and never starts the Herdr server. The main window does all of this once.
 */
export class MireWindowSession {
	/** The timer of the next reading, or null. */
	private static _timer: number | null = null;
	/** The reading that runs now, or null. */
	private static _reading: Promise<boolean> | null = null;
	/** A reading was asked while another reading ran. */
	private static _isReadingAgain = false;
	/** The functions that stop the listening. */
	private static _unlistenList: UnlistenFn[] = [];

	/**
	 * Listens to the Herdr events that the desktop application sends to every window, then reads the snapshot once.
	 * @returns A promise that resolves after the first reading.
	 */
	static async start(): Promise<void> {
		for (const eventName of HERDR_EVENTS) {
			MireWindowSession._unlistenList.push(await listen(eventName, () => MireWindowSession._schedule()));
		}
		MireWindowSession._unlistenList.push(await listen<string>('herdr://disconnected', (event) => {
			sessionState.connected = false;
			sessionState.error = event.payload;
		}));
		window.addEventListener('storage', MireWindowSession._onStorage);
		await MireWindowSession.refresh();
	}

	/** Stops the listening. The tests use it. */
	static stop(): void {
		for (const unlisten of MireWindowSession._unlistenList) {
			unlisten();
		}
		MireWindowSession._unlistenList = [];
		window.removeEventListener('storage', MireWindowSession._onStorage);
		if (MireWindowSession._timer !== null) {
			window.clearTimeout(MireWindowSession._timer);
			MireWindowSession._timer = null;
		}
	}

	/**
	 * Reads the Herdr snapshot now and keeps it in the session state.
	 * @returns True when the snapshot was read, false when Herdr did not answer.
	 */
	static async refresh(): Promise<boolean> {
		if (MireWindowSession._reading !== null) {
			MireWindowSession._isReadingAgain = true;
			return MireWindowSession._reading;
		}
		MireWindowSession._reading = MireWindowSession._read();
		try {
			return await MireWindowSession._reading;
		} finally {
			MireWindowSession._reading = null;
		}
	}

	/**
	 * Reads the snapshot, and reads it again when a reading was asked in the meantime.
	 * @returns True when the snapshot was read, false when Herdr did not answer.
	 */
	private static async _read(): Promise<boolean> {
		try {
			do {
				MireWindowSession._isReadingAgain = false;
				const snapshot = await api.snapshot();
				sessionState.snapshot = FinishedStatus.apply(snapshot, sessionState.dismissed);
				sessionState.connected = true;
				sessionState.error = '';
			} while ((MireWindowSession._isReadingAgain as boolean) === true);
			return true;
		} catch (error) {
			sessionState.connected = false;
			sessionState.error = String(error);
			return false;
		}
	}

	/** Plans one reading after a short delay. */
	private static _schedule(): void {
		if (MireWindowSession._timer !== null) {
			window.clearTimeout(MireWindowSession._timer);
		}
		MireWindowSession._timer = window.setTimeout(() => {
			MireWindowSession._timer = null;
			void MireWindowSession.refresh();
		}, EVENT_DELAY_MS);
	}

	/**
	 * Follows the Finished cards that the developer closes in the main window, so that both windows show the same
	 * status.
	 * @param event The change of `localStorage` made by another window.
	 */
	private static _onStorage(event: StorageEvent): void {
		if (event.key !== DISMISSED_KEY) {
			return;
		}
		try {
			sessionState.dismissed = JSON.parse(event.newValue ?? '{}');
		} catch {
			sessionState.dismissed = {};
		}
		MireWindowSession._schedule();
	}
}
