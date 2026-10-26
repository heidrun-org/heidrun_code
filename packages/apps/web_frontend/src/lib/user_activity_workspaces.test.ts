// @vitest-environment node
import { describe, expect, it } from "vitest";
import { UserActivitySlots } from "./user_activity_slots";
import { USER_ACTIVITY_WORKSPACE_COLOR_TOKENS, UserActivityWorkspaces } from "./user_activity_workspaces";

/** A record with only the folder of its workspace. */
function record(workspaceFolder: string): { workspaceFolder: string } {
	return { workspaceFolder };
}

describe("UserActivityWorkspaces.choices", () => {
	it("lists open workspaces even when they have no activity record", () => {
		expect(UserActivityWorkspaces.choices([
			{ folder: "/work/alpha", label: "Alpha app" },
			{ folder: "/work/beta", label: "Beta app" },
		])).toEqual([
			{ folder: "/work/alpha", name: "Alpha app" },
			{ folder: "/work/beta", name: "Beta app" },
		]);
	});

	it("does not include historical records in the workspace choices", () => {
		const historicalRecords = [record("/work/closed")];
		const choices = UserActivityWorkspaces.choices([{ folder: "/work/open", label: "Open app" }]);
		expect(choices).toEqual([{ folder: "/work/open", name: "Open app" }]);
		expect(choices.some((choice) => choice.folder === historicalRecords[0].workspaceFolder)).toBe(false);
	});

	it("keeps one choice for each open folder", () => {
		const choices = UserActivityWorkspaces.choices([
			{ folder: "/work/alpha", label: "Alpha" },
			{ folder: "/work/alpha", label: "Alpha duplicate" },
		]);
		expect(choices).toEqual([{ folder: "/work/alpha", name: "Alpha" }]);
	});

	it("writes the folder after the name when two workspaces have the same name", () => {
		const openWorkspaces = [
			{ folder: "/one/app", label: "app" },
			{ folder: "/two/app", label: "app" },
			{ folder: "/work/beta", label: "beta" },
		];
		expect(UserActivityWorkspaces.choices(openWorkspaces)).toEqual([
			{ folder: "/one/app", name: "app (/one/app)" },
			{ folder: "/two/app", name: "app (/two/app)" },
			{ folder: "/work/beta", name: "beta" },
		]);
	});

	it("reads the last part of a folder with a slash at the end or with backslashes", () => {
		const choices = UserActivityWorkspaces.choices([
			{ folder: "/work/alpha/", label: "" },
			{ folder: "C:\\work\\beta", label: "" },
		]);
		expect(choices.map((choice) => choice.name)).toEqual(["alpha", "beta"]);
	});

	it("gives no choice when no workspace is open", () => {
		expect(UserActivityWorkspaces.choices([])).toEqual([]);
	});

	it("ignores a workspace that is open with an empty label", () => {
		const choices = UserActivityWorkspaces.choices([{ folder: "/work/alpha", label: "" }]);
		expect(choices[0].name).toBe("alpha");
	});
});

describe("UserActivityWorkspaces.filterRecords", () => {
	const records = [record("/work/alpha"), record("/work/beta"), record("/work/alpha")];

	it("keeps only the records of the chosen workspaces, in the same order", () => {
		expect(UserActivityWorkspaces.filterRecords(records, ["/work/alpha"])).toEqual([records[0], records[2]]);
	});

	it("keeps every record when every workspace is chosen", () => {
		expect(UserActivityWorkspaces.filterRecords(records, ["/work/beta", "/work/alpha"])).toEqual(records);
	});

	it("keeps no record when no workspace is chosen", () => {
		expect(UserActivityWorkspaces.filterRecords(records, [])).toEqual([]);
	});
});

describe("UserActivityWorkspaces.runningPeriodStartedAt", () => {
	it("keeps the running period when its workspace is chosen", () => {
		expect(UserActivityWorkspaces.runningPeriodStartedAt(1000, "/work/alpha", ["/work/alpha"])).toBe(1000);
	});

	it("drops the running period when its workspace is not chosen", () => {
		expect(UserActivityWorkspaces.runningPeriodStartedAt(1000, "/work/alpha", ["/work/beta"])).toBeNull();
	});

	it("gives null when no period runs, or when no workspace is selected", () => {
		expect(UserActivityWorkspaces.runningPeriodStartedAt(null, "/work/alpha", ["/work/alpha"])).toBeNull();
		expect(UserActivityWorkspaces.runningPeriodStartedAt(1000, null, ["/work/alpha"])).toBeNull();
	});
});

describe("UserActivityWorkspaces.colorToken", () => {
	it("gives a different color to each of the first workspaces, and starts again after the last color", () => {
		const count = USER_ACTIVITY_WORKSPACE_COLOR_TOKENS.length;
		const firstColors = Array.from({ length: count }, (_unused, index) => UserActivityWorkspaces.colorToken(index));
		expect(new Set(firstColors).size).toBe(count);
		expect(UserActivityWorkspaces.colorToken(count)).toBe(firstColors[0]);
		expect(UserActivityWorkspaces.colorToken(count + 1)).toBe(firstColors[1]);
	});

	it("gives only names of CSS variables of the color scales of Bootstrap", () => {
		for (const token of USER_ACTIVITY_WORKSPACE_COLOR_TOKENS) {
			expect(token).toMatch(/^--[a-z]+-500$/);
		}
	});
});

