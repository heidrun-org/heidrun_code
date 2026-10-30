import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";

const invoke = vi.fn(async (_command: string, _payload?: unknown): Promise<unknown> => null);

vi.mock("@tauri-apps/api/core", () => ({ invoke: (command: string, payload?: unknown) => invoke(command, payload) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

import MireDialog from "./MireDialog.vue";
import { state } from "../../stores/session";
import { MireModal, mireModal } from "../../stores/mire/mire_modal";
import { MireStore, mireState } from "../../stores/mire/mire_store";
import { MireViewTestSupport, TEST_NODES } from "./mire_view_test_support";

let wrapper: VueWrapper | null = null;

beforeEach(() => {
  invoke.mockClear();
  state.snapshot = MireViewTestSupport.snapshot();
  mireState.selectedPath = ["heidrun"];
  MireModal.open();
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  state.snapshot = null;
  document.body.innerHTML = "";
});

describe("MireDialog", () => {
  it("registers its view in the collector when it opens, and leaves the collector when it closes", async () => {
    wrapper = mount(MireDialog, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.get("#mire-title").text()).toBe("Mire");
    const subscribe = invoke.mock.calls.find((call) => call[0] === "mire_subscribe");
    expect(subscribe).toBeDefined();
    wrapper.unmount();
    wrapper = null;
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("mire_unsubscribe", subscribe?.[1]);
  });

  it("closes with Escape, and with the close button", async () => {
    wrapper = mount(MireDialog, { attachTo: document.body });
    await flushPromises();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(mireModal.isOpen).toBe(false);
    MireModal.open();
    await wrapper.get(".dialog-header button").trigger("click");
    expect(mireModal.isOpen).toBe(false);
  });

  it("closes after Open in Heidrun Code shows the pane in the main window", async () => {
    MireStore.select(TEST_NODES.codex);
    wrapper = mount(MireDialog, { attachTo: document.body });
    await flushPromises();
    await wrapper.get("[data-open-in-heidrun-code]").trigger("click");
    expect(state.selectedPaneId).toBe("p3");
    expect(mireModal.isOpen).toBe(false);
  });
});
