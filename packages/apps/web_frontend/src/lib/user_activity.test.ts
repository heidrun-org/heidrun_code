// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { USER_ACTIVITY_COOL_DOWN_MS, UserActivity } from "./user_activity";

const FOLDER = "/work/heidrun";
const OTHER_FOLDER = "/work/teamwright";

/** A time in the middle of a day, in milliseconds since 1 January 1970. */
const START = Date.UTC(2026, 9, 14, 17, 52, 3, 412);

describe("UserActivity: is the user active", () => {
	it("is not active before any action", () => {
		const userActivity = new UserActivity(true, FOLDER);
		expect(userActivity.isActive(START)).toBe(false);
	});

	it("is active just after an action while the window is in front", () => {
		const userActivity = new UserActivity(true, FOLDER);
		userActivity.recordAction(START, "keyboard");
		expect(userActivity.isActive(START)).toBe(true);
	});

	it("stays active until the cool down is over, and not after", () => {
		const userActivity = new UserActivity(true, FOLDER);
		userActivity.recordAction(START, "keyboard");
		expect(userActivity.isActive(START + USER_ACTIVITY_COOL_DOWN_MS - 1)).toBe(true);
		expect(userActivity.isActive(START + USER_ACTIVITY_COOL_DOWN_MS)).toBe(false);
	});

	it("starts the cool down again at each action", () => {
		const userActivity = new UserActivity(true, FOLDER);
		userActivity.recordAction(START, "keyboard");
		userActivity.recordAction(START + USER_ACTIVITY_COOL_DOWN_MS - 1, "mouse");
		expect(userActivity.isActive(START + USER_ACTIVITY_COOL_DOWN_MS + 1)).toBe(true);
	});

	it("gives the time left before the user is no longer active", () => {
		const userActivity = new UserActivity(true, FOLDER, 4_000);
		userActivity.recordAction(START, "mouse");
		expect(userActivity.msUntilInactive(START + 1_500)).toBe(2_500);
		expect(userActivity.msUntilInactive(START + 10_000)).toBe(0);
	});

	it("ignores an action while the window is not in front", () => {
		const userActivity = new UserActivity(false, FOLDER);
		expect(userActivity.recordAction(START, "keyboard")).toBeNull();
		expect(userActivity.isActive(START)).toBe(false);
	});

	it("ignores an action while no workspace is selected", () => {
		const userActivity = new UserActivity(true, null);
		userActivity.recordAction(START, "keyboard");
		expect(userActivity.isActive(START)).toBe(false);
	});

	it("is no longer active at once when the window goes behind, without waiting for the cool down", () => {
		const userActivity = new UserActivity(true, FOLDER);
		userActivity.recordAction(START, "keyboard");
		userActivity.setWindowInFront(false, START + 1);
		expect(userActivity.isActive(START + 1)).toBe(false);
	});

	it("is not active again when the window comes back to the front, until the next action", () => {
		const userActivity = new UserActivity(true, FOLDER);
		userActivity.recordAction(START, "keyboard");
		userActivity.setWindowInFront(false, START + 1);
		userActivity.setWindowInFront(true, START + 2);
		expect(userActivity.isActive(START + 2)).toBe(false);
		userActivity.recordAction(START + 3, "mouse");
		expect(userActivity.isActive(START + 3)).toBe(true);
	});
});

describe("UserActivity: the record of an active period", () => {
	it("gives no record while the period runs", () => {
		const userActivity = new UserActivity(true, FOLDER);
		expect(userActivity.recordAction(START, "keyboard")).toBeNull();
		expect(userActivity.recordAction(START + 1_000, "mouse")).toBeNull();
		expect(userActivity.tick(START + 2_000)).toBeNull();
	});

	it("ends with the reason cool_down at the last action plus the cool down, and counts each kind of action", () => {
		const userActivity = new UserActivity(true, FOLDER);
		userActivity.recordAction(START, "keyboard");
		userActivity.recordAction(START + 1_000, "keyboard");
		userActivity.recordAction(START + 2_000, "mouse");
		const record = userActivity.tick(START + 2_000 + USER_ACTIVITY_COOL_DOWN_MS);
		expect(record).toEqual({
			workspaceFolder: FOLDER,
			startedAt: UserActivity.formatTime(START),
			lastActionAt: UserActivity.formatTime(START + 2_000),
			endedAt: UserActivity.formatTime(START + 2_000 + USER_ACTIVITY_COOL_DOWN_MS),
			keyboardActionCount: 2,
			mouseActionCount: 1,
			endReason: "cool_down",
		});
	});

	it("ends at the end of the cool down, and not at the late time of the check", () => {
		const userActivity = new UserActivity(true, FOLDER);
		userActivity.recordAction(START, "keyboard");
		const record = userActivity.tick(START + 60_000);
		expect(record?.endedAt).toBe(UserActivity.formatTime(START + USER_ACTIVITY_COOL_DOWN_MS));
	});

	it("gives the record of the old period, and starts a new period, when an action comes after the cool down", () => {
		const userActivity = new UserActivity(true, FOLDER);
		userActivity.recordAction(START, "keyboard");
		const record = userActivity.recordAction(START + 60_000, "mouse");
		expect(record?.endReason).toBe("cool_down");
		expect(record?.keyboardActionCount).toBe(1);
		expect(userActivity.periodStartedAt).toBe(START + 60_000);
		const next = userActivity.tick(START + 60_000 + USER_ACTIVITY_COOL_DOWN_MS);
		expect(next).toMatchObject({ keyboardActionCount: 0, mouseActionCount: 1 });
	});

	it("ends with the reason window_behind at the time when the window went behind", () => {
		const userActivity = new UserActivity(true, FOLDER);
		userActivity.recordAction(START, "keyboard");
		const record = userActivity.setWindowInFront(false, START + 1_500);
		expect(record).toMatchObject({
			endReason: "window_behind",
			lastActionAt: UserActivity.formatTime(START),
			endedAt: UserActivity.formatTime(START + 1_500),
		});
	});

	it("ends with the reason cool_down when the window goes behind after the cool down, and not window_behind", () => {
		const userActivity = new UserActivity(true, FOLDER);
		userActivity.recordAction(START, "keyboard");
		const record = userActivity.setWindowInFront(false, START + 60_000);
		expect(record?.endReason).toBe("cool_down");
		expect(record?.endedAt).toBe(UserActivity.formatTime(START + USER_ACTIVITY_COOL_DOWN_MS));
	});

	it("gives no record when the window goes behind while the user is not active", () => {
		const userActivity = new UserActivity(true, FOLDER);
		expect(userActivity.setWindowInFront(false, START)).toBeNull();
	});

	it("ends with the reason app_closed when the application closes during a period", () => {
		const userActivity = new UserActivity(true, FOLDER);
		userActivity.recordAction(START, "mouse");
		const record = userActivity.close(START + 2_000);
		expect(record).toMatchObject({ endReason: "app_closed", endedAt: UserActivity.formatTime(START + 2_000) });
		expect(userActivity.isActive(START + 2_000)).toBe(false);
	});

	it("gives no record when the application closes while the user is not active", () => {
		const userActivity = new UserActivity(true, FOLDER);
		expect(userActivity.close(START)).toBeNull();
	});
});

