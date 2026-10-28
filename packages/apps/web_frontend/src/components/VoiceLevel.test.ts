import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import VoiceLevel from "./VoiceLevel.vue";
import { LEVEL_COUNT } from "../stores/voice_input";

/** The heights of the bars of a mounted row, in pixels, from the left to the right. */
function heightsOf(wrapper: ReturnType<typeof mount>): number[] {
	return wrapper.findAll(".bar").map((bar) => Number.parseInt((bar.element as HTMLElement).style.height, 10));
}

describe("VoiceLevel", () => {
	it("always shows the same number of bars, and keeps the missing ones as dots on the left", () => {
		const wrapper = mount(VoiceLevel, { props: { levels: [1, 0.5] } });
		const heights = heightsOf(wrapper);
		expect(heights.length).toBe(LEVEL_COUNT);
		expect(heights.slice(0, LEVEL_COUNT - 2).every((height) => height === 4)).toBe(true);
		expect(heights[LEVEL_COUNT - 2]).toBe(36);
		expect(heights[LEVEL_COUNT - 1]).toBeGreaterThan(4);
		expect(heights[LEVEL_COUNT - 1]).toBeLessThan(36);
		wrapper.unmount();
	});

	it("shows only dots for silence", () => {
		const wrapper = mount(VoiceLevel, { props: { levels: new Array<number>(LEVEL_COUNT).fill(0) } });
		expect(heightsOf(wrapper).every((height) => height === 4)).toBe(true);
		wrapper.unmount();
	});

	it("keeps the newest levels when there are more levels than bars", () => {
		const levels = [...new Array<number>(10).fill(0), ...new Array<number>(LEVEL_COUNT).fill(1)];
		const wrapper = mount(VoiceLevel, { props: { levels } });
		expect(heightsOf(wrapper).every((height) => height === 36)).toBe(true);
		wrapper.unmount();
	});

	it("keeps a level that is out of range inside the smallest and the largest height", () => {
		const wrapper = mount(VoiceLevel, { props: { levels: [-3, 7] } });
		const heights = heightsOf(wrapper);
		expect(heights[LEVEL_COUNT - 2]).toBe(4);
		expect(heights[LEVEL_COUNT - 1]).toBe(36);
		wrapper.unmount();
	});

	it("shows flat dots, whatever the levels, and marks the row while Whisper transcribes", () => {
		const levels = new Array<number>(LEVEL_COUNT).fill(1);
		const wrapper = mount(VoiceLevel, { props: { levels, isTranscribing: true } });
		expect(wrapper.classes()).toContain("is-transcribing");
		expect(heightsOf(wrapper).length).toBe(LEVEL_COUNT);
		expect(heightsOf(wrapper).every((height) => height === 4)).toBe(true);
		wrapper.unmount();
	});

	it("shows flat dots, and marks the row as waiting, while the recording waits for Whisper (issue 868)", () => {
		const levels = new Array<number>(LEVEL_COUNT).fill(1);
		const wrapper = mount(VoiceLevel, { props: { levels, isWaiting: true } });
		expect(wrapper.classes()).toContain("is-waiting");
		expect(wrapper.classes()).not.toContain("is-transcribing");
		expect(heightsOf(wrapper).every((height) => height === 4)).toBe(true);
		wrapper.unmount();
	});

	it("marks the row as transcribing only, when both marks are given", () => {
		const wrapper = mount(VoiceLevel, { props: { levels: [], isWaiting: true, isTranscribing: true } });
		expect(wrapper.classes()).toContain("is-transcribing");
		expect(wrapper.classes()).not.toContain("is-waiting");
		wrapper.unmount();
	});

	it("shows the levels and no mark while the microphone is open", () => {
		const levels = new Array<number>(LEVEL_COUNT).fill(1);
		const wrapper = mount(VoiceLevel, { props: { levels } });
		expect(wrapper.classes()).not.toContain("is-transcribing");
		expect(wrapper.classes()).not.toContain("is-waiting");
		expect(heightsOf(wrapper).every((height) => height === 36)).toBe(true);
		wrapper.unmount();
	});

	it("gives each bar its position, so that the green sine wave reaches the bars one after the other", () => {
		const wrapper = mount(VoiceLevel, { props: { levels: [], isTranscribing: true } });
		const positions = wrapper
			.findAll(".bar")
			.map((bar) => Number.parseInt((bar.element as HTMLElement).style.getPropertyValue("--bar-index"), 10));
		expect(positions).toEqual(Array.from({ length: LEVEL_COUNT }, (_, index) => index));
		wrapper.unmount();
	});

	it("has a name for the screen reader", () => {
		const wrapper = mount(VoiceLevel, { props: { levels: [] } });
		expect(wrapper.attributes("role")).toBe("img");
		expect(wrapper.attributes("aria-label")).toBe("Level of the voice");
		wrapper.unmount();
	});
});
