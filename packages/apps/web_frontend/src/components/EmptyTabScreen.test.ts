// @vitest-environment jsdom
import Fs from "node:fs";
import Path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import EmptyTabScreen from "./EmptyTabScreen.vue";

const originalResizeObserver = globalThis.ResizeObserver;
const playNextGoatBleat = vi.fn();

vi.mock("../lib/goat_sounds", () => ({ playNextGoatBleat: () => playNextGoatBleat() }));

beforeEach(() => {
  playNextGoatBleat.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  globalThis.ResizeObserver = originalResizeObserver;
  const svgElementPrototype = SVGElement.prototype as unknown as Record<string, unknown>;
  delete svgElementPrototype.getStartPositionOfChar;
  delete svgElementPrototype.getRotationOfChar;
});

/** Makes the browser of the tests tell where the emoji of the second line is, as a real browser does. */
function stubPlaceOfCharacter() {
  const svgElementPrototype = SVGElement.prototype as unknown as Record<string, unknown>;
  svgElementPrototype.getStartPositionOfChar = () => ({ x: 640, y: 512 });
  svgElementPrototype.getRotationOfChar = () => 14;
}

/** Tells the emoji that its shake, and the flight of each of its sparks, are finished. */
function finishLaughAnimations(wrapper: ReturnType<typeof mountEmptyTabScreen>["wrapper"]) {
  const animatedElements = [wrapper.get(".empty-tab-emoji"), ...wrapper.findAll(".empty-tab-spark")];
  for (const animatedElement of animatedElements) {
    animatedElement.element.dispatchEvent(new Event("animationend", { bubbles: true }));
  }
}

/**
 * Mounts the screen with a fake `ResizeObserver`, and gives back a function that gives the screen a width and a
 * height, then tells the screen about it, as a browser does after the layout.
 */
function mountEmptyTabScreen() {
  const observer = { callback: null as (() => void) | null, disconnectCount: 0 };
  globalThis.ResizeObserver = class {
    constructor(callback: () => void) {
      observer.callback = callback;
    }
    observe() {}
    unobserve() {}
    disconnect() {
      observer.disconnectCount += 1;
    }
  } as unknown as typeof ResizeObserver;
  const wrapper = mount(EmptyTabScreen);
  async function resizeScreen(width: number, height: number) {
    Object.defineProperty(wrapper.element, "clientWidth", { value: width, configurable: true });
    Object.defineProperty(wrapper.element, "clientHeight", { value: height, configurable: true });
    observer.callback?.();
    await flushPromises();
  }
  return { wrapper, observer, resizeScreen };
}

/**
 * Reads the numbers of one line of the joke: the start point, the radii, the three flags of the arc, and the end point.
 * The line is the first line or the second line.
 */
