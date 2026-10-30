import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";

const invoke = vi.fn(async (command: string, payload?: unknown): Promise<unknown> => {
  if (command === "herdr_request" && (payload as { method?: string } | undefined)?.method === "session.snapshot") {
    return { snapshot: MireViewTestSupport.snapshot() };
  }
  if (command === "mire_window_open") {
    return windowOpenAnswer();
  }
  return null;
});

/** The answer of the fake `mire_window_open`. */
let windowOpenAnswer: () => unknown = () => "opened";

vi.mock("@tauri-apps/api/core", () => ({ invoke: (command: string, payload?: unknown) => invoke(command, payload) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

import MireDialog from "./MireDialog.vue";
import { state } from "../../stores/session";
import { MireModal, mireModal } from "../../stores/mire/mire_modal";
import { MireStore, mireState } from "../../stores/mire/mire_store";
import { MIRE_SIDEBAR_WIDTH_KEY } from "../../stores/mire/mire_sidebar_width";
import { MireViewTestSupport, TEST_NODES } from "./mire_view_test_support";

let wrapper: VueWrapper | null = null;

beforeEach(() => {
  invoke.mockClear();
  windowOpenAnswer = () => "opened";
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

  it("gives the keyboard focus back to where it was in the main window, after Escape and after the close button", async () => {
    const terminal = document.createElement("textarea");
    document.body.appendChild(terminal);
    MireModal.close();
    terminal.focus();
    MireModal.open();
    wrapper = mount(MireDialog, { attachTo: document.body });
    await flushPromises();
    wrapper.get<HTMLButtonElement>("[data-open-separate-window]").element.focus();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(document.activeElement).toBe(terminal);
    MireModal.open();
    wrapper.get<HTMLButtonElement>("[data-open-separate-window]").element.focus();
    await wrapper.get(".dialog-header button[aria-label]").trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(terminal);
  });

  it("closes after Open in Heidrun Code shows the pane in the main window, and leaves the focus to the pane", async () => {
    const terminal = document.createElement("textarea");
    document.body.appendChild(terminal);
    MireModal.close();
    terminal.focus();
    MireModal.open();
    MireStore.select(TEST_NODES.codex);
    wrapper = mount(MireDialog, { attachTo: document.body });
    await flushPromises();
    wrapper.get<HTMLButtonElement>("[data-open-in-heidrun-code]").element.focus();
    await wrapper.get("[data-open-in-heidrun-code]").trigger("click");
    await flushPromises();
    expect(state.selectedPaneId).toBe("p3");
    expect(mireModal.isOpen).toBe(false);
    expect(document.activeElement).not.toBe(terminal);
  });

  it("shows a workspace, a tab, or a pane in the main window with a double click on the graph, and closes", async () => {
    wrapper = mount(MireDialog, { attachTo: document.body });
    await flushPromises();
    await wrapper.get('[data-node-id="workspace:w2"]').trigger("dblclick");
    await flushPromises();
    expect(state.selectedWorkspaceId).toBe("w2");
    expect(mireModal.isOpen).toBe(false);

    MireModal.open();
    await wrapper.get('[data-sector-id="workspace:w1"]').trigger("dblclick");
    await flushPromises();
    expect(state.selectedWorkspaceId).toBe("w1");

    MireModal.open();
    await wrapper.get(`[data-node-id="${TEST_NODES.codex}"] [data-tab-label]`).trigger("dblclick");
    await flushPromises();
    expect(state.selectedWorkspaceId).toBe("w1");
    expect(state.selectedTabId).toBe("w1:t2");
    expect(mireModal.isOpen).toBe(false);

    MireModal.open();
    state.selectedPaneId = null;
    await wrapper.get(`[data-node-id="${TEST_NODES.codexUnmatched}"]`).trigger("dblclick");
    await flushPromises();
    expect(state.selectedWorkspaceId).toBe("w2");
    expect(state.selectedTabId).toBe("w2:t1");
    expect(state.selectedPaneId).toBe("p4");
    expect(mireModal.isOpen).toBe(false);
  });

  it("changes the width of the right sidebar with the drag handle on its left edge, and saves the width", async () => {
    localStorage.removeItem(MIRE_SIDEBAR_WIDTH_KEY);
    wrapper = mount(MireDialog, { attachTo: document.body });
    await flushPromises();
    const sidebar = wrapper.get("[data-mire-sidebar]");
    expect(sidebar.attributes("style")).toContain("width: 380px");
    const resizer = wrapper.get("[data-mire-sidebar-resizer]");
    expect(resizer.attributes("role")).toBe("separator");
    await resizer.trigger("keydown", { key: "ArrowLeft", shiftKey: true });
    expect(sidebar.attributes("style")).toContain("width: 420px");
    expect(localStorage.getItem(MIRE_SIDEBAR_WIDTH_KEY)).toBe("420");
    await resizer.trigger("keydown", { key: "ArrowRight" });
    expect(sidebar.attributes("style")).toContain("width: 410px");
    await resizer.trigger("dblclick");
    expect(sidebar.attributes("style")).toContain("width: 380px");
    localStorage.removeItem(MIRE_SIDEBAR_WIDTH_KEY);
  });

  it("opens the separate window with its button, and closes the modal", async () => {
    wrapper = mount(MireDialog, { attachTo: document.body });
    await flushPromises();
    const button = wrapper.get("[data-open-separate-window]");
    expect(button.text()).toBe("Open in a separate window");
    await button.trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenCalledWith("mire_window_open", undefined);
    expect(mireModal.isOpen).toBe(false);
  });

  it("stays open with a message when the separate window cannot open", async () => {
    windowOpenAnswer = () => {
      throw new Error("mire_window_open_failed");
    };
    wrapper = mount(MireDialog, { attachTo: document.body });
    await flushPromises();
    await wrapper.get("[data-open-separate-window]").trigger("click");
    await flushPromises();
    expect(mireModal.isOpen).toBe(true);
    expect(state.toast).toBe("The separate Mire window cannot open.");
  });

  it("shows a terminal preview that never takes the input focus and never resizes a terminal", async () => {
    MireStore.select(TEST_NODES.claude);
    wrapper = mount(MireDialog, { attachTo: document.body });
    await flushPromises();
    const preview = wrapper.get("[data-section=\"terminal\"]");
    expect(preview.find("textarea").exists()).toBe(false);
    expect(preview.find("[tabindex]").exists()).toBe(false);
    expect(preview.element.contains(document.activeElement)).toBe(false);
    expect(invoke.mock.calls.some((call) => String(call[0]).startsWith("pty_"))).toBe(false);
  });
});
