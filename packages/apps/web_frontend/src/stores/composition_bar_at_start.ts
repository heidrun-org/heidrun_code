import { agentKind } from '../lib/format';
import type { PaneInfo } from '../lib/types';
import { CompositionBar } from './composition_bar';
import { settings } from './settings';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	CompositionBarAtStart — opens the composition bar of the coding agents that Herdr kept running (issue 865)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** Opens the composition bar of each pane that already runs a coding agent when Heidrun Code starts. */
export class CompositionBarAtStart {
	/** The kinds of coding agent that the switch "Show the composition bar when starting a coding agent" covers. */
	private static readonly _CODING_AGENT_KINDS = ['Claude', 'Codex', 'Antigravity'];

	/**
	 * Opens the composition bar of each pane that runs Claude Code, Codex, or Antigravity, when the switch "Show the
	 * composition bar when starting a coding agent" is on. Herdr keeps these panes running after Heidrun Code quits, and
	 * the composition bar states live only in memory, so no pane has a state at the start. A plain terminal stays closed.
	 * @param panes The panes of the first snapshot that Herdr sends after the start.
	 */
	static openForRunningCodingAgents(panes: PaneInfo[]): void {
		if (settings.isCompositionBarShownOnAgentStart === false) {
			return;
		}
		for (const pane of panes) {
			if (CompositionBarAtStart._CODING_AGENT_KINDS.includes(agentKind(pane)) === false) {
				continue;
			}
			CompositionBar.forPane(pane.pane_id).isOpen = true;
		}
	}
}
