// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
	MIRE_SIDEBAR_DEFAULT_WIDTH,
	MIRE_SIDEBAR_WIDTH_KEY,
	MireSidebarWidth,
	mireSidebarWidth,
} from './mire_sidebar_width';

afterEach(() => {
	localStorage.removeItem(MIRE_SIDEBAR_WIDTH_KEY);
	mireSidebarWidth.value = MIRE_SIDEBAR_DEFAULT_WIDTH;
});

describe('MireSidebarWidth', () => {
	it('saves the width, and reads it again', () => {
		MireSidebarWidth.set(512);
		expect(localStorage.getItem(MIRE_SIDEBAR_WIDTH_KEY)).toBe('512');
		mireSidebarWidth.value = MIRE_SIDEBAR_DEFAULT_WIDTH;
		MireSidebarWidth.load();
		expect(mireSidebarWidth.value).toBe(512);
	});

	it('gives the default width when no width is saved, or when the saved value is not a width', () => {
		for (const text of [null, 'wide', '100', 'Infinity']) {
			if (text === null) {
				localStorage.removeItem(MIRE_SIDEBAR_WIDTH_KEY);
			} else {
				localStorage.setItem(MIRE_SIDEBAR_WIDTH_KEY, text);
			}
			mireSidebarWidth.value = 999;
			MireSidebarWidth.load();
			expect(mireSidebarWidth.value).toBe(MIRE_SIDEBAR_DEFAULT_WIDTH);
		}
	});
});
