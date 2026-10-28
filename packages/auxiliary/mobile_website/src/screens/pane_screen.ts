import type { AgentView, TerminalTyping } from '../mobile_types';
import { HtmlEscape } from '../html_escape';
import { OutputText } from '../output_text';
import { StatusLabels } from '../components/status_labels';
import { MenuButtons } from '../components/menu_buttons';
import { ScreenHeader } from '../components/screen_header';
import { Icon } from '../components/icon';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	PaneScreen — one pane: the end of its output, its menu, a field for a prompt, and the buttons that stop it
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The screen of one pane that runs a coding agent. The center shows only the output of the pane, edge to edge.
 */
export class PaneScreen {
	/** The identifier of the field for a prompt. */
	static readonly promptFieldId = 'prompt-field';

	/**
	 * Draws the screen.
	 * @param agent The coding agent of the pane, or null when the pane does not exist anymore.
	 * @param output The end of the output of the pane.
	 * @param isVoiceAvailable True when the browser can turn the voice into text: the screen shows the microphone
	 * button. False: the microphone key of the keyboard of the phone is the fallback.
	 * @param terminalTyping What the developer can do to type in a plain terminal. A coding agent always has its field
	 * for a prompt.
	 * @returns The HTML of the screen, without the bottom bar.
	 */
	static render(agent: AgentView | null, output: string, isVoiceAvailable: boolean, terminalTyping: TerminalTyping): string {
		if (agent === null) {
			const missingHtmlContent = /* html */`
				${ScreenHeader.renderPane('Coding agent', '', false)}
				<main><div class="empty">This coding agent does not exist anymore.</div></main>
			`;
			return missingHtmlContent;
		}
		const color = StatusLabels.colorName(agent);
		const label = HtmlEscape.escape(StatusLabels.label(agent));
		const badgeHtmlContent = /* html */`<span class="badge badge-${color}">${label}</span>`;
		const paneId = HtmlEscape.escape(agent.paneId);
		const placeholder = HtmlEscape.escape(`Prompt for ${agent.name}…`);
		const outputHtmlContent = OutputText.toHtml(output);
		const shownHtmlContent = outputHtmlContent === '' ? '…' : outputHtmlContent;
		if (agent.hasCodingAgent === false) {
			return PaneScreen.renderTerminal(agent, outputHtmlContent, badgeHtmlContent, isVoiceAvailable, terminalTyping);
		}
		const isBlocked = agent.status === 'blocked';
		const isWorking = agent.status === 'working';
		const denyHtmlContent = isBlocked ? PaneScreen.renderDangerButton('deny', 'Refuse', paneId) : '';
		const stopHtmlContent = isWorking ? PaneScreen.renderStopButton(paneId) : '';
		const micHtmlContent = isVoiceAvailable ? PaneScreen.renderMicButton() : '';
		const actionsHtmlContent =
			denyHtmlContent === '' ? '' : /* html */`<div class="actions">${denyHtmlContent}</div>`;
		const screenHtmlContent = /* html */`
			${ScreenHeader.renderPane(`${agent.workspace} · ${agent.tab}`, badgeHtmlContent, true)}
			<main class="pane-main">
				${PaneScreen.renderQuestion(agent)}
				<pre class="output"><code class="output-text">${shownHtmlContent}</code></pre>
				${actionsHtmlContent}
			</main>
			<div class="composer">
				<textarea
					id="${PaneScreen.promptFieldId}"
					placeholder="${placeholder}"
					rows="1"
					enterkeyhint="send"
				></textarea>
				${micHtmlContent}
				${stopHtmlContent}
				<button
					class="send-button"
					data-action="send"
					data-pane-id="${paneId}"
					aria-label="Send"
					title="Send (Cmd+Enter)"
				>
					${Icon.render('send-fill', 20)}
				</button>
			</div>
		`;
		return screenHtmlContent;
	}

