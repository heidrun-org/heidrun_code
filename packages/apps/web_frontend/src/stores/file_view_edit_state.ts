// The changes that the developer types in the file view panes, by pane identifier. This file imports no other store of
// the window except the confirmation modal dialog, so that the session store can ask before it closes a pane, a tab, or a
// workspace that holds unsaved changes.
// - issue #899
import { reactive } from 'vue';
import { askConfirm } from './confirm';
import { t } from '../i18n/index';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FileViewEditState — the text of each file view pane and whether it is saved
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The text of the file of one file view pane: what was read from the disk, and what the editor holds now. */
export type FileViewEdit = {
	/** The project of the file, as the backend resolved it. */
	root: string;
	/** The path of the file inside the project. */
	path: string;
	/** The text when it was read from the disk or saved last. */
	original: string;
	/** The fingerprint of `original`: a save checks that the disk still holds it. Null when the file was deleted. */
	hash: string | null;
	/** The text that the editor holds now. */
	current: string;
	/** True when the file changed on the disk while the developer had unsaved changes. */
	isConflict: boolean;
	/** The text on the disk during a conflict, or null when the file is gone. */
	diskText: string | null;
	/** The fingerprint of `diskText`, or null when the file is gone. */
	diskHash: string | null;
	/** True while a save runs. */
	isSaving: boolean;
};

/** The edits of the file view panes, by pane identifier. A pane that shows an image or a preview has no edit. */
export const fileViewEdits = reactive({} as Record<string, FileViewEdit>);

/** Tells which file view panes have unsaved changes, and asks before they close. */
export class FileViewEditState {
	/**
	 * Tells if a file view pane holds changes that are not saved.
	 * @param paneId The identifier of the pane, or null or undefined.
	 * @returns True when the text of the editor differs from the text of the disk.
	 */
	static isDirty(paneId: string | null | undefined): boolean {
		if (paneId === null || paneId === undefined) {
			return false;
		}
		const edit = fileViewEdits[paneId];
		if (edit === undefined) {
			return false;
		}
		return edit.current !== edit.original;
	}

	/**
	 * Lists the panes that hold unsaved changes.
	 * @param paneIds The panes to look at, or undefined for every pane.
	 * @returns The identifiers of the panes with unsaved changes.
	 */
	static dirtyPaneIds(paneIds?: string[]): string[] {
		const candidates = paneIds ?? Object.keys(fileViewEdits);
		return candidates.filter((paneId) => FileViewEditState.isDirty(paneId));
	}

	/**
	 * Gives the names of the files of some panes, for a message.
	 * @param paneIds The identifiers of the panes.
	 * @returns The names of the files, separated by commas.
	 */
	static fileNames(paneIds: string[]): string {
		return paneIds
			.map((paneId) => fileViewEdits[paneId]?.path.split('/').pop() ?? '')
			.filter((name) => name !== '')
			.join(', ');
	}

	/**
	 * Asks the developer before panes with unsaved changes close. Nothing is asked when no pane has unsaved changes.
	 * @param paneIds The panes that will close.
	 * @returns True when the panes can close: no unsaved changes, or the developer chose to lose them.
	 */
	static async confirmDiscard(paneIds: string[]): Promise<boolean> {
		const dirtyPaneIds = FileViewEditState.dirtyPaneIds(paneIds);
		if (dirtyPaneIds.length === 0) {
			return true;
		}
		const isConfirmed = await askConfirm(
			t('fileView.closeUnsaved', {
				count: dirtyPaneIds.length,
				names: FileViewEditState.fileNames(dirtyPaneIds),
			}),
			t('fileView.closeWithoutSaving'),
		);
		if (isConfirmed === false) {
			return false;
		}
		for (const paneId of dirtyPaneIds) {
			delete fileViewEdits[paneId];
		}
		return true;
	}

	/**
	 * Forgets the edit of a pane, for example when the pane is gone.
	 * @param paneId The identifier of the pane.
	 */
	static forget(paneId: string): void {
		delete fileViewEdits[paneId];
	}
}
