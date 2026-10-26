import { invoke } from '@tauri-apps/api/core';
import { reactive } from 'vue';

// The image behind each text [Image #N] of the chat of the selected pane, shown at the bottom of the Clipboard sidebar section.
// Issue: https://github.com/heidrun-org/heidrun_code/issues/790

/** One image of a chat, as the command `chat_images_find` gives it. */
type FoundChatImage = {
	/** The number `N` of the text `[Image #N]`. */
	number: number;
	/** The media type of the image, for example `image/png`. */
	media_type: string;
	/** The whole image in base64. */
	data: string;
};

/** The answer of the command `chat_images_find`. */
type FoundChatImageList = {
	/** The number of every image of the chat, in order. */
	numbers: number[];
	/** The images whose number is above the number that the call gave. */
	images: FoundChatImage[];
};

/** One image of the chat, ready for an `img` element. */
export type ChatImage = {
	/** The number `N` of the text `[Image #N]`. */
	number: number;
	/** The image as a `data:` address. */
	source: string;
};

/** The images of the chat of one chat session of Claude Code. */
export type ChatImagesState = {
	/** The chat session identifier whose images are shown, or null when the selected pane has no chat of Claude Code. */
	sessionId: string | null;
	/** The images of the chat, in the order of their numbers. */
	images: ChatImage[];
	/** The text of the last error, or an empty text. */
	error: string;
	/** The number of the image that the big view shows, or null when the big view is closed. */
	viewerNumber: number | null;
};

/** The images of the chat of the selected pane. */
export class ChatImages {
	/** The images of the chat that the Clipboard sidebar section shows. */
	static readonly state = reactive<ChatImagesState>({
		sessionId: null,
		images: [],
		error: '',
		viewerNumber: null,
	});

	/** True while a call to `chat_images_find` runs. */
	private static _isLoading = false;

	/** True when a load was asked while a call ran: the load runs again at the end of the call. */
	private static _isLoadAsked = false;

	/**
	 * Reads the images of the chat session `sessionId`. A new chat session starts from an empty list. The same chat session
	 * asks only for the images above the last number that it has, and forgets the images that the chat no longer has.
	 * @param sessionId The chat session identifier of the selected pane, or null when the pane has no chat of Claude Code.
	 * @returns A promise that settles when the images are read.
	 */
	static async load(sessionId: string | null): Promise<void> {
		const state = ChatImages.state;
		if (sessionId !== state.sessionId) {
			state.sessionId = sessionId;
			state.images = [];
			state.error = '';
			state.viewerNumber = null;
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
	 * Opens the big view on one image.
	 * @param number The number of the image.
	 */
	static openViewer(number: number): void {
		ChatImages.state.viewerNumber = number;
	}

	/** Closes the big view. */
	static closeViewer(): void {
		ChatImages.state.viewerNumber = null;
	}

	/**
	 * Shows the next or the previous image in the big view, and goes round at the two ends.
	 * @param step 1 for the next image, -1 for the previous image.
	 */
	static moveViewer(step: number): void {
		const images = ChatImages.state.images;
		const at = images.findIndex((image) => image.number === ChatImages.state.viewerNumber);
		if (at === -1 || images.length === 0) {
			return;
		}
		ChatImages.state.viewerNumber = images[(at + step + images.length) % images.length].number;
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * Asks the desktop application for the images above the last number, and merges them into the list.
	 * @param sessionId The chat session identifier.
	 * @returns A promise that settles when the list is updated.
	 */
	private static async _loadOnce(sessionId: string): Promise<void> {
		const state = ChatImages.state;
		const last = state.images[state.images.length - 1];
		const afterNumber = last === undefined ? 0 : last.number;
		try {
			const list = await invoke<FoundChatImageList>('chat_images_find', {
				sessionId,
				afterNumber,
			});
			if (state.sessionId !== sessionId) {
				return;
			}
			const kept = state.images.filter((image) => list.numbers.includes(image.number));
			const added = list.images
				.filter((image) => image.media_type.startsWith('image/'))
				.map((image) => ({
					number: image.number,
					source: `data:${image.media_type};base64,${image.data}`,
				}));
			state.images = [...kept, ...added].sort((a, b) => a.number - b.number);
			state.error = '';
		} catch (error) {
			if (state.sessionId === sessionId) {
				state.error = String(error);
			}
		}
	}
}
