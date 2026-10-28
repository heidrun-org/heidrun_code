// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CalendarSlots } from "./calendar_slots";

/** The time zone that the tests of the clock changes use. The time zone of the computer is put back after the tests. */
const PARIS = "Europe/Paris";

/** The number of milliseconds in one hour. */
const HOUR = 3_600_000;

describe("CalendarSlots.build", () => {
	const now = new Date(2026, 9, 14, 15, 0, 0).getTime();

	it("gives one slot for each day with a slot of 24 hours, the last slot ending at the end of today", () => {
		const slots = CalendarSlots.build(now, 7, 24);
		expect(slots).toHaveLength(7);
		expect(slots[0].startedAt).toBe(new Date(2026, 9, 8).getTime());
		expect(slots[6].startedAt).toBe(new Date(2026, 9, 14).getTime());
		expect(slots[6].endedAt).toBe(new Date(2026, 9, 15).getTime());
	});

	it("gives four slots for each day with a slot of 6 hours and 24 slots for each day with a slot of 1 hour", () => {
		expect(CalendarSlots.build(now, 7, 6)).toHaveLength(28);
		expect(CalendarSlots.build(now, 30, 6)).toHaveLength(120);
		expect(CalendarSlots.build(now, 7, 1)).toHaveLength(168);
	});

	it("starts the first slot of each day at midnight, with slots that follow each other with no hole", () => {
		const slots = CalendarSlots.build(now, 3, 6);
		expect(slots[0].startedAt).toBe(new Date(2026, 9, 12).getTime());
		expect(slots[4].startedAt).toBe(new Date(2026, 9, 13).getTime());
		for (let index = 1; index < slots.length; index += 1) {
			expect(slots[index].startedAt).toBe(slots[index - 1].endedAt);
		}
		expect(slots[11].endedAt).toBe(new Date(2026, 9, 15).getTime());
	});
});

describe("CalendarSlots.build, the days that the clock changes", () => {
	let timeZoneBefore: string | undefined;

	beforeAll(() => {
		timeZoneBefore = process.env.TZ;
		process.env.TZ = PARIS;
	});

	afterAll(() => {
		if (timeZoneBefore === undefined) {
			delete process.env.TZ;
		} else {
			process.env.TZ = timeZoneBefore;
		}
	});

	it("uses the time zone of the test", () => {
		expect(new Date(2026, 9, 25, 12).toISOString()).toBe("2026-10-25T11:00:00.000Z");
	});

	it("gives a day of 25 hours 25 slots of 1 hour, and an extra last slot of 1 hour with slots of 6 hours", () => {
		const now = new Date(2026, 9, 25, 12).getTime();
		expect(CalendarSlots.build(now, 1, 1)).toHaveLength(25);
		const slots = CalendarSlots.build(now, 1, 6);
		expect(slots.map((slot) => (slot.endedAt - slot.startedAt) / HOUR)).toEqual([6, 6, 6, 6, 1]);
		expect(slots[4].startedAt).toBe(Date.parse("2026-10-25T22:00:00.000Z"));
		expect(slots[4].endedAt).toBe(Date.parse("2026-10-25T23:00:00.000Z"));
	});

	it("gives a day of 23 hours 23 slots of 1 hour, and a last slot of 5 hours with slots of 6 hours", () => {
		const now = new Date(2026, 2, 29, 12).getTime();
		expect(CalendarSlots.build(now, 1, 1)).toHaveLength(23);
		const slots = CalendarSlots.build(now, 1, 6);
		expect(slots.map((slot) => (slot.endedAt - slot.startedAt) / HOUR)).toEqual([6, 6, 6, 5]);
	});

	it("gives one slot of 25 hours for the day of 25 hours with a slot of 24 hours", () => {
		const now = new Date(2026, 9, 25, 12).getTime();
		const slots = CalendarSlots.build(now, 1, 24);
		expect(slots).toHaveLength(1);
		expect((slots[0].endedAt - slots[0].startedAt) / HOUR).toBe(25);
	});

	it("puts the two hours that repeat on the night of the change in two different slots of 1 hour", () => {
		const now = new Date(2026, 9, 25, 12).getTime();
		const slots = CalendarSlots.build(now, 1, 1);
		const first = CalendarSlots.findIndex(slots, "2026-10-25T00:30:00.000Z");
		const second = CalendarSlots.findIndex(slots, "2026-10-25T01:30:00.000Z");
		expect([first, second]).toEqual([2, 3]);
	});
});

describe("CalendarSlots.findIndex", () => {
	const now = new Date(2026, 9, 14, 15, 0, 0).getTime();
	const slots = CalendarSlots.build(now, 2, 6);

	it("finds the slot that holds a time, the start being inside the slot and the end being outside", () => {
		expect(CalendarSlots.findIndex(slots, new Date(2026, 9, 13, 5, 59).toISOString())).toBe(0);
		expect(CalendarSlots.findIndex(slots, new Date(2026, 9, 13, 6, 0).toISOString())).toBe(1);
		expect(CalendarSlots.findIndex(slots, new Date(2026, 9, 14, 23, 59).toISOString())).toBe(7);
	});

	it("gives -1 for a time before the first slot, after the last slot, or that is not a time", () => {
		expect(CalendarSlots.findIndex(slots, new Date(2026, 9, 12, 23, 59).toISOString())).toBe(-1);
		expect(CalendarSlots.findIndex(slots, new Date(2026, 9, 15, 0, 0).toISOString())).toBe(-1);
		expect(CalendarSlots.findIndex(slots, "yesterday")).toBe(-1);
	});
});