function readJokePathNumbers(
  wrapper: ReturnType<typeof mountEmptyTabScreen>["wrapper"],
  line: "first" | "second" = "second",
): number[] {
  const pathText = wrapper.get(`#empty-tab-${line}-line-path`).attributes("d") ?? "";
  return (pathText.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

/** Reads the size of the letters of the title, in pixels, from the style of the screen. */
function readTitleSize(wrapper: ReturnType<typeof mountEmptyTabScreen>["wrapper"]): number {
  return Number((wrapper.attributes("style") ?? "").match(/--title-size:\s*(\d+)px/)?.[1]);
}

describe("EmptyTabScreen", () => {
  it("shows the baby goat image, the name Heidrun Code, and the joke", () => {
    const { wrapper } = mountEmptyTabScreen();
    expect(wrapper.find("img.empty-tab-image").exists()).toBe(true);
    expect(wrapper.get(".empty-tab-title").text()).toBe("Heidrun Code");
    expect(wrapper.get(".empty-tab-first-line").text()).toBe("How can I help you? In Valhalla my mead never runs out.");
    expect(wrapper.get(".empty-tab-second-line textPath").text()).toBe("Not like your tokens 🙂");
  });

  it("keeps the emoji inside the second line, and does not shake it, when the browser cannot tell its place", async () => {
    const { wrapper, resizeScreen } = mountEmptyTabScreen();
    await resizeScreen(1000, 600);
    await flushPromises();
    expect(wrapper.find(".empty-tab-emoji").exists()).toBe(false);
    expect(wrapper.find(".empty-tab-emoji-slot").exists()).toBe(false);
    expect(wrapper.get(".empty-tab-second-line textPath").text()).toContain("🙂");
    wrapper.unmount();
  });

  it("draws the emoji alone at the place of its character on the arc, and hides the emoji inside the arc", async () => {
    const svgElementPrototype = SVGElement.prototype as unknown as Record<string, unknown>;
    svgElementPrototype.getStartPositionOfChar = () => ({ x: 640, y: 512 });
    svgElementPrototype.getRotationOfChar = () => 14;
    try {
      const { wrapper, resizeScreen } = mountEmptyTabScreen();
      await resizeScreen(1000, 600);
      await flushPromises();
      expect(wrapper.get(".empty-tab-emoji").text()).toBe("🙂");
      const sparkEmojis = wrapper.findAll(".empty-tab-spark").map((spark) => spark.text());
      expect(sparkEmojis.length).toBeGreaterThanOrEqual(8);
      expect(new Set(sparkEmojis).size).toBe(sparkEmojis.length);
      for (const sparkEmoji of sparkEmojis) {
        expect(sparkEmoji).toMatch(/^\p{Extended_Pictographic}$/u);
      }
      expect(wrapper.get(".empty-tab-emoji").element.parentElement?.getAttribute("transform")).toBe(
        "translate(640 512) rotate(14)",
      );
      expect(wrapper.get(".empty-tab-emoji-slot").text()).toBe("🙂");
      wrapper.unmount();
    } finally {
      delete svgElementPrototype.getStartPositionOfChar;
      delete svgElementPrototype.getRotationOfChar;
    }
  });

  it("shakes the emoji with a rotation and a move, three times, and sends a firework of other smiling emojis, when the fade-in is done", () => {
    const source = Fs.readFileSync(Path.join(import.meta.dirname, "EmptyTabScreen.vue"), "utf8");
    expect(source).toMatch(
      /\.empty-tab-emoji\s*{[^}]*animation:\s*empty-tab-laugh\s+0\.9s\s+ease-in-out\s+var\(--laugh-delay\)\s+3;/,
    );
    expect(source).toMatch(/@keyframes empty-tab-laugh\s*{[^@]*rotate\([^@]*translateY\(|@keyframes empty-tab-laugh\s*{[^@]*translateY\([^@]*rotate\(/);
    expect(source).toMatch(
      /\.empty-tab-spark\s*{[^}]*animation:\s*empty-tab-firework\s+2s\s+ease-out\s+calc\(var\(--laugh-delay\)\s*\+\s*var\(--spark-delay\)\)/,
    );
    expect(source).toMatch(/@keyframes empty-tab-firework\s*{[^@]*translate\([^@]*rotate\(/);
	const fireworkKeyframes = source.split('@keyframes empty-tab-firework')[1].split('@media')[0];
	expect(fireworkKeyframes).not.toMatch(/scale\(/);
	expect(source).not.toContain('--drift-scale');
    expect(source).toMatch(/--second-line-delay:\s*2s;/);
    expect(source).toMatch(/--second-line-fade-duration:\s*3s;/);
    expect(source).toMatch(/--laugh-delay:\s*calc\(var\(--second-line-delay\)\s*\+\s*var\(--second-line-fade-duration\)\);/);
  });

  it("does not move the line of the joke or the emoji when the user asks for less motion", () => {
    const source = Fs.readFileSync(Path.join(import.meta.dirname, "EmptyTabScreen.vue"), "utf8");
    expect(source).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*{\s*\.empty-tab-second-line,\s*\.empty-tab-emoji,\s*\.empty-tab-spark\s*{\s*animation:\s*none;/,
    );
  });

  it("keeps the old message as the label of the screen, for the screen readers", () => {
    const { wrapper } = mountEmptyTabScreen();
    expect(wrapper.attributes("aria-label")).toBe("No pane in this tab.");
  });

  it("writes each line of the joke along the lower half of a circle, centered in the middle of the screen and above the top edge", async () => {
    const { wrapper, resizeScreen } = mountEmptyTabScreen();
    await resizeScreen(1000, 600);
    for (const line of ["first", "second"] as const) {
      const [startX, startY, radiusX, radiusY, , , , endX, endY] = readJokePathNumbers(wrapper, line);
      expect(radiusX).toBe(radiusY);
      expect(startY).toBe(endY);
      expect(startX + radiusX).toBe(500);
      expect(endX - radiusX).toBe(500);
      expect(startY).toBeLessThan(0);
      expect(wrapper.get(`.empty-tab-${line}-line textPath`).attributes("href")).toBe(`#empty-tab-${line}-line-path`);
    }
    wrapper.unmount();
  });

  it("puts the second line of the joke below the first line, on a circle with the same center", async () => {
    const { wrapper, resizeScreen } = mountEmptyTabScreen();
    await resizeScreen(1000, 600);
    const [, firstStartY, firstRadius] = readJokePathNumbers(wrapper, "first");
    const [, secondStartY, secondRadius] = readJokePathNumbers(wrapper, "second");
    expect(firstStartY).toBe(secondStartY);
    expect(secondRadius).toBeGreaterThan(firstRadius);
    expect(secondStartY + secondRadius).toBeGreaterThan(firstStartY + firstRadius);
    wrapper.unmount();
  });

  it("fades the second line of the joke in slowly, after a delay, and not the first line", () => {
    const source = Fs.readFileSync(Path.join(import.meta.dirname, "EmptyTabScreen.vue"), "utf8");
    expect(source).toMatch(
      /\.empty-tab-second-line\s*{[^}]*animation:\s*empty-tab-fade-in\s+var\(--second-line-fade-duration\)\s+ease-in-out\s+var\(--second-line-delay\)/,
    );
    expect(source).toMatch(/@keyframes empty-tab-fade-in\s*{\s*from\s*{\s*opacity:\s*0;/);
    expect(source).not.toMatch(/\.empty-tab-first-line\s*{[^}]*animation/);
  });

  it("makes the title smaller on a small screen, and keeps the same look of the curve of the joke", async () => {
    const { wrapper, resizeScreen } = mountEmptyTabScreen();
    await resizeScreen(1980, 800);
    const largeTitleSize = readTitleSize(wrapper);
    const [, , largeRadius] = readJokePathNumbers(wrapper);
    await resizeScreen(600, 400);
    const smallTitleSize = readTitleSize(wrapper);
    const [, , smallRadius] = readJokePathNumbers(wrapper);
    expect(smallTitleSize).toBeLessThan(largeTitleSize);
    expect(smallRadius / 600).toBeCloseTo(largeRadius / 1980);
    wrapper.unmount();
  });

  it("stops to watch the size of the screen when it is removed", () => {
    const { wrapper, observer } = mountEmptyTabScreen();
    wrapper.unmount();
    expect(observer.disconnectCount).toBe(1);
  });
  it("does not draw the laugh again for a click on the emoji while the laugh is still running", async () => {
    stubPlaceOfCharacter();
    const { wrapper, resizeScreen } = mountEmptyTabScreen();
    await resizeScreen(1000, 600);
    await flushPromises();
    const groupBeforeClick = wrapper.get(".empty-tab-emoji").element.parentElement;
    expect(wrapper.find(".empty-tab-emoji-ready").exists()).toBe(false);
    await wrapper.get(".empty-tab-emoji-hit-area").trigger("click");
    expect(wrapper.get(".empty-tab-emoji").element.parentElement).toBe(groupBeforeClick);
    expect(wrapper.find(".empty-tab-replaying").exists()).toBe(false);
    wrapper.unmount();
  });

  it("makes the emoji laugh again, at once, for a click on the emoji when the laugh is over", async () => {
    stubPlaceOfCharacter();
    const { wrapper, resizeScreen } = mountEmptyTabScreen();
    await resizeScreen(1000, 600);
    await flushPromises();
    const groupBeforeClick = wrapper.get(".empty-tab-emoji").element.parentElement;
    finishLaughAnimations(wrapper);
    await flushPromises();
    expect(wrapper.find(".empty-tab-emoji-ready").exists()).toBe(true);

    await wrapper.get(".empty-tab-emoji-hit-area").trigger("click");
    await flushPromises();
    expect(wrapper.get(".empty-tab-emoji").element.parentElement).not.toBe(groupBeforeClick);
    expect(wrapper.find(".empty-tab-replaying").exists()).toBe(true);
    expect(wrapper.find(".empty-tab-emoji-ready").exists()).toBe(false);
    wrapper.unmount();
  });

  it("lets the user click on the emoji again after the second laugh is over, and not before", async () => {
    stubPlaceOfCharacter();
    const { wrapper, resizeScreen } = mountEmptyTabScreen();
    await resizeScreen(1000, 600);
    await flushPromises();
    finishLaughAnimations(wrapper);
    await wrapper.get(".empty-tab-emoji-hit-area").trigger("click");
    await flushPromises();
    const groupOfSecondLaugh = wrapper.get(".empty-tab-emoji").element.parentElement;

    await wrapper.get(".empty-tab-emoji-hit-area").trigger("click");
    expect(wrapper.get(".empty-tab-emoji").element.parentElement).toBe(groupOfSecondLaugh);

    finishLaughAnimations(wrapper);
    await flushPromises();
    expect(wrapper.find(".empty-tab-emoji-ready").exists()).toBe(true);
    await wrapper.get(".empty-tab-emoji-hit-area").trigger("click");
    await flushPromises();
    expect(wrapper.get(".empty-tab-emoji").element.parentElement).not.toBe(groupOfSecondLaugh);
    wrapper.unmount();
  });

  it("plays a goat bleat at each click on the emoji that starts the laugh again", async () => {
    stubPlaceOfCharacter();
    const { wrapper, resizeScreen } = mountEmptyTabScreen();
    await resizeScreen(1000, 600);
    await flushPromises();
    for (let clickCount = 1; clickCount <= 3; clickCount += 1) {
      finishLaughAnimations(wrapper);
      await flushPromises();
      await wrapper.get(".empty-tab-emoji-hit-area").trigger("click");
      await flushPromises();
      expect(playNextGoatBleat).toHaveBeenCalledTimes(clickCount);
    }
    wrapper.unmount();
  });

  it("plays no goat bleat for the laugh that starts by itself, nor for a click while the laugh is still running", async () => {
    stubPlaceOfCharacter();
    const { wrapper, resizeScreen } = mountEmptyTabScreen();
    await resizeScreen(1000, 600);
    await flushPromises();
    expect(playNextGoatBleat).not.toHaveBeenCalled();
    await wrapper.get(".empty-tab-emoji-hit-area").trigger("click");
    await flushPromises();
    expect(playNextGoatBleat).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("starts the laugh without the wait of the fade-in, and lets only the click area of the emoji take clicks", () => {
    const source = Fs.readFileSync(Path.join(import.meta.dirname, "EmptyTabScreen.vue"), "utf8");
    expect(source).toMatch(/\.empty-tab-replaying\s*{\s*--laugh-delay:\s*0s;/);
    expect(source).toMatch(/\.empty-tab-joke-arc\s*{[^}]*pointer-events:\s*none;/);
    expect(source).toMatch(/\.empty-tab-emoji-hit-area\s*{[^}]*pointer-events:\s*all;/);
    expect(source).toMatch(/\.empty-tab-emoji-ready\s*{[^}]*cursor:\s*pointer;/);
  });
  it("gives a different firework at each click on the emoji, and keeps every firework inside the same limits", async () => {
    let seed = 0.123;
    vi.spyOn(Math, "random").mockImplementation(() => {
      seed = (seed + 0.6180339887) % 1;
      return seed;
    });
    stubPlaceOfCharacter();
    const { wrapper, resizeScreen } = mountEmptyTabScreen();
    await resizeScreen(1000, 600);
    await flushPromises();

    const seenFireworks = new Set<string>();
    for (let clickCount = 0; clickCount < 6; clickCount += 1) {
      const sparks = wrapper.findAll(".empty-tab-spark");
      expect(sparks.length).toBeGreaterThanOrEqual(8);
      expect(sparks.length).toBeLessThanOrEqual(12);
      const sparkEmojis = sparks.map((spark) => spark.text());
      expect(new Set(sparkEmojis).size).toBe(sparkEmojis.length);
      for (const spark of sparks) {
        expect(spark.attributes("style")).toMatch(/--drift-y:\s*-/);
      }
      const group = wrapper.get(".empty-tab-emoji").element.parentElement as unknown as SVGGElement;
      const shakeDirection = group.style.getPropertyValue("--shake-direction");
      const shakeStrength = Number(group.style.getPropertyValue("--shake-strength"));
      expect(["-1", "1"]).toContain(shakeDirection);
      expect(shakeStrength).toBeGreaterThanOrEqual(0.7);
      expect(shakeStrength).toBeLessThanOrEqual(1.3);
      seenFireworks.add(sparks.map((spark) => `${spark.text()}${spark.attributes("style")}`).join("|") + shakeDirection + shakeStrength);

      finishLaughAnimations(wrapper);
      await flushPromises();
      await wrapper.get(".empty-tab-emoji-hit-area").trigger("click");
      await flushPromises();
    }
    expect(seenFireworks.size).toBe(6);
    wrapper.unmount();
  });
  it("keeps the dark colors in the dark theme, and takes the background, the text, and the title colors of the light theme", () => {
    const source = Fs.readFileSync(Path.join(import.meta.dirname, "EmptyTabScreen.vue"), "utf8");
    expect(source).toMatch(/\.empty-tab-screen\s*{[^}]*--screen-background:\s*var\(--illustration-bg\);[^}]*--joke-color:\s*var\(--illustration-text\);/);
    expect(source).toMatch(
      /:root\[data-theme="light"\]\s+\.empty-tab-screen\s*{[^}]*--screen-background:\s*var\(--bg\);[^}]*--title-color:\s*var\(--accent\);[^}]*--joke-color:\s*var\(--text\);/,
    );
    expect(source).toMatch(/\.empty-tab-screen\s*{[^}]*background:\s*radial-gradient\([^;]*var\(--screen-glow\)[^;]*var\(--screen-background\);/);
  });
});
