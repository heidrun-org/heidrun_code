import identity from '../../../../../data/identity.json';
import babyGoatImageUrl from '../assets/baby_goat.webp';
import { HtmlEscape } from '../html_escape';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	WelcomeScreen — the first page: the baby goat, the name, what Heidrun Code does, and the button "Go to the app"
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The welcome page. The page opens on it when its address names no screen. It needs no data from the computer, so it
 * draws before the pairing and before the first answer. It has no bottom bar.
 */
export class WelcomeScreen {
	/**
	 * Draws the page. The name, the motto, and the description come from the file `data/identity.json`, the one
	 * place where Heidrun Code keeps them.
	 * @returns The HTML of the page.
	 */
	static render(): string {
		const name = HtmlEscape.escape(identity.title);
		const motto = HtmlEscape.escape(identity.motto.en);
		const description = WelcomeScreen.renderSentences(identity.description.en);
		const imageUrl = HtmlEscape.escape(babyGoatImageUrl);
		const screenHtmlContent = /* html */`
			<main class="welcome">
				<div class="welcome-picture">
					<img
						class="welcome-image"
						src="${imageUrl}"
						width="640"
						height="640"
						alt="The baby goat of Heidrun Code, with a golden crown and golden horns"
					>
				</div>
				<div class="welcome-text">
					<h1 class="welcome-name">${name}</h1>
					<p class="welcome-motto">${motto}</p>
					<p class="welcome-description">${description}</p>
				</div>
				<button
					class="button button-primary welcome-button"
					data-action="go"
					data-screen="dashboard"
				>
					Go to the app
				</button>
			</main>
		`;
		return screenHtmlContent;
	}

	/**
	 * Puts each sentence on its own line, so a line never breaks inside a sentence and leaves one word alone.
	 * @param text The text, with one or more sentences.
	 * @returns The HTML of the sentences, escaped.
	 */
	private static renderSentences(text: string): string {
		return text
			.split(/(?<=[.!?])\s+/)
			.filter((sentence) => sentence !== '')
			.map((sentence) => /* html */`<span class="welcome-line">${HtmlEscape.escape(sentence)}</span>`)
			.join('');
	}
}
