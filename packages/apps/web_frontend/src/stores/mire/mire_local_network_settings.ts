import { reactive } from 'vue';
import * as api from '../../lib/api';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MireLocalNetworkSettings — the option "Show the Mire on the local network" of the section "Mire" of the Settings window
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Why the Mire server does not work. */
export type MireLocalNetworkError = {
	/** What went wrong: `cannotListen` or `noNetwork`. */
	kind: 'cannotListen' | 'noNetwork';
	/** The words of the system about the problem. It can be empty. */
	detail: string;
};

/** What the desktop application says about the Mire on the local network. */
export type MireLocalNetworkStatus = {
	/** True when the developer turned the option on. */
	enabled: boolean;
	/** True when the server listens. */
	running: boolean;
	/** The address of the page with the pairing key, or null while the server does not listen or has no network. */
	address: string | null;
	/** The same address as a QR code (SVG), or null in the same cases. */
	qr: string | null;
	/** Why the server does not work, or null. */
	error: MireLocalNetworkError | null;
};

/** The state of the section "Mire" of the Settings window. */
export const mireLocalNetworkSettingsState = reactive({
	/** The last status, or null before the first answer. */
	status: null as MireLocalNetworkStatus | null,
	/** True while a change runs: the controls wait. */
	isBusy: false,
});

/** The actions of the section "Mire" of the Settings window on the Mire server. */
export class MireLocalNetworkSettings {
	/**
	 * Reads the status again.
	 * @returns A promise that resolves when the status is read.
	 */
	static async refresh(): Promise<void> {
		mireLocalNetworkSettingsState.status = await api.mireLocalNetworkStatus<MireLocalNetworkStatus>().catch(() => null);
	}

	/**
	 * Turns the option on or off.
	 * @param isOn True to turn the option on.
	 * @returns A promise that resolves with the new status.
	 */
	static async setEnabled(isOn: boolean): Promise<void> {
		await MireLocalNetworkSettings._change(() => isOn === true
			? api.mireLocalNetworkEnable<MireLocalNetworkStatus>()
			: api.mireLocalNetworkDisable<MireLocalNetworkStatus>());
	}

	/**
	 * Makes a new pairing key: every device must scan the new QR code.
	 * @returns A promise that resolves with the new status.
	 */
	static async makeNewKey(): Promise<void> {
		await MireLocalNetworkSettings._change(() => api.mireLocalNetworkNewKey<MireLocalNetworkStatus>());
	}

	/**
	 * Runs one change, and keeps the status that it gives. The status is read again when the change fails.
	 * @param changeFn The call of the desktop application.
	 * @returns A promise that resolves when the change ends.
	 */
	private static async _change(changeFn: () => Promise<MireLocalNetworkStatus>): Promise<void> {
		mireLocalNetworkSettingsState.isBusy = true;
		try {
			mireLocalNetworkSettingsState.status = await changeFn();
		} catch {
			await MireLocalNetworkSettings.refresh();
		} finally {
			mireLocalNetworkSettingsState.isBusy = false;
		}
	}
}
