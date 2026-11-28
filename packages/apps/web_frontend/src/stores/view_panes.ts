import * as api from '../lib/api';
import { refresh, selectPane, toast } from './session';
import { WorkspaceFolders } from './workspace_folders';
import type { PaneInfo } from '../lib/types';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ViewPanes — opens a pane that Heidrun Code draws over a terminal that only waits
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Opens a view pane over a terminal that only waits. */
export class ViewPanes {
	/**
	 * Creates a tab with one view pane and selects that pane when ready.
	 * @param workspaceId The workspace in which to create the tab.
	 * @param tabLabel The name shown in the tab bar.
	 * @param label The label that identifies the pane as a view pane.
	 * @param waitLine The text printed by the waiting terminal.
	 * @returns True when the view opens, or false when Herdr fails.
	 */
	static async openInNewTab(
		workspaceId: string,
		tabLabel: string,
		label: string,
		waitLine: string,
	): Promise<boolean> {
		let pane: PaneInfo | undefined;
		try {
			pane = await api.newTab(workspaceId, WorkspaceFolders.require(workspaceId), tabLabel);
			await ViewPanes._show(pane, label, waitLine);
			return true;
		} catch (error) {
			if (pane !== undefined) {
				try {
					await api.closePane(pane.pane_id);
				} catch (closeError) {
					toast(`${String(error)}. ${String(closeError)}`, 'error');
					return false;
				}
			}
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

	/**
	 * Configures a new view pane before selecting it.
	 * @param pane The new pane.
	 * @param label The label that identifies the view.
	 * @param waitLine The text printed by the waiting terminal.
	 * @returns A promise that resolves after the pane is selected.
	 */
	private static async _show(pane: PaneInfo, label: string, waitLine: string): Promise<void> {
		await api.renamePane(pane.pane_id, label);
		await api.run(pane.pane_id, ViewPanes.waitCommand(waitLine));
		await refresh();
		selectPane(pane);
	}
}
