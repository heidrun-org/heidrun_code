// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CalendarDays } from "./calendar_days";

/** Wednesday 14 October 2026, 15:00 in the time zone of the computer. */
const NOW = new Date(2026, 9, 14, 15, 0, 0).getTime();

describe("CalendarDays", () => {
	it("starts the first day at midnight, and ends the time range at the next midnight", () => {
		expect(CalendarDays.firstDayStartedAt(NOW, 7)).toBe(new Date(2026, 9, 8).getTime());
		expect(CalendarDays.firstDayStartedAt(NOW, 30)).toBe(new Date(2026, 8, 15).getTime());
		expect(CalendarDays.endOfTodayAt(NOW)).toBe(new Date(2026, 9, 15).getTime());
	});

	it("gives one day for each day of the time range, the last day being today", () => {
		const days = CalendarDays.build(NOW, 7);
		expect(days).toHaveLength(7);
		expect(days[0].startedAt).toBe(new Date(2026, 9, 8).getTime());
		expect(days[6].startedAt).toBe(new Date(2026, 9, 14).getTime());
		expect(days[6].endedAt).toBe(new Date(2026, 9, 15).getTime());
		for (let index = 1; index < days.length; index += 1) {
			expect(days[index].startedAt).toBe(days[index - 1].endedAt);
		}
	});

	it("keeps one day for each calendar day, each one starting at midnight, when the clock changes in the time range", () => {
		const days = CalendarDays.build(new Date(2026, 10, 3, 15, 0, 0).getTime(), 30);
		expect(days).toHaveLength(30);
		for (const day of days) {
			expect(new Date(day.startedAt).getHours()).toBe(0);
		}
	});

	it("finds the day of a time, the first moment of a day included and the first moment of the next day excluded", () => {
		const days = CalendarDays.build(NOW, 7);
		expect(CalendarDays.findIndex(days, new Date(2026, 9, 7, 23, 59, 59).toISOString())).toBe(-1);
		expect(CalendarDays.findIndex(days, new Date(2026, 9, 8, 0, 0, 0).toISOString())).toBe(0);
		expect(CalendarDays.findIndex(days, new Date(2026, 9, 14, 23, 59, 59).toISOString())).toBe(6);
		expect(CalendarDays.findIndex(days, new Date(2026, 9, 15, 0, 0, 0).toISOString())).toBe(-1);
	});

	it("finds no day for a text that is not a time", () => {
		expect(CalendarDays.findIndex(CalendarDays.build(NOW, 7), "yesterday")).toBe(-1);
	});
});
