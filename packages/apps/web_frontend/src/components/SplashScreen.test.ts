import Fs from "node:fs";
import Path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const showMainWindow = vi.fn<() => Promise<void>>();
const isSplashScreenDisabled = vi.fn<() => Promise<boolean>>();
const playNextGoatBleat = vi.fn();

vi.mock("../lib/api", () => ({
  showMainWindow: () => showMainWindow(),
  isSplashScreenDisabled: () => isSplashScreenDisabled(),
}));
vi.mock("../lib/goat_sounds", () => ({ playNextGoatBleat: () => playNextGoatBleat() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/**
 * Mounts the splash screen, with the browser function `decode` of the image replaced by a function that records its call,
 * and waits until Heidrun Code has told if the command line option `--no-splash-screen` is present.
 */
async function mountSplashScreen() {
  const decode = vi.fn(async () => {});
  HTMLImageElement.prototype.decode = decode;
  const { default: SplashScreen } = await import("./SplashScreen.vue");
  const wrapper = mount(SplashScreen);
  await flushPromises();
  return { wrapper, decode };
}

/** Reads the numbers of the line of the motto: the start point, the radii, the three flags of the arc, and the end point. */
function readMottoPathNumbers(wrapper: Awaited<ReturnType<typeof mountSplashScreen>>["wrapper"]): number[] {
  const pathText = wrapper.get("#splash-motto-path").attributes("d") ?? "";
  return (pathText.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetModules();
  showMainWindow.mockReset();
  showMainWindow.mockResolvedValue(undefined);
  isSplashScreenDisabled.mockReset();
  isSplashScreenDisabled.mockResolvedValue(false);
  playNextGoatBleat.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SplashScreen", () => {
  it("shows the title and the motto, and no subtitle", async () => {
    const { wrapper } = await mountSplashScreen();
    expect(wrapper.get(".splash-title").text()).not.toBe("");
    expect(wrapper.get(".splash-motto").text()).not.toBe("");
    expect(wrapper.find(".splash-subtitle").exists()).toBe(false);
  });

  it("writes the title at 128 pixels and the motto at 52 pixels, twice the size they had before", () => {
    const source = Fs.readFileSync(Path.join(import.meta.dirname, "SplashScreen.vue"), "utf8");
    expect(source).toMatch(/\.splash-title\s*{[^}]*font-size:\s*128px/);
    expect(source).toMatch(/\.splash-motto\s*{[^}]*font-size:\s*52px/);
  });

  it("writes the motto along the lower half of a circle, centered in the middle of the screen and above the top edge", async () => {
    const { wrapper } = await mountSplashScreen();
    const [startX, startY, radiusX, radiusY, , , , endX, endY] = readMottoPathNumbers(wrapper);
    expect(radiusX).toBe(radiusY);
    expect(startY).toBe(endY);
    expect(startX + radiusX).toBe(window.innerWidth / 2);
    expect(endX - radiusX).toBe(window.innerWidth / 2);
    expect(startY).toBeLessThan(0);
    expect(wrapper.get(".splash-motto textPath").attributes("href")).toBe("#splash-motto-path");
  });

  it("keeps the radius of the circle of the motto and its lowest point above the bottom edge, in every window size", async () => {
    const { wrapper } = await mountSplashScreen();
    const [, , radius] = readMottoPathNumbers(wrapper);
    const originalWidth = window.innerWidth;
    const originalHeight = window.innerHeight;
    try {
      Object.defineProperty(window, "innerWidth", { value: 1440, configurable: true, writable: true });
      Object.defineProperty(window, "innerHeight", { value: 900, configurable: true, writable: true });
      window.dispatchEvent(new Event("resize"));
      await flushPromises();
      const [resizedStartX, resizedStartY, resizedRadius, , , , , resizedEndX] = readMottoPathNumbers(wrapper);
      expect(resizedRadius).toBe(radius);
      expect(resizedStartX + resizedEndX).toBe(1440);
      expect(resizedStartY + resizedRadius).toBe(900 - 72);
    } finally {
      Object.defineProperty(window, "innerWidth", { value: originalWidth, configurable: true, writable: true });
      Object.defineProperty(window, "innerHeight", { value: originalHeight, configurable: true, writable: true });
      wrapper.unmount();
    }
  });

  it("does not show the main window, and does not start the display time, before the image is loaded", async () => {
    const { wrapper } = await mountSplashScreen();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(showMainWindow).not.toHaveBeenCalled();
    expect(wrapper.find(".splash").exists()).toBe(true);
  });

  it("decodes the image, then shows the main window once, when the image is loaded", async () => {
    const { wrapper, decode } = await mountSplashScreen();
    await wrapper.get("img.splash-image").trigger("load");
    await flushPromises();
    expect(decode).toHaveBeenCalledTimes(1);
    expect(showMainWindow).toHaveBeenCalledTimes(1);
    expect(decode.mock.invocationCallOrder[0]).toBeLessThan(showMainWindow.mock.invocationCallOrder[0]);
  });

  it("shows the main window anyway when the image fails to load, so the window never stays hidden", async () => {
    const { wrapper } = await mountSplashScreen();
    await wrapper.get("img.splash-image").trigger("error");
    await flushPromises();
    expect(showMainWindow).toHaveBeenCalledTimes(1);
  });

  it("shows the main window anyway when the image cannot be decoded", async () => {
    const { wrapper, decode } = await mountSplashScreen();
    decode.mockRejectedValue(new Error("decode failed"));
    await wrapper.get("img.splash-image").trigger("load");
    await flushPromises();
    expect(showMainWindow).toHaveBeenCalledTimes(1);
  });

  it("keeps the splash screen for 3 seconds after the main window is shown, then closes it", async () => {
    const { wrapper } = await mountSplashScreen();
    await wrapper.get("img.splash-image").trigger("load");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(2_999);
    expect(wrapper.find(".splash").exists()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(wrapper.find(".splash").exists()).toBe(false);
  });

  it("closes the splash screen after 3 seconds even when there is no window to show, as in a plain browser", async () => {
    showMainWindow.mockRejectedValue(new Error("no Tauri"));
    const { wrapper } = await mountSplashScreen();
    await wrapper.get("img.splash-image").trigger("load");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(wrapper.find(".splash").exists()).toBe(false);
  });

  it("closes the splash screen when it is clicked", async () => {
    const { wrapper } = await mountSplashScreen();
    await wrapper.get(".splash").trigger("click");
    expect(wrapper.find(".splash").exists()).toBe(false);
  });

  it("shows a button that plays a goat bleat", async () => {
    const { wrapper } = await mountSplashScreen();
    const button = wrapper.get("button.splash-sound-button");
    expect(button.text()).not.toBe("");
    await button.trigger("click");
    expect(playNextGoatBleat).toHaveBeenCalledTimes(1);
  });

  it("keeps the splash screen open for a click on the sound button, and still closes it after 3 seconds", async () => {
    const { wrapper } = await mountSplashScreen();
    await wrapper.get("img.splash-image").trigger("load");
    await flushPromises();
    await wrapper.get("button.splash-sound-button").trigger("click");
    expect(wrapper.find(".splash").exists()).toBe(true);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(wrapper.find(".splash").exists()).toBe(false);
  });

  it("plays no sound by itself", async () => {
    const { wrapper } = await mountSplashScreen();
    await wrapper.get("img.splash-image").trigger("load");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(3_000);
    expect(playNextGoatBleat).not.toHaveBeenCalled();
  });

  it("shows no splash screen, and no splash image, when Heidrun Code starts with the option --no-splash-screen", async () => {
    isSplashScreenDisabled.mockResolvedValue(true);
    const { wrapper } = await mountSplashScreen();
    expect(wrapper.find(".splash").exists()).toBe(false);
    expect(wrapper.find("img.splash-image").exists()).toBe(false);
  });

  it("shows the main window at once, once, and without the display time, with the option --no-splash-screen", async () => {
    isSplashScreenDisabled.mockResolvedValue(true);
    const { decode } = await mountSplashScreen();
    expect(showMainWindow).toHaveBeenCalledTimes(1);
    expect(decode).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(showMainWindow).toHaveBeenCalledTimes(1);
  });

  it("does not fail with the option --no-splash-screen when there is no window to show, as in a plain browser", async () => {
    isSplashScreenDisabled.mockResolvedValue(true);
    showMainWindow.mockRejectedValue(new Error("no Tauri"));
    const { wrapper } = await mountSplashScreen();
    expect(wrapper.find(".splash").exists()).toBe(false);
  });

  it("shows the splash screen, and does not show the main window before the image is loaded, without the option", async () => {
    const { wrapper } = await mountSplashScreen();
    expect(isSplashScreenDisabled).toHaveBeenCalledTimes(1);
    expect(wrapper.find(".splash").exists()).toBe(true);
    expect(showMainWindow).not.toHaveBeenCalled();
  });

  it("shows the splash screen when Heidrun Code cannot tell if the option is present, as in a plain browser", async () => {
    isSplashScreenDisabled.mockRejectedValue(new Error("no Tauri"));
    const { wrapper } = await mountSplashScreen();
    expect(wrapper.find(".splash").exists()).toBe(true);
  });
});
