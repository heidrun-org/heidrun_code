import { afterEach, describe, expect, it } from 'vitest';
import type { ILink, Terminal } from '@xterm/xterm';
import { ChatImageHover } from './chat_image_hover';
import { ChatImages, type ChatImage } from './chat_images';
import { ChatImagesFollower } from './chat_images_follower';

// Tests of the image that shows when the pointer is over a text [Image #N] of a terminal (issue #924).

/** A terminal whose buffer holds `lines`, one character in each cell. */
function fakeTerminal(lines: string[]): Terminal {
	const bufferLines = lines.map((text) => ({
		length: text.length,
		getCell: (x: number) => ({
			getWidth: () => 1,
			getChars: () => text[x],
		}),
	}));
	return {
		buffer: {
			active: {
				length: bufferLines.length,
				getLine: (index: number) => bufferLines[index],
			},
		},
	} as unknown as Terminal;
}

/** The links of line `y`, from 1, that the link provider gives. */
function linksOf(terminal: Terminal, y: number, paneId = 'w1:p1'): ILink[] | undefined {
	let links: ILink[] | undefined;
	ChatImageHover.createLinkProvider(terminal, () => paneId).provideLinks(y, (found) => {
		links = found;
	});
	return links;
}

/** An image of a Codex chat. */
function image(key: number, number: number, message: number): ChatImage {
	return {
		key,
		number,
		message,
		source: `data:image/png;base64,${key}`,
	};
}

/** A pointer event at a place of the window. */
function pointerAt(x: number, y: number): MouseEvent {
	return new MouseEvent('mousemove', {
		clientX: x,
		clientY: y,
	});
}

afterEach(() => {
	ChatImageHover.hide();
	ChatImages.state.images = [];
	ChatImagesFollower.state.paneId = null;
});

describe('ChatImageHover', () => {
	it('shows an image at the place of the pointer, and hides it', () => {
		ChatImageHover.show(image(0, 1, 1), 40, 50);
		expect(ChatImageHover.state).toMatchObject({
			x: 40,
			y: 50,
		});
		expect(ChatImageHover.state.image?.key).toBe(0);
		ChatImageHover.hide();
		expect(ChatImageHover.state.image).toBeNull();
	});

	it('underlines each text [Image #N] of the selected pane, at its columns', () => {
		ChatImagesFollower.state.paneId = 'w1:p1';
		ChatImages.state.images = [image(0, 1, 1)];
		const links = linksOf(fakeTerminal(['> look [Image #1] here']), 1);
		expect(links).toHaveLength(1);
		expect(links?.[0].range).toEqual({
			start: {
				x: 8,
				y: 1,
			},
			end: {
				x: 17,
				y: 1,
			},
		});
	});

	it('gives no link in a pane that is not selected, or when the chat has no image', () => {
		const terminal = fakeTerminal(['[Image #1]']);
		ChatImagesFollower.state.paneId = 'w1:p2';
		ChatImages.state.images = [image(0, 1, 1)];
		expect(linksOf(terminal, 1)).toBeUndefined();
		ChatImagesFollower.state.paneId = 'w1:p1';
		ChatImages.state.images = [];
		expect(linksOf(terminal, 1)).toBeUndefined();
	});

	it('shows the image of the Codex message of the text, matched from the end of the terminal', () => {
		ChatImagesFollower.state.paneId = 'w1:p1';
		ChatImages.state.images = [image(0, 1, 1), image(1, 1, 2)];
		const terminal = fakeTerminal(['> first [Image #1]', 'answer', '> second [Image #1]']);
		linksOf(terminal, 1)?.[0].hover?.(pointerAt(10, 20), '[Image #1]');
		expect(ChatImageHover.state.image?.key).toBe(0);
		linksOf(terminal, 3)?.[0].hover?.(pointerAt(10, 20), '[Image #1]');
		expect(ChatImageHover.state.image?.key).toBe(1);
		linksOf(terminal, 3)?.[0].leave?.(pointerAt(10, 20), '[Image #1]');
		expect(ChatImageHover.state.image).toBeNull();
	});
});
