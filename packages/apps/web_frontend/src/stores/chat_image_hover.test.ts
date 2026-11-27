import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ILink, Terminal } from '@xterm/xterm';
import { ChatImageHover } from './chat_image_hover';
import { ChatImages, type ChatImage } from './chat_images';
import { ChatImagesFollower } from './chat_images_follower';
import { settings } from './settings';

// Tests of the image that shows when the pointer is over a text [Image #N] of a terminal (issue #924).

/** A terminal whose buffer holds `lines`, one character in each cell. */
function fakeTerminal(lines: string[]): Terminal {
	const bufferLines = lines.map((text) => ({
		length: text.length,
		translateToString: () => text.trimEnd(),
		getCell: (x: number) => ({
			getWidth: () => 1,
			getChars: () => text[x],
		}),
	}));
	return {
		buffer: {
			active: {
				length: bufferLines.length,
				viewportY: 0,
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
	settings.terminalInputImagePreviews = true;
	ChatImageHover.hide();
	ChatImages.state.images = [];
	ChatImagesFollower.state.paneId = null;
	vi.useRealTimers();
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

	it('underlines the marker and shows its preview only after half a second on the label', () => {
		vi.useFakeTimers();
		ChatImagesFollower.state.paneId = 'w1:p1';
		ChatImages.state.images = [image(0, 1, 1)];
		const terminal = fakeTerminal(['> look [Image #1] here']);
		const element = document.createElement('div');
		const screen = document.createElement('div');
		screen.className = 'xterm-screen';
		vi.spyOn(screen, 'getBoundingClientRect').mockReturnValue(new DOMRect(50, 100, 800, 240));
		element.append(screen);
		Object.assign(terminal, {
			element,
			cols: 80,
			rows: 10,
		});
		const links = linksOf(terminal, 1);
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
		const link = links?.[0];
		link?.hover?.(pointerAt(130, 105), link.text);
		vi.advanceTimersByTime(499);
		expect(ChatImageHover.state.image).toBeNull();
		link?.leave?.(pointerAt(130, 105), link.text);
		vi.advanceTimersByTime(500);
		expect(ChatImageHover.state.image).toBeNull();
		link?.hover?.(pointerAt(130, 105), link.text);
		settings.terminalInputImagePreviews = false;
		vi.advanceTimersByTime(500);
		expect(ChatImageHover.state.image).toBeNull();

		settings.terminalInputImagePreviews = true;
		link?.hover?.(pointerAt(130, 105), link.text);
		vi.advanceTimersByTime(500);
		expect(ChatImageHover.state.image?.key).toBe(0);
		expect(ChatImageHover.state).toMatchObject({
			x: 170,
			y: 100,
			bottom: 124,
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

	it('matches sent Codex attachments and resolves reply mentions without counting them as attachments', () => {
		vi.useFakeTimers();
		ChatImagesFollower.state.paneId = 'w1:p1';
		ChatImages.state.images = [image(0, 1, 1), image(1, 1, 2)];
		const terminal = fakeTerminal([
			'› [Image #1]First message',
			'• Reply mentioning [Image #1]',
			'  [Image #1]',
			'',
			'› Second message',
			'• Reply mentioning [Image #1] twice: [Image #1]',
			'  > [Image #1]',
		]);
		for (const [y, key] of [[1, 0], [2, 0], [3, 1], [6, 1], [7, 1]]) {
			const links = linksOf(terminal, y);
			expect(links).toHaveLength(y === 6 ? 2 : 1);
			for (const link of links ?? []) {
				link.hover?.(pointerAt(10, 20), link.text);
				vi.advanceTimersByTime(500);
				expect(ChatImageHover.state.image?.key).toBe(key);
				link.leave?.(pointerAt(10, 20), link.text);
				vi.advanceTimersByTime(250);
				expect(ChatImageHover.state.image).toBeNull();
			}
		}
	});
});
