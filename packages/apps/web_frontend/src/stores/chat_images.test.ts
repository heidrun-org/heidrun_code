// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { ChatImages } from './chat_images';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
}));

/**
 * Builds the answer of the command `chat_images_find` for a chat of Claude Code, where the key of an image is its number.
 * @param keys The key of every image of the chat.
 * @param images The images that the answer sends, as `[key, data]`.
 * @returns The answer.
 */
function answer(keys: number[], images: [number, string][]) {
	return {
		keys,
		images: images.map(([key, data]) => ({
			key,
			number: key,
			message: null as number | null,
			media_type: 'image/png',
			data,
		})),
	};
}

beforeEach(async () => {
	vi.mocked(invoke).mockReset();
	await ChatImages.load(null);
});

describe('ChatImages', () => {
	it('shows each image with its number, as a data address, in the order of the numbers', async () => {
		vi.mocked(invoke).mockResolvedValueOnce(answer([1, 2, 6], [[1, 'AAA'], [2, 'BBB'], [6, 'FFF']]));
		await ChatImages.load('chat-1');
		expect(invoke).toHaveBeenCalledWith('chat_images_find', {
			sessionId: 'chat-1',
			afterKey: 0,
		});
		expect(ChatImages.state.images).toEqual([
			{ key: 1, number: 1, message: null, source: 'data:image/png;base64,AAA' },
			{ key: 2, number: 2, message: null, source: 'data:image/png;base64,BBB' },
			{ key: 6, number: 6, message: null, source: 'data:image/png;base64,FFF' },
		]);
	});

	it('asks only for the images above the last key, and forgets an image that the chat no longer has', async () => {
		vi.mocked(invoke).mockResolvedValueOnce(answer([1, 2], [[1, 'AAA'], [2, 'BBB']]));
		await ChatImages.load('chat-1');
		vi.mocked(invoke).mockResolvedValueOnce(answer([2, 3], [[3, 'CCC']]));
		await ChatImages.load('chat-1');
		expect(vi.mocked(invoke).mock.calls[1][1]).toEqual({
			sessionId: 'chat-1',
			afterKey: 2,
		});
		expect(ChatImages.state.images.map((image) => image.number)).toEqual([2, 3]);
	});

	it('starts from an empty list for another chat session, and shows nothing when the pane has no chat', async () => {
		vi.mocked(invoke).mockResolvedValueOnce(answer([1], [[1, 'AAA']]));
		await ChatImages.load('chat-1');
		vi.mocked(invoke).mockResolvedValueOnce(answer([1], [[1, 'ZZZ']]));
		await ChatImages.load('chat-2');
		expect(vi.mocked(invoke).mock.calls[1][1]).toEqual({
			sessionId: 'chat-2',
			afterKey: 0,
		});
		expect(ChatImages.state.images).toEqual([{ key: 1, number: 1, message: null, source: 'data:image/png;base64,ZZZ' }]);
		await ChatImages.load(null);
		expect(ChatImages.state.images).toEqual([]);
		expect(invoke).toHaveBeenCalledTimes(2);
	});

	it('leaves out a media type that is not an image', async () => {
		const found = answer([1, 2], [[1, 'AAA'], [2, 'PPP']]);
		found.images[1].media_type = 'text/html';
		vi.mocked(invoke).mockResolvedValueOnce(found);
		await ChatImages.load('chat-1');
		expect(ChatImages.state.images.map((image) => image.number)).toEqual([1]);
	});

	it('keeps the error text when the command fails, and clears it at the next good answer', async () => {
		vi.mocked(invoke).mockRejectedValueOnce('broken');
		await ChatImages.load('chat-1');
		expect(ChatImages.state.error).toBe('broken');
		vi.mocked(invoke).mockResolvedValueOnce(answer([], []));
		await ChatImages.load('chat-1');
		expect(ChatImages.state.error).toBe('');
	});

	it('keeps two images of Codex with the same number apart by their key and their message', async () => {
		const found = answer([1, 2], [[1, 'AAA'], [2, 'BBB']]);
		found.images[0].message = 1;
		found.images[1].number = 1;
		found.images[1].message = 2;
		vi.mocked(invoke).mockResolvedValueOnce(found);
		await ChatImages.load('01a17e05-bc59-7e70-8f26-aa9c8f220604');
		expect(ChatImages.state.images.map((image) => [image.key, image.number, image.message])).toEqual([
			[1, 1, 1],
			[2, 1, 2],
		]);
		ChatImages.openViewer(2);
		ChatImages.moveViewer(1);
		expect(ChatImages.state.viewerKey).toBe(1);
	});

	it('finds the Codex chat of a terminal title and a folder, and asks only once for a found chat', async () => {
		vi.mocked(invoke).mockResolvedValueOnce(null);
		expect(await ChatImages.findCodexChat('heidrun', '/work/cache-test')).toBe(null);
		vi.mocked(invoke).mockResolvedValueOnce('01a17e13-c2cd-7811-adda-f790dcf914a0');
		expect(await ChatImages.findCodexChat('Respond to greeting | heidrun', '/work/cache-test')).toBe('01a17e13-c2cd-7811-adda-f790dcf914a0');
		expect(await ChatImages.findCodexChat('Respond to greeting | heidrun', '/work/cache-test')).toBe('01a17e13-c2cd-7811-adda-f790dcf914a0');
		expect(invoke).toHaveBeenCalledTimes(2);
		expect(invoke).toHaveBeenLastCalledWith('chat_images_find_codex_chat', {
			terminalTitle: 'Respond to greeting | heidrun',
			folder: '/work/cache-test',
		});
	});

	it('moves the big view to the next and the previous image, and goes round at the two ends', async () => {
		vi.mocked(invoke).mockResolvedValueOnce(answer([1, 2, 6], [[1, 'AAA'], [2, 'BBB'], [6, 'FFF']]));
		await ChatImages.load('chat-1');
		ChatImages.openViewer(6);
		ChatImages.moveViewer(1);
		expect(ChatImages.state.viewerKey).toBe(1);
		ChatImages.moveViewer(-1);
		expect(ChatImages.state.viewerKey).toBe(6);
		ChatImages.closeViewer();
		expect(ChatImages.state.viewerKey).toBe(null);
	});
});
