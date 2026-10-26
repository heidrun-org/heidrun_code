// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
	USER_ACTIVITY_RANGES,
	USER_ACTIVITY_RANGE_IDS,
	USER_ACTIVITY_SLOT_LENGTHS,
	UserActivitySlots,
	type UserActivityPeriodTimes,
} from "./user_activity_slots";

/** The time of 14 October 2026 plus `dayOffset` days, on the clock of the computer, in milliseconds. */
function local(dayOffset: number, hour: number, minute: number, second = 0): number {
	return new Date(2026, 9, 14 + dayOffset, hour, minute, second).getTime();
}

/** A record of an active period between two times in milliseconds. */
function period(startedAt: number, endedAt: number): UserActivityPeriodTimes {
	return { startedAt: new Date(startedAt).toISOString(), endedAt: new Date(endedAt).toISOString() };
}

/** The user activity times of the slots, in seconds, the oldest first. */
function seconds(activeTimesMs: { activeTimeMs: number }[]): number[] {
	return activeTimesMs.map((slot) => slot.activeTimeMs / 1000);
}

/** The length of one hour, in milliseconds. */
const HOUR_MS = 60 * 60_000;

describe("UserActivitySlots.compute for the last day", () => {
	const now = local(0, 14, 22, 30);

	it("gives twenty-four slots of one hour that start at a full hour, the last one holding the current time", () => {
		const slots = UserActivitySlots.compute([], null, now, "day");
		expect(slots).toHaveLength(24);
		expect(slots[23].startedAt).toBe(local(0, 14, 0));
		expect(slots[23].endedAt).toBe(local(0, 15, 0));
		expect(slots[0].startedAt).toBe(local(-1, 15, 0));
		expect(UserActivitySlots.firstSlotStartedAt(now, "day")).toBe(local(-1, 15, 0));
		for (const slot of slots) {
			expect(slot.endedAt - slot.startedAt).toBe(HOUR_MS);
		}
	});

	it("uses the last day when no time range is given", () => {
		expect(UserActivitySlots.compute([], null, now)).toEqual(UserActivitySlots.compute([], null, now, "day"));
		expect(UserActivitySlots.firstSlotStartedAt(now)).toBe(local(-1, 15, 0));
	});

	it("gives a height of 0 to every slot when there is no record and no running period", () => {
		expect(seconds(UserActivitySlots.compute([], null, now, "day"))).toEqual(new Array(24).fill(0));
	});

	it("puts one active period that is inside one slot in that slot only", () => {
		const slots = UserActivitySlots.compute([period(local(0, 12, 10), local(0, 12, 40))], null, now, "day");
		expect(slots[21].startedAt).toBe(local(0, 12, 0));
		expect(seconds(slots)).toEqual([...new Array(21).fill(0), 1800, 0, 0]);
	});

	it("cuts an active period at the limit between two hours, and each part counts in its own slot", () => {
		const slots = UserActivitySlots.compute([period(local(0, 12, 50), local(0, 13, 20))], null, now, "day");
		expect(slots[21].activeTimeMs).toBe(10 * 60_000);
		expect(slots[22].activeTimeMs).toBe(20 * 60_000);
		expect(seconds(slots).reduce((sum, value) => sum + value, 0)).toBe(30 * 60);
	});

	it("cuts an active period that starts before the first slot, and counts the period that runs now", () => {
		const records = [period(local(-1, 14, 30), local(-1, 15, 10))];
		const slots = UserActivitySlots.compute(records, local(0, 14, 10), now, "day");
		expect(slots[0].activeTimeMs).toBe(10 * 60_000);
		expect(slots[23].activeTimeMs).toBe(12.5 * 60_000);
	});

	it("ignores an active period that ended before the first slot", () => {
		const slots = UserActivitySlots.compute([period(local(-2, 10, 0), local(-2, 11, 0))], null, now, "day");
		expect(seconds(slots)).toEqual(new Array(24).fill(0));
	});

	it("counts the active period that runs now from its start up to the current time", () => {
		const slots = UserActivitySlots.compute([], local(0, 13, 40), now, "day");
		expect(slots[22].activeTimeMs).toBe(20 * 60_000);
		expect(slots[23].activeTimeMs).toBe(22.5 * 60_000);
	});

	it("adds the periods of the same slot together, and never gives more than one hour to a slot", () => {
		const records = [period(local(0, 12, 0), local(0, 12, 50)), period(local(0, 12, 20), local(0, 12, 59)), period(local(0, 12, 0), local(0, 13, 0))];
		const slots = UserActivitySlots.compute(records, null, now, "day");
		expect(slots[21].startedAt).toBe(local(0, 12, 0));
		expect(slots[21].activeTimeMs).toBe(HOUR_MS);
	});

	it("never counts a period after the current time", () => {
		const slots = UserActivitySlots.compute([period(local(0, 14, 10), local(0, 15, 30))], null, now, "day");
		expect(slots[23].activeTimeMs).toBe(12.5 * 60_000);
	});

	it("ignores a record whose time is not a date", () => {
		const slots = UserActivitySlots.compute([{ startedAt: "yesterday", endedAt: new Date(local(0, 14, 10)).toISOString() }], null, now, "day");
		expect(seconds(slots)).toEqual(new Array(24).fill(0));
	});

	it("reads a time that carries an offset of a time zone", () => {
		const withOffset = (time: number): string => new Date(time + 2 * HOUR_MS).toISOString().replace("Z", "+02:00");
		const record = { startedAt: withOffset(local(0, 12, 10)), endedAt: withOffset(local(0, 12, 40)) };
		expect(seconds(UserActivitySlots.compute([record], null, now, "day"))[21]).toBe(1800);
	});
});

