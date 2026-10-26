import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import UserActivityPanel from "./UserActivityPanel.vue";
import { UserActivity, type UserActivityRecord } from "../lib/user_activity";
import { state } from "../stores/session";
import { activePeriodStartedAt, isUserActive, userActivityRecordsOfToday } from "../stores/user_activity";
import type { SessionSnapshot } from "../lib/types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/** A snapshot with one workspace that has one pane in a folder. */
function snapshot(): SessionSnapshot {
	return {
		version: "test",
		protocol: 1,
		workspaces: [{ workspace_id: "w1", workspace_folder: "/work/heidrun", number: 1, label: "heidrun", focused: true, pane_count: 1, tab_count: 1, active_tab_id: "w1:t1" }],
		tabs: [],
		panes: [{ pane_id: "p1", workspace_id: "w1", cwd: "/work/heidrun" }],
		layouts: [],
		agents: [],
	} as unknown as SessionSnapshot;
}

/** A record of the folder, from `startedAt` to `endedAt`, in the time zone +02:00. */
function record(workspaceFolder: string, startedAt: string, endedAt: string): UserActivityRecord {
	return {
		workspaceFolder,
		startedAt: `2026-10-14T${startedAt}.000+02:00`,
		lastActionAt: `2026-10-14T${endedAt}.000+02:00`,
		endedAt: `2026-10-14T${endedAt}.000+02:00`,
		keyboardActionCount: 12,
		mouseActionCount: 3,
		endReason: "cool_down",
	};
}

beforeEach(() => {
	state.snapshot = snapshot();
	state.selectedWorkspaceId = "w1";
});

afterEach(() => {
	state.snapshot = null;
	state.selectedWorkspaceId = null;
	isUserActive.value = false;
	activePeriodStartedAt.value = null;
	userActivityRecordsOfToday.value = [];
});

describe("UserActivityPanel", () => {
	it("shows its title and the badge Not active when the user is not active", () => {
		const wrapper = mount(UserActivityPanel);
		expect(wrapper.get(".user-activity-title").text()).toContain("User activity");
		expect(wrapper.get("[data-field=state]").text()).toBe("Not active");
		expect(wrapper.get("[data-field=state]").classes()).toContain("theme-secondary");
		expect(wrapper.find("[data-field=since]").exists()).toBe(false);
	});

	it("shows the badge Active, and the time when the period started, while the user is active", () => {
		isUserActive.value = true;
		activePeriodStartedAt.value = new Date(2026, 9, 14, 19, 52, 3).getTime();
		const wrapper = mount(UserActivityPanel);
		expect(wrapper.get("[data-field=state]").text()).toBe("Active");
		expect(wrapper.get("[data-field=state]").classes()).toContain("theme-success");
		expect(wrapper.get("[data-field=since]").text()).toBe("since 19:52:03");
	});

	it("shows the folder of the selected workspace", () => {
		const wrapper = mount(UserActivityPanel);
		expect(wrapper.get("[data-field=folder]").text()).toBe("/work/heidrun");
	});

	it("tells that no workspace is selected when there is none", () => {
		state.selectedWorkspaceId = null;
		const wrapper = mount(UserActivityPanel);
		expect(wrapper.get("[data-field=folder]").text()).toBe("No workspace is selected.");
	});

	it("tells that no active period ended today when there is no record, and shows no period", () => {
		const wrapper = mount(UserActivityPanel);
		expect(wrapper.get("[data-field=no-today]").text()).toBe("No active period ended today.");
		expect(wrapper.findAll("[data-period]")).toHaveLength(0);
	});

	it("shows the total of each folder today, the longest first", () => {
		userActivityRecordsOfToday.value = [
			record("/work/heidrun", "19:00:00", "19:00:05"),
			record("/work/teamwright", "19:10:00", "19:11:30"),
			record("/work/heidrun", "19:20:00", "19:20:10"),
		];
		const wrapper = mount(UserActivityPanel);
		const totals = wrapper.findAll("[data-total]").map((row) => row.text());
		expect(totals).toEqual(["/work/teamwright1 min 30 s", "/work/heidrun15 s"]);
	});

	it("shows the last periods, the newest first, with the time range, the length, the folder, the counts, and the reason", () => {
		userActivityRecordsOfToday.value = [
			record("/work/heidrun", "19:00:00", "19:00:05"),
			record("/work/teamwright", "19:10:00", "19:11:30"),
		];
		const wrapper = mount(UserActivityPanel);
		const periods = wrapper.findAll("[data-period]");
		expect(periods).toHaveLength(2);
		const text = periods[0].text();
		expect(text).toContain("19:10:00 → 19:11:30");
		expect(text).toContain("1 min 30 s");
		expect(text).toContain("/work/teamwright");
		expect(text).toContain("Keyboard: 12");
		expect(text).toContain("Mouse: 3");
		expect(periods[0].get("[data-reason]").text()).toBe("no action for the cool down");
		expect(periods[1].text()).toContain("/work/heidrun");
	});

	it.each([
		["cool_down", "no action for the cool down"],
		["window_behind", "the window went behind"],
		["workspace_changed", "the workspace changed"],
		["app_closed", "the application closed"],
	] as const)("tells in words the reason %s", (endReason, text) => {
		userActivityRecordsOfToday.value = [{ ...record("/work/heidrun", "19:00:00", "19:00:05"), endReason }];
		const wrapper = mount(UserActivityPanel);
		expect(wrapper.get("[data-reason]").text()).toBe(text);
	});

	it("shows the file where the records are kept", () => {
		const wrapper = mount(UserActivityPanel);
		expect(wrapper.text()).toContain("~/.config/heidrun_code/user_activity.jsonl");
	});

	it("writes the time when the period started in the same way as the records do", () => {
		const startedAt = new Date(2026, 9, 14, 19, 52, 3).getTime();
		expect(UserActivity.formatTime(startedAt).slice(11, 19)).toBe("19:52:03");
	});
});
