// @vitest-environment node
import { describe, expect, it } from "vitest";
import { USER_ACTIVITY_SLOT_LENGTHS, type UserActivitySlotLengthId } from "./user_activity_slots";
import { UserActivityVerticalAxis } from "./user_activity_vertical_axis";

/** One minute, and one hour, in milliseconds. */
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

describe("UserActivityVerticalAxis", () => {
  it("counts a slot of 15 minutes to 1 hour in minutes, and a slot of 6 hours or of 1 day in hours", () => {
    expect(UserActivityVerticalAxis.of("fifteen_minutes", 0).unit).toBe("minutes");
    expect(UserActivityVerticalAxis.of("thirty_minutes", 0).unit).toBe("minutes");
    expect(UserActivityVerticalAxis.of("one_hour", 0).unit).toBe("minutes");
    expect(UserActivityVerticalAxis.of("six_hours", 0).unit).toBe("hours");
    expect(UserActivityVerticalAxis.of("one_day", 0).unit).toBe("hours");
    expect(UserActivityVerticalAxis.of("one_hour", 0).unitMs).toBe(MINUTE_MS);
    expect(UserActivityVerticalAxis.of("one_day", 0).unitMs).toBe(HOUR_MS);
  });

  it("gives the lowest top when there is no activity", () => {
    expect(UserActivityVerticalAxis.of("one_hour", 0)).toMatchObject({ top: 5, step: 1 });
    expect(UserActivityVerticalAxis.of("one_day", 0)).toMatchObject({ top: 1, step: 0.5 });
  });

  it("gives the lowest top that holds the highest bar with some space above it", () => {
    expect(UserActivityVerticalAxis.of("one_hour", 4 * MINUTE_MS).top).toBe(5);
    expect(UserActivityVerticalAxis.of("one_hour", 5 * MINUTE_MS).top).toBe(10);
    expect(UserActivityVerticalAxis.of("one_hour", 9 * MINUTE_MS).top).toBe(10);
    expect(UserActivityVerticalAxis.of("one_hour", 10 * MINUTE_MS).top).toBe(15);
    expect(UserActivityVerticalAxis.of("one_hour", 15 * MINUTE_MS).top).toBe(30);
    expect(UserActivityVerticalAxis.of("one_hour", 27 * MINUTE_MS).top).toBe(30);
    expect(UserActivityVerticalAxis.of("one_hour", 28 * MINUTE_MS).top).toBe(60);
    expect(UserActivityVerticalAxis.of("one_day", 20 * MINUTE_MS).top).toBe(1);
    expect(UserActivityVerticalAxis.of("one_day", 2 * HOUR_MS).top).toBe(3);
    expect(UserActivityVerticalAxis.of("one_day", 5 * HOUR_MS).top).toBe(6);
    expect(UserActivityVerticalAxis.of("one_day", 6 * HOUR_MS).top).toBe(12);
    expect(UserActivityVerticalAxis.of("one_day", 12 * HOUR_MS).top).toBe(24);
  });

  it("never goes over the length of the slot, even when the highest bar fills the slot", () => {
    expect(UserActivityVerticalAxis.of("fifteen_minutes", 15 * MINUTE_MS).top).toBe(15);
    expect(UserActivityVerticalAxis.of("thirty_minutes", 30 * MINUTE_MS).top).toBe(30);
    expect(UserActivityVerticalAxis.of("one_hour", HOUR_MS).top).toBe(60);
    expect(UserActivityVerticalAxis.of("six_hours", 6 * HOUR_MS).top).toBe(6);
    expect(UserActivityVerticalAxis.of("one_day", 24 * HOUR_MS).top).toBe(24);
  });

  it("gives, for the longest slot of each length, a top that is the length of the slot", () => {
    const expected: Record<UserActivitySlotLengthId, number> = {
      fifteen_minutes: 15,
      thirty_minutes: 30,
      one_hour: 60,
      six_hours: 6,
      one_day: 24,
    };
    for (const id of Object.keys(USER_ACTIVITY_SLOT_LENGTHS) as UserActivitySlotLengthId[]) {
      expect(UserActivityVerticalAxis.of(id, 365 * 24 * HOUR_MS).top).toBe(expected[id]);
    }
  });

  it("gives the same axis for the same slot length and the same highest bar each time", () => {
    const first = UserActivityVerticalAxis.of("one_hour", 12 * MINUTE_MS);
    UserActivityVerticalAxis.of("one_day", 2 * HOUR_MS);
    expect(UserActivityVerticalAxis.of("one_hour", 12 * MINUTE_MS)).toEqual(first);
  });

  it("treats a negative time as no activity", () => {
    expect(UserActivityVerticalAxis.of("one_hour", -5 * MINUTE_MS).top).toBe(5);
  });

  it("gives a step that makes at most ten lines", () => {
    for (const id of Object.keys(USER_ACTIVITY_SLOT_LENGTHS) as UserActivitySlotLengthId[]) {
      for (const tallestMinutes of [0, 3, 8, 14, 25, 50, 500, 1440]) {
        const { top, step } = UserActivityVerticalAxis.of(id, tallestMinutes * MINUTE_MS);
        expect(top / step).toBeLessThanOrEqual(10);
        expect(top / step).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
