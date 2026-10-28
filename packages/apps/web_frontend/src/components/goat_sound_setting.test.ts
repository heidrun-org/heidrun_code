import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import AboutModal from "./AboutModal.vue";
import EmptyTabScreen from "./EmptyTabScreen.vue";
import SplashScreen from "./SplashScreen.vue";
import { settings } from "../stores/settings";

///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////
//	GoatSoundSettingTest — the setting "goat sound" rules the three places that play a goat bleat (issue #620)
///////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////

const state = vi.hoisted(() => ({ showAbout: null as (() => void) | null }));
/** What every fake audio element does: one shared pair of functions, so that a test counts the plays of all the bleats. */
const audio = vi.hoisted(() => ({ play: vi.fn(async () => {}), pause: vi.fn() }));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (_name: string, handler: () => void) => {
    state.showAbout = handler;
    return () => {};
  }),
}));
vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn(async () => "1.2.3") }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("../lib/api", () => ({
  showMainWindow: vi.fn(async () => {}),
  isSplashScreenDisabled: vi.fn(async () => false),
}));

/** A fake audio element: the code of the goat bleats finds nothing else to play a sound with. */
class FakeAudio {
  currentTime = 99;
  play = audio.play;
  pause = audio.pause;
  constructor(public src: string) {}
}

const originalResizeObserver = globalThis.ResizeObserver;

beforeEach(() => {
  audio.play.mockClear();
  audio.pause.mockClear();
  vi.stubGlobal("Audio", FakeAudio);
  HTMLImageElement.prototype.decode = vi.fn(async () => {});
  const svgElementPrototype = SVGElement.prototype as unknown as Record<string, unknown>;
  svgElementPrototype.getStartPositionOfChar = () => ({ x: 640, y: 512 });
  svgElementPrototype.getRotationOfChar = () => 14;
  settings.goatSound = false;
});

afterEach(() => {
  vi.unstubAllGlobals();
  globalThis.ResizeObserver = originalResizeObserver;
  const svgElementPrototype = SVGElement.prototype as unknown as Record<string, unknown>;
  delete svgElementPrototype.getStartPositionOfChar;
  delete svgElementPrototype.getRotationOfChar;
});

/** Mounts the About modal, and opens it as the menu of the application does. */
async function mountAboutModal() {
  const wrapper = mount(AboutModal);
  await flushPromises();
  state.showAbout?.();
  await flushPromises();
  return wrapper;
}

/** Mounts the splash screen, and waits until Heidrun Code has told if the command line option `--no-splash-screen` is present. */
async function mountSplashScreen() {
  const wrapper = mount(SplashScreen);
  await flushPromises();
  return wrapper;
}

/** Mounts the empty tab screen with a fake `ResizeObserver`, and gives it a size, as a browser does after the layout. */
async function mountEmptyTabScreen() {
  let callback: (() => void) | null = null;
  globalThis.ResizeObserver = class {
    constructor(observerCallback: () => void) {
      callback = observerCallback;
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  const wrapper = mount(EmptyTabScreen);
  Object.defineProperty(wrapper.element, "clientWidth", { value: 1000, configurable: true });
  Object.defineProperty(wrapper.element, "clientHeight", { value: 600, configurable: true });
  (callback as (() => void) | null)?.();
  await flushPromises();
  return wrapper;
}

/** Clicks the sound button of the About modal. */
async function clickAboutModalSound(wrapper: Awaited<ReturnType<typeof mountAboutModal>>) {
  await wrapper.get("button.play-goat-sound").trigger("click");
}

/** Clicks the sound button of the splash screen. */
async function clickSplashScreenSound(wrapper: Awaited<ReturnType<typeof mountSplashScreen>>) {
  await wrapper.get("button.splash-sound-button").trigger("click");
}

/** Waits until the laugh of the smiley is over, then clicks the smiley, so that the laugh starts again. */
async function clickSmiley(wrapper: Awaited<ReturnType<typeof mountEmptyTabScreen>>) {
  const animatedElements = [wrapper.get(".empty-tab-emoji"), ...wrapper.findAll(".empty-tab-spark")];
  for (const animatedElement of animatedElements) {
    animatedElement.element.dispatchEvent(new Event("animationend", { bubbles: true }));
  }
  await flushPromises();
  await wrapper.get(".empty-tab-emoji-hit-area").trigger("click");
  await flushPromises();
}

describe("the goat sound setting", () => {
  it("is off by default, so a click on each of the three places plays no goat bleat", async () => {
    const aboutModal = await mountAboutModal();
    const splashScreen = await mountSplashScreen();
    const emptyTabScreen = await mountEmptyTabScreen();
    expect(settings.goatSound).toBe(false);
    await clickAboutModalSound(aboutModal);
    await clickSplashScreenSound(splashScreen);
    await clickSmiley(emptyTabScreen);
    expect(audio.play).not.toHaveBeenCalled();
    aboutModal.unmount();
    splashScreen.unmount();
    emptyTabScreen.unmount();
  });

  it("is on, so a click on each of the three places plays a goat bleat", async () => {
    settings.goatSound = true;
    const aboutModal = await mountAboutModal();
    const splashScreen = await mountSplashScreen();
    const emptyTabScreen = await mountEmptyTabScreen();
    expect(audio.play).not.toHaveBeenCalled();
    await clickAboutModalSound(aboutModal);
    expect(audio.play).toHaveBeenCalledTimes(1);
    await clickSplashScreenSound(splashScreen);
    expect(audio.play).toHaveBeenCalledTimes(2);
    await clickSmiley(emptyTabScreen);
    expect(audio.play).toHaveBeenCalledTimes(3);
    aboutModal.unmount();
    splashScreen.unmount();
    emptyTabScreen.unmount();
  });

  it("applies at once to the screens that are already open, and plays no sound by itself when it changes", async () => {
    const aboutModal = await mountAboutModal();
    await clickAboutModalSound(aboutModal);
    expect(audio.play).not.toHaveBeenCalled();

    settings.goatSound = true;
    await flushPromises();
    expect(audio.play).not.toHaveBeenCalled();
    await clickAboutModalSound(aboutModal);
    expect(audio.play).toHaveBeenCalledTimes(1);

    settings.goatSound = false;
    await flushPromises();
    await clickAboutModalSound(aboutModal);
    expect(audio.play).toHaveBeenCalledTimes(1);
    aboutModal.unmount();
  });

  it("keeps the buttons and the smiley of the three places on the screen when it is off", async () => {
    const aboutModal = await mountAboutModal();
    const splashScreen = await mountSplashScreen();
    const emptyTabScreen = await mountEmptyTabScreen();
    expect(aboutModal.find("button.play-goat-sound").exists()).toBe(true);
    expect(splashScreen.find("button.splash-sound-button").exists()).toBe(true);
    expect(emptyTabScreen.find(".empty-tab-emoji-hit-area").exists()).toBe(true);
    aboutModal.unmount();
    splashScreen.unmount();
    emptyTabScreen.unmount();
  });
});
