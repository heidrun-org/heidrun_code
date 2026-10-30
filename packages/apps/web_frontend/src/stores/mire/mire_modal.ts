import { nextTick, reactive } from 'vue';
import { toast } from '../session';
import { t } from '../../i18n/index';
import { MireSeparateWindow } from './mire_separate_window';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MireModal — opens and closes the Mire as a modal over the main window
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The state of the Mire modal: not saved, the modal starts closed. */
export const mireModal = reactive({
	/** True while the Mire modal shows. */
	isOpen: false,
});

/** How the modal closes. */
export type MireModalCloseOptions = {
	/** True gives the keyboard focus back to the element that had it before the modal opened. */
	isFocusRestored: boolean;
};

/** The element that had the keyboard focus when the modal opened, or null. */
let focusedBeforeOpening: HTMLElement | null = null;

/** Opens and closes the Mire modal. */
export class MireModal {
	/** Opens the Mire modal. The Mire view registers in the shared collector when it mounts. */
	static open(): void {
		const element = document.activeElement;
		focusedBeforeOpening = element instanceof HTMLElement && element !== document.body ? element : null;
		mireModal.isOpen = true;
	}

	/**
	 * Closes the Mire modal. The Mire view leaves the shared collector when it unmounts. By default, the keyboard focus
	 * goes back to where it was in the main window.
	 * @param options How the modal closes. "Open in Heidrun Code" leaves the focus to the pane that it shows.
	 */
	static close(options: MireModalCloseOptions = {
		isFocusRestored: true,
	}): void {
		const element = focusedBeforeOpening;
		focusedBeforeOpening = null;
		mireModal.isOpen = false;
		if (options.isFocusRestored === false || element === null) {
			return;
		}
		void nextTick(() => {
			if (element.isConnected === true) {
				element.focus();
			}
		});
	}

	/**
	 * Opens the Mire in the separate Mire window, for a second screen, and closes the modal.
	 * @returns A promise that resolves when the window shows, or when the message of the error shows.
	 */
	static async openInSeparateWindow(): Promise<void> {
		const isOpened = await MireSeparateWindow.open();
		if (isOpened === false) {
			toast(t('mire.separateWindow.failed'), 'error');
			return;
		}
		MireModal.close();
	}
}
