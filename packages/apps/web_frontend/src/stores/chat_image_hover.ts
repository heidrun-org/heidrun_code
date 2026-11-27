import { reactive } from 'vue';
import type { IBufferLine, ILink, ILinkProvider, Terminal } from '@xterm/xterm';
import { ChatImages, type ChatImage } from './chat_images';
import { ChatImagesFollower } from './chat_images_follower';
import { ChatImageLinks } from '../lib/chat_image_links';
import { settings } from './settings';

// The image that shows when the pointer is over a text [Image #N] of a terminal.
// Issue: https://github.com/heidrun-org/heidrun_code/issues/924

/** The image under the pointer, and the place of the pointer. */
export type ChatImageHoverState = {
	/** The image, or null when the pointer is over no text `[Image #N]`. */
	image: ChatImage | null;
	/** The horizontal center of the terminal label, in window pixels. */
	x: number;
	/** The top of the terminal label, in window pixels. */
	y: number;
	/** The bottom of the terminal label, in window pixels. */
	bottom: number;
};

/** The image that shows over a terminal when the pointer is over a text `[Image #N]`. */
export class ChatImageHover {
	/** The image under the pointer. */
	static readonly state = reactive<ChatImageHoverState>({
		image: null,
		x: 0,
		y: 0,
		bottom: 0,
	});

	/** Pending preview while the pointer rests on a terminal label. */
	private static _showTimer = 0;

	/** Pending dismissal while the pointer crosses from the label to the preview. */
	private static _hideTimer = 0;

	/**
	 * Shows an image beside the terminal label.
	 * @param image The image.
	 * @param x The horizontal center of the label.
	 * @param y The top of the label.
	 * @param bottom The bottom of the label.
	 * @returns Nothing.
	 */
	static show(image: ChatImage, x: number, y: number, bottom = y): void {
		ChatImageHover.keepOpen();
		ChatImageHover.state.image = image;
		ChatImageHover.state.x = x;
		ChatImageHover.state.y = y;
		ChatImageHover.state.bottom = bottom;
	}

	/** Cancels dismissal when the pointer enters the preview or another label. */
	static keepOpen(): void {
		window.clearTimeout(ChatImageHover._hideTimer);
	}

	/** Gives the pointer time to cross between the terminal label and the preview. */
	static hideSoon(): void {
		window.clearTimeout(ChatImageHover._showTimer);
		ChatImageHover.keepOpen();
		ChatImageHover._hideTimer = window.setTimeout(ChatImageHover.hide, 250);
	}

	/** Hides the image. */
	static hide(): void {
		window.clearTimeout(ChatImageHover._showTimer);
		ChatImageHover.keepOpen();
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
						ChatImageHover.hide();
						ChatImageHover._showTimer = window.setTimeout(() => {
							if (settings.terminalInputImagePreviews === false ||
								ChatImagesFollower.state.paneId !== paneIdFn() || ChatImages.state.viewerKey !== null) {
								return;
							}
							const images = ChatImages.state.images;
							const laterCount = images.some((image) => image.message !== null)
								? ChatImageHover._countLaterCodexAttachments(terminal, y, found.number)
								: 0;
							const image = ChatImageLinks.imageFor(images, found.number, laterCount);
							if (image === null) {
								return;
							}
							const screen = terminal.element?.querySelector('.xterm-screen')?.getBoundingClientRect();
							if (screen === undefined || screen.width === 0 || screen.height === 0) {
								ChatImageHover.show(image, event.clientX, event.clientY);
								return;
							}
							const cellWidth = screen.width / terminal.cols;
							const cellHeight = screen.height / terminal.rows;
							const midpoint = (columns[found.start] + columns[found.end - 1] + 1) / 2;
							const top = screen.top + (y - 1 - terminal.buffer.active.viewportY) * cellHeight;
							ChatImageHover.show(image, screen.left + midpoint * cellWidth, top, top + cellHeight);
						}, 500);
					},
					leave: () => ChatImageHover.hideSoon(),
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
	 * Counts later Codex attachment rows for the same image number. Codex prints file arguments on their own indented
	 * rows and inline attachments in sent prompts. Reply mentions use the preceding attachment of the same number.
	 * @param terminal The terminal.
	 * @param y The line under the pointer, from 1.
	 * @param number The image number.
	 * @returns The number of attachment rows below this line.
	 */
	private static _countLaterCodexAttachments(terminal: Terminal, y: number, number: number): number {
		const buffer = terminal.buffer.active;
		const marker = `[Image #${number}]`;
		let count = 0;
		for (let index = y; index < buffer.length; index++) {
			const text = buffer.getLine(index)?.translateToString(true);
			if (text === undefined || text.includes(marker) === false) {
				continue;
			}
			if (text === `  ${marker}` || /^ {0,2}› /.test(text)) {
				count++;
			}
		}
		return count;
	}
}
