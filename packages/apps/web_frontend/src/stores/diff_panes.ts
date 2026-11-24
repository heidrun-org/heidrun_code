import { DiffPaneLabel } from '../lib/diff_pane_label';
import { ViewPanes } from './view_panes';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	DiffPanes — opens the changes of a file in a diff pane
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Opens the changes of a file in a diff pane: a pane that shows the diff, read only, over a terminal that only waits. */
export class DiffPanes {
	/**
	 * Shows the changes of a file from Source Control in its own focused tab.
	 * @param workspaceId The workspace of Source Control.
	 * @param absolutePath The absolute path of the changed file.
	 * @returns True when the diff opens, or false when Herdr fails.
	 */
	static async openInNewTab(workspaceId: string, absolutePath: string): Promise<boolean> {
		const label = DiffPaneLabel.format(absolutePath);
		return ViewPanes.openInNewTab(
			workspaceId,
			DiffPaneLabel.fileName(label) ?? absolutePath,
			label,
			'Below the diff pane of Heidrun',
		);
	}
}
