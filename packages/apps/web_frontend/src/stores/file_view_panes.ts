import { reactive } from 'vue';
import { FileViewLabel } from '../lib/file_view_label';
import { FileViewEditState } from './file_view_edit_state';
import { selectedPane } from './session';
import { ViewPanes } from './view_panes';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FileViewPanes — opens a file in a file view pane
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** A line that a file view pane must show, for example the line of `src/main.rs:42` or of a search result. */
export type FileViewLineRequest = {
	/** The number of the line, from 1. */
	line: number;
	/** Grows at each request, so that a second request for the same line shows it again. */
	sequence: number;
};

/** The line to show for each absolute path of a file, set before the file view pane shows the file (issue #898). */
export const fileViewLineRequests = reactive({} as Record<string, FileViewLineRequest>);

let lineRequestSequence = 0;

/** Opens a file in a file view pane: a pane that shows the file over a terminal that only waits. */
export class FileViewPanes {
	/**
	 * Shows a file in a file view pane. When the selected pane is a terminal, a new pane opens to its right and the terminal
	 * stays as it was. When the selected pane is a file view pane, the file replaces the file of that pane, except when that
	 * pane holds unsaved changes: then a new pane opens to its right, and the changes stay.
	 * @param absolutePath The absolute path of the file to show.
	 * @param line The line to show, from 1, or null to show the file from its start.
	 * @returns True when a file view pane shows the file, false when there is no selected pane or when Herdr failed.
	 */
	static async open(absolutePath: string, line: number | null = null): Promise<boolean> {
		if (line !== null) {
			fileViewLineRequests[absolutePath] = {
				line,
				sequence: ++lineRequestSequence,
			};
		} else {
			delete fileViewLineRequests[absolutePath];
		}
		const isSelectedPaneDirty = FileViewEditState.isDirty(selectedPane.value?.pane_id);
		return ViewPanes.open({
			label: FileViewLabel.format(absolutePath),
			isSameKindFn: (label) => {
				const shownPath = FileViewLabel.parse(label);
				return shownPath !== null && (isSelectedPaneDirty === false || shownPath === absolutePath);
			},
			waitLine: 'Below the file view of Heidrun',
		});
	}
}
