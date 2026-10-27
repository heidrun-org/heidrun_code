import { computed, effectScope, reactive, ref, watch, type EffectScope } from 'vue';
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
	/** True for a Codex pane whose chat has no title yet, so Heidrun Code cannot find it. */
	isCodexWithoutChat: boolean;
};

/** Follows the selected pane and reads the images of its chat. */
export class ChatImagesFollower {
	/** The chat that the follower reads. */
	static readonly state = reactive<ChatImagesFollowerState>({
		paneId: null,
		sessionId: null,
		isCodexWithoutChat: false,
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
	 * The chat session identifier of the chat of a pane. A Claude Code pane gives the identifier of its status line
	 * (`hd_sid`), a Codex pane gives the chat found from the title of its terminal. A pane where no coding agent runs any
	 * more gives the last identifier of its status line.
	 * @param pane The pane, or null.
	 * @param codexChat The chat found for the pane when it is a Codex pane, or null.
	 * @returns The identifier, or null when the pane has no chat that Heidrun Code knows.
	 */
	static chatSessionId(pane: AgentInfo | null, codexChat: string | null): string | null {
		if (pane === null) {
			return null;
		}
		if (pane.agent === 'codex') {
			return codexChat;
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
		// The chat of the selected Codex pane, found from the title of its terminal and its folder.
		const codexChat = ref<string | null>(null);
		const codexTerminal = computed(() => {
			const pane = selectedPane.value;
			if (pane === null || pane.agent !== 'codex') {
				return null;
			}
			return {
				title: pane.terminal_title_stripped ?? pane.terminal_title ?? '',
				folder: pane.foreground_cwd || pane.cwd || '',
			};
		});
		const sessionId = computed(() => ChatImagesFollower.chatSessionId(selectedPane.value, codexChat.value));
		// The status line of Claude Code writes a new time after each change of the chat. Codex has no status line: a change
		// of the state of the coding agent (working, idle, done) tells that the chat changed.
		const reportTime = computed(() => `${selectedPane.value?.tokens?.hd_ts ?? ''}|${selectedPane.value?.agent_status ?? ''}`);

		watch(
			() => (codexTerminal.value === null ? null : `${codexTerminal.value.folder}\n${codexTerminal.value.title}`),
			async () => {
				const terminal = codexTerminal.value;
				codexChat.value = null;
				if (terminal === null) {
					return;
				}
				const found = await ChatImages.findCodexChat(terminal.title, terminal.folder);
				if (codexTerminal.value?.title === terminal.title && codexTerminal.value.folder === terminal.folder) {
					codexChat.value = found;
				}
			},
			{ immediate: true },
		);
		watch(
			[() => selectedPane.value?.pane_id ?? null, sessionId, codexTerminal],
			([paneId, current, terminal]) => {
				state.paneId = paneId;
				state.sessionId = current;
				state.isCodexWithoutChat = terminal !== null && current === null;
			},
			{ immediate: true },
		);
		watch(
			sessionId,
			(current) => {
				// A new chat shows at once, without the images of the chat before.
				ChatImagesFollower._lastReadAt = Date.now();
				void ChatImages.load(current);
			},
			{ immediate: true },
		);
		watch(reportTime, () => ChatImagesFollower._readSoon(() => sessionId.value));
	}

	/**
	 * Reads the images again, at most once every `READ_INTERVAL_MILLISECONDS`.
	 * @param sessionIdFn Gives the chat session identifier to read at the time of the read.
	 */
	private static _readSoon(sessionIdFn: () => string | null): void {
		if (ChatImagesFollower._timer !== null) {
			return;
		}
		const wait = Math.max(0, ChatImagesFollower._lastReadAt + READ_INTERVAL_MILLISECONDS - Date.now());
		ChatImagesFollower._timer = setTimeout(() => {
			ChatImagesFollower._timer = null;
			ChatImagesFollower._lastReadAt = Date.now();
			void ChatImages.load(sessionIdFn());
		}, wait);
	}
}
