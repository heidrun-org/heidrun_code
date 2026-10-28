import type { AgentView } from '../mobile_types';
import { HtmlEscape } from '../html_escape';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MenuButtons — one button for each choice of the menu that blocks a coding agent
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws the choices of a menu. A tap sends the number of the choice. The guards of Heidrun Code check a dangerous command
 * on the computer before the choice goes to the coding agent.
 */
export class MenuButtons {
	/**
	 * Draws the buttons of the menu of one coding agent.
	 * @param agent A blocked coding agent.
	 * @returns The HTML of the buttons, or an empty text when the coding agent has no menu.
	 */
	static render(agent: AgentView): string {
		if (agent.menu === null) {
			return '';
		}
		const paneId = HtmlEscape.escape(agent.paneId);
		return agent.menu.options
			.map((option) => {
				const tone = MenuButtons.tone(option.label);
				const number = HtmlEscape.escape(option.n);
				const buttonHtmlContent = /* html */`
					<button class="option ${tone}"
						data-action="answer"
						data-pane-id="${paneId}"
						data-n="${number}"
					>
						<span class="option-number">${HtmlEscape.escape(option.n)}.</span>
						<span>${HtmlEscape.escape(option.label)}</span>
					</button>
				`;
				return buttonHtmlContent;
			})
			.join('');
	}

	/**
	 * Tells if a choice allows or refuses. The words come from the coding agent, in English or in French.
	 * @param label The text of the choice.
	 * @returns "option-yes" for an allowing choice, "option-no" for a refusing choice, else an empty text.
	 */
	private static tone(label: string): string {
		if (/^(yes|oui|allow|autoriser)/i.test(label)) {
			return 'option-yes';
		}
		if (/^(no|non|deny|refuser)/i.test(label)) {
			return 'option-no';
		}
		return '';
	}
}