describe("UserActivity: a change of workspace", () => {
	it("ends the period of the first workspace with the reason workspace_changed, with its own folder", () => {
		const userActivity = new UserActivity(true, FOLDER);
		userActivity.recordAction(START, "keyboard");
		const record = userActivity.setWorkspaceFolder(OTHER_FOLDER, START + 2_000);
		expect(record).toMatchObject({
			workspaceFolder: FOLDER,
			endReason: "workspace_changed",
			endedAt: UserActivity.formatTime(START + 2_000),
		});
	});

	it("starts a new period in the new workspace at once, when the user was active, and counts the change as an action", () => {
		const userActivity = new UserActivity(true, FOLDER);
		userActivity.recordAction(START, "keyboard");
		userActivity.setWorkspaceFolder(OTHER_FOLDER, START + 2_000);
		expect(userActivity.isActive(START + 2_000)).toBe(true);
		expect(userActivity.periodStartedAt).toBe(START + 2_000);
		const next = userActivity.tick(START + 2_000 + USER_ACTIVITY_COOL_DOWN_MS);
		expect(next).toEqual({
			workspaceFolder: OTHER_FOLDER,
			startedAt: UserActivity.formatTime(START + 2_000),
			lastActionAt: UserActivity.formatTime(START + 2_000),
			endedAt: UserActivity.formatTime(START + 2_000 + USER_ACTIVITY_COOL_DOWN_MS),
			keyboardActionCount: 0,
			mouseActionCount: 0,
			endReason: "cool_down",
		});
	});

	it("starts no period when the user was not active", () => {
		const userActivity = new UserActivity(true, FOLDER);
		expect(userActivity.setWorkspaceFolder(OTHER_FOLDER, START)).toBeNull();
		expect(userActivity.isActive(START)).toBe(false);
	});

	it("gives the record with the reason cool_down when the cool down was over before the change", () => {
		const userActivity = new UserActivity(true, FOLDER);
		userActivity.recordAction(START, "keyboard");
		const record = userActivity.setWorkspaceFolder(OTHER_FOLDER, START + 60_000);
		expect(record?.endReason).toBe("cool_down");
		expect(userActivity.isActive(START + 60_000)).toBe(false);
	});

	it("does nothing when the folder is the same", () => {
		const userActivity = new UserActivity(true, FOLDER);
		userActivity.recordAction(START, "keyboard");
		expect(userActivity.setWorkspaceFolder(FOLDER, START + 1_000)).toBeNull();
		expect(userActivity.periodStartedAt).toBe(START);
	});

	it("ends the period and starts no new one when no workspace is selected any more", () => {
		const userActivity = new UserActivity(true, FOLDER);
		userActivity.recordAction(START, "keyboard");
		const record = userActivity.setWorkspaceFolder(null, START + 1_000);
		expect(record?.endReason).toBe("workspace_changed");
		expect(userActivity.isActive(START + 1_000)).toBe(false);
	});
});

describe("UserActivity.formatTime", () => {
	const originalTimeZone = process.env.TZ;

	afterEach(() => {
		if (originalTimeZone === undefined) {
			delete process.env.TZ;
		} else {
			process.env.TZ = originalTimeZone;
		}
	});

	it("writes the time with milliseconds and the offset of the time zone, and the text gives the same time back", () => {
		const text = UserActivity.formatTime(START);
		expect(text).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
		expect(new Date(text).getTime()).toBe(START);
	});

	it.each([
		["Europe/Paris", "2026-10-14T19:52:03.412+02:00"],
		["Asia/Kolkata", "2026-10-14T23:22:03.412+05:30"],
		["America/Los_Angeles", "2026-10-14T10:52:03.412-07:00"],
		["UTC", "2026-10-14T17:52:03.412+00:00"],
	])("writes the local time of the time zone %s", (timeZone, expected) => {
		process.env.TZ = timeZone;
		expect(UserActivity.formatTime(START)).toBe(expected);
	});
});
