import { reactive } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { parseLauncherList, type Launcher } from '../lib/project_config';
import { toast } from './session';
import { t } from '../i18n/index';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Types
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** What the desktop application reads from the file `launchers.json` of the folder of the data of Heidrun Code. */
type UserLaunchersFile = {
	/** False when the file does not exist. */
	exists: boolean;
	/** The launchers of the file, in its order. Empty when the file does not exist or is not valid. */
	launchers: unknown[];
	/** Why the file cannot be read, or null. While it is set, the window never writes the file. */
	error: string | null;
};

/**
 * The launchers of the user level, which show in every workspace. The launchers of the workspace level are in the key
 * `launchers` of the file `.heidrun/config.json` of each project.
 */
export const userLaunchers = reactive({
	/** The launchers of the file `launchers.json`, in its order. */
	list: [] as Launcher[],
	/** Why the file cannot be read, or null. */
	error: null as string | null,
});

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	UserLaunchers — reads and writes the file of the launchers of the user level
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Keeps the launchers of the user level in the file `launchers.json`. The command line heidrun_code_ctrl and a person can
 * change the file too, so the window reads it again about every second.
 */
export class UserLaunchers {
	/** How often the window reads the file again, in milliseconds. */
	static readonly READ_INTERVAL = 1000;

	/** The launchers as JSON text, as last read from the file or written to it. */
	private static _knownText = '[]';

	/** True once the file was read without an error. Before that the window writes nothing. */
	private static _isFileReady = false;

	/** The number of changes that the window made, to tell a read that started before a change from a read after it. */
	private static _changeCount = 0;

	/** The number of writes in progress. A read that ends during a write is ignored. */
	private static _writeCount = 0;

	/** The writes one after the other, so that two quick changes never write from the same old list. */
	private static _writeChain: Promise<boolean> = Promise.resolve(true);

	/** True while a read is in progress. */
	private static _isReading = false;

	/** True once the reading every second has started. */
	private static _isStarted = false;

	/**
	 * Reads the file once, then reads it again every second.
	 * @returns Nothing.
	 */
	static startReading(): void {
		if (UserLaunchers._isStarted === true) {
			return;
		}
		UserLaunchers._isStarted = true;
		void UserLaunchers.readOnce();
		window.setInterval(() => void UserLaunchers.readOnce(), UserLaunchers.READ_INTERVAL);
	}

	/**
	 * Reads the file, unless a read is already in progress.
	 * @returns Nothing.
	 */
	static async readOnce(): Promise<void> {
		if (UserLaunchers._isReading === true) {
			return;
		}
		UserLaunchers._isReading = true;
		try {
			await UserLaunchers._read();
		} finally {
			UserLaunchers._isReading = false;
		}
	}

	/**
	 * Changes the launchers and writes the file. `change` gets the list at the moment of the write, so two quick changes
	 * never start from the same old list, and it returns the new list without changing the old one.
	 * @param change - Gives the new list from the old list.
	 * @returns True when the file is written. False, after a message on the screen, when the file was not read yet, is not
	 * valid (the window never overwrites it), or cannot be written.
	 */
	static change(change: (list: Launcher[]) => Launcher[]): Promise<boolean> {
		const run = async (): Promise<boolean> => {
			if (userLaunchers.error !== null) {
				toast(t('userLaunchers.fileInvalid', { reason: userLaunchers.error }));
				return false;
			}
			if (UserLaunchers._isFileReady === false) {
				toast(t('userLaunchers.fileNotRead'));
				return false;
			}
			const list = change(userLaunchers.list);
			UserLaunchers._changeCount++;
			UserLaunchers._writeCount++;
			try {
				await invoke('launchers_user_write', { launchers: list });
				UserLaunchers._knownText = JSON.stringify(list);
				userLaunchers.list = list;
				return true;
			} catch (error) {
				toast(String(error));
				return false;
			} finally {
				UserLaunchers._writeCount--;
			}
		};
		const result = UserLaunchers._writeChain.then(run, run);
		UserLaunchers._writeChain = result.catch(() => false);
		return result;
	}

	/**
	 * Reads the file, and shows what another program changed in it.
	 * @returns Nothing.
	 */
	private static async _read(): Promise<void> {
		const changeCountBefore = UserLaunchers._changeCount;
		let file: UserLaunchersFile;
		try {
			file = await invoke<UserLaunchersFile>('launchers_user_read');
		} catch {
			return;
		}
		if (typeof file !== 'object' || file === null) {
			return;
		}
		if (changeCountBefore !== UserLaunchers._changeCount || UserLaunchers._writeCount > 0) {
			return;
		}
		if (file.error !== null) {
			UserLaunchers._showError(file.error);
			return;
		}
		let launchers: Launcher[];
		try {
			launchers = parseLauncherList(file.launchers);
		} catch (error) {
			UserLaunchers._showError(error instanceof Error ? error.message : String(error));
			return;
		}
		userLaunchers.error = null;
		UserLaunchers._isFileReady = true;
		const text = JSON.stringify(launchers);
		if (text !== UserLaunchers._knownText) {
			UserLaunchers._knownText = text;
			userLaunchers.list = launchers;
		}
	}

	/**
	 * Remembers why the file cannot be read, and says it once on the screen. The window then writes nothing.
	 * @param reason - Why the file cannot be read.
	 * @returns Nothing.
	 */
	private static _showError(reason: string): void {
		if (userLaunchers.error !== reason) {
			toast(t('userLaunchers.fileInvalid', { reason }));
		}
		userLaunchers.error = reason;
	}
}