describe("UserActivitySlots.compute for the last week", () => {
	const now = local(0, 14, 22, 30);

	it("gives seven slots of one day that start at midnight, the last one holding the current time", () => {
		const slots = UserActivitySlots.compute([], null, now, "week");
		expect(slots).toHaveLength(7);
		expect(slots[6].startedAt).toBe(local(0, 0, 0));
		expect(slots[6].endedAt).toBe(local(1, 0, 0));
		expect(slots[0].startedAt).toBe(local(-6, 0, 0));
		expect(UserActivitySlots.firstSlotStartedAt(now, "week")).toBe(local(-6, 0, 0));
	});

	it("cuts an active period at midnight, and each part counts in its own day", () => {
		const slots = UserActivitySlots.compute([period(local(-1, 23, 50), local(0, 0, 20))], null, now, "week");
		expect(slots[5].activeTimeMs).toBe(10 * 60_000);
		expect(slots[6].activeTimeMs).toBe(20 * 60_000);
	});

	it("cuts an active period that starts before the first day at the start of the first day", () => {
		const slots = UserActivitySlots.compute([period(local(-7, 23, 0), local(-6, 1, 0))], null, now, "week");
		expect(slots[0].activeTimeMs).toBe(60 * 60_000);
		expect(seconds(slots).slice(1)).toEqual(new Array(6).fill(0));
	});

	it("adds the periods of the same day together", () => {
		const records = [period(local(-3, 9, 0), local(-3, 10, 0)), period(local(-3, 14, 0), local(-3, 14, 30))];
		expect(UserActivitySlots.compute(records, null, now, "week")[3].activeTimeMs).toBe(90 * 60_000);
	});
});

describe("UserActivitySlots.compute for the last month", () => {
	const now = local(0, 14, 22, 30);

	it("gives thirty slots of one day that start at midnight, the last one holding the current time", () => {
		const slots = UserActivitySlots.compute([], null, now, "month");
		expect(slots).toHaveLength(30);
		expect(slots[29].startedAt).toBe(local(0, 0, 0));
		expect(slots[29].endedAt).toBe(local(1, 0, 0));
		expect(slots[0].startedAt).toBe(local(-29, 0, 0));
		expect(UserActivitySlots.firstSlotStartedAt(now, "month")).toBe(local(-29, 0, 0));
	});

	it("cuts an active period at midnight, and each part counts in its own day", () => {
		const slots = UserActivitySlots.compute([period(local(-1, 23, 50), local(0, 0, 20))], null, now, "month");
		expect(slots[28].activeTimeMs).toBe(10 * 60_000);
		expect(slots[29].activeTimeMs).toBe(20 * 60_000);
	});

	it("cuts an active period that starts before the first day at the start of the first day", () => {
		const slots = UserActivitySlots.compute([period(local(-30, 23, 0), local(-29, 1, 0))], null, now, "month");
		expect(slots[0].activeTimeMs).toBe(HOUR_MS);
		expect(seconds(slots).slice(1)).toEqual(new Array(29).fill(0));
	});

	it("gives one hundred twenty slots of six hours, starting at midnight, six, twelve, and eighteen hours", () => {
		const slots = UserActivitySlots.compute([period(local(0, 5, 0), local(0, 7, 0))], null, now, "month", "six_hours");
		expect(slots).toHaveLength(120);
		expect(slots[119].startedAt).toBe(local(0, 12, 0));
		expect(slots[118].startedAt).toBe(local(0, 6, 0));
		expect(slots[117].startedAt).toBe(local(0, 0, 0));
		expect(slots[0].startedAt).toBe(local(-30, 18, 0));
		expect(slots[117].activeTimeMs).toBe(HOUR_MS);
		expect(slots[118].activeTimeMs).toBe(HOUR_MS);
	});
});

