// @vitest-environment node
import { describe, expect, it } from "vitest";
import { AiCost, type AiCostAnswer, type AiCostHourRow, type AiCostWorkspace } from "./ai_cost";

/** Wednesday 14 October 2026, 15:00 in the time zone of the computer. */
const NOW = new Date(2026, 9, 14, 15, 0, 0).getTime();

/**
 * A row of the answer: the tokens and the cost of a coding agent in the hour `hour` of the day `monthDay` of October 2026, at
 * the clock of the computer. A cost of `null` is an hour whose tokens have no known price: all its tokens are unpriced.
 */
function row(monthDay: number, codingAgent: string, costUsd: number | null, tokens = 0, hour = 0): AiCostHourRow {
	return {
		startedAt: new Date(2026, 9, monthDay, hour).toISOString(),
		day: `2026-10-${String(monthDay).padStart(2, "0")}`,
		codingAgent,
		tokens,
		costUsd,
		unpricedTokens: costUsd === null ? tokens : 0,
	};
}

/** An answer with these rows, for one workspace that is imported. */
function answerOf(hours: AiCostHourRow[]): AiCostAnswer {
	return { workspaces: [], hours, priceVersion: 1, pricesCheckedAt: null };
}

/** The state of a workspace. */
function workspace(folder: string, synchronizedAt: string | null, error: string | null = null): AiCostWorkspace {
	return { folder, repository: "owner/name", synchronizedAt, error };
}

describe("AiCost.compute", () => {
	const rows = [
		row(14, "claude", 3.75),
		row(14, "codex", 0.5),
		row(12, "claude", 4),
		row(9, "codex", 1),
		row(8, "codex", 0.75),
		row(7, "claude", 100),
	];

	it("gives one slot of one day for each day of the time range by default, the last slot being today", () => {
		const result = AiCost.compute(answerOf(rows), NOW, 7);
		expect(result.slots).toHaveLength(7);
		expect(result.slots[0].startedAt).toBe(new Date(2026, 9, 8).getTime());
		expect(result.slots[6].startedAt).toBe(new Date(2026, 9, 14).getTime());
	});

	it("puts the cost of each coding agent on the day of the row", () => {
		const result = AiCost.compute(answerOf(rows), NOW, 7);
		expect(result.slots.map((slot) => [slot.costByAgent.claude, slot.costByAgent.codex])).toEqual([
			[0, 0.75],
			[0, 1],
			[0, 0],
			[0, 0],
			[4, 0],
			[0, 0],
			[3.75, 0.5],
		]);
	});

	it("gives the cost of each coding agent and the total of the time range, and ignores a day that is older", () => {
		const result = AiCost.compute(answerOf(rows), NOW, 7);
		expect(result.totalByAgent).toEqual({ claude: 7.75, codex: 2.25 });
		expect(result.totalCost).toBe(10);
	});

	it("counts the older days again in a longer time range", () => {
		const result = AiCost.compute(answerOf(rows), NOW, 30);
		expect(result.slots).toHaveLength(30);
		expect(result.totalByAgent.claude).toBe(107.75);
	});

	it("ignores a row of another coding agent and a row whose day is not a time", () => {
		const result = AiCost.compute(
			answerOf([row(14, "antigravity", 5, 500), { ...row(14, "claude", 5, 500), startedAt: "yesterday" }]),
			NOW,
			7,
		);
		expect(result.totalCost).toBe(0);
		expect(result.totalTokens).toBe(0);
	});

	it("gives days with a cost of zero and no token when there is no row", () => {
		const result = AiCost.compute(answerOf([]), NOW, 7);
		expect(result.slots.every((slot) => slot.costByAgent.claude === 0 && slot.costByAgent.codex === 0)).toBe(true);
		expect(result.slots.every((slot) => slot.tokensByAgent.claude === 0 && slot.tokensByAgent.codex === 0)).toBe(true);
		expect(result.totalCost).toBe(0);
		expect(result.totalTokens).toBe(0);
		expect(result.unpricedTokens).toBe(0);
	});

	it("puts a row on the day that holds its start, whatever the length of that day", () => {
		const longDay = { startedAt: new Date(2026, 9, 25).toISOString(), day: "2026-10-25" };
		const result = AiCost.compute(answerOf([{ ...row(25, "claude", 1, 10), ...longDay }]), new Date(2026, 9, 26, 12).getTime(), 3);
		expect(result.slots.map((slot) => slot.tokensByAgent.claude)).toEqual([0, 10, 0]);
	});
});

