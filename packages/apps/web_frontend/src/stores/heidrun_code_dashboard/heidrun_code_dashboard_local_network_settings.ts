import { reactive } from 'vue';
import * as api from '../../lib/api';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	HeidrunCodeDashboardLocalNetworkSettings — the option "Show the Heidrun Code Dashboard on the local network" of the section "Heidrun Code Dashboard" of the Settings window
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Why the Heidrun Code Dashboard server does not work. */
export type HeidrunCodeDashboardLocalNetworkError = {
	/** What went wrong: `cannotListen` or `noNetwork`. */
	kind: 'cannotListen' | 'noNetwork';
	/** The words of the system about the problem. It can be empty. */
	detail: string;
};

/** What the desktop application says about the Heidrun Code Dashboard on the local network. */
export type HeidrunCodeDashboardLocalNetworkStatus = {
	/** True when the developer turned the option on. */
	enabled: boolean;
	/** True when the server listens. */
	running: boolean;
	/** The address of the page with the pairing key, or null while the server does not listen or has no network. */
	address: string | null;
	/** The same address as a QR code (SVG), or null in the same cases. */
	qr: string | null;
	/** Why the server does not work, or null. */
	error: HeidrunCodeDashboardLocalNetworkError | null;
};

/** The state of the section "Heidrun Code Dashboard" of the Settings window. */
export const heidrunCodeDashboardLocalNetworkSettingsState = reactive({
	/** The last status, or null before the first answer. */
	status: null as HeidrunCodeDashboardLocalNetworkStatus | null,
	/** True while a change runs: the controls wait. */
	isBusy: false,
});

/** The actions of the section "Heidrun Code Dashboard" of the Settings window on the Heidrun Code Dashboard server. */
export class HeidrunCodeDashboardLocalNetworkSettings {
	/**
	 * Reads the status again.
	 * @returns A promise that resolves when the status is read.
	 */
	static async refresh(): Promise<void> {
		heidrunCodeDashboardLocalNetworkSettingsState.status = await api.heidrunCodeDashboardLocalNetworkStatus<HeidrunCodeDashboardLocalNetworkStatus>().catch(() => null);
	}

	/**
	 * Turns the option on or off.
	 * @param isOn True to turn the option on.
	 * @returns A promise that resolves with the new status.
	 */
	static async setEnabled(isOn: boolean): Promise<void> {
		await HeidrunCodeDashboardLocalNetworkSettings._change(() => isOn === true
			? api.heidrunCodeDashboardLocalNetworkEnable<HeidrunCodeDashboardLocalNetworkStatus>()
			: api.heidrunCodeDashboardLocalNetworkDisable<HeidrunCodeDashboardLocalNetworkStatus>());
	}

	/**
	 * Makes a new pairing key: every device must scan the new QR code.
	 * @returns A promise that resolves with the new status.
	 */
	static async makeNewKey(): Promise<void> {
		await HeidrunCodeDashboardLocalNetworkSettings._change(() => api.heidrunCodeDashboardLocalNetworkNewKey<HeidrunCodeDashboardLocalNetworkStatus>());
	}

	/**
	 * Runs one change, and keeps the status that it gives. The status is read again when the change fails.
	 * @param changeFn The call of the desktop application.
	 * @returns A promise that resolves when the change ends.
	 */
	private static async _change(changeFn: () => Promise<HeidrunCodeDashboardLocalNetworkStatus>): Promise<void> {
		heidrunCodeDashboardLocalNetworkSettingsState.isBusy = true;
		try {
			heidrunCodeDashboardLocalNetworkSettingsState.status = await changeFn();
		} catch {
			await HeidrunCodeDashboardLocalNetworkSettings.refresh();
		} finally {
			heidrunCodeDashboardLocalNetworkSettingsState.isBusy = false;
		}
	}
}
