// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
	HEIDRUN_CODE_DASHBOARD_LOCAL_NETWORK_SIDEBAR_FOLDED_KEY,
	HEIDRUN_CODE_DASHBOARD_SIDEBAR_FOLDED_KEY,
	HeidrunCodeDashboardSidebarFold,
	heidrunCodeDashboardSidebarFolded,
} from './heidrun_code_dashboard_sidebar_fold';

afterEach(() => {
	localStorage.removeItem(HEIDRUN_CODE_DASHBOARD_SIDEBAR_FOLDED_KEY);
	localStorage.removeItem(HEIDRUN_CODE_DASHBOARD_LOCAL_NETWORK_SIDEBAR_FOLDED_KEY);
	heidrunCodeDashboardSidebarFolded.value = false;
});

describe('HeidrunCodeDashboardSidebarFold (issue #1016)', () => {
	it('starts unfolded when nothing is saved, or when the saved value is not true', () => {
		for (const text of [null, 'yes', 'false']) {
			if (text !== null) {
				localStorage.setItem(HEIDRUN_CODE_DASHBOARD_SIDEBAR_FOLDED_KEY, text);
			}
			heidrunCodeDashboardSidebarFolded.value = true;
			HeidrunCodeDashboardSidebarFold.load(false);
			expect(heidrunCodeDashboardSidebarFolded.value).toBe(false);
		}
	});

	it('saves the fold, and reads it again', () => {
		HeidrunCodeDashboardSidebarFold.load(false);
		HeidrunCodeDashboardSidebarFold.toggle();
		expect(localStorage.getItem(HEIDRUN_CODE_DASHBOARD_SIDEBAR_FOLDED_KEY)).toBe('true');
		heidrunCodeDashboardSidebarFolded.value = false;
		HeidrunCodeDashboardSidebarFold.load(false);
		expect(heidrunCodeDashboardSidebarFolded.value).toBe(true);
	});

	it('keeps the choice of the computer and the choice of the page of the local network apart', () => {
		HeidrunCodeDashboardSidebarFold.load(true);
		HeidrunCodeDashboardSidebarFold.toggle();
		expect(localStorage.getItem(HEIDRUN_CODE_DASHBOARD_LOCAL_NETWORK_SIDEBAR_FOLDED_KEY)).toBe('true');
		expect(localStorage.getItem(HEIDRUN_CODE_DASHBOARD_SIDEBAR_FOLDED_KEY)).toBe(null);
		HeidrunCodeDashboardSidebarFold.load(false);
		expect(heidrunCodeDashboardSidebarFolded.value).toBe(false);
		HeidrunCodeDashboardSidebarFold.load(true);
		expect(heidrunCodeDashboardSidebarFolded.value).toBe(true);
	});
});
