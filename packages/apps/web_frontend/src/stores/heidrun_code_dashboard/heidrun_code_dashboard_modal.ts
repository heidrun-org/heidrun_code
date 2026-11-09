import { nextTick, reactive } from 'vue';
import { toast } from '../session';
import { t } from '../../i18n/index';
import { HeidrunCodeDashboardSeparateWindow } from './heidrun_code_dashboard_separate_window';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunCodeDashboardModal — opens and closes the Heidrun Code Dashboard as a modal over the main window
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The state of the Heidrun Code Dashboard modal: not saved, the modal starts closed. */
export const heidrunCodeDashboardModal = reactive({
	/** True while the Heidrun Code Dashboard modal shows. */
	isOpen: false,
});

/** How the modal closes. */
export type HeidrunCodeDashboardModalCloseOptions = {
	/** True gives the keyboard focus back to the element that had it before the modal opened. */
	isFocusRestored: boolean;
};

/** The element that had the keyboard focus when the modal opened, or null. */
let focusedBeforeOpening: HTMLElement | null = null;

/** Opens and closes the Heidrun Code Dashboard modal. */
export class HeidrunCodeDashboardModal {
	/** Opens the Heidrun Code Dashboard modal. The Heidrun Code Dashboard view registers in the shared collector when it mounts. */
	static open(): void {
		const element = document.activeElement;
		focusedBeforeOpening = element instanceof HTMLElement && element !== document.body ? element : null;
		heidrunCodeDashboardModal.isOpen = true;
	}

	/**
	 * Closes the Heidrun Code Dashboard modal. The Heidrun Code Dashboard view leaves the shared collector when it unmounts. By default, the keyboard focus
	 * goes back to where it was in the main window.
	 * @param options How the modal closes. "Open in Heidrun Code" leaves the focus to the pane that it shows.
	 */
	static close(options: HeidrunCodeDashboardModalCloseOptions = {
		isFocusRestored: true,
	}): void {
		const element = focusedBeforeOpening;
		focusedBeforeOpening = null;
		heidrunCodeDashboardModal.isOpen = false;
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
	 * Opens the Heidrun Code Dashboard in the separate Heidrun Code Dashboard window, for a second screen, and closes the modal.
	 * @returns A promise that resolves when the window shows, or when the message of the error shows.
	 */
	static async openInSeparateWindow(): Promise<void> {
		const isOpened = await HeidrunCodeDashboardSeparateWindow.open();
		if (isOpened === false) {
			toast(t('heidrunCodeDashboard.separateWindow.failed'), 'error');
			return;
		}
		HeidrunCodeDashboardModal.close();
	}
}
