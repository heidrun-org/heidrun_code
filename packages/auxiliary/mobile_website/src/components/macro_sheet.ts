import type { MacroView } from '../mobile_types';
import { HtmlEscape } from '../html_escape';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MacroSheet — the sheet that lists the macros of the open pane
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws the list of the macros, over the screen of one pane. A tap on a macro writes its text into the field for a
 * prompt. A tap outside the list, or on Cancel, closes the sheet.
 */
export class MacroSheet {
	/**
	 * Draws the sheet.
	 * @param macros The macros of the pane: the personal macros, then the macros of the project.
	 * @returns The HTML of the sheet.
	 */
	static render(macros: MacroView[]): string {
		const listHtmlContent =
			macros.length === 0
				? /* html */`<p>No macro. Add a macro in Heidrun Code on the computer.</p>`
				: macros.map((macro, index) => MacroSheet.renderMacro(macro, index)).join('');
		const sheetHtmlContent = /* html */`
			<div class="sheet macro-sheet" data-action="macro-sheet-close">
				<div class="sheet-box">
					<h2>Macros</h2>
					<div class="list">${listHtmlContent}</div>
					<div class="actions">
						<button class="button" data-action="macro-sheet-close">Cancel</button>
					</div>
				</div>
			</div>
		`;
		return sheetHtmlContent;
	}

	/**
	 * Draws one macro as a button.
	 * @param macro The macro.
	 * @param index The place of the macro in the list.
	 * @returns The HTML of the button.
	 */
	private static renderMacro(macro: MacroView, index: number): string {
		const source = macro.source === 'personal' ? 'My macro' : 'Project';
		const description = macro.description === '' ? source : `${source} · ${macro.description}`;
		const macroHtmlContent = /* html */`
			<button class="card macro" data-action="insert-macro" data-index="${index}">
				<span class="name">${HtmlEscape.escape(macro.label)}</span>
				<span class="sub">${HtmlEscape.escape(description)}</span>
			</button>
		`;
		return macroHtmlContent;
	}
}
