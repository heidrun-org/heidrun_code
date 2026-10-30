import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";

const invoke = vi.fn(async (command: string, payload?: Record<string, unknown>): Promise<unknown> => {
  if (command === "herdr_request" && payload?.method === "session.snapshot") {
    return { snapshot: MireViewTestSupport.snapshot() };
  }
  if (command === "herdr_request" && payload?.method === "pane.read") {
    return { read: { text: "> Synchronize the cards\n" } };
  }
  return null;
});

/** The fake Tauri window of the page. */
const fakeWindow = {
  isFullScreen: false,
  isFullscreen: vi.fn(async () => fakeWindow.isFullScreen),
  setFullscreen: vi.fn(async (isFullScreen: boolean) => {
    fakeWindow.isFullScreen = isFullScreen;
  }),
  close: vi.fn(async () => {}),
};

vi.mock("@tauri-apps/api/core", () => ({ invoke: (command: string, payload?: Record<string, unknown>) => invoke(command, payload) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => fakeWindow }));

import MireWindowRoot from "./MireWindowRoot.vue";
import MireDialog from "./MireDialog.vue";
import { state } from "../../stores/session";
import { MireModal } from "../../stores/mire/mire_modal";
import { MireStore, mireState } from "../../stores/mire/mire_store";
import { MireViewTestSupport, TEST_NODES } from "./mire_view_test_support";

let wrapper: VueWrapper | null = null;

/** The view identifiers of the calls of a command of the shared collector. */
function viewIdsOf(command: string): string[] {
  return invoke.mock.calls.filter((call) => call[0] === command).map((call) => String(call[1]?.viewId));
}

beforeEach(() => {
  invoke.mockClear();
  fakeWindow.isFullScreen = false;
  fakeWindow.setFullscreen.mockClear();
  fakeWindow.close.mockClear();
  state.snapshot = MireViewTestSupport.snapshot();
  state.selectedPaneId = null;
  mireState.selectedPath = ["heidrun"];
  MireStore.useDisplayMode("window");
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  state.snapshot = null;
  MireStore.useDisplayMode("modal");
  document.body.innerHTML = "";
});

describe("MireWindowRoot, the page of the separate Mire window", () => {
  it("mounts the same Mire view, which registers once in the shared collector", async () => {
    wrapper = mount(MireWindowRoot, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find("[data-mire-view]").exists()).toBe(true);
    expect(viewIdsOf("mire_subscribe")).toHaveLength(1);
    expect(viewIdsOf("mire_subscribe")[0].startsWith("mire_view_window_")).toBe(true);
  });

  it("enters and leaves the full screen with its button", async () => {
    wrapper = mount(MireWindowRoot, { attachTo: document.body });
    await flushPromises();
    const button = wrapper.get("[data-full-screen]");
    expect(button.text()).toBe("Full screen");
    await button.trigger("click");
    await flushPromises();
    expect(fakeWindow.setFullscreen).toHaveBeenCalledWith(true);
    expect(wrapper.get("[data-full-screen]").text()).toBe("Exit full screen");
    expect(wrapper.get("[data-full-screen]").attributes("aria-pressed")).toBe("true");
    await wrapper.get("[data-full-screen]").trigger("click");
    await flushPromises();
    expect(fakeWindow.setFullscreen).toHaveBeenLastCalledWith(false);
    expect(wrapper.get("[data-full-screen]").text()).toBe("Full screen");
  });

  it("closes the window with ⌘W, and Escape does not close it", async () => {
    wrapper = mount(MireWindowRoot, { attachTo: document.body });
    await flushPromises();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape" }));
    expect(fakeWindow.close).not.toHaveBeenCalled();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w", code: "KeyW", metaKey: true }));
    expect(fakeWindow.close).toHaveBeenCalledTimes(1);
  });

  it("asks the main window to show the pane with Open in Heidrun Code, after a new reading of Herdr", async () => {
    MireStore.select(TEST_NODES.codex);
    wrapper = mount(MireWindowRoot, { attachTo: document.body });
    await flushPromises();
    await wrapper.get("[data-open-in-heidrun-code]").trigger("click");
    await flushPromises();
    const commands = invoke.mock.calls.map((call) => call[0]);
    expect(commands.lastIndexOf("herdr_request")).toBeLessThan(commands.indexOf("mire_open_in_main_window"));
    expect(invoke).toHaveBeenCalledWith("mire_open_in_main_window", { paneId: "p3" });
    expect(state.selectedPaneId).toBe(null);
    expect(wrapper.find("[data-mire-view]").exists()).toBe(true);
  });

  it("shows a terminal preview that never takes the input focus and never resizes a terminal", async () => {
    MireStore.select(TEST_NODES.claude);
    wrapper = mount(MireWindowRoot, { attachTo: document.body });
    await flushPromises();
    const preview = wrapper.get('[data-section="terminal"]');
    expect(preview.text()).toContain("Synchronize the cards");
    expect(preview.find("textarea").exists()).toBe(false);
    expect(preview.find("[tabindex]").exists()).toBe(false);
    expect(preview.element.contains(document.activeElement)).toBe(false);
    expect(invoke.mock.calls.some((call) => String(call[0]).startsWith("pty_"))).toBe(false);
  });

  it("has no Approve button", async () => {
    MireStore.select(TEST_NODES.codex);
    wrapper = mount(MireWindowRoot, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find("[data-approve]").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Approve");
  });
});

describe("the modal and the separate window open at the same time", () => {
  it("register one view each in the one shared collector, and closing one removes only its own view", async () => {
    wrapper = mount(MireWindowRoot, { attachTo: document.body });
    MireStore.useDisplayMode("modal");
    MireModal.open();
    const dialog = mount(MireDialog, { attachTo: document.body });
    await flushPromises();
    const subscribed = viewIdsOf("mire_subscribe");
    expect(subscribed).toHaveLength(2);
    expect(new Set(subscribed).size).toBe(2);
    dialog.unmount();
    await flushPromises();
    expect(viewIdsOf("mire_unsubscribe")).toEqual([subscribed.find((viewId) => viewId.startsWith("mire_view_modal_"))]);
    wrapper.unmount();
    wrapper = null;
    await flushPromises();
    expect(viewIdsOf("mire_unsubscribe").sort()).toEqual([...subscribed].sort());
    MireModal.close();
  });
});
