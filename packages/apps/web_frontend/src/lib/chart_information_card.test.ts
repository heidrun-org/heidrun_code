// @vitest-environment node
import { describe, expect, it } from "vitest";
import { CHART_BAR_GAP, CHART_LEGEND, CHART_MARGIN, ChartInformationCard } from "./chart_information_card";

describe("ChartInformationCard.anchor", () => {
	/** A chart of 504 pixels with 12 bars: the plotting area is 400 pixels wide, so each bar slot is 400 / 12 pixels wide. */
	const chartWidth = 504;
	const barCount = 12;
	const slotWidth = 400 / 12;
	const halfBar = (slotWidth * (1 - CHART_BAR_GAP)) / 2;

	it("puts the card at the right of a bar in the left half of the chart, touching the right edge of the bar", () => {
		const { side, edge } = ChartInformationCard.anchor(1, barCount, 50, chartWidth, 300);
		expect(side).toBe("end");
		expect(edge).toBeCloseTo(CHART_MARGIN.l + 1.5 * slotWidth + halfBar, 5);
	});

	it("puts the card at the left of a bar in the right half of the chart, touching the left edge of the bar", () => {
		const { side, edge } = ChartInformationCard.anchor(10, barCount, 50, chartWidth, 300);
		expect(side).toBe("start");
		expect(edge).toBeCloseTo(CHART_MARGIN.l + 10.5 * slotWidth - halfBar, 5);
	});

	it("keeps the edge between the two sides of the plotting area for the first and the last bar", () => {
		const first = ChartInformationCard.anchor(0, barCount, 50, chartWidth, 300);
		const last = ChartInformationCard.anchor(barCount - 1, barCount, 50, chartWidth, 300);
		expect(first.edge).toBeGreaterThan(CHART_MARGIN.l);
		expect(last.edge).toBeLessThan(chartWidth - CHART_MARGIN.r);
	});

	it("gives a bar in the middle of the chart to one side or the other, never to both", () => {
		const sides = [5, 6].map((index) => ChartInformationCard.anchor(index, barCount, 50, chartWidth, 300).side);
		expect(sides).toEqual(["end", "start"]);
	});

	it("keeps the height of the pointer and the size of the chart for the card", () => {
		const anchor = ChartInformationCard.anchor(3, barCount, 123, chartWidth, 300);
		expect([anchor.pointerY, anchor.chartWidth, anchor.chartHeight]).toEqual([123, chartWidth, 300]);
	});

	it("works for a chart with only one bar", () => {
		const { edge } = ChartInformationCard.anchor(0, 1, 50, chartWidth, 300);
		expect(edge).toBeGreaterThan(CHART_MARGIN.l);
		expect(edge).toBeLessThan(chartWidth - CHART_MARGIN.r);
	});
});

describe("ChartInformationCard.top", () => {
	it("puts the middle of the card at the height of the pointer", () => {
		expect(ChartInformationCard.top(150, 100, 400)).toBe(100);
	});

	it("keeps the card inside the chart when the pointer is near the top or near the bottom", () => {
		expect(ChartInformationCard.top(10, 100, 400)).toBe(0);
		expect(ChartInformationCard.top(390, 100, 400)).toBe(300);
	});

	it("puts the card at the top when it is taller than the chart", () => {
		expect(ChartInformationCard.top(100, 500, 400)).toBe(0);
	});
});

describe("ChartInformationCard.arrowTop", () => {
	it("puts the middle of the arrow at the height of the pointer", () => {
		expect(ChartInformationCard.arrowTop(150, 100, 100)).toBe(38);
	});

	it("keeps the arrow away from the corners of the card", () => {
		expect(ChartInformationCard.arrowTop(0, 0, 100)).toBe(8);
		expect(ChartInformationCard.arrowTop(100, 0, 100)).toBe(68);
	});

	it("gives a top when the card is too short for the arrow", () => {
		expect(ChartInformationCard.arrowTop(5, 0, 10)).toBe(8);
	});
});

describe("CHART_LEGEND", () => {
	it("is one line above the bars, and a click on it does nothing", () => {
		expect(CHART_LEGEND.orientation).toBe("h");
		expect(CHART_LEGEND.itemclick).toBe(false);
		expect(CHART_LEGEND.itemdoubleclick).toBe(false);
	});
});
