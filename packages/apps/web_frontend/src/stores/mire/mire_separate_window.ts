import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import * as api from '../../lib/api';
import { t } from '../../i18n/index';
import { toast } from '../session';
import { MireStore, type MireOpenResult } from './mire_store';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MireSeparateWindow — opens the separate Mire window, and shows in the main window the pane that it asks for
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The event that the separate Mire window sends to the main window only, through `mire_open_in_main_window`. */
export const MIRE_OPEN_PANE_EVENT = 'mire://open-pane';

/** The request of the separate Mire window to show one pane. */
type MireOpenPaneRequest = {
	/** The pane identifier. */
	paneId: string;
};

/** The separate Mire window, seen from the main window. */
export class MireSeparateWindow {
	/**
	 * Opens the separate Mire window, or gives the focus to the Mire window that is already open: only one Mire window
	 * exists at a time.
	 * @returns True when the window shows.
	 */
	static async open(): Promise<boolean> {
		try {
			await api.mireWindowOpen();
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Called once by the main window: listens to the requests of the separate Mire window to show a pane.
	 * @returns The function that stops the listening.
	 */
	static listenToOpenRequests(): Promise<UnlistenFn> {
		return listen<MireOpenPaneRequest>(MIRE_OPEN_PANE_EVENT, (event) => {
			void MireSeparateWindow.openRequestedPane(event.payload.paneId);
		});
	}

	/**
	 * Shows the pane that the separate Mire window asks for. The main window reads the Herdr snapshot again first, and
	 * says so in a message when the pane is gone.
	 * @param paneId The pane identifier.
	 * @returns What happened.
	 */
	static async openRequestedPane(paneId: string): Promise<MireOpenResult> {
		const result = await MireStore.openInHeidrunCode(paneId);
		if (result !== 'opened') {
			toast(t(`mire.open.${result}`), 'error');
		}
		return result;
	}
}
