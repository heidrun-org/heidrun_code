import { reactive } from 'vue';
import type { IBufferLine, ILink, ILinkProvider, Terminal } from '@xterm/xterm';
import { ChatImages, type ChatImage } from './chat_images';
import { ChatImagesFollower } from './chat_images_follower';
import { ChatImageLinks, type ChatImageText } from '../lib/chat_image_links';

// The image that shows when the pointer is over a text [Image #N] of a terminal.
// Issue: https://github.com/heidrun-org/heidrun_code/issues/924

/** The image under the pointer, and the place of the pointer. */
export type ChatImageHoverState = {
	/** The image, or null when the pointer is over no text `[Image #N]`. */
	image: ChatImage | null;
	/** The horizontal place of the pointer in the window, in pixels. */
	x: number;
	/** The vertical place of the pointer in the window, in pixels. */
	y: number;
};

/** The image that shows over a terminal when the pointer is over a text `[Image #N]`. */
export class ChatImageHover {
	/** The image under the pointer. */
	static readonly state = reactive<ChatImageHoverState>({
		image: null,
		x: 0,
		y: 0,
	});

	/**
	 * Shows an image near the pointer.
	 * @param image The image.
	 * @param x The horizontal place of the pointer in the window, in pixels.
	 * @param y The vertical place of the pointer in the window, in pixels.
	 */
	static show(image: ChatImage, x: number, y: number): void {
		ChatImageHover.state.image = image;
		ChatImageHover.state.x = x;
		ChatImageHover.state.y = y;
	}

	/** Hides the image. */
	static hide(): void {
		ChatImageHover.state.image = null;
	}

	/**
	 * The link provider of a terminal that underlines each text `[Image #N]` of the chat of the pane, and shows its image while
	 * the pointer is over it. It gives links only in the selected pane, the pane whose images `ChatImagesFollower` reads.
	 * @param terminal The terminal.
	 * @param paneIdFn Gives the identifier of the pane of the terminal.
	 * @returns The link provider.
	 */
	static createLinkProvider(terminal: Terminal, paneIdFn: () => string): ILinkProvider {
		return {
			provideLinks: (y, callback) => {
				const line = terminal.buffer.active.getLine(y - 1);
				if (line === undefined || ChatImagesFollower.state.paneId !== paneIdFn() || ChatImages.state.images.length === 0) {
					callback(undefined);
					return;
				}
				const { text, columns } = ChatImageHover._lineText(line);
				const links: ILink[] = ChatImageLinks.findInLine(text).map((found) => ({
					text: text.slice(found.start, found.end),
					range: {
						start: { x: columns[found.start] + 1, y },
						end: { x: columns[found.end - 1] + 1, y },
					},
					decorations: {
						underline: true,
						pointerCursor: false,
					},
					activate: () => {},
					hover: (event: MouseEvent) => {
						const laterCount = ChatImageHover._countLater(terminal, y, found);
						const image = ChatImageLinks.imageFor(ChatImages.state.images, found.number, laterCount);
						if (image !== null) {
							ChatImageHover.show(image, event.clientX, event.clientY);
						}
					},
					leave: () => ChatImageHover.hide(),
				}));
				callback(links.length > 0 ? links : undefined);
			},
		};
	}

	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////
	//	Helpers
	///////////////////////////////////////////////////////////////////////////////
	///////////////////////////////////////////////////////////////////////////////

	/**
	 * The text of a line of the terminal, and the column of each character. A wide character, such as an emoji, takes two
	 * columns, so the index of a character in the text is not always its column.
	 * @param line The line.
	 * @returns The text and the column of each character.
	 */
	private static _lineText(line: IBufferLine): { text: string; columns: number[] } {
		let text = '';
		const columns: number[] = [];
		for (let x = 0; x < line.length; x++) {
			const cell = line.getCell(x);
			if (cell === undefined) {
				break;
			}
			if (cell.getWidth() === 0) {
				continue;
			}
			const chars = cell.getChars() || ' ';
			for (let i = 0; i < chars.length; i++) {
				columns.push(x);
			}
			text += chars;
		}
		return { text, columns };
	}

	/**
	 * The number of texts `[Image #N]` with the number of `found` below it in the terminal: after it on its line, and on the
	 * lines below.
	 * @param terminal The terminal.
	 * @param y The line of `found`, from 1.
	 * @param found The text under the pointer.
	 * @returns The number of texts below.
	 */
	private static _countLater(terminal: Terminal, y: number, found: ChatImageText): number {
		const buffer = terminal.buffer.active;
		let count = 0;
		for (let index = y - 1; index < buffer.length; index++) {
			const line = buffer.getLine(index);
			if (line === undefined) {
				continue;
			}
			const texts = ChatImageLinks.findInLine(ChatImageHover._lineText(line).text);
			for (const text of texts) {
				const isBelow = index > y - 1 || text.start > found.start;
				if (isBelow && text.number === found.number) {
					count++;
				}
			}
		}
		return count;
	}
}
