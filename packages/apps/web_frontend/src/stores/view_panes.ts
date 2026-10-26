import * as api from '../lib/api';
import { refresh, selectPane, selectedPane, toast } from './session';
import { WorkspaceFolders } from './workspace_folders';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ViewPanes — opens a pane that Heidrun Code draws over a terminal that only waits
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** What a kind of view pane gives to `ViewPanes.open`: the file view pane and the diff pane. */
export type ViewPaneOptions = {
	/** The label of the pane, which marks its kind and holds the absolute path of the file. */
	label: string;
	/** True when a label marks a pane of the same kind, so that the new label replaces its label and no new pane opens. */
	isSameKindFn: (label: string | null | undefined) => boolean;
	/** The text that the waiting terminal prints for the person who looks at the pane in Herdr. */
	waitLine: string;
};

/** Opens a view pane: a pane that shows a file, read only, over a terminal that only waits. */
export class ViewPanes {
	/**
	 * Shows a view pane. When the selected pane is of the same kind, the new label replaces its label. Otherwise a new pane
	 * opens to the right of the selected pane, and the selected pane stays as it was.
	 * @param options The label, the test of the kind, and the line of the waiting terminal.
	 * @returns True when a view pane shows the file, false when there is no selected pane or when Herdr failed.
	 */
	static async open(options: ViewPaneOptions): Promise<boolean> {
		const pane = selectedPane.value;
		if (pane === null) {
			return false;
		}
		try {
			if (options.isSameKindFn(pane.label)) {
				await api.renamePane(pane.pane_id, options.label);
				await refresh();
				return true;
			}
			const folder = WorkspaceFolders.require(pane.workspace_id);
			const newPane = await api.split(pane.pane_id, 'right', folder);
			await api.renamePane(newPane.pane_id, options.label);
			await api.run(newPane.pane_id, ViewPanes.waitCommand(options.waitLine));
			await refresh();
			selectPane(newPane);
			return true;
		} catch (error) {
			toast(String(error), 'error');
			return false;
		}
	}

	/**
	 * Writes the command that runs under a view pane. It prints a line for the person who looks at the terminal in Herdr, then
	 * waits for about three years, so that nobody types a command into the terminal that the view hides.
	 * @param waitLine The line to print. It holds no single quote.
	 * @returns The command to run with `herdr pane run`.
	 */
	static waitCommand(waitLine: string): string {
		return `echo '${waitLine}'; sleep 99999999`;
	}
}