describe("AiCost.compute, the slot length", () => {
	const hourRows = [
		row(14, "claude", 1, 100, 5),
		row(14, "claude", 2, 200, 6),
		row(14, "codex", 0.5, 50, 11),
		row(14, "claude", 4, 400, 12),
		row(14, "claude", null, 800, 23),
		row(13, "codex", 3, 300, 0),
	];

	it("gives four slots for each day with a slot of 6 hours, the last slot ending at the end of today", () => {
		const result = AiCost.compute(answerOf(hourRows), NOW, 7, 6);
		expect(result.slots).toHaveLength(28);
		expect(result.slots[0].startedAt).toBe(new Date(2026, 9, 8).getTime());
		expect(result.slots[0].endedAt).toBe(new Date(2026, 9, 8, 6).getTime());
		expect(result.slots[27].startedAt).toBe(new Date(2026, 9, 14, 18).getTime());
		expect(result.slots[27].endedAt).toBe(new Date(2026, 9, 15).getTime());
	});

	it("adds the hours that a slot of 6 hours holds, and keeps the hours of the other slots apart", () => {
		const result = AiCost.compute(answerOf(hourRows), NOW, 7, 6);
		const today = result.slots.slice(24);
		expect(today.map((slot) => [slot.tokensByAgent.claude, slot.tokensByAgent.codex])).toEqual([
			[100, 0],
			[200, 50],
			[400, 0],
			[800, 0],
		]);
		expect(today.map((slot) => slot.costByAgent.claude)).toEqual([1, 2, 4, 0]);
		expect(result.slots[20].tokensByAgent.codex).toBe(300);
	});

	it("gives 24 slots for each day with a slot of 1 hour, and puts each row in the slot of its hour", () => {
		const result = AiCost.compute(answerOf(hourRows), NOW, 7, 1);
		expect(result.slots).toHaveLength(7 * 24);
		const today = 6 * 24;
		expect(result.slots[today + 5].tokensByAgent.claude).toBe(100);
		expect(result.slots[today + 6].tokensByAgent.claude).toBe(200);
		expect(result.slots[today + 23].tokensByAgent.claude).toBe(800);
		expect(result.slots[5 * 24].tokensByAgent.codex).toBe(300);
	});

	it("gives the same totals for every slot length, and counts the unpriced tokens once", () => {
		const totals = [1, 6, 24].map((slotHours) => {
			const result = AiCost.compute(answerOf(hourRows), NOW, 7, slotHours);
			return [result.totalCost, result.totalTokens, result.unpricedTokens, result.totalByAgent.claude, result.totalByAgent.codex];
		});
		expect(totals[0]).toEqual([10.5, 1_850, 800, 7, 3.5]);
		expect(totals[1]).toEqual(totals[0]);
		expect(totals[2]).toEqual(totals[0]);
	});

	it("cuts a day of 25 hours in 25 slots of 1 hour, and a day of 23 hours in 23 slots, in the time zone of the computer", () => {
		const longDay = new Date(2026, 9, 25, 12).getTime();
		const hours = AiCost.compute(answerOf([]), longDay, 1, 1).slots.length;
		expect([23, 24, 25]).toContain(hours);
		const dayLength = (new Date(2026, 9, 26).getTime() - new Date(2026, 9, 25).getTime()) / 3_600_000;
		expect(hours).toBe(Math.ceil(dayLength));
	});
});

describe("AiCost.compute, the tokens", () => {
	const rows = [
		row(14, "claude", 3.75, 1_500),
		row(14, "codex", 0.5, 200),
		row(12, "claude", 4, 3_000),
		row(7, "claude", 100, 90_000),
	];

	it("adds the tokens of each coding agent on the day of the row", () => {
		const result = AiCost.compute(answerOf(rows), NOW, 7);
		expect(result.slots.map((slot) => [slot.tokensByAgent.claude, slot.tokensByAgent.codex])).toEqual([
			[0, 0],
			[0, 0],
			[0, 0],
			[0, 0],
			[3_000, 0],
			[0, 0],
			[1_500, 200],
		]);
	});

	it("gives the tokens of each coding agent and the total of the time range, and ignores a day that is older", () => {
		const result = AiCost.compute(answerOf(rows), NOW, 7);
		expect(result.totalTokensByAgent).toEqual({ claude: 4_500, codex: 200 });
		expect(result.totalTokens).toBe(4_700);
	});

	it("counts the older days again in a longer time range", () => {
		const result = AiCost.compute(answerOf(rows), NOW, 30);
		expect(result.totalTokensByAgent.claude).toBe(94_500);
		expect(result.totalTokens).toBe(94_700);
	});
});

