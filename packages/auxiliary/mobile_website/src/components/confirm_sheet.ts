import type { ConfirmRequest } from '../mobile_types';
import { HtmlEscape } from '../html_escape';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	ConfirmSheet — the sheet that asks the developer to check a dangerous command once more
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws the sheet that the guards of Heidrun Code ask for. It shows the whole command, and a second tap confirms.
 */
export class ConfirmSheet {
	/**
	 * Draws the sheet.
	 * @param request The command and the reason why the guards stopped it.
	 * @returns The HTML of the sheet.
	 */
	static render(request: ConfirmRequest): string {
		const sheetHtmlContent = /* html */`
			<div class="sheet" data-action="sheet-cancel">
				<div class="sheet-box">
					<h2>Command to check</h2>
					<p>${HtmlEscape.escape(request.why)}</p>
					<div class="detail">${HtmlEscape.escape(request.command)}</div>
					<div class="actions">
						<button class="button" data-action="sheet-cancel">Cancel</button>
						<button class="button button-danger" data-action="sheet-confirm">
							Confirm anyway
						</button>
					</div>
				</div>
			</div>
		`;
		return sheetHtmlContent;
	}
}
