import { invoke } from '@tauri-apps/api/core';
import { reactive } from 'vue';

// The image behind each text [Image #N] of the chat of the selected pane, shown at the bottom of the Clipboard sidebar section.
// Issues: https://github.com/heidrun-org/heidrun_code/issues/790 and https://github.com/heidrun-org/heidrun_code/issues/924

/** One image of a chat, as the command `chat_images_find` gives it. */
type FoundChatImage = {
	/** The key of the image in its chat: no other image of the chat has it, and a later image has a larger key. */
	key: number;
	/** The number `N` of the text `[Image #N]`. */
	number: number;
	/** For Codex, the place of the message of the image among the messages of the chat that hold images, else null. */
	message: number | null;
	/** The media type of the image, for example `image/png`. */
	media_type: string;
	/** The whole image in base64. */
	data: string;
};

/** The answer of the command `chat_images_find`. */
type FoundChatImageList = {
	/** The key of every image of the chat, in order. */
	keys: number[];
	/** The images whose key is above the key that the call gave. */
	images: FoundChatImage[];
};

/** One image of the chat, ready for an `img` element. */
export type ChatImage = {
	/** The key of the image in its chat, unique in the chat. */
	key: number;
	/** The number `N` of the text `[Image #N]`. */
	number: number;
	/**
	 * For Codex, the place of the message of the image among the messages of the chat that hold images, else null. Codex
	 * starts the numbers again in each message, so the message tells two images with the same number apart.
	 */
	message: number | null;
	/** The image as a `data:` address. */
	source: string;
};

/** The images of the chat of one chat session of Claude Code or of Codex. */
export type ChatImagesState = {
	/** The chat session identifier whose images are shown, or null when the selected pane has no chat that Heidrun Code knows. */
	sessionId: string | null;
	/** The images of the chat, in the order of their keys. */
	images: ChatImage[];
	/** The text of the last error, or an empty text. */
	error: string;
	/** The key of the image that the big view shows, or null when the big view is closed. */
	viewerKey: number | null;
};

/** The images of the chat of the selected pane. */
export class ChatImages {
	/** The images of the chat that the Clipboard sidebar section shows. */
	static readonly state = reactive<ChatImagesState>({
		sessionId: null,
		images: [],
		error: '',
		viewerKey: null,
	});

	/** True while a call to `chat_images_find` runs. */
	private static _isLoading = false;

	/** True when a load was asked while a call ran: the load runs again at the end of the call. */
	private static _isLoadAsked = false;

	/** The chat of Codex found for each folder and title of a terminal. */
	private static _codexChats = new Map<string, string>();

	/**
	 * Reads the images of the chat session `sessionId`. A new chat session starts from an empty list. The same chat session
	 * asks only for the images above the last key that it has, and forgets the images that the chat no longer has.
	 * @param sessionId The chat session identifier of the selected pane, or null when the pane has no chat that Heidrun Code
	 * knows.
	 * @returns A promise that settles when the images are read.
	 */
	static async load(sessionId: string | null): Promise<void> {
		const state = ChatImages.state;
		if (sessionId !== state.sessionId) {
			state.sessionId = sessionId;
			state.images = [];
			state.error = '';
			state.viewerKey = null;
		}
		if (sessionId === null) {
			return;
		}
		if (ChatImages._isLoading === true) {
			ChatImages._isLoadAsked = true;
			return;
		}
		ChatImages._isLoading = true;
		try {
			await ChatImages._loadOnce(sessionId);
		} finally {
			ChatImages._isLoading = false;
		}
		if (ChatImages._isLoadAsked === true) {
			ChatImages._isLoadAsked = false;
			await ChatImages.load(state.sessionId);
		}
	}

	/**
	 * Finds the chat of Codex that a Codex pane shows, from the title of its terminal and the folder where Codex runs. Codex
	 * writes the title of its chat in the title of the terminal, and gives no other link between a pane and its chat. A found
	 * chat is kept, so the same title and folder ask the desktop application only once.
	 * @param terminalTitle The title of the terminal of the pane.
	 * @param folder The folder where Codex runs.
	 * @returns The chat session identifier, or null when no chat matches.
	 */
	static async findCodexChat(terminalTitle: string, folder: string): Promise<string | null> {
		const cacheKey = `${folder}\n${terminalTitle}`;
		const known = ChatImages._codexChats.get(cacheKey);
		if (known !== undefined) {
			return known;
		}
		try {
			const found = await invoke<string | null>('chat_images_find_codex_chat', {
				terminalTitle,
				folder,
			});
			if (found !== null) {
				ChatImages._codexChats.set(cacheKey, found);
			}
			return found;
		} catch {
			return null;
		}
	}

	/**
	 * Opens the big view on one image.
	 * @param key The key of the image.
	 */
	static openViewer(key: number): void {
		ChatImages.state.viewerKey = key;
	}

	/** Closes the big view. */
	static closeViewer(): void {
		ChatImages.state.viewerKey = null;
	}

	/**
	 * Shows the next or the previous image in the big view, and goes round at the two ends.
	 * @param step 1 for the next image, -1 for the previous image.
	 */
	static moveViewer(step: number): void {
		const images = ChatImages.state.images;
		const at = images.findIndex((image) => image.key === ChatImages.state.viewerKey);
		if (at === -1 || images.length === 0) {
			return;
		}
		ChatImages.state.viewerKey = images[(at + step + images.length) % images.length].key;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Asks the desktop application for the images above the last key, and merges them into the list.
	 * @param sessionId The chat session identifier.
	 * @returns A promise that settles when the list is updated.
	 */
	private static async _loadOnce(sessionId: string): Promise<void> {
		const state = ChatImages.state;
		const last = state.images[state.images.length - 1];
		const afterKey = last === undefined ? 0 : last.key;
		try {
			const list = await invoke<FoundChatImageList>('chat_images_find', {
				sessionId,
				afterKey,
			});
			if (state.sessionId !== sessionId) {
				return;
			}
			const kept = state.images.filter((image) => list.keys.includes(image.key));
			const added = list.images
				.filter((image) => image.media_type.startsWith('image/'))
				.map((image) => ({
					key: image.key,
					number: image.number,
					message: image.message,
					source: `data:${image.media_type};base64,${image.data}`,
				}));
			state.images = [...kept, ...added].sort((a, b) => a.key - b.key);
			state.error = '';
		} catch (error) {
			if (state.sessionId === sessionId) {
				state.error = String(error);
			}
		}
	}
}
