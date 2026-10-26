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
	 * Shows the changes of a file in a diff pane. When the selected pane is a diff pane, the file replaces the file of that pane.
	 * Otherwise a new pane opens to the right of the selected pane, and the selected pane stays as it was.
	 * @param absolutePath The absolute path of the changed file.
	 * @returns True when a diff pane shows the changes, false when there is no selected pane or when Herdr failed.
	 */
	static async open(absolutePath: string): Promise<boolean> {
		return ViewPanes.open({
			label: DiffPaneLabel.format(absolutePath),
			isSameKindFn: (label) => DiffPaneLabel.parse(label) !== null,
			waitLine: 'Below the diff pane of Heidrun',
		});
	}
}
