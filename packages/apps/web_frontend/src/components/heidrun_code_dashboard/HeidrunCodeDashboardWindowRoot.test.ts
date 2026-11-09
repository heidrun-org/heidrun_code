import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";

const invoke = vi.fn(async (command: string, payload?: Record<string, unknown>): Promise<unknown> => {
  if (command === "herdr_request" && payload?.method === "session.snapshot") {
    return { snapshot: HeidrunCodeDashboardViewTestSupport.snapshot() };
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

import HeidrunCodeDashboardWindowRoot from "./HeidrunCodeDashboardWindowRoot.vue";
import HeidrunCodeDashboardDialog from "./HeidrunCodeDashboardDialog.vue";
import { state } from "../../stores/session";
import { HeidrunCodeDashboardModal } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_modal";
import { HeidrunCodeDashboardStore, heidrunCodeDashboardState } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import { HEIDRUN_CODE_DASHBOARD_SIDEBAR_WIDTH_KEY } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_sidebar_width";
import { HeidrunCodeDashboardViewTestSupport, TEST_NODES } from "./heidrun_code_dashboard_view_test_support";

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
  state.snapshot = HeidrunCodeDashboardViewTestSupport.snapshot();
  state.selectedPaneId = null;
  heidrunCodeDashboardState.selectedPath = ["heidrun"];
  HeidrunCodeDashboardStore.useDisplayMode("window");
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  state.snapshot = null;
  HeidrunCodeDashboardStore.useDisplayMode("modal");
  document.body.innerHTML = "";
});

describe("HeidrunCodeDashboardWindowRoot, the page of the separate Heidrun Code Dashboard window", () => {
  it("mounts the same Heidrun Code Dashboard view, which registers once in the shared collector", async () => {
    wrapper = mount(HeidrunCodeDashboardWindowRoot, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find("[data-heidrun-code-dashboard-view]").exists()).toBe(true);
    expect(viewIdsOf("heidrun_code_dashboard_subscribe")).toHaveLength(1);
    expect(viewIdsOf("heidrun_code_dashboard_subscribe")[0].startsWith("heidrun_code_dashboard_view_window_")).toBe(true);
  });

  it("enters and leaves the full screen with its button", async () => {
    wrapper = mount(HeidrunCodeDashboardWindowRoot, { attachTo: document.body });
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
    wrapper = mount(HeidrunCodeDashboardWindowRoot, { attachTo: document.body });
    await flushPromises();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape" }));
    expect(fakeWindow.close).not.toHaveBeenCalled();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w", code: "KeyW", metaKey: true }));
    expect(fakeWindow.close).toHaveBeenCalledTimes(1);
  });

  it("asks the main window to show the pane with Open in Heidrun Code, after a new reading of Herdr", async () => {
    HeidrunCodeDashboardStore.select(TEST_NODES.codex);
    wrapper = mount(HeidrunCodeDashboardWindowRoot, { attachTo: document.body });
    await flushPromises();
    await wrapper.get("[data-open-in-heidrun-code]").trigger("click");
    await flushPromises();
    const commands = invoke.mock.calls.map((call) => call[0]);
    expect(commands.lastIndexOf("herdr_request")).toBeLessThan(commands.indexOf("heidrun_code_dashboard_open_in_main_window"));
    expect(invoke).toHaveBeenCalledWith("heidrun_code_dashboard_open_in_main_window", { kind: "pane", id: "p3" });
    expect(state.selectedPaneId).toBe(null);
    expect(wrapper.find("[data-heidrun-code-dashboard-view]").exists()).toBe(true);
  });

  it("asks the main window to show a workspace, a tab, or a pane with a double click on the graph, and stays open", async () => {
    wrapper = mount(HeidrunCodeDashboardWindowRoot, { attachTo: document.body });
    await flushPromises();
    await wrapper.get('[data-node-id="workspace:w2"]').trigger("dblclick");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("heidrun_code_dashboard_open_in_main_window", { kind: "workspace", id: "w2" });
    await wrapper.get(`[data-node-id="${TEST_NODES.codex}"] [data-tab-label]`).trigger("dblclick");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("heidrun_code_dashboard_open_in_main_window", { kind: "tab", id: "w1:t2" });
    expect(invoke).not.toHaveBeenCalledWith("heidrun_code_dashboard_open_in_main_window", { kind: "pane", id: "p3" });
    await wrapper.get(`[data-node-id="${TEST_NODES.codex}"]`).trigger("dblclick");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("heidrun_code_dashboard_open_in_main_window", { kind: "pane", id: "p3" });
    expect(state.selectedPaneId).toBe(null);
    expect(wrapper.find("[data-heidrun-code-dashboard-view]").exists()).toBe(true);
  });

  it("takes the width of the right sidebar chosen in the modal, and has the same drag handle", async () => {
    localStorage.setItem(HEIDRUN_CODE_DASHBOARD_SIDEBAR_WIDTH_KEY, "500");
    wrapper = mount(HeidrunCodeDashboardWindowRoot, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.get("[data-heidrun-code-dashboard-sidebar]").attributes("style")).toContain("width: 500px");
    expect(wrapper.find("[data-heidrun-code-dashboard-sidebar-resizer]").exists()).toBe(true);
    localStorage.removeItem(HEIDRUN_CODE_DASHBOARD_SIDEBAR_WIDTH_KEY);
  });

  it("shows a terminal preview that never takes the input focus and never resizes a terminal", async () => {
    HeidrunCodeDashboardStore.select(TEST_NODES.claude);
    wrapper = mount(HeidrunCodeDashboardWindowRoot, { attachTo: document.body });
    await flushPromises();
    const preview = wrapper.get('[data-section="terminal"]');
    expect(preview.text()).toContain("Synchronize the cards");
    expect(preview.find("textarea").exists()).toBe(false);
    expect(preview.find("[tabindex]").exists()).toBe(false);
    expect(preview.element.contains(document.activeElement)).toBe(false);
    expect(invoke.mock.calls.some((call) => String(call[0]).startsWith("pty_"))).toBe(false);
  });

  it("has no Approve button", async () => {
    HeidrunCodeDashboardStore.select(TEST_NODES.codex);
    wrapper = mount(HeidrunCodeDashboardWindowRoot, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find("[data-approve]").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Approve");
  });
});

describe("the modal and the separate window open at the same time", () => {
  it("register one view each in the one shared collector, and closing one removes only its own view", async () => {
    wrapper = mount(HeidrunCodeDashboardWindowRoot, { attachTo: document.body });
    HeidrunCodeDashboardStore.useDisplayMode("modal");
    HeidrunCodeDashboardModal.open();
    const dialog = mount(HeidrunCodeDashboardDialog, { attachTo: document.body });
    await flushPromises();
    const subscribed = viewIdsOf("heidrun_code_dashboard_subscribe");
    expect(subscribed).toHaveLength(2);
    expect(new Set(subscribed).size).toBe(2);
    dialog.unmount();
    await flushPromises();
    expect(viewIdsOf("heidrun_code_dashboard_unsubscribe")).toEqual([subscribed.find((viewId) => viewId.startsWith("heidrun_code_dashboard_view_modal_"))]);
    wrapper.unmount();
    wrapper = null;
    await flushPromises();
    expect(viewIdsOf("heidrun_code_dashboard_unsubscribe").sort()).toEqual([...subscribed].sort());
    HeidrunCodeDashboardModal.close();
  });
});
