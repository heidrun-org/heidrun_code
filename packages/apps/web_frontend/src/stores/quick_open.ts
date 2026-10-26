// The box that searches a file of the project by its name, on top of the panes: the shortcut ⌘P and the entry
// "Open a project file" of the command palette open it.
// - issue #898
import { reactive } from 'vue';
import { currentGit } from './git';
import { selectedPane, toast } from './session';
import { t } from '../i18n/index';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	QuickOpen — opens and closes the box that searches a file by its name
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** The state of the box that searches a file by its name. */
export const quickOpen = reactive({
	/** True while the box is open. */
	isOpen: false,
	/** The folder whose project the box lists: the folder of the selected pane, or the repository of the workspace. */
	folder: '',
});

/** Opens and closes the box that searches a file of the project by its name. */
export class QuickOpen {
	/**
	 * Opens the box on the project of the selected pane. Without a selected pane, the box uses the repository of the
	 * selected workspace. Without both, a toast tells why nothing opens.
	 */
	static open(): void {
		const pane = selectedPane.value;
		const folder = pane?.foreground_cwd || pane?.cwd || currentGit.value?.root || '';
		if (folder === '') {
			toast(t('quickOpen.noFolder'), 'error');
			return;
		}
		quickOpen.folder = folder;
		quickOpen.isOpen = true;
	}

	/** Closes the box. */
	static close(): void {
		quickOpen.isOpen = false;
	}
}
