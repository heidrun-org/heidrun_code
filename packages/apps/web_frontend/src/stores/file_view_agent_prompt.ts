// Asks the coding agent of the tab of a file view pane to explain or to fix the selected lines of the file.
// - issue #901
import { allPanes, insertText, selectPane, toast } from './session';
import { paneFocusHistory } from './pane_focus_history_state';
import { languageFor } from '../lib/highlight';
import type { AgentInfo } from '../lib/types';
import { t } from '../i18n/index';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	FileViewAgentPrompt — writes a prompt about selected lines into the coding agent of the tab
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** What the developer asks the coding agent about the selected lines. */
export type FileViewAgentRequest = 'explain' | 'fix';

/** The selected lines of a file view pane. */
export type FileViewSelectedLines = {
	/** The path of the file inside the project. */
	path: string;
	/** The first selected line, from 1. */
	fromLine: number;
	/** The last selected line, from 1. */
	toLine: number;
	/** The selected text. */
	text: string;
};

/** Writes a prompt about the selected lines of a file view pane into the coding agent of the same tab. */
export class FileViewAgentPrompt {
	/**
	 * Finds the coding agent that receives the prompt: the coding agent of the tab that had the keyboard last, or else
	 * the first coding agent of the tab.
	 * @param filePane The file view pane.
	 * @returns The pane of the coding agent, or null when the tab has no coding agent.
	 */
	static targetPane(filePane: AgentInfo): AgentInfo | null {
		const agentPanes = allPanes.value.filter(
			(pane) =>
				pane.tab_id === filePane.tab_id &&
				pane.pane_id !== filePane.pane_id &&
				pane.agent !== null &&
				pane.agent !== undefined,
		);
		if (agentPanes.length === 0) {
			return null;
		}
		const historyPaneIds = paneFocusHistory.paneIds;
		for (let index = historyPaneIds.length - 1; index >= 0; index--) {
			const agentPane = agentPanes.find((pane) => pane.pane_id === historyPaneIds[index]);
			if (agentPane !== undefined) {
				return agentPane;
			}
		}
		return agentPanes[0];
	}

	/**
	 * Writes the prompt into the coding agent of the tab, and selects that pane. Enter is not pressed, so that the
	 * developer can change the prompt first.
	 * @param filePane The file view pane.
	 * @param selectedLines The selected lines.
	 * @param request What the developer asks.
	 * @returns True when the prompt is written, false when the tab has no coding agent.
	 */
	static async ask(filePane: AgentInfo, selectedLines: FileViewSelectedLines, request: FileViewAgentRequest): Promise<boolean> {
		const agentPane = FileViewAgentPrompt.targetPane(filePane);
		if (agentPane === null) {
			toast(t('fileView.ask.noCodingAgent'), 'error');
			return false;
		}
		await insertText(agentPane.pane_id, FileViewAgentPrompt.prompt(selectedLines, request), false);
		selectPane(agentPane);
		return true;
	}

	/**
	 * Writes the prompt: the path, the lines, the selected code, and the request.
	 * @param selectedLines The selected lines.
	 * @param request What the developer asks.
	 * @returns The text of the prompt.
	 */
	static prompt(selectedLines: FileViewSelectedLines, request: FileViewAgentRequest): string {
		const where =
			selectedLines.fromLine === selectedLines.toLine
				? t('fileView.ask.line', { line: selectedLines.fromLine })
				: t('fileView.ask.lines', { from: selectedLines.fromLine, to: selectedLines.toLine });
		return t('fileView.ask.prompt', {
			path: selectedLines.path,
			where,
			language: languageFor(selectedLines.path) ?? '',
			code: selectedLines.text.replace(/\n$/, ''),
			ask: request === 'explain' ? t('fileView.ask.explain') : t('fileView.ask.fix'),
		});
	}
}
