///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	TypingSheet — the warning that the developer reads before typing in a terminal from the phone
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws the sheet that asks the developer to allow typing in a plain terminal. Typing on a phone is hard, and a
 * wrong key can run a command that the developer did not mean, so the phone only reads a terminal until the
 * developer says yes.
 */
export class TypingSheet {
	/**
	 * Draws the sheet.
	 * @returns The HTML of the sheet.
	 */
	static render(): string {
		const sheetHtmlContent = /* html */`
			<div class="sheet typing-sheet" data-action="typing-cancel">
				<div class="sheet-box">
					<h2>Type in this terminal?</h2>
					<p>
						Typing on a phone is hard. A mistake can run a command that you did not mean, in a real
						terminal on your computer.
					</p>
					<p>Heidrun Code checks every command with the guards before it runs, and asks you again when a guard stops it.</p>
					<div class="actions">
						<button class="button" data-action="typing-cancel">Cancel</button>
						<button class="button button-danger" data-action="typing-allow">Yes, let me type</button>
					</div>
				</div>
			</div>
		`;
		return sheetHtmlContent;
	}
}
