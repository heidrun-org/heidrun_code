// Reads, saves, and watches the file of a file view pane, and asks before Heidrun Code quits with unsaved changes.
// - issue #899
import { watch } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { allPanes, state, toast } from './session';
import { fileViewEdits, FileViewEditState, type FileViewEdit } from './file_view_edit_state';
import { askConfirm } from './confirm';
import { t } from '../i18n/index';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FileViewEdits — reads, saves, and watches the file of a file view pane
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** A text file read by the backend, with its fingerprint. */
type FileText = {
	/** The text of the file. */
	text: string;
	/** The fingerprint of the text. */
	hash: string;
};

/** The fingerprint of a file on the disk now. */
type FileStamp = {
	/** The fingerprint, or null when the file is gone. */
	hash: string | null;
};

/** Reads, saves, and watches the file of a file view pane. */
export class FileViewEdits {
	/**
	 * Reads a file to edit it in a pane. When the pane already holds unsaved changes of the same file, they stay.
	 * @param paneId The identifier of the pane.
	 * @param root The project of the file.
	 * @param path The path of the file inside the project.
	 * @returns The edit of the pane.
	 */
	static async load(paneId: string, root: string, path: string): Promise<FileViewEdit> {
		const existing = fileViewEdits[paneId];
		if (existing !== undefined && existing.root === root && existing.path === path && FileViewEditState.isDirty(paneId)) {
			return existing;
		}
		const fileText = await invoke<FileText>('file_read', { root, path });
		fileViewEdits[paneId] = FileViewEdits._fresh(root, path, fileText);
		return fileViewEdits[paneId];
	}

	/**
	 * Saves the text of a pane, only when the disk still holds the text that the editor started from.
	 * @param paneId The identifier of the pane.
	 * @param isOverwrite True to replace the version of the disk that the conflict shows.
	 * @returns True when the file is saved.
	 */
	static async save(paneId: string, isOverwrite = false): Promise<boolean> {
		const edit = fileViewEdits[paneId];
		if (edit === undefined || edit.isSaving) {
			return false;
		}
		if (FileViewEditState.isDirty(paneId) === false && isOverwrite === false) {
			return true;
		}
		edit.isSaving = true;
		try {
			const content = edit.current;
			const stamp = await invoke<FileStamp>('file_write', {
				root: edit.root,
				path: edit.path,
				content,
				expected: isOverwrite ? edit.diskHash : edit.hash,
			});
			Object.assign(edit, {
				original: content,
				hash: stamp.hash,
				isConflict: false,
				diskText: null,
				diskHash: null,
			});
			toast(t('fileView.saved', { name: edit.path.split('/').pop() ?? edit.path }));
			return true;
		} catch (error) {
			if (String(error).includes('changed_on_disk')) {
				if (isOverwrite) {
					toast(t('fileView.changedAgain'));
				}
				await FileViewEdits._markConflict(paneId);
			} else {
				toast(String(error), 'error');
			}
			return false;
		} finally {
			edit.isSaving = false;
		}
	}

	/**
	 * Looks at the file on the disk. A file without unsaved changes is read again quietly. A file with unsaved changes
	 * shows the conflict at once, before the save.
	 * @param paneId The identifier of the pane.
	 */
	static async check(paneId: string): Promise<void> {
		const edit = fileViewEdits[paneId];
		if (edit === undefined || edit.isSaving) {
			return;
		}
		let stamp: FileStamp;
		try {
			stamp = await invoke<FileStamp>('file_stat', { root: edit.root, path: edit.path });
		} catch {
			return;
		}
		if (edit.isConflict) {
			if (stamp.hash !== edit.diskHash) {
				await FileViewEdits._markConflict(paneId);
			}
			return;
		}
		if (stamp.hash === edit.hash) {
			return;
		}
		if (FileViewEditState.isDirty(paneId) === false && stamp.hash !== null) {
			const fileText = await invoke<FileText>('file_read', { root: edit.root, path: edit.path }).catch(() => null);
			const now = fileViewEdits[paneId];
			if (fileText === null || now === undefined) {
				return;
			}
			// The developer typed while the file was read: the text is not replaced, it is a conflict.
			if (now.current !== now.original) {
				await FileViewEdits._markConflict(paneId);
				return;
			}
			fileViewEdits[paneId] = FileViewEdits._fresh(edit.root, edit.path, fileText);
			return;
		}
		await FileViewEdits._markConflict(paneId);
	}

	/**
	 * Reads the file of the disk again and drops the unsaved changes.
	 * @param paneId The identifier of the pane.
	 */
	static async reload(paneId: string): Promise<void> {
		const edit = fileViewEdits[paneId];
		if (edit === undefined) {
			return;
		}
		try {
			const fileText = await invoke<FileText>('file_read', { root: edit.root, path: edit.path });
			fileViewEdits[paneId] = FileViewEdits._fresh(edit.root, edit.path, fileText);
		} catch (error) {
			toast(String(error), 'error');
		}
	}

	/**
	 * Asks the developer what to do when Heidrun Code quits with unsaved changes, then quits when the developer agrees.
	 */
	static async confirmQuit(): Promise<void> {
		const dirtyPaneIds = FileViewEditState.dirtyPaneIds();
		if (dirtyPaneIds.length === 0) {
			await invoke('quit_now').catch(() => {});
			return;
		}
		const isConfirmed = await askConfirm(
			t('fileView.quitUnsaved', {
				count: dirtyPaneIds.length,
				names: FileViewEditState.fileNames(dirtyPaneIds),
			}),
			t('fileView.quitWithoutSaving'),
		);
		if (isConfirmed) {
			await invoke('quit_now').catch(() => {});
		}
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	private static _fresh(root: string, path: string, fileText: FileText): FileViewEdit {
		return {
			root,
			path,
			original: fileText.text,
			hash: fileText.hash,
			current: fileText.text,
			isConflict: false,
			diskText: null,
			diskHash: null,
			isSaving: false,
		};
	}

	private static async _markConflict(paneId: string): Promise<void> {
		const edit = fileViewEdits[paneId];
		if (edit === undefined) {
			return;
		}
		edit.isConflict = true;
		try {
			const stamp = await invoke<FileStamp>('file_stat', { root: edit.root, path: edit.path });
			if (stamp.hash === null) {
				edit.diskText = null;
				edit.diskHash = null;
				return;
			}
			const fileText = await invoke<FileText>('file_read', { root: edit.root, path: edit.path });
			edit.diskText = fileText.text;
			edit.diskHash = fileText.hash;
		} catch {
			// The conflict shows without the version of the disk.
		}
	}
}

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	Quit and closed panes
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

// The backend asks before it quits, or before the window closes, while a file view pane holds unsaved changes.
watch(
	() => FileViewEditState.dirtyPaneIds().length > 0,
	(isUnsaved) => {
		invoke('set_unsaved', { on: isUnsaved }).catch(() => {});
	},
);

listen('quit-blocked', () => {
	void FileViewEdits.confirmQuit();
}).catch(() => {});

// A pane that Herdr closed takes its edit with it.
watch(
	() => allPanes.value.map((pane) => pane.pane_id),
	(paneIds) => {
		if (state.snapshot === null) {
			return;
		}
		for (const paneId of Object.keys(fileViewEdits)) {
			if (paneIds.includes(paneId) === false) {
				FileViewEditState.forget(paneId);
			}
		}
	},
);
