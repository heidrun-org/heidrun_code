import { computed, effectScope, reactive, watch, type EffectScope } from 'vue';
import { ChatImages } from './chat_images';
import { selectedPane } from './session';
import type { AgentInfo } from '../lib/types';

// Keeps the images of the chat of the selected pane up to date, for the Clipboard sidebar section and for the image that
// shows when the pointer is over a text [Image #N] of a terminal. It runs also when the Clipboard sidebar section is closed.
// Issues: https://github.com/heidrun-org/heidrun_code/issues/790 and https://github.com/heidrun-org/heidrun_code/issues/924

/** The shortest time between two reads of the images, in milliseconds: the status line of Claude Code reports often. */
const READ_INTERVAL_MILLISECONDS = 2000;

/** The chat that the follower reads. */
export type ChatImagesFollowerState = {
	/** The pane whose chat is read, or null when no pane is selected. */
	paneId: string | null;
	/** The chat session identifier of the chat of the pane, or null when the pane has no chat that Heidrun Code knows. */
	sessionId: string | null;
};

/** Follows the selected pane and reads the images of its chat. */
export class ChatImagesFollower {
	/** The chat that the follower reads. */
	static readonly state = reactive<ChatImagesFollowerState>({
		paneId: null,
		sessionId: null,
	});

	/** The scope of the watchers, or null when the follower does not run. */
	private static _scope: EffectScope | null = null;

	/** The time of the last read, in milliseconds. */
	private static _lastReadAt = 0;

	/** The timer of the next read, or null. */
	private static _timer: ReturnType<typeof setTimeout> | null = null;

	/** Starts the follower, and reads the images of the chat of the selected pane at once. A second call does nothing. */
	static start(): void {
		if (ChatImagesFollower._scope !== null) {
			return;
		}
		ChatImagesFollower._scope = effectScope(true);
		ChatImagesFollower._scope.run(() => ChatImagesFollower._follow());
	}

	/** Stops the follower and its timer. */
	static stop(): void {
		ChatImagesFollower._scope?.stop();
		ChatImagesFollower._scope = null;
		if (ChatImagesFollower._timer !== null) {
			clearTimeout(ChatImagesFollower._timer);
			ChatImagesFollower._timer = null;
		}
	}

	/**
	 * Reads the chat identifier reported for the pane. Claude Code supplies it through its status line.
	 * @param pane The selected pane, or null.
	 * @returns The identifier, or null when the pane has no known chat.
	 */
	static chatSessionId(pane: AgentInfo | null): string | null {
		if (pane === null) {
			return null;
		}
		if (pane.agent_session?.agent === 'codex' && pane.agent !== 'claude') {
			return pane.agent_session.value || null;
		}
		if (pane.agent === 'codex') {
			return null;
		}
		return pane.tokens?.hd_sid ?? null;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/** Creates the watchers. Runs inside the scope of the follower. */
	private static _follow(): void {
		const state = ChatImagesFollower.state;
		const sessionId = computed(() => ChatImagesFollower.chatSessionId(selectedPane.value));
		const isCodexWorking = computed(() =>
			sessionId.value !== null
			&& selectedPane.value?.agent_session?.agent === 'codex'
			&& selectedPane.value.agent_status === 'working',
		);
		const readSoonFn = () => ChatImagesFollower._readSoon(() => sessionId.value, () => isCodexWorking.value);
		const reportTime = computed(() => `${selectedPane.value?.tokens?.hd_ts ?? ''}|${selectedPane.value?.agent_status ?? ''}`);

		watch(
			[() => selectedPane.value?.pane_id ?? null, sessionId],
			([paneId, current]) => {
				state.paneId = paneId;
				state.sessionId = current;
			},
			{ immediate: true },
		);
		watch(
			sessionId,
			(current) => {
				// A new chat shows at once, without the images of the chat before.
				ChatImagesFollower._lastReadAt = Date.now();
				void ChatImages.load(current);
				if (isCodexWorking.value === true) {
					readSoonFn();
				}
			},
			{ immediate: true },
		);
		watch(reportTime, readSoonFn);
	}

	/**
	 * Reads the images again, at most once every `READ_INTERVAL_MILLISECONDS`.
	 * @param sessionIdFn Gives the chat session identifier to read at the time of the read.
	 * @param isCodexWorkingFn Tells whether to keep reading while Codex is working.
	 */
	private static _readSoon(sessionIdFn: () => string | null, isCodexWorkingFn: () => boolean): void {
		if (ChatImagesFollower._timer !== null) {
			return;
		}
		const scope = ChatImagesFollower._scope;
		const wait = Math.max(0, ChatImagesFollower._lastReadAt + READ_INTERVAL_MILLISECONDS - Date.now());
		ChatImagesFollower._timer = setTimeout(async () => {
			ChatImagesFollower._timer = null;
			ChatImagesFollower._lastReadAt = Date.now();
			await ChatImages.load(sessionIdFn());
			if (ChatImagesFollower._scope === scope && isCodexWorkingFn() === true) {
				ChatImagesFollower._readSoon(sessionIdFn, isCodexWorkingFn);
			}
		}, wait);
	}
}
