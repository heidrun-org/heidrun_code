import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";

const invoke = vi.fn(async (): Promise<unknown> => null);
const listen = vi.fn(async () => () => {});

vi.mock("@tauri-apps/api/core", () => ({ invoke: () => invoke() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: () => listen() }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

import HeidrunCodeDashboardLocalNetworkRoot from "./HeidrunCodeDashboardLocalNetworkRoot.vue";
import { state } from "../../stores/session";
import { HeidrunCodeDashboardLocalNetworkSession, heidrunCodeDashboardLocalNetworkPageState } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_local_network_session";
import { HeidrunCodeDashboardStore, heidrunCodeDashboardState } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import { HeidrunCodeDashboardViewTestSupport, TEST_NODES, TEST_NOW_MS } from "./heidrun_code_dashboard_view_test_support";

let wrapper: VueWrapper | null = null;

beforeEach(() => {
  invoke.mockClear();
  listen.mockClear();
  HeidrunCodeDashboardStore.useDisplayMode("localNetwork");
  HeidrunCodeDashboardLocalNetworkSession.apply({
    snapshot: HeidrunCodeDashboardViewTestSupport.snapshot(),
    observations: HeidrunCodeDashboardViewTestSupport.observations(),
    herdrSocketPath: "/home/.config/herdr/sessions/heidrun/herdr.sock",
  }, TEST_NOW_MS);
  heidrunCodeDashboardState.selectedPath = ["heidrun"];
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  state.snapshot = null;
  heidrunCodeDashboardState.observations = null;
  heidrunCodeDashboardLocalNetworkPageState.isConnectionLost = false;
  HeidrunCodeDashboardStore.useDisplayMode("modal");
  document.body.innerHTML = "";
});

describe("HeidrunCodeDashboardLocalNetworkRoot, the Heidrun Code Dashboard page of a phone or a tablet of the local network (issue 978)", () => {
  it("shows the same Heidrun Code Dashboard view from the state of the Heidrun Code Dashboard server, and calls no Tauri command", async () => {
    wrapper = mount(HeidrunCodeDashboardLocalNetworkRoot, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find("[data-heidrun-code-dashboard-view]").exists()).toBe(true);
    expect(wrapper.find("[data-heidrun-code-dashboard-sidebar]").text()).toContain("DashMenu V2");
    expect(heidrunCodeDashboardState.herdrSessionName).toBe("heidrun");
    expect(invoke).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
  });

  it("has no Open in Heidrun Code and no terminal preview for a coding agent, because the page sends nothing to a pane", async () => {
    HeidrunCodeDashboardStore.select(TEST_NODES.claude);
    wrapper = mount(HeidrunCodeDashboardLocalNetworkRoot, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find("[data-section='task']").exists()).toBe(true);
    expect(wrapper.find("[data-open-in-heidrun-code]").exists()).toBe(false);
    expect(wrapper.find("[data-section='terminal']").exists()).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("has no drag handle on the right sidebar, which keeps the width of the page, and opens nothing on a double click", async () => {
    wrapper = mount(HeidrunCodeDashboardLocalNetworkRoot, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find("[data-heidrun-code-dashboard-sidebar-resizer]").exists()).toBe(false);
    expect(wrapper.get("[data-heidrun-code-dashboard-sidebar]").attributes("style")).toBeUndefined();
    await wrapper.get(`[data-node-id="${TEST_NODES.codex}"]`).trigger("dblclick");
    await flushPromises();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("has no transcript preview for a subagent", async () => {
    HeidrunCodeDashboardStore.select(TEST_NODES.olivier);
    wrapper = mount(HeidrunCodeDashboardLocalNetworkRoot, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find("[data-section='messages']").exists()).toBe(true);
    expect(wrapper.find("[data-section='transcript']").exists()).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("says that the connection is lost, and hides the message after the next answer", async () => {
    wrapper = mount(HeidrunCodeDashboardLocalNetworkRoot, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find("[data-connection-lost]").exists()).toBe(false);
    heidrunCodeDashboardLocalNetworkPageState.isConnectionLost = true;
    await flushPromises();
    expect(wrapper.get("[data-connection-lost]").text()).toContain("The connection to Heidrun Code is lost");
    HeidrunCodeDashboardLocalNetworkSession.apply({
      snapshot: HeidrunCodeDashboardViewTestSupport.snapshot(),
      observations: HeidrunCodeDashboardViewTestSupport.observations(),
      herdrSocketPath: null,
    }, TEST_NOW_MS);
    await flushPromises();
    expect(wrapper.find("[data-connection-lost]").exists()).toBe(false);
  });

  it("shows the button of full screen only when the web browser can show the page in full screen", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => false });
    wrapper = mount(HeidrunCodeDashboardLocalNetworkRoot, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find("[data-full-screen]").exists()).toBe(false);
    wrapper.unmount();
    const requestFullscreen = vi.fn(async () => {});
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => true });
    document.documentElement.requestFullscreen = requestFullscreen;
    wrapper = mount(HeidrunCodeDashboardLocalNetworkRoot, { attachTo: document.body });
    await flushPromises();
    await wrapper.get("[data-full-screen]").trigger("click");
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    delete (document as unknown as { fullscreenEnabled?: boolean }).fullscreenEnabled;
  });
});
