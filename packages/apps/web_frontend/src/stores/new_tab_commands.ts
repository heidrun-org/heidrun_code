import { settings } from './settings';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	NewTabCommands — the commands that the pane of a new tab can run
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/** One command that the pane of a new tab can run, the option `newTabCommand` of the settings. */
export type NewTabCommand = {
	/** The value of the option `newTabCommand`. */
	id: 'terminal' | 'claude' | 'codex' | 'agy';
	/** The coding agent that must be switched on in the Settings window, or null for the terminal. */
	agentId: 'claude' | 'codex' | 'antigravity' | null;
	/** The key of the name of the command in the locale files. */
	labelKey: string;
	/** The key of the explanation of the command in the locale files. */
	titleKey: string;
};

/** The commands that the pane of a new tab can run, in the order of the Settings window and of the list of the plus button. */
export const NEW_TAB_COMMANDS: readonly NewTabCommand[] = [
	{
		id: 'terminal',
		agentId: null,
		labelKey: 'settingsNewTab.terminalLabel',
		titleKey: 'settingsNewTab.terminalTitle',
	},
	{
		id: 'claude',
		agentId: 'claude',
		labelKey: 'settingsNewTab.claudeLabel',
		titleKey: 'settingsNewTab.claudeTitle',
	},
	{
		id: 'codex',
		agentId: 'codex',
		labelKey: 'settingsNewTab.codexLabel',
		titleKey: 'settingsNewTab.codexTitle',
	},
	{
		id: 'agy',
		agentId: 'antigravity',
		labelKey: 'settingsNewTab.antigravityLabel',
		titleKey: 'settingsNewTab.antigravityTitle',
	},
];

/** Gives the commands of a new tab that the developer can choose. */
export class NewTabCommands {
	/**
	 * Gives the terminal, and each command whose coding agent is switched on in the Settings window.
	 * @returns The available commands, in the order of `NEW_TAB_COMMANDS`.
	 */
	static available(): NewTabCommand[] {
		return NEW_TAB_COMMANDS.filter((command) => command.agentId === null || settings.ownedAgents.includes(command.agentId));
	}
}
