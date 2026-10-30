import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import * as api from '../../lib/api';
import { t } from '../../i18n/index';
import { toast } from '../session';
import { MireStore, type MireOpenResult, type MireOpenTarget } from './mire_store';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MireSeparateWindow — opens the separate Mire window, and shows in the main window the target that it asks for
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The event that the separate Mire window sends to the main window only, through `mire_open_in_main_window`. */
export const MIRE_OPEN_IN_MAIN_WINDOW_EVENT = 'mire://open-in-main-window';

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
	 * Called once by the main window: listens to the requests of the separate Mire window to show a workspace, a tab, or
	 * a pane.
	 * @returns The function that stops the listening.
	 */
	static listenToOpenRequests(): Promise<UnlistenFn> {
		return listen<MireOpenTarget>(MIRE_OPEN_IN_MAIN_WINDOW_EVENT, (event) => {
			void MireSeparateWindow.openRequestedTarget(event.payload);
		});
	}

	/**
	 * Shows the workspace, the tab, or the pane that the separate Mire window asks for. The main window reads the Herdr
	 * snapshot again first, and says so in a message when the target is gone.
	 * @param target The workspace, the tab, or the pane.
	 * @returns What happened.
	 */
	static async openRequestedTarget(target: MireOpenTarget): Promise<MireOpenResult> {
		const result = await MireStore.openInHeidrunCode(target);
		if (result !== 'opened') {
			toast(t(`mire.open.${result}`), 'error');
		}
		return result;
	}
}
