// @vitest-environment node
import { describe, expect, it } from "vitest";
import { AveragePerDay } from "./average_per_day";

describe("AveragePerDay.of", () => {
	it("divides the total by the number of days", () => {
		expect(AveragePerDay.of(498, 7)).toBeCloseTo(71.142857, 5);
		expect(AveragePerDay.of(30, 30)).toBe(1);
	});

	it("counts a day with no work, so a total of zero gives zero", () => {
		expect(AveragePerDay.of(0, 7)).toBe(0);
	});

	it("gives zero when the time range has no day", () => {
		expect(AveragePerDay.of(12, 0)).toBe(0);
	});
});

describe("AveragePerDay.countText", () => {
	it("writes at most one decimal digit", () => {
		expect(AveragePerDay.countText(71.142857, "en")).toBe("71.1");
		expect(AveragePerDay.countText(2.5714, "en")).toBe("2.6");
		expect(AveragePerDay.countText(3, "en")).toBe("3");
	});

	it("writes two decimal digits for an average of more than 0 and less than 1, so that one item in 30 days is not zero", () => {
		expect(AveragePerDay.countText(1 / 30, "en")).toBe("0.03");
		expect(AveragePerDay.countText(3 / 7, "en")).toBe("0.43");
	});

	it("writes zero as zero", () => {
		expect(AveragePerDay.countText(0, "en")).toBe("0");
	});

	it("writes the number as the language writes it", () => {
		expect(AveragePerDay.countText(71.142857, "fr")).toBe("71,1");
		expect(AveragePerDay.countText(1763.57, "en")).toBe("1,763.6");
	});
});
