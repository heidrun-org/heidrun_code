import { ref } from 'vue';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MireSidebarWidth — the width of the right sidebar of the Mire, chosen with the drag handle
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The key of `localStorage` that keeps the width. The Mire modal and the separate Mire window share it. */
export const MIRE_SIDEBAR_WIDTH_KEY = 'heidrun.mire.sidebarWidth';

/** The width of the right sidebar before the developer drags its edge, in pixels. */
export const MIRE_SIDEBAR_DEFAULT_WIDTH = 380;

/** The smallest width of the right sidebar, in pixels. */
export const MIRE_SIDEBAR_MINIMUM_WIDTH = 280;

/** The width of the right sidebar of the Mire, in pixels. */
export const mireSidebarWidth = ref(MIRE_SIDEBAR_DEFAULT_WIDTH);

/** Reads and saves the width of the right sidebar of the Mire. */
export class MireSidebarWidth {
	/**
	 * Reads the saved width again, for example when a Mire view mounts, so that the separate Mire window takes the width
	 * chosen in the modal. A missing or wrong value gives the default width.
	 */
	static load(): void {
		mireSidebarWidth.value = MireSidebarWidth._read();
	}

	/**
	 * Sets the width and saves it.
	 * @param width The new width, in pixels, already kept between its limits by the drag handle.
	 */
	static set(width: number): void {
		mireSidebarWidth.value = width;
		try {
			localStorage.setItem(MIRE_SIDEBAR_WIDTH_KEY, String(width));
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
			text = localStorage.getItem(MIRE_SIDEBAR_WIDTH_KEY);
		} catch {
			return MIRE_SIDEBAR_DEFAULT_WIDTH;
		}
		const width = Number(text);
		if (text === null || Number.isFinite(width) === false || width < MIRE_SIDEBAR_MINIMUM_WIDTH) {
			return MIRE_SIDEBAR_DEFAULT_WIDTH;
		}
		return width;
	}
}
