///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	MessageScreen — the screens that tell the developer why nothing is shown yet
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * Draws the screen of a phone that is not paired, and the screen of a phone that waits for the first answer of the
 * computer.
 */
export class MessageScreen {
	/**
	 * Draws the screen of a phone that is not paired.
	 * @returns The HTML of the screen.
	 */
	static pairing(): string {
		const screenHtmlContent = /* html */`
			<div class="message">
				<h2>Pairing needed</h2>
				<p>In Heidrun Code on your computer, open "Mobile access".</p>
				<p>Scan the QR code with the camera.</p>
			</div>
		`;
		return screenHtmlContent;
	}

	/**
	 * Draws the screen of a phone that has no answer from the computer yet.
	 * @param isOnline False when the last call failed, null before the first call.
	 * @returns The HTML of the screen.
	 */
	static connecting(isOnline: boolean | null): string {
		const offlineText = 'The computer does not answer. Is Heidrun Code open?';
		const text = isOnline === false ? offlineText : 'Connecting…';
		const screenHtmlContent = /* html */`<div class="message">${text}</div>`;
		return screenHtmlContent;
	}
}
