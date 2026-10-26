import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { USER_ACTIVITY_COOL_DOWN_MS, type UserActivityRecord } from "../lib/user_activity";
import type { SessionSnapshot } from "../lib/types";

const invoke = vi.hoisted(() => vi.fn(async (_command: string, _arguments?: unknown): Promise<unknown> => undefined));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/** True while the fake window of the test is in front. */
let isWindowInFront = true;

/** A snapshot with two workspaces, each with one pane in its own folder. */
function snapshot(): SessionSnapshot {
	return {
		version: "test",
		protocol: 1,
		workspaces: [
			{ workspace_id: "w1", workspace_folder: "/work/heidrun", number: 1, label: "heidrun", focused: true, pane_count: 1, tab_count: 1, active_tab_id: "w1:t1" },
			{ workspace_id: "w2", workspace_folder: "/work/teamwright", number: 2, label: "teamwright", focused: false, pane_count: 1, tab_count: 1, active_tab_id: "w2:t1" },
		],
		tabs: [],
		panes: [
			{ pane_id: "p1", workspace_id: "w1", cwd: "/work/heidrun" },
			{ pane_id: "p2", workspace_id: "w2", cwd: "/work/teamwright" },
		],
		layouts: [],
		agents: [],
	} as unknown as SessionSnapshot;
}

/** The listeners that the store put on the window during the test, so that the test removes them at its end. */
let windowListeners: [string, EventListenerOrEventListenerObject, AddEventListenerOptions | boolean | undefined][] = [];

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date(2026, 9, 14, 19, 52, 3, 412));
	vi.resetModules();
	invoke.mockReset();
	invoke.mockImplementation(async (command: string) => (command === "user_activity_read" ? [] : undefined));
	isWindowInFront = true;
	vi.spyOn(document, "hasFocus").mockImplementation(() => isWindowInFront);
	windowListeners = [];
	const addEventListener = window.addEventListener.bind(window);
	vi.spyOn(window, "addEventListener").mockImplementation((type: string, listener: unknown, options?: unknown) => {
		windowListeners.push([type, listener as EventListener, options as AddEventListenerOptions | boolean | undefined]);
		addEventListener(type, listener as EventListener, options as AddEventListenerOptions | boolean | undefined);
	});
});

afterEach(() => {
	for (const [type, listener, options] of windowListeners) {
		window.removeEventListener(type, listener, options);
	}
	vi.useRealTimers();
	vi.restoreAllMocks();
});

/** Loads the stores, selects the workspace `w1`, and starts the detection. */
async function startedStore() {
	const { state } = await import("./session");
	state.snapshot = snapshot();
	state.selectedWorkspaceId = "w1";
	const store = await import("./user_activity");
	store.startUserActivity();
	await nextTick();
	return { ...store, state };
}

/** The records that the store wrote to the file, in order. */
function writtenRecords(): UserActivityRecord[] {
	return invoke.mock.calls
		.filter(([command]) => command === "user_activity_append")
		.map(([, argumentsOfCall]) => (argumentsOfCall as { record: UserActivityRecord }).record);
}

describe("startUserActivity: is the user active in front of Heidrun Code", () => {
	it("tells the status item that the user is not active at the start", async () => {
		const { isUserActive } = await startedStore();
		expect(isUserActive.value).toBe(false);
		expect(invoke).toHaveBeenCalledWith("status_item_set_user_active", { isActive: false });
	});

	it.each(["keydown", "mousedown", "mousemove", "wheel"])("counts the event %s while the window is in front", async (eventName) => {
		const { isUserActive } = await startedStore();
		window.dispatchEvent(new Event(eventName));
		await nextTick();
		expect(isUserActive.value).toBe(true);
		expect(invoke).toHaveBeenLastCalledWith("status_item_set_user_active", { isActive: true });
	});

	it("is no longer active when the cool down is over, and tells the status item", async () => {
		const { isUserActive } = await startedStore();
		window.dispatchEvent(new Event("keydown"));
		await nextTick();
		expect(invoke).toHaveBeenLastCalledWith("status_item_set_user_active", { isActive: true });
		vi.advanceTimersByTime(USER_ACTIVITY_COOL_DOWN_MS - 1);
		expect(isUserActive.value).toBe(true);
		vi.advanceTimersByTime(2);
		await nextTick();
		expect(isUserActive.value).toBe(false);
		expect(invoke).toHaveBeenCalledWith("status_item_set_user_active", { isActive: false });
	});

	it("does not count a mouse move over a window that is not in front", async () => {
		isWindowInFront = false;
		const { isUserActive } = await startedStore();
		window.dispatchEvent(new Event("mousemove"));
		expect(isUserActive.value).toBe(false);
	});

	it("does not count an action while no workspace is selected", async () => {
		const { isUserActive, state } = await startedStore();
		state.selectedWorkspaceId = null;
		await nextTick();
		window.dispatchEvent(new Event("keydown"));
		expect(isUserActive.value).toBe(false);
	});

	it("sees a key even when the component under it stops the event, like the terminal does", async () => {
		const { isUserActive } = await startedStore();
		const terminal = document.createElement("textarea");
		terminal.addEventListener("keydown", (event) => event.stopPropagation());
		document.body.appendChild(terminal);
		terminal.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
		expect(isUserActive.value).toBe(true);
		terminal.remove();
	});

	it("does nothing the second time that it starts", async () => {
		const store = await startedStore();
		const callCount = invoke.mock.calls.length;
		store.startUserActivity();
		await nextTick();
		expect(invoke.mock.calls.length).toBe(callCount);
	});
});