describe("UserActivitySlots.slotCount", () => {
	it("gives the number of slots of the length of the range divided by the slot length", () => {
		expect(UserActivitySlots.slotCount("day")).toBe(24);
		expect(UserActivitySlots.slotCount("day", "fifteen_minutes")).toBe(96);
		expect(UserActivitySlots.slotCount("day", "thirty_minutes")).toBe(48);
		expect(UserActivitySlots.slotCount("week")).toBe(7);
		expect(UserActivitySlots.slotCount("week", "one_hour")).toBe(168);
		expect(UserActivitySlots.slotCount("week", "six_hours")).toBe(28);
		expect(UserActivitySlots.slotCount("month")).toBe(30);
		expect(UserActivitySlots.slotCount("month", "six_hours")).toBe(120);
	});

	it("gives a whole number of slots for every slot length that a range offers", () => {
		for (const rangeId of USER_ACTIVITY_RANGE_IDS) {
			const { slotLengthIds, defaultSlotLengthId } = USER_ACTIVITY_RANGES[rangeId];
			expect(slotLengthIds).toContain(defaultSlotLengthId);
			for (const slotLengthId of slotLengthIds) {
				const count = UserActivitySlots.slotCount(rangeId, slotLengthId);
				expect(Number.isInteger(count)).toBe(true);
				expect(UserActivitySlots.compute([], null, local(0, 14, 22, 30), rangeId, slotLengthId)).toHaveLength(count);
			}
		}
	});

	it("offers the slot lengths of the issue in each range, and no range of one hour", () => {
		expect(USER_ACTIVITY_RANGES.day.slotLengthIds).toEqual(["fifteen_minutes", "thirty_minutes", "one_hour"]);
		expect(USER_ACTIVITY_RANGES.week.slotLengthIds).toEqual(["one_hour", "six_hours", "one_day"]);
		expect(USER_ACTIVITY_RANGES.month.slotLengthIds).toEqual(["six_hours", "one_day"]);
		expect(USER_ACTIVITY_RANGES.day.defaultSlotLengthId).toBe("one_hour");
		expect(USER_ACTIVITY_RANGES.week.defaultSlotLengthId).toBe("one_day");
		expect(USER_ACTIVITY_RANGES.month.defaultSlotLengthId).toBe("one_day");
		expect(Object.keys(USER_ACTIVITY_SLOT_LENGTHS)).toHaveLength(5);
		expect(USER_ACTIVITY_RANGE_IDS).toEqual(["day", "week", "month"]);
	});
});

