// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { ChatImages } from './chat_images';

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
}));

/**
 * Builds the answer of the command `chat_images_find`.
 * @param numbers The number of every image of the chat.
 * @param images The images that the answer sends, as `[number, data]`.
 * @returns The answer.
 */
function answer(numbers: number[], images: [number, string][]) {
	return {
		numbers,
		images: images.map(([number, data]) => ({
			number,
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
			afterNumber: 0,
		});
		expect(ChatImages.state.images).toEqual([
			{ number: 1, source: 'data:image/png;base64,AAA' },
			{ number: 2, source: 'data:image/png;base64,BBB' },
			{ number: 6, source: 'data:image/png;base64,FFF' },
		]);
	});

	it('asks only for the images above the last number, and forgets an image that the chat no longer has', async () => {
		vi.mocked(invoke).mockResolvedValueOnce(answer([1, 2], [[1, 'AAA'], [2, 'BBB']]));
		await ChatImages.load('chat-1');
		vi.mocked(invoke).mockResolvedValueOnce(answer([2, 3], [[3, 'CCC']]));
		await ChatImages.load('chat-1');
		expect(vi.mocked(invoke).mock.calls[1][1]).toEqual({
			sessionId: 'chat-1',
			afterNumber: 2,
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
			afterNumber: 0,
		});
		expect(ChatImages.state.images).toEqual([{ number: 1, source: 'data:image/png;base64,ZZZ' }]);
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

	it('moves the big view to the next and the previous image, and goes round at the two ends', async () => {
		vi.mocked(invoke).mockResolvedValueOnce(answer([1, 2, 6], [[1, 'AAA'], [2, 'BBB'], [6, 'FFF']]));
		await ChatImages.load('chat-1');
		ChatImages.openViewer(6);
		ChatImages.moveViewer(1);
		expect(ChatImages.state.viewerNumber).toBe(1);
		ChatImages.moveViewer(-1);
		expect(ChatImages.state.viewerNumber).toBe(6);
		ChatImages.closeViewer();
		expect(ChatImages.state.viewerNumber).toBe(null);
	});
});
