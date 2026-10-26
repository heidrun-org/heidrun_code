import { HtmlEscape } from '../html_escape';
import { Icon } from './icon';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ScreenHeader — the bar at the top of a screen
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws the top bar of a screen.
 */
export class ScreenHeader {
	/**
	 * Draws the top bar of a screen of the bottom bar: the branding icon, title, and connection to the computer.
	 * @param title The title of the screen.
	 * @param isOnline True when the last call worked, false when it failed, null before the first call.
	 * @param isSettingsButtonShown True to show the gear button, which opens the settings of the phone.
	 * @returns The HTML of the top bar.
	 */
	static renderTab(title: string, isOnline: boolean | null, isSettingsButtonShown = false): string {
		const settingsHtmlContent = isSettingsButtonShown
			? /* html */`
				<button class="icon-button" data-action="open-settings" aria-label="Settings" title="Settings">
					${Icon.render('gear', 20)}
				</button>
			`
			: '';
		const connection = isOnline === true ? 'dot-ok' : isOnline === false ? 'dot-blocked' : 'dot-idle';
		const connectionText = isOnline === true ? 'Connected' : 'Not connected';
		const headerHtmlContent = /* html */`
			<header class="top">
				<span class="branding-icon" role="img" aria-label="Heidrun Code">
					${Icon.render('heidrun-goat-only', 24)}
				</span>
				<h1>${HtmlEscape.escape(title)}</h1>
				<span class="dot ${connection}" role="img" aria-label="${connectionText}"></span>
				${settingsHtmlContent}
			</header>
		`;
		return headerHtmlContent;
	}

	/**
	 * Draws the top bar of the screen of one pane: a back button, the title, a badge, the macro button, and a button
	 * that refreshes the output.
	 * @param title The title of the screen.
	 * @param badgeHtmlContent The HTML of the badge, or an empty text.
	 * @param isMacroButtonShown True to show the macro button, which opens the list of the macros of the pane.
	 * @returns The HTML of the top bar.
	 */
	static renderPane(title: string, badgeHtmlContent: string, isMacroButtonShown: boolean): string {
		const macroHtmlContent = isMacroButtonShown
			? /* html */`
				<button class="icon-button" data-action="open-macros" aria-label="Macros" title="Macros">
					${Icon.render('lightning-charge', 20)}
				</button>
			`
			: '';
		const headerHtmlContent = /* html */`
			<header class="top">
				<button class="back" data-action="back" aria-label="Back">
					${Icon.render('chevron-left', 24)}
				</button>
				<h1>${HtmlEscape.escape(title)}</h1>
				${badgeHtmlContent}
				${macroHtmlContent}
				<button class="icon-button" data-action="refresh" aria-label="Refresh" title="Refresh">
					${Icon.render('arrow-clockwise', 20)}
				</button>
			</header>
		`;
		return headerHtmlContent;
	}
}
