import { describe, expect, it } from 'vitest';
import { ChatImageLinks } from './chat_image_links';
import type { ChatImage } from '../stores/chat_images';

// Tests of the texts [Image #N] of a terminal and of the image behind each one (issue #924).

/** An image of a chat. */
function image(key: number, number: number, message: number | null): ChatImage {
	return {
		key,
		number,
		message,
		source: `data:image/png;base64,${key}`,
	};
}

describe('ChatImageLinks.findInLine', () => {
	it('finds each text [Image #N] of a line with its place and its number', () => {
		expect(ChatImageLinks.findInLine('see [Image #1] and [Image #12]')).toEqual([
			{
				start: 4,
				end: 14,
				number: 1,
			},
			{
				start: 19,
				end: 30,
				number: 12,
			},
		]);
	});

	it('finds nothing in a line without a complete text', () => {
		expect(ChatImageLinks.findInLine('[Image #] [Image 1] Image #1]')).toEqual([]);
	});
});

describe('ChatImageLinks.imageFor', () => {
	it('gives the image with the number in a chat of Claude Code, wherever the text is', () => {
		const images = [image(1, 1, null), image(2, 2, null)];
		expect(ChatImageLinks.imageFor(images, 2, 0)?.key).toBe(2);
		expect(ChatImageLinks.imageFor(images, 2, 5)?.key).toBe(2);
	});

	it('matches a Codex text from the end of the chat, because Codex starts the numbers again in each message', () => {
		const images = [image(0, 1, 1), image(1, 2, 1), image(2, 1, 2)];
		expect(ChatImageLinks.imageFor(images, 1, 0)?.key).toBe(2);
		expect(ChatImageLinks.imageFor(images, 1, 1)?.key).toBe(0);
		expect(ChatImageLinks.imageFor(images, 2, 0)?.key).toBe(1);
	});

	it('gives null for a number that the chat does not have, or a text without its image', () => {
		const images = [image(0, 1, 1)];
		expect(ChatImageLinks.imageFor(images, 3, 0)).toBeNull();
		expect(ChatImageLinks.imageFor(images, 1, 1)).toBeNull();
	});
});

describe('ChatImageLinks.imageName', () => {
	it('names an image of Claude Code by its number, and an image of Codex by its message too', () => {
		expect(ChatImageLinks.imageName(image(1, 1, null))).toBe('[Image #1]');
		expect(ChatImageLinks.imageName(image(0, 1, 2))).toBe('Message 2 · [Image #1]');
	});
});
