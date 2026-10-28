// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { UserActivityRecord } from "./user_activity";
import { USER_ACTIVITY_ROW_LIMIT, UserActivityView } from "./user_activity_view";

/** A record of the folder, from `startedAt` to `endedAt`, in the time zone +02:00. */
function record(workspaceFolder: string, startedAt: string, endedAt: string): UserActivityRecord {
	return {
		workspaceFolder,
		startedAt: `2026-10-14T${startedAt}.000+02:00`,
		lastActionAt: `2026-10-14T${endedAt}.000+02:00`,
		endedAt: `2026-10-14T${endedAt}.000+02:00`,
		keyboardActionCount: 3,
		mouseActionCount: 1,
		endReason: "cool_down",
	};
}

describe("UserActivityView.formatDuration", () => {
	it.each([
		[0, "0 s"],
		[5_000, "5 s"],
		[59_400, "59 s"],
		[192_000, "3 min 12 s"],
		[3_600_000, "1 h 00 min 00 s"],
		[3_907_000, "1 h 05 min 07 s"],
	])("writes %i milliseconds as %s", (durationMs, expected) => {
		expect(UserActivityView.formatDuration(durationMs)).toBe(expected);
	});
});

describe("UserActivityView.durationMs", () => {
	it("is the time from the start to the end, whatever the time zone of each time", () => {
		const mixed = { ...record("/a", "19:00:00", "19:00:05"), endedAt: "2026-10-14T17:00:05.000+00:00" };
		expect(UserActivityView.durationMs(mixed)).toBe(5_000);
	});

	it("is 0 when a time is not a date, or when the end is before the start", () => {
		expect(UserActivityView.durationMs({ ...record("/a", "19:00:00", "19:00:05"), endedAt: "yesterday" })).toBe(0);
		expect(UserActivityView.durationMs(record("/a", "19:00:05", "19:00:00"))).toBe(0);
	});
});

describe("UserActivityView.timeOfDay", () => {
	it("gives the time of the day as it is written in the text", () => {
		expect(UserActivityView.timeOfDay("2026-10-14T19:52:03.412+02:00")).toBe("19:52:03");
	});
});

describe("UserActivityView.rows", () => {
	it("gives the newest period first, with its time range, its length, its folder, its counts, and its reason", () => {
		const rows = UserActivityView.rows([record("/a", "19:00:00", "19:00:05"), record("/b", "19:10:00", "19:12:30")]);
		expect(rows.map((row) => row.workspaceFolder)).toEqual(["/b", "/a"]);
		expect(rows[0]).toMatchObject({
			timeRange: "19:10:00 → 19:12:30",
			duration: "2 min 30 s",
			keyboardActionCount: 3,
			mouseActionCount: 1,
			endReason: "cool_down",
		});
	});

	it("keeps only the newest periods when there are more than the limit", () => {
		const records = Array.from({ length: USER_ACTIVITY_ROW_LIMIT + 5 }, (_, index) =>
			record(`/folder-${index}`, "19:00:00", "19:00:05"),
		);
		const rows = UserActivityView.rows(records);
		expect(rows).toHaveLength(USER_ACTIVITY_ROW_LIMIT);
		expect(rows[0].workspaceFolder).toBe(`/folder-${USER_ACTIVITY_ROW_LIMIT + 4}`);
	});

	it("gives no line when there is no record", () => {
		expect(UserActivityView.rows([])).toEqual([]);
	});
});

describe("UserActivityView.totalsByFolder", () => {
	it("adds up the periods of each folder, and puts the longest folder first", () => {
		const totals = UserActivityView.totalsByFolder([
			record("/a", "19:00:00", "19:00:05"),
			record("/b", "19:10:00", "19:11:00"),
			record("/a", "19:20:00", "19:20:10"),
		]);
		expect(totals).toEqual([
			{ workspaceFolder: "/b", durationMs: 60_000 },
			{ workspaceFolder: "/a", durationMs: 15_000 },
		]);
	});

	it("gives no total when there is no record", () => {
		expect(UserActivityView.totalsByFolder([])).toEqual([]);
	});
});
