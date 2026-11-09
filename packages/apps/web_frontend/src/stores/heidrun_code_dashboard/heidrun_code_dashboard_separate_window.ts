import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import * as api from '../../lib/api';
import { t } from '../../i18n/index';
import { toast } from '../session';
import { HeidrunCodeDashboardStore, type HeidrunCodeDashboardOpenResult, type HeidrunCodeDashboardOpenTarget } from './heidrun_code_dashboard_store';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunCodeDashboardSeparateWindow — opens the separate Heidrun Code Dashboard window, and shows in the main window the target that it asks for
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The event that the separate Heidrun Code Dashboard window sends to the main window only, through `heidrun_code_dashboard_open_in_main_window`. */
export const HEIDRUN_CODE_DASHBOARD_OPEN_IN_MAIN_WINDOW_EVENT = 'heidrun_code_dashboard://open-in-main-window';

/** The separate Heidrun Code Dashboard window, seen from the main window. */
export class HeidrunCodeDashboardSeparateWindow {
	/**
	 * Opens the separate Heidrun Code Dashboard window, or gives the focus to the Heidrun Code Dashboard window that is already open: only one Heidrun Code Dashboard window
	 * exists at a time.
	 * @returns True when the window shows.
	 */
	static async open(): Promise<boolean> {
		try {
			await api.heidrunCodeDashboardWindowOpen();
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Called once by the main window: listens to the requests of the separate Heidrun Code Dashboard window to show a workspace, a tab, or
	 * a pane.
	 * @returns The function that stops the listening.
	 */
	static listenToOpenRequests(): Promise<UnlistenFn> {
		return listen<HeidrunCodeDashboardOpenTarget>(HEIDRUN_CODE_DASHBOARD_OPEN_IN_MAIN_WINDOW_EVENT, (event) => {
			void HeidrunCodeDashboardSeparateWindow.openRequestedTarget(event.payload);
		});
	}

	/**
	 * Shows the workspace, the tab, or the pane that the separate Heidrun Code Dashboard window asks for. The main window reads the Herdr
	 * snapshot again first, and says so in a message when the target is gone.
	 * @param target The workspace, the tab, or the pane.
	 * @returns What happened.
	 */
	static async openRequestedTarget(target: HeidrunCodeDashboardOpenTarget): Promise<HeidrunCodeDashboardOpenResult> {
		const result = await HeidrunCodeDashboardStore.openInHeidrunCode(target);
		if (result !== 'opened') {
			toast(t(`heidrunCodeDashboard.open.${result}`), 'error');
		}
		return result;
	}
}
