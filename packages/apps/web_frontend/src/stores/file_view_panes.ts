import { FileViewLabel } from '../lib/file_view_label';
import { ViewPanes } from './view_panes';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FileViewPanes — opens a file in a file view pane
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Opens a file in a file view pane: a pane that shows the file, read only, over a terminal that only waits. */
export class FileViewPanes {
	/**
	 * Shows a file in a file view pane. When the selected pane is a terminal, a new pane opens to its right and the terminal
	 * stays as it was. When the selected pane is a file view pane, the file replaces the file of that pane.
	 * @param absolutePath The absolute path of the file to show.
	 * @returns True when a file view pane shows the file, false when there is no selected pane or when Herdr failed.
	 */
	static async open(absolutePath: string): Promise<boolean> {
		return ViewPanes.open({
			label: FileViewLabel.format(absolutePath),
			isSameKindFn: (label) => FileViewLabel.parse(label) !== null,
			waitLine: 'Below the file view of Heidrun',
		});
	}
}
