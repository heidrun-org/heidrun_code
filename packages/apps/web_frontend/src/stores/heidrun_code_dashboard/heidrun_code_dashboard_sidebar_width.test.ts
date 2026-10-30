// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
	HEIDRUN_CODE_DASHBOARD_SIDEBAR_DEFAULT_WIDTH,
	HEIDRUN_CODE_DASHBOARD_SIDEBAR_WIDTH_KEY,
	HeidrunCodeDashboardSidebarWidth,
	OLD_MIRE_SIDEBAR_WIDTH_KEY,
	heidrunCodeDashboardSidebarWidth,
} from './heidrun_code_dashboard_sidebar_width';

afterEach(() => {
	localStorage.removeItem(HEIDRUN_CODE_DASHBOARD_SIDEBAR_WIDTH_KEY);
	localStorage.removeItem(OLD_MIRE_SIDEBAR_WIDTH_KEY);
	heidrunCodeDashboardSidebarWidth.value = HEIDRUN_CODE_DASHBOARD_SIDEBAR_DEFAULT_WIDTH;
});

describe('HeidrunCodeDashboardSidebarWidth', () => {
	it('saves the width, and reads it again', () => {
		HeidrunCodeDashboardSidebarWidth.set(512);
		expect(localStorage.getItem(HEIDRUN_CODE_DASHBOARD_SIDEBAR_WIDTH_KEY)).toBe('512');
		heidrunCodeDashboardSidebarWidth.value = HEIDRUN_CODE_DASHBOARD_SIDEBAR_DEFAULT_WIDTH;
		HeidrunCodeDashboardSidebarWidth.load();
		expect(heidrunCodeDashboardSidebarWidth.value).toBe(512);
	});

	it('gives the default width when no width is saved, or when the saved value is not a width', () => {
		for (const text of [null, 'wide', '100', 'Infinity']) {
			if (text === null) {
				localStorage.removeItem(HEIDRUN_CODE_DASHBOARD_SIDEBAR_WIDTH_KEY);
			} else {
				localStorage.setItem(HEIDRUN_CODE_DASHBOARD_SIDEBAR_WIDTH_KEY, text);
			}
			heidrunCodeDashboardSidebarWidth.value = 999;
			HeidrunCodeDashboardSidebarWidth.load();
			expect(heidrunCodeDashboardSidebarWidth.value).toBe(HEIDRUN_CODE_DASHBOARD_SIDEBAR_DEFAULT_WIDTH);
		}
	});

	it('keeps the width saved under the old key of the Mire, and moves it to the new key (issue 989)', () => {
		localStorage.setItem(OLD_MIRE_SIDEBAR_WIDTH_KEY, '450');
		HeidrunCodeDashboardSidebarWidth.load();
		expect(heidrunCodeDashboardSidebarWidth.value).toBe(450);
		expect(localStorage.getItem(HEIDRUN_CODE_DASHBOARD_SIDEBAR_WIDTH_KEY)).toBe('450');
		expect(localStorage.getItem(OLD_MIRE_SIDEBAR_WIDTH_KEY)).toBe(null);
	});
});