describe("startUserActivity: the records", () => {
	it("writes no record while the period runs", async () => {
		await startedStore();
		window.dispatchEvent(new Event("keydown"));
		vi.advanceTimersByTime(USER_ACTIVITY_COOL_DOWN_MS - 1);
		expect(writtenRecords()).toEqual([]);
	});

	it("writes one record when the cool down ends, with the folder, ISO times, the counts, and the reason", async () => {
		const { userActivityRecordsOfToday } = await startedStore();
		window.dispatchEvent(new Event("keydown"));
		vi.advanceTimersByTime(1_000);
		window.dispatchEvent(new Event("keydown"));
		window.dispatchEvent(new Event("mousemove"));
		vi.advanceTimersByTime(USER_ACTIVITY_COOL_DOWN_MS);
		expect(writtenRecords()).toHaveLength(1);
		const [record] = writtenRecords();
		expect(record.workspaceFolder).toBe("/work/heidrun");
		expect(record.keyboardActionCount).toBe(2);
		expect(record.mouseActionCount).toBe(1);
		expect(record.endReason).toBe("cool_down");
		for (const time of [record.startedAt, record.lastActionAt, record.endedAt]) {
			expect(time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
		}
		expect(new Date(record.endedAt).getTime() - new Date(record.lastActionAt).getTime()).toBe(USER_ACTIVITY_COOL_DOWN_MS);
		expect(userActivityRecordsOfToday.value).toEqual([record]);
	});

	it("writes a record with the reason window_behind when the window goes behind", async () => {
		await startedStore();
		window.dispatchEvent(new Event("keydown"));
		vi.advanceTimersByTime(1_500);
		isWindowInFront = false;
		window.dispatchEvent(new Event("blur"));
		expect(writtenRecords().map((record) => record.endReason)).toEqual(["window_behind"]);
	});

	it("writes a record with the reason workspace_changed, and starts the next period in the new folder", async () => {
		const { state, isUserActive } = await startedStore();
		window.dispatchEvent(new Event("keydown"));
		vi.advanceTimersByTime(1_000);
		state.selectedWorkspaceId = "w2";
		await nextTick();
		expect(writtenRecords()).toHaveLength(1);
		expect(writtenRecords()[0]).toMatchObject({ workspaceFolder: "/work/heidrun", endReason: "workspace_changed" });
		expect(isUserActive.value).toBe(true);
		vi.advanceTimersByTime(USER_ACTIVITY_COOL_DOWN_MS);
		expect(writtenRecords()).toHaveLength(2);
		expect(writtenRecords()[1]).toMatchObject({ workspaceFolder: "/work/teamwright", endReason: "cool_down" });
	});

	it("writes a record with the reason app_closed when the window closes during a period", async () => {
		await startedStore();
		window.dispatchEvent(new Event("mousedown"));
		window.dispatchEvent(new Event("beforeunload"));
		expect(writtenRecords().map((record) => record.endReason)).toEqual(["app_closed"]);
	});

	it("puts the records of the file before the new records, without a double", async () => {
		const stored: UserActivityRecord = {
			workspaceFolder: "/work/old",
			startedAt: "2026-10-14T08:00:00.000+02:00",
			lastActionAt: "2026-10-14T08:00:10.000+02:00",
			endedAt: "2026-10-14T08:00:15.000+02:00",
			keyboardActionCount: 4,
			mouseActionCount: 1,
			endReason: "cool_down",
		};
		invoke.mockImplementation(async (command: string) => (command === "user_activity_read" ? [stored] : undefined));
		const { userActivityRecordsOfToday } = await startedStore();
		await vi.advanceTimersByTimeAsync(0);
		expect(userActivityRecordsOfToday.value).toEqual([stored]);
		expect(invoke).toHaveBeenCalledWith("user_activity_read", { since: expect.stringMatching(/T00:00:00\.000[+-]\d{2}:\d{2}$/) });
	});
});