	/**
	 * Draws the screen of a plain terminal. The phone only reads it, until the developer allows typing: then the
	 * screen has a field for a command. A terminal has no macro button and no button that stops it.
	 * @param agent The pane of the plain terminal.
	 * @param outputHtmlContent The HTML of the end of its output.
	 * @param badgeHtmlContent The HTML of the badge of the header.
	 * @param isVoiceAvailable True when the browser can turn the voice into text.
	 * @param terminalTyping What the developer can do to type in this terminal.
	 * @returns The HTML of the screen, without the bottom bar.
	 */
	private static renderTerminal(
		agent: AgentView,
		outputHtmlContent: string,
		badgeHtmlContent: string,
		isVoiceAvailable: boolean,
		terminalTyping: TerminalTyping,
	): string {
		const shownHtmlContent = outputHtmlContent === '' ? '…' : outputHtmlContent;
		const paneId = HtmlEscape.escape(agent.paneId);
		const noticeText = {
			off: 'The phone only reads this terminal. Typing is off in the Settings window of Heidrun Code.',
			locked: 'The phone only reads this terminal until you allow typing.',
			unlocked: 'Every command passes the guards before it runs.',
		}[terminalTyping];
		const micHtmlContent = isVoiceAvailable ? PaneScreen.renderMicButton() : '';
		const composerHtmlContent = terminalTyping === 'unlocked'
			? /* html */`
				<div class="composer">
					<textarea
						id="${PaneScreen.promptFieldId}"
						placeholder="${HtmlEscape.escape(`Command for ${agent.name}…`)}"
						rows="1"
						enterkeyhint="send"
					></textarea>
					${micHtmlContent}
					<button
						class="send-button"
						data-action="send"
						data-pane-id="${paneId}"
						aria-label="Send"
						title="Send (Cmd+Enter)"
					>
						${Icon.render('send-fill', 20)}
					</button>
				</div>
			`
			: terminalTyping === 'locked'
				? /* html */`
					<div class="composer">
						<button class="button button-danger" data-action="typing-ask">Type in this terminal…</button>
					</div>
				`
				: '';
		const terminalHtmlContent = /* html */`
			${ScreenHeader.renderPane(`${agent.workspace} · ${agent.tab}`, badgeHtmlContent, false)}
			<main class="pane-main">
				<div class="question">${noticeText}</div>
				<pre class="output"><code class="output-text">${shownHtmlContent}</code></pre>
			</main>
			${composerHtmlContent}
		`;
		return terminalHtmlContent;
	}

	/**
	 * Draws what the coding agent waits for: its menu when it is blocked, or its question.
	 * @param agent The coding agent.
	 * @returns The HTML of the question, or an empty text.
	 */
	private static renderQuestion(agent: AgentView): string {
		if (agent.status === 'blocked' && agent.menu !== null) {
			const menuHtmlContent = /* html */`
				<div class="menu">
					${PaneScreen.renderLine('question', agent.menu.question)}
					${PaneScreen.renderLine('detail', agent.menu.detail)}
					${MenuButtons.render(agent)}
				</div>
			`;
			return menuHtmlContent;
		}
		if (agent.status === 'blocked') {
			const waitingText = 'Waiting for a decision: read the end of the output below.';
			return PaneScreen.renderLine('question', waitingText);
		}
		return PaneScreen.renderLine('question', agent.question);
	}

	/**
	 * Draws one line of text, or nothing when there is no text.
	 * @param className The class of the line: `question` or `detail`.
	 * @param text The text, not escaped yet, or null.
	 * @returns The HTML of the line, or an empty text.
	 */
	private static renderLine(className: string, text: string | null): string {
		if (text === null || text === '') {
			return '';
		}
		const lineHtmlContent = /* html */`<div class="${className}">${HtmlEscape.escape(text)}</div>`;
		return lineHtmlContent;
	}

	/**
	 * Draws the microphone button. A tap starts to listen, and the words go into the field for a prompt. A second
	 * tap stops to listen.
	 * @returns The HTML of the button.
	 */
	private static renderMicButton(): string {
		const buttonHtmlContent = /* html */`
			<button
				class="mic-button"
				data-action="voice"
				aria-label="Dictate"
				aria-pressed="false"
				title="Dictate the prompt"
			>
				${Icon.render('mic-fill', 20)}
			</button>
		`;
		return buttonHtmlContent;
	}

	/**
	 * Draws the button that interrupts a working coding agent: the stop icon, a red square, next to the button
	 * Send.
	 * @param paneId The identifier of the pane, already escaped.
	 * @returns The HTML of the button.
	 */
	private static renderStopButton(paneId: string): string {
		const buttonHtmlContent = /* html */`
			<button
				class="stop-button"
				data-action="interrupt"
				data-pane-id="${paneId}"
				aria-label="Interrupt"
				title="Interrupt (Esc)"
			>
				${Icon.render('stop-fill', 20)}
			</button>
		`;
		return buttonHtmlContent;
	}

	/**
	 * Draws a red button that sends a key to the coding agent.
	 * @param action The name of the action that the page sends.
	 * @param label The text of the button.
	 * @param paneId The identifier of the pane, already escaped.
	 * @returns The HTML of the button.
	 */
	private static renderDangerButton(action: string, label: string, paneId: string): string {
		const buttonHtmlContent = /* html */`
			<button class="button button-danger" data-action="${action}" data-pane-id="${paneId}">
				${label}
			</button>
		`;
		return buttonHtmlContent;
	}
}
