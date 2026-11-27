import { afterEach, describe, expect, it, vi } from 'vitest';
import { enableAutoUnmount, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import ChatImageHoverPreview from './ChatImageHoverPreview.vue';
import ChatImagesViewer from './ChatImagesViewer.vue';
import { ChatImageHover } from '../stores/chat_image_hover';
import { ChatImages } from '../stores/chat_images';

const IMAGE = {
	key: 1,
	number: 1,
	message: 2,
	source: 'data:image/png;base64,AAAA',
};

enableAutoUnmount(afterEach);
afterEach(() => {
	ChatImageHover.hide();
	ChatImages.closeViewer();
	ChatImages.state.images = [];
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('ChatImageHoverPreview', () => {
	it('stays hidden until an image marker is hovered', () => {
		mount(ChatImageHoverPreview, { attachTo: document.body });
		expect(document.body.querySelector('.chat-image-hover')).toBeNull();
	});

	it('keeps the same width and points at the label when the window edge shifts the preview', async () => {
		vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 360, 180));
		mount(ChatImageHoverPreview, { attachTo: document.body });
		ChatImageHover.show(IMAGE, 50, 40, 60);
		await nextTick();
		const preview = document.body.querySelector<HTMLElement>('.chat-image-hover');
		expect(preview?.classList.contains('below')).toBe(true);
		expect(preview?.style.top).toBe('68px');
		expect(preview?.style.width).toBe('360px');
		expect(preview?.style.left).toBe('8px');
		expect(preview?.style.getPropertyValue('--arrow-x')).toBe('42px');

		const bottom = 270;
		ChatImageHover.show(IMAGE, 500, bottom - 20, bottom);
		await nextTick();
		expect(preview?.classList.contains('below')).toBe(false);
		expect(preview?.style.top).toBe(`${bottom - 28}px`);
		expect(preview?.style.width).toBe('360px');
		expect(preview?.style.getPropertyValue('--arrow-x')).toBe('180px');
	});

	it('stays open while hovered and opens the shared image browser at the previewed image', async () => {
		vi.useFakeTimers();
		ChatImages.state.images = [
			{
				...IMAGE,
				key: 0,
				message: 1,
			},
			IMAGE,
		];
		mount(ChatImageHoverPreview, { attachTo: document.body });
		mount(ChatImagesViewer, { attachTo: document.body });
		ChatImageHover.show(IMAGE, 500, 40);
		await nextTick();

		const preview = document.body.querySelector<HTMLElement>('.chat-image-hover');
		expect(preview?.querySelector('img')?.getAttribute('src')).toBe(IMAGE.source);
		expect(preview?.textContent?.trim()).toBe('Message 2 · [Image #1]');
		ChatImageHover.hideSoon();
		preview?.dispatchEvent(new MouseEvent('mouseenter'));
		vi.advanceTimersByTime(250);
		await nextTick();
		expect(document.body.contains(preview)).toBe(true);

		preview?.querySelector('button')?.click();
		await nextTick();
		expect(document.body.querySelector('.chat-image-hover')).toBeNull();
		expect(document.body.querySelector('[role="dialog"] .position')?.textContent).toBe('2 of 2');
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
		await nextTick();
		expect(document.body.querySelector('[role="dialog"] .position')?.textContent).toBe('1 of 2');
	});
});