describe("UserActivitySlots.compute with a chosen slot length", () => {
	const now = local(0, 14, 22, 30);

	it("gives ninety-six slots of fifteen minutes for the last day, on a multiple of fifteen minutes", () => {
		const slots = UserActivitySlots.compute([period(local(0, 13, 55), local(0, 14, 20))], null, now, "day", "fifteen_minutes");
		expect(slots).toHaveLength(96);
		expect(slots[95].startedAt).toBe(local(0, 14, 15));
		expect(slots[0].startedAt).toBe(local(-1, 14, 30));
		expect(slots[93].activeTimeMs).toBe(5 * 60_000);
		expect(slots[94].activeTimeMs).toBe(15 * 60_000);
		expect(slots[95].activeTimeMs).toBe(5 * 60_000);
	});

	it("gives forty-eight slots of thirty minutes for the last day", () => {
		const slots = UserActivitySlots.compute([], null, now, "day", "thirty_minutes");
		expect(slots).toHaveLength(48);
		expect(slots[47].startedAt).toBe(local(0, 14, 0));
		expect(slots[47].endedAt).toBe(local(0, 14, 30));
		expect(slots[0].startedAt).toBe(local(-1, 14, 30));
	});

	it("gives one hundred sixty-eight slots of one hour for the last week", () => {
		const slots = UserActivitySlots.compute([period(local(-2, 9, 30), local(-2, 10, 15))], null, now, "week", "one_hour");
		expect(slots).toHaveLength(168);
		expect(slots[167].startedAt).toBe(local(0, 14, 0));
		expect(slots[0].startedAt).toBe(local(-7, 15, 0));
		const hours = slots.filter((slot) => slot.activeTimeMs > 0);
		expect(hours.map((slot) => slot.activeTimeMs)).toEqual([30 * 60_000, 15 * 60_000]);
	});

	it("gives twenty-eight slots of six hours for the last week, starting at midnight, six, twelve, and eighteen hours", () => {
		const slots = UserActivitySlots.compute([period(local(0, 5, 0), local(0, 7, 0))], null, now, "week", "six_hours");
		expect(slots).toHaveLength(28);
		expect(slots[27].startedAt).toBe(local(0, 12, 0));
		expect(slots[27].endedAt).toBe(local(0, 18, 0));
		expect(slots[26].startedAt).toBe(local(0, 6, 0));
		expect(slots[25].startedAt).toBe(local(0, 0, 0));
		expect(slots[0].startedAt).toBe(local(-7, 18, 0));
		expect(slots[25].activeTimeMs).toBe(60 * 60_000);
		expect(slots[26].activeTimeMs).toBe(60 * 60_000);
	});

	it("keeps the one-day slots of the last week when the slot length is chosen to be one day", () => {
		const slots = UserActivitySlots.compute([period(local(-3, 9, 0), local(-3, 10, 0))], null, now, "week", "one_day");
		expect(slots).toHaveLength(7);
		expect(slots[3].activeTimeMs).toBe(60 * 60_000);
	});

	it("gives the same total of user activity time for every slot length of a range", () => {
		const records = [period(local(0, 13, 40), local(0, 13, 52)), period(local(0, 14, 3), local(0, 14, 9, 30))];
		for (const rangeId of USER_ACTIVITY_RANGE_IDS) {
			for (const slotLengthId of USER_ACTIVITY_RANGES[rangeId].slotLengthIds) {
				const slots = UserActivitySlots.compute(records, null, now, rangeId, slotLengthId);
				expect(seconds(slots).reduce((sum, value) => sum + value, 0)).toBe(12 * 60 + 6 * 60 + 30);
			}
		}
	});

	it("gives the same total of user activity time for the slot lengths of the last month", () => {
		const records = [period(local(-10, 9, 0), local(-10, 11, 30)), period(local(-1, 23, 0), local(0, 1, 0))];
		for (const slotLengthId of USER_ACTIVITY_RANGES.month.slotLengthIds) {
			const slots = UserActivitySlots.compute(records, null, now, "month", slotLengthId);
			expect(seconds(slots).reduce((sum, value) => sum + value, 0)).toBe(4.5 * 3600);
		}
	});
});

describe("UserActivitySlots.earliestSlotStartedAt", () => {
	it("gives the start of the oldest slot of any range and any slot length", () => {
		const now = local(0, 14, 22, 30);
		expect(UserActivitySlots.earliestSlotStartedAt(now)).toBe(local(-30, 18, 0));
		for (const rangeId of USER_ACTIVITY_RANGE_IDS) {
			for (const slotLengthId of USER_ACTIVITY_RANGES[rangeId].slotLengthIds) {
				expect(UserActivitySlots.earliestSlotStartedAt(now)).toBeLessThanOrEqual(
					UserActivitySlots.firstSlotStartedAt(now, rangeId, slotLengthId),
				);
			}
		}
	});
});

