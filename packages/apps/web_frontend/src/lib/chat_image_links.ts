import type { ChatImage } from '../stores/chat_images';
import { t } from '../i18n/index';

// Finds the texts [Image #N] of a line of a terminal, and the image of the chat behind each one.
// Issue: https://github.com/heidrun-org/heidrun_code/issues/924

/** One text `[Image #N]` in a line of a terminal. */
export type ChatImageText = {
	/** The index of the first character of the text in the line. */
	start: number;
	/** The index after the last character of the text in the line. */
	end: number;
	/** The number `N`. */
	number: number;
};

/** The texts `[Image #N]` of a terminal and the images of the chat. */
export class ChatImageLinks {
	/**
	 * The texts `[Image #N]` of a line.
	 * @param line The text of the line.
	 * @returns The texts, in the order of the line.
	 */
	static findInLine(line: string): ChatImageText[] {
		const found: ChatImageText[] = [];
		for (const match of line.matchAll(/\[Image #(\d+)\]/g)) {
			found.push({
				start: match.index,
				end: match.index + match[0].length,
				number: Number(match[1]),
			});
		}
		return found;
	}

	/**
	 * The name of an image: the text of the chat, and for Codex the message too, because Codex starts the numbers again in
	 * each message.
	 * @param image The image.
	 * @returns The name, for example `[Image #1]` or `Message 2 · [Image #1]`.
	 */
	static imageName(image: ChatImage): string {
		if (image.message === null) {
			return t('chatImagesSection.imageName', { number: image.number });
		}
		return t('chatImagesSection.imageNameInMessage', { message: image.message, number: image.number });
	}

	/**
	 * The image behind one text `[Image #N]`. In a chat of Claude Code each number names one image. Codex starts the numbers
	 * again in each message, so the text is matched from the end of the chat: the last text `[Image #1]` of the terminal is
	 * the last image 1 of the chat, the one before it is the image 1 before, and so on.
	 * @param images The images of the chat, in the order of their keys.
	 * @param number The number `N` of the text.
	 * @param laterCount The number of texts `[Image #N]` with the same number below this one in the terminal.
	 * @returns The image, or null when the chat has no such image, for example a text that is not sent yet.
	 */
	static imageFor(images: ChatImage[], number: number, laterCount: number): ChatImage | null {
		const sameNumber = images.filter((image) => image.number === number);
		if (sameNumber.length === 0) {
			return null;
		}
		if (sameNumber.every((image) => image.message === null)) {
			return sameNumber[0];
		}
		return sameNumber[sameNumber.length - 1 - laterCount] ?? null;
	}
}
