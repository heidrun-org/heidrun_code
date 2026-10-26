// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import ThreeJsDemoModal from "./ThreeJsDemoModal.vue";
import { threeJsDemoModal, openThreeJsDemoModal } from "../stores/three_js_demo_modal";

const sceneMock = vi.hoisted(() => ({
  constructorError: null as Error | null,
  instances: [] as { canvas: HTMLCanvasElement; start: () => void; dispose: () => void; resize: () => void }[],
}));

vi.mock("../lib/three_js_demo_scene", () => ({
  ThreeJsDemoScene: class {
    webGlVersion = "WebGL 2.0 (test)";
    start = vi.fn();
    dispose = vi.fn();
    resize = vi.fn();
    constructor(public canvas: HTMLCanvasElement) {
      if (sceneMock.constructorError !== null) {
        throw sceneMock.constructorError;
      }
      sceneMock.instances.push(this);
    }
  },
}));

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  sceneMock.constructorError = null;
  sceneMock.instances.length = 0;
  openThreeJsDemoModal();
});

afterEach(() => {
  threeJsDemoModal.open = false;
  vi.unstubAllGlobals();
});

describe("ThreeJsDemoModal", () => {
  it("shows the title", () => {
    const wrapper = mount(ThreeJsDemoModal);
    expect(wrapper.get(".dialog-title").text()).toBe("Three.js demo");
    wrapper.unmount();
  });

  it("starts the scene on its canvas and shows the WebGL version", async () => {
    const wrapper = mount(ThreeJsDemoModal);
    await flushPromises();
    expect(sceneMock.instances).toHaveLength(1);
    expect(sceneMock.instances[0].canvas).toBe(wrapper.get("canvas").element);
    expect(sceneMock.instances[0].start).toHaveBeenCalledTimes(1);
    expect(wrapper.get(".dialog-footer").text()).toBe("Drawn with WebGL 2.0 (test)");
    wrapper.unmount();
  });

  it("shows an error and hides the canvas when WebGL is not available", async () => {
    sceneMock.constructorError = new Error("no context");
    const wrapper = mount(ThreeJsDemoModal);
    await flushPromises();
    expect(wrapper.get(".alert").text()).toContain("WebGL is not available in this window");
    expect(wrapper.get("canvas").isVisible()).toBe(false);
    wrapper.unmount();
  });

  it("closes with the close button", async () => {
    const wrapper = mount(ThreeJsDemoModal);
    await wrapper.get(".dialog-header button").trigger("click");
    expect(threeJsDemoModal.open).toBe(false);
    wrapper.unmount();
  });

  it("closes with the Escape key", () => {
    const wrapper = mount(ThreeJsDemoModal);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(threeJsDemoModal.open).toBe(false);
    wrapper.unmount();
  });

  it("stops the scene when the window closes", async () => {
    const wrapper = mount(ThreeJsDemoModal);
    await flushPromises();
    wrapper.unmount();
    expect(sceneMock.instances[0].dispose).toHaveBeenCalledTimes(1);
  });
});