describe("UserActivitySlots.labelStepInMinutes", () => {
	it("gives no more than thirteen labels, each on a whole number of slots, for every range and every slot length", () => {
		for (const rangeId of USER_ACTIVITY_RANGE_IDS) {
			const { lengthInMinutes, slotLengthIds } = USER_ACTIVITY_RANGES[rangeId];
			for (const slotLengthId of slotLengthIds) {
				const step = UserActivitySlots.labelStepInMinutes(rangeId, slotLengthId);
				const slotInMinutes = lengthInMinutes / UserActivitySlots.slotCount(rangeId, slotLengthId);
				expect(step % slotInMinutes).toBe(0);
				expect(lengthInMinutes / step).toBeLessThanOrEqual(13);
			}
		}
	});

	it("gives the steps that the histogram shows for the slot lengths of the issue", () => {
		expect(UserActivitySlots.labelStepInMinutes("day", "fifteen_minutes")).toBe(120);
		expect(UserActivitySlots.labelStepInMinutes("day")).toBe(120);
		expect(UserActivitySlots.labelStepInMinutes("week", "one_hour")).toBe(1440);
		expect(UserActivitySlots.labelStepInMinutes("week", "six_hours")).toBe(1440);
		expect(UserActivitySlots.labelStepInMinutes("week")).toBe(1440);
		expect(UserActivitySlots.labelStepInMinutes("month", "six_hours")).toBe(4320);
		expect(UserActivitySlots.labelStepInMinutes("month", "one_day")).toBe(4320);
		expect(UserActivitySlots.labelStepInMinutes("month")).toBe(4320);
	});
});

describe("UserActivitySlots.hasLabel", () => {
	const lastSlotStartedAt = local(0, 12, 0);

	it("gives a label to a slot that starts at a multiple of a step of one day or less, since midnight", () => {
		expect(UserActivitySlots.hasLabel(local(-3, 14, 0), lastSlotStartedAt, 120)).toBe(true);
		expect(UserActivitySlots.hasLabel(local(0, 13, 0), lastSlotStartedAt, 120)).toBe(false);
		expect(UserActivitySlots.hasLabel(local(-2, 0, 0), lastSlotStartedAt, 1440)).toBe(true);
		expect(UserActivitySlots.hasLabel(local(-2, 6, 0), lastSlotStartedAt, 1440)).toBe(false);
	});

	it("gives a label to every third midnight, counted back from the midnight of the last slot, for a step of three days", () => {
		expect(UserActivitySlots.hasLabel(local(0, 0, 0), lastSlotStartedAt, 4320)).toBe(true);
		expect(UserActivitySlots.hasLabel(local(-1, 0, 0), lastSlotStartedAt, 4320)).toBe(false);
		expect(UserActivitySlots.hasLabel(local(-2, 0, 0), lastSlotStartedAt, 4320)).toBe(false);
		expect(UserActivitySlots.hasLabel(local(-3, 0, 0), lastSlotStartedAt, 4320)).toBe(true);
		expect(UserActivitySlots.hasLabel(local(-27, 0, 0), lastSlotStartedAt, 4320)).toBe(true);
		expect(UserActivitySlots.hasLabel(local(-29, 0, 0), lastSlotStartedAt, 4320)).toBe(false);
	});

	it("gives no label to a slot that does not start at midnight, for a step of three days", () => {
		expect(UserActivitySlots.hasLabel(local(0, 12, 0), lastSlotStartedAt, 4320)).toBe(false);
		expect(UserActivitySlots.hasLabel(local(-3, 6, 0), lastSlotStartedAt, 4320)).toBe(false);
	});

	it("gives ten labels to the thirty days of the last month, for slots of one day and for slots of six hours", () => {
		const now = local(0, 14, 22, 30);
		for (const slotLengthId of USER_ACTIVITY_RANGES.month.slotLengthIds) {
			const slots = UserActivitySlots.compute([], null, now, "month", slotLengthId);
			const step = UserActivitySlots.labelStepInMinutes("month", slotLengthId);
			const lastStartedAt = slots[slots.length - 1].startedAt;
			const labelled = slots.filter((slot) => UserActivitySlots.hasLabel(slot.startedAt, lastStartedAt, step));
			expect(labelled).toHaveLength(10);
		}
	});
});
