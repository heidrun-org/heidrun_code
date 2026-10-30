import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";

const invoke = vi.fn(async (): Promise<unknown> => null);
const listen = vi.fn(async () => () => {});

vi.mock("@tauri-apps/api/core", () => ({ invoke: () => invoke() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: () => listen() }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

import MireLocalNetworkRoot from "./MireLocalNetworkRoot.vue";
import { state } from "../../stores/session";
import { MireLocalNetworkSession, mireLocalNetworkPageState } from "../../stores/mire/mire_local_network_session";
import { MireStore, mireState } from "../../stores/mire/mire_store";
import { MireViewTestSupport, TEST_NODES, TEST_NOW_MS } from "./mire_view_test_support";

let wrapper: VueWrapper | null = null;

beforeEach(() => {
  invoke.mockClear();
  listen.mockClear();
  MireStore.useDisplayMode("localNetwork");
  MireLocalNetworkSession.apply({
    snapshot: MireViewTestSupport.snapshot(),
    observations: MireViewTestSupport.observations(),
    herdrSocketPath: "/home/.config/herdr/sessions/heidrun/herdr.sock",
  }, TEST_NOW_MS);
  mireState.selectedPath = ["heidrun"];
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  state.snapshot = null;
  mireState.observations = null;
  mireLocalNetworkPageState.isConnectionLost = false;
  MireStore.useDisplayMode("modal");
  document.body.innerHTML = "";
});

describe("MireLocalNetworkRoot, the Mire page of a phone or a tablet of the local network (issue 978)", () => {
  it("shows the same Mire view from the state of the Mire server, and calls no Tauri command", async () => {
    wrapper = mount(MireLocalNetworkRoot, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find("[data-mire-view]").exists()).toBe(true);
    expect(wrapper.find("[data-mire-sidebar]").text()).toContain("DashMenu V2");
    expect(mireState.herdrSessionName).toBe("heidrun");
    expect(invoke).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
  });

  it("has no Open in Heidrun Code and no terminal preview for a coding agent, because the page sends nothing to a pane", async () => {
    MireStore.select(TEST_NODES.claude);
    wrapper = mount(MireLocalNetworkRoot, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find("[data-section='task']").exists()).toBe(true);
    expect(wrapper.find("[data-open-in-heidrun-code]").exists()).toBe(false);
    expect(wrapper.find("[data-section='terminal']").exists()).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("has no drag handle on the right sidebar, which keeps the width of the page, and opens nothing on a double click", async () => {
    wrapper = mount(MireLocalNetworkRoot, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find("[data-mire-sidebar-resizer]").exists()).toBe(false);
    expect(wrapper.get("[data-mire-sidebar]").attributes("style")).toBeUndefined();
    await wrapper.get(`[data-node-id="${TEST_NODES.codex}"]`).trigger("dblclick");
    await flushPromises();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("has no transcript preview for a subagent", async () => {
    MireStore.select(TEST_NODES.olivier);
    wrapper = mount(MireLocalNetworkRoot, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find("[data-section='messages']").exists()).toBe(true);
    expect(wrapper.find("[data-section='transcript']").exists()).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("says that the connection is lost, and hides the message after the next answer", async () => {
    wrapper = mount(MireLocalNetworkRoot, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find("[data-connection-lost]").exists()).toBe(false);
    mireLocalNetworkPageState.isConnectionLost = true;
    await flushPromises();
    expect(wrapper.get("[data-connection-lost]").text()).toContain("The connection to Heidrun Code is lost");
    MireLocalNetworkSession.apply({
      snapshot: MireViewTestSupport.snapshot(),
      observations: MireViewTestSupport.observations(),
      herdrSocketPath: null,
    }, TEST_NOW_MS);
    await flushPromises();
    expect(wrapper.find("[data-connection-lost]").exists()).toBe(false);
  });

  it("shows the button of full screen only when the web browser can show the page in full screen", async () => {
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => false });
    wrapper = mount(MireLocalNetworkRoot, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find("[data-full-screen]").exists()).toBe(false);
    wrapper.unmount();
    const requestFullscreen = vi.fn(async () => {});
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => true });
    document.documentElement.requestFullscreen = requestFullscreen;
    wrapper = mount(MireLocalNetworkRoot, { attachTo: document.body });
    await flushPromises();
    await wrapper.get("[data-full-screen]").trigger("click");
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    delete (document as unknown as { fullscreenEnabled?: boolean }).fullscreenEnabled;
  });
});
