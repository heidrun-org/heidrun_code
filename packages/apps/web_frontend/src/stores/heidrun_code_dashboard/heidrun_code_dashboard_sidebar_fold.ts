import { ref } from 'vue';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunCodeDashboardSidebarFold — whether the right sidebar of the Heidrun Code Dashboard is folded (issue #1016)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The key of `localStorage` that keeps the fold on the computer. The modal and the separate window share it. */
export const HEIDRUN_CODE_DASHBOARD_SIDEBAR_FOLDED_KEY = 'heidrun.heidrunCodeDashboard.sidebarFolded';

/** The key of `localStorage` that keeps the fold on the page of a device of the local network. */
export const HEIDRUN_CODE_DASHBOARD_LOCAL_NETWORK_SIDEBAR_FOLDED_KEY = 'heidrun.heidrunCodeDashboard.localNetwork.sidebarFolded';

/** True while the right sidebar is folded to a strip, so that the graph takes the whole width. */
export const heidrunCodeDashboardSidebarFolded = ref(false);

/** Reads, changes, and saves the fold of the right sidebar of the Heidrun Code Dashboard. */
export class HeidrunCodeDashboardSidebarFold {
	/** The key of the view that loaded the fold last. */
	private static _key = HEIDRUN_CODE_DASHBOARD_SIDEBAR_FOLDED_KEY;

	/**
	 * Reads the saved fold when a view mounts. The computer and the page of the local network keep their own choice.
	 * @param isOnLocalNetwork True on the page of a device of the local network.
	 */
	static load(isOnLocalNetwork: boolean): void {
		HeidrunCodeDashboardSidebarFold._key = isOnLocalNetwork ? HEIDRUN_CODE_DASHBOARD_LOCAL_NETWORK_SIDEBAR_FOLDED_KEY : HEIDRUN_CODE_DASHBOARD_SIDEBAR_FOLDED_KEY;
		let text: string | null = null;
		try {
			text = localStorage.getItem(HeidrunCodeDashboardSidebarFold._key);
		} catch {
			// The sidebar starts unfolded when the web browser refuses to read the saved value.
		}
		heidrunCodeDashboardSidebarFolded.value = text === 'true';
	}

	/** Folds the sidebar when it is unfolded, unfolds it otherwise, and saves the choice. */
	static toggle(): void {
		heidrunCodeDashboardSidebarFolded.value = heidrunCodeDashboardSidebarFolded.value === false;
		try {
			localStorage.setItem(HeidrunCodeDashboardSidebarFold._key, String(heidrunCodeDashboardSidebarFolded.value));
		} catch {
			// The fold stays for this view when the web browser refuses to save it.
		}
	}
}
