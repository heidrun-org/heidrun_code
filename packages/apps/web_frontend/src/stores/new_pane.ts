import { WorkspaceFolders } from './workspace_folders';
import { launchAgent } from './agents';
import { newTerminal, newWorkspace, selectedWorkspace, splitPane } from './session';
import { settings } from './settings';
import type { PaneInfo } from '../lib/types';
import type { NewTabCommand } from './new_tab_commands';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	NewPane — starts the preferred application in a tab, split pane, or workspace
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Creates panes directly with the preferred application or a terminal. */
export class NewPane {
	/**
	 * Starts the preferred application, or a terminal while Shift is held.
	 * @param event - The click on the plus button of the tab bar.
	 * @returns A promise that ends when the application starts.
	 */
	static async onNewPaneClick(event: MouseEvent): Promise<void> {
		if (event.shiftKey === true) {
			await newTerminal();
			return;
		}
		await NewPane.startDefaultNewTab();
	}

	/**
	 * Splits a pane and starts the preferred application, or a terminal while Shift is held.
	 * @param event - The click on the split control.
	 * @param direction - Where the new pane goes.
	 * @param paneId - The pane to split, or the selected pane when omitted.
	 * @returns A promise that ends when the application starts.
	 */
	static async onSplitPaneClick(event: MouseEvent, direction: 'right' | 'down', paneId?: string): Promise<void> {
		if (event.shiftKey === true) {
			await splitPane(direction, paneId);
			return;
		}
		await NewPane.startDefaultSplit(direction, paneId);
	}

	/**
	 * Starts the preferred application in a split pane, preserving the tab name.
	 * @param direction - Where the new pane goes.
	 * @param paneId - The pane to split, or the selected pane when omitted.
	 * @returns A promise that ends when the application starts.
	 */
	static async startDefaultSplit(direction: 'right' | 'down', paneId?: string): Promise<void> {
		const pane = await splitPane(direction, paneId);
		if (pane !== undefined) {
			await NewPane._startDefaultPane(pane, '');
		}
	}

	/**
	 * Starts the preferred application in a new tab, for the plus button and Command+T.
	 * @returns A promise that ends when the application starts.
	 */
	static async startDefaultNewTab(): Promise<void> {
		await NewPane._startDefaultPane();
	}

	/**
	 * Starts one chosen command in a new tab, whatever the default command is, for the list of the plus button.
	 * @param commandId - The command to start.
	 * @returns A promise that ends when the application starts.
	 */
	static async startNewTab(commandId: NewTabCommand['id']): Promise<void> {
		await NewPane._startDefaultPane(undefined, commandId, commandId);
	}

	/**
	 * Creates a workspace and starts the preferred application in the workspace's first pane.
	 * @param cwd - The workspace folder, absolute or starting with `~`.
	 * @param label - The workspace name.
	 * @returns A promise that ends when the application starts.
	 */
	static async openNewWorkspace(cwd: string | null, label: string | null): Promise<void> {
		const pane = await newWorkspace(cwd, label);
		if (pane !== undefined) {
			await NewPane._startDefaultPane(pane);
		}
	}

	/**
	 * Starts a free coding agent with the default model and no starting prompt, or a terminal.
	 * @param existingPane - A pane already created by a split or a new workspace.
	 * @param label - The tab name, or an empty name to preserve the current tab name.
	 * @param tool - The command to start, the default command of a new tab when omitted.
	 * @returns A promise that ends when the application starts or reports a failure.
	 */
	private static async _startDefaultPane(
		existingPane?: PaneInfo,
		label: string = settings.newTabCommand,
		tool: NewTabCommand['id'] = settings.newTabCommand,
	): Promise<void> {
		const workspace = selectedWorkspace.value;
		if (workspace === null || workspace === undefined) {
			return;
		}
		if (tool === 'terminal') {
			if (existingPane === undefined) {
				await newTerminal();
			}
			return;
		}
		await launchAgent({
			workspaceId: workspace.workspace_id,
			cwd: WorkspaceFolders.get(workspace.workspace_id),
			tool,
			agent: null,
			model: null,
			label,
			prompt: '',
			existingPane,
		});
	}
}
