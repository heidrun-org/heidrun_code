import type { Snapshot } from '../mobile_types';
import { HtmlEscape } from '../html_escape';
import { SnapshotQueries } from '../snapshot_queries';
import { AgentCard } from '../components/agent_card';
import { ScreenHeader } from '../components/screen_header';

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	NeedsYouScreen — the coding agents that wait for the developer
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

/**
 * The screen of the coding agents that wait. It lists the coding agents that are blocked, that ask a question, or
 * that finished, with the blocked ones first. It shows the same coding agents as the Needs you sidebar section of
 * Heidrun Code desktop.
 */
export class NeedsYouScreen {
	/**
	 * Draws the screen.
	 * @param snapshot The answer of the method `state`.
	 * @param isOnline True when the last call worked, false when it failed, null before the first call.
	 * @returns The HTML of the screen, without the bottom bar.
	 */
	static render(snapshot: Snapshot, isOnline: boolean | null): string {
		const agents = SnapshotQueries.attentionAgents(snapshot);
		const quotaItemsHtmlContent = snapshot.quotas
			.map((quota) => HtmlEscape.escape(`${quota.name} ${quota.percent} %`))
			.map((text) => /* html */`<span>${text}</span>`)
			.join('');
		const quotasHtmlContent =
			quotaItemsHtmlContent === ''
				? ''
				: /* html */`<div class="quota">${quotaItemsHtmlContent}</div>`;
		const cardsHtmlContent =
			agents.length === 0
				? /* html */`<div class="empty">Nothing waits for your decision.</div>`
				: agents.map((agent) => AgentCard.renderAttention(agent, snapshot.now)).join('');
		const screenHtmlContent = /* html */`
			${ScreenHeader.renderTab('Needs you', isOnline)}
			<main>
				${quotasHtmlContent}
				${cardsHtmlContent}
			</main>
		`;
		return screenHtmlContent;
	}
}
