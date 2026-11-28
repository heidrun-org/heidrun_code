import { reactive } from 'vue';
import { FileViewLabel } from '../lib/file_view_label';
import { t } from '../i18n/index';
import { state, toast } from './session';
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

/** The anchor to show for each absolute path of a Markdown file, set by a link of a Markdown preview (issue #928). */
export const fileViewAnchorRequests = reactive({} as Record<string, string>);

const WAIT_LINE = 'Below the file view of Heidrun';

let lineRequestSequence = 0;

/** Opens a file in a file view pane: a pane that shows the file over a terminal that only waits. */
export class FileViewPanes {
	/**
	 * Shows a file in a new focused tab in the selected workspace.
	 * @param absolutePath The absolute path of the file to show.
	 * @param line The line to show, from 1, or null to show the file from its start.
	 * @param anchor The Markdown heading to show, or null to show the file from its start.
	 * @returns True when the file opens, or false when no workspace is selected or Herdr fails.
	 */
	static async open(absolutePath: string, line: number | null = null, anchor: string | null = null): Promise<boolean> {
		const workspaceId = state.selectedWorkspaceId;
		if (workspaceId === null) {
			toast(t('viewPanes.noSelectedWorkspace'), 'error');
			return false;
		}
		return FileViewPanes.openInNewTab(workspaceId, absolutePath, line, anchor);
	}

	/**
	 * Shows a file in a new focused tab in the given workspace.
	 * @param workspaceId The workspace in which to open the file.
	 * @param absolutePath The absolute path of the file to show.
	 * @param line The line to show, from 1, or null to show the file from its start.
	 * @param anchor The Markdown heading to show, or null to show the file from its start.
	 * @returns True when the file opens, or false when Herdr fails.
	 */
	static async openInNewTab(
		workspaceId: string,
		absolutePath: string,
		line: number | null = null,
		anchor: string | null = null,
	): Promise<boolean> {
		if (line !== null) {
			fileViewLineRequests[absolutePath] = {
				line,
				sequence: ++lineRequestSequence,
			};
		} else {
			delete fileViewLineRequests[absolutePath];
		}
		if (anchor !== null) {
			fileViewAnchorRequests[absolutePath] = anchor;
		} else {
			delete fileViewAnchorRequests[absolutePath];
		}
		const label = FileViewLabel.format(absolutePath);
		return ViewPanes.openInNewTab(workspaceId, FileViewLabel.fileName(label) ?? absolutePath, label, WAIT_LINE);
	}
}