describe("AiCost.compute, the tokens that have no known price", () => {
	it("counts the tokens of a day with no known price, counts no cost for them, and adds them to the unpriced tokens", () => {
		const result = AiCost.compute(answerOf([row(14, "claude", null, 700), row(13, "claude", null, 300), row(14, "codex", 2, 50)]), NOW, 7);
		expect(result.totalTokensByAgent).toEqual({ claude: 1_000, codex: 50 });
		expect(result.slots.map((slot) => slot.tokensByAgent.claude).slice(5)).toEqual([300, 700]);
		expect(result.totalCost).toBe(2);
		expect(result.unpricedTokens).toBe(1_000);
	});

	it("counts the unpriced tokens of a day that has a known cost for a part of its tokens", () => {
		const result = AiCost.compute(answerOf([{ ...row(14, "claude", 5, 1_000), unpricedTokens: 400 }]), NOW, 7);
		expect(result.totalCost).toBe(5);
		expect(result.totalTokens).toBe(1_000);
		expect(result.unpricedTokens).toBe(400);
	});

	it("does not count the unpriced tokens of a day outside the time range", () => {
		const result = AiCost.compute(answerOf([row(1, "claude", null, 700)]), NOW, 7);
		expect(result.unpricedTokens).toBe(0);
	});
});

describe("AiCost.mergeSynchronizationErrors", () => {
	it("adds the error of the synchronization to the workspace of the same folder, and keeps the other workspaces as they are", () => {
		const answer = { ...answerOf([]), workspaces: [workspace("/work/a", null), workspace("/work/b", "2026-10-14T09:00:00.000Z")] };
		const merged = AiCost.mergeSynchronizationErrors(answer, {
			workspaces: [workspace("/work/a", null, "no remote origin"), workspace("/work/b", "2026-10-14T09:00:00.000Z")],
			priceWarning: null,
		});
		expect(merged.workspaces.map((item) => item.error)).toEqual(["no remote origin", null]);
		expect(AiCost.findNotImported(merged.workspaces)).toEqual([]);
	});

	it("keeps the error that the read gave, and changes nothing else of the answer", () => {
		const answer = { ...answerOf([row(14, "claude", 1, 10)]), workspaces: [workspace("/work/a", null, "read error")] };
		const merged = AiCost.mergeSynchronizationErrors(answer, {
			workspaces: [workspace("/work/a", null, "synchronization error")],
			priceWarning: null,
		});
		expect(merged.workspaces[0].error).toBe("read error");
		expect(merged.hours).toEqual(answer.hours);
		expect(merged.priceVersion).toBe(1);
	});
});

describe("AiCost.findNotImported", () => {
	it("gives the workspaces that have no date of synchronization and no error", () => {
		const workspaces = [
			workspace("/a", "2026-10-14T09:00:00.000Z"),
			workspace("/b", null),
			workspace("/c", null, "The folder has no remote origin."),
		];
		expect(AiCost.findNotImported(workspaces).map((one) => one.folder)).toEqual(["/b"]);
	});
});

describe("AiCost.findOldestSynchronizedAt", () => {
	it("gives the oldest date of synchronization of the workspaces that were imported", () => {
		const workspaces = [
			workspace("/a", "2026-10-14T09:00:00.000Z"),
			workspace("/b", null),
			workspace("/c", "2026-10-13T08:00:00.000Z"),
		];
		expect(AiCost.findOldestSynchronizedAt(workspaces)).toBe("2026-10-13T08:00:00.000Z");
	});

	it("gives nothing when no workspace was imported", () => {
		expect(AiCost.findOldestSynchronizedAt([workspace("/a", null)])).toBeNull();
		expect(AiCost.findOldestSynchronizedAt([])).toBeNull();
	});
});

describe("AiCost.timeZone", () => {
	it("gives the name of the time zone of the computer, which the data layer reads", () => {
		expect(AiCost.timeZone()).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
		expect(AiCost.timeZone()).not.toBe("");
	});
});
