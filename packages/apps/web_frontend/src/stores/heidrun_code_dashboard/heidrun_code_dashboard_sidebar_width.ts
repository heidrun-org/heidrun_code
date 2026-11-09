import { ref } from 'vue';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunCodeDashboardSidebarWidth — the width of the right sidebar of the Heidrun Code Dashboard, chosen with the drag handle
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The key of `localStorage` that keeps the width. The Heidrun Code Dashboard modal and the separate Heidrun Code Dashboard window share it. */
export const HEIDRUN_CODE_DASHBOARD_SIDEBAR_WIDTH_KEY = 'heidrun.heidrunCodeDashboard.sidebarWidth';

/** The key of `localStorage` that kept the width before the Mire became the Heidrun Code Dashboard (issue 989). */
export const OLD_MIRE_SIDEBAR_WIDTH_KEY = 'heidrun.mire.sidebarWidth';

/** The width of the right sidebar before the developer drags its edge, in pixels. */
export const HEIDRUN_CODE_DASHBOARD_SIDEBAR_DEFAULT_WIDTH = 380;

/** The smallest width of the right sidebar, in pixels. */
export const HEIDRUN_CODE_DASHBOARD_SIDEBAR_MINIMUM_WIDTH = 280;

/** The width of the right sidebar of the Heidrun Code Dashboard, in pixels. */
export const heidrunCodeDashboardSidebarWidth = ref(HEIDRUN_CODE_DASHBOARD_SIDEBAR_DEFAULT_WIDTH);

/** Reads and saves the width of the right sidebar of the Heidrun Code Dashboard. */
export class HeidrunCodeDashboardSidebarWidth {
	/**
	 * Reads the saved width again, for example when a Heidrun Code Dashboard view mounts, so that the separate Heidrun Code Dashboard window takes the width
	 * chosen in the modal. A missing or wrong value gives the default width.
	 */
	static load(): void {
		heidrunCodeDashboardSidebarWidth.value = HeidrunCodeDashboardSidebarWidth._read();
	}

	/**
	 * Sets the width and saves it.
	 * @param width The new width, in pixels, already kept between its limits by the drag handle.
	 */
	static set(width: number): void {
		heidrunCodeDashboardSidebarWidth.value = width;
		try {
			localStorage.setItem(HEIDRUN_CODE_DASHBOARD_SIDEBAR_WIDTH_KEY, String(width));
		} catch {
			// The width stays for this view when the web browser refuses to save it.
		}
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Reads the saved width.
	 * @returns The saved width, or the default width when none is saved or the value is not a width.
	 */
	private static _read(): number {
		let text: string | null = null;
		try {
			text = localStorage.getItem(HEIDRUN_CODE_DASHBOARD_SIDEBAR_WIDTH_KEY);
			if (text === null) {
				text = HeidrunCodeDashboardSidebarWidth._moveOldWidth();
			}
		} catch {
			return HEIDRUN_CODE_DASHBOARD_SIDEBAR_DEFAULT_WIDTH;
		}
		const width = Number(text);
		if (text === null || Number.isFinite(width) === false || width < HEIDRUN_CODE_DASHBOARD_SIDEBAR_MINIMUM_WIDTH) {
			return HEIDRUN_CODE_DASHBOARD_SIDEBAR_DEFAULT_WIDTH;
		}
		return width;
	}

	/**
	 * Moves the width saved under the old key of the Mire to the new key, once.
	 * @returns The moved width as text, or `null` when the old key holds nothing.
	 */
	private static _moveOldWidth(): string | null {
		const text = localStorage.getItem(OLD_MIRE_SIDEBAR_WIDTH_KEY);
		if (text === null) {
			return null;
		}
		localStorage.setItem(HEIDRUN_CODE_DASHBOARD_SIDEBAR_WIDTH_KEY, text);
		localStorage.removeItem(OLD_MIRE_SIDEBAR_WIDTH_KEY);
		return text;
	}
}