describe("UserActivityWorkspaces.slotsByWorkspace", () => {
	const ALPHA = "/work/alpha";
	const BETA = "/work/beta";
	const GAMMA = "/work/gamma";
	const choices = [
		{ folder: ALPHA, name: "alpha" },
		{ folder: BETA, name: "beta" },
		{ folder: GAMMA, name: "gamma" },
	];

	/** The current time of the tests: 10:07:30. The last slot of one hour is 10:00 to 11:00, and it has index 23. */
	const now = new Date(2026, 9, 15, 10, 7, 30).getTime();

	/** A record of an active period that starts at a time of the clock, and lasts a number of seconds. */
	function timedRecord(workspaceFolder: string, hour: number, minute: number, second: number, durationInSeconds: number) {
		const startedAt = new Date(2026, 9, 15, hour, minute, second).getTime();
		return {
			workspaceFolder,
			startedAt: new Date(startedAt).toISOString(),
			endedAt: new Date(startedAt + durationInSeconds * 1000).toISOString(),
		};
	}

	const records = [
		timedRecord(ALPHA, 10, 0, 30, 60),
		timedRecord(BETA, 10, 2, 0, 60),
		timedRecord(BETA, 9, 57, 0, 60),
	];

	it("gives one entry for each chosen workspace, in the order of the choices, with the user activity time of this workspace only", () => {
		const result = UserActivityWorkspaces.slotsByWorkspace(choices, [BETA, ALPHA], records, null, null, now);
		expect(result.map((workspace) => workspace.folder)).toEqual([ALPHA, BETA]);
		expect(result.map((workspace) => workspace.name)).toEqual(["alpha", "beta"]);
		expect(result[0].slots).toHaveLength(24);
		expect(result[0].slots.map((slot) => slot.activeTimeMs / 1000)).toEqual([...new Array(23).fill(0), 60]);
		expect(result[1].slots.map((slot) => slot.activeTimeMs / 1000)).toEqual([...new Array(22).fill(0), 60, 60]);
	});

	it("keeps the color of a workspace when another workspace is hidden", () => {
		const everyWorkspace = UserActivityWorkspaces.slotsByWorkspace(choices, [ALPHA, BETA, GAMMA], records, null, null, now);
		const withoutBeta = UserActivityWorkspaces.slotsByWorkspace(choices, [ALPHA, GAMMA], records, null, null, now);
		expect(withoutBeta.map((workspace) => workspace.folder)).toEqual([ALPHA, GAMMA]);
		expect(withoutBeta[0].colorToken).toBe(everyWorkspace[0].colorToken);
		expect(withoutBeta[1].colorToken).toBe(everyWorkspace[2].colorToken);
		expect(withoutBeta[1].colorToken).toBe(UserActivityWorkspaces.colorToken(2));
	});

	it("gives the same colors in every time range", () => {
		const colors = (rangeId: "day" | "week" | "month") =>
			UserActivityWorkspaces.slotsByWorkspace(choices, [ALPHA, BETA], records, null, null, now, rangeId).map((workspace) => workspace.colorToken);
		expect(colors("week")).toEqual(colors("day"));
		expect(colors("month")).toEqual(colors("day"));
	});

	it("adds up, slot by slot, to the user activity time of all the chosen workspaces together", () => {
		const result = UserActivityWorkspaces.slotsByWorkspace(choices, [ALPHA, BETA, GAMMA], records, null, null, now);
		const total = UserActivitySlots.compute(records, null, now);
		const sums = total.map((_slot, index) => result.reduce((sum, workspace) => sum + workspace.slots[index].activeTimeMs, 0));
		expect(sums).toEqual(total.map((slot) => slot.activeTimeMs));
	});

	it("counts the running active period only in the slots of its own workspace", () => {
		const runningPeriodStartedAt = new Date(2026, 9, 15, 10, 6, 30).getTime();
		const result = UserActivityWorkspaces.slotsByWorkspace(choices, [ALPHA, BETA], records, runningPeriodStartedAt, ALPHA, now);
		expect(result[0].slots[23].activeTimeMs / 1000).toBe(120);
		expect(result[1].slots[23].activeTimeMs / 1000).toBe(60);
	});

	it("gives a workspace with no user activity time in the range a part of height 0", () => {
		const result = UserActivityWorkspaces.slotsByWorkspace(choices, [GAMMA], records, null, null, now);
		expect(result).toHaveLength(1);
		expect(result[0].slots.every((slot) => slot.activeTimeMs === 0)).toBe(true);
	});

	it("gives no entry when no workspace is chosen, or when there is no choice", () => {
		expect(UserActivityWorkspaces.slotsByWorkspace(choices, [], records, null, null, now)).toEqual([]);
		expect(UserActivityWorkspaces.slotsByWorkspace([], [], [], null, null, now)).toEqual([]);
	});
});
