import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";

const invoke = vi.fn(async (command: string, payload?: Record<string, unknown>): Promise<unknown> => {
  if (command === "herdr_request" && payload?.method === "pane.read") {
    return { read: { text: "> Synchronize the cards\n  ✓ 48 tests pass\n" } };
  }
  if (command === "herdr_request" && payload?.method === "session.snapshot") {
    return { snapshot: herdrSnapshot };
  }
  if (command === "claude_session_agents") {
    return [{ id: "a1", lines: ["⏺ I draw the menu screen."] }];
  }
  return null;
});

/** The Herdr snapshot that the fake `session.snapshot` gives. */
let herdrSnapshot: unknown = null;

vi.mock("@tauri-apps/api/core", () => ({ invoke: (command: string, payload?: Record<string, unknown>) => invoke(command, payload) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

import MireSidebar from "./MireSidebar.vue";
import { state } from "../../stores/session";
import { MireStore, mireSelectedEntry, mireState } from "../../stores/mire/mire_store";
import { MireViewTestSupport, TEST_NODES, TEST_NOW_MS } from "./mire_view_test_support";

let wrapper: VueWrapper | null = null;

/** Mounts the sidebar with the test snapshot and the test observations, with one node selected. */
async function mountSidebar(nodeId: string): Promise<VueWrapper> {
  state.snapshot = MireViewTestSupport.snapshot();
  mireState.observations = MireViewTestSupport.observations();
  mireState.nowMs = TEST_NOW_MS;
  MireStore.select(nodeId);
  wrapper = mount(MireSidebar, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  invoke.mockClear();
  herdrSnapshot = MireViewTestSupport.snapshot();
  mireState.filter = null;
  mireState.selectedPath = ["heidrun"];
  mireState.selectedFreshness = null;
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  state.snapshot = null;
  mireState.observations = null;
  document.body.innerHTML = "";
});

describe("MireSidebar, Heidrun selected", () => {
  it("shows the pending attention first, then the workspaces", async () => {
    const sidebar = await mountSidebar("heidrun");
    const details = sidebar.get('[data-mire-details="heidrun"]');
    const sections = details.findAll("[data-section]").map((section) => section.attributes("data-section"));
    expect(sections).toEqual(["attention", "workspaces"]);
    const attention = details.findAll("[data-attention-id]");
    expect(attention[0].text()).toContain("Two options for the schema of the table menu_items: which one?");
    expect(attention[0].get("[data-developer-action]").text()).toBe("Waits for your answer.");
    expect(attention[1].get("[data-developer-action]").text()).toBe("Waits for an answer. An automatic reviewer can answer it.");
    expect(details.get('[data-section="workspaces"]').text()).toContain("DashMenu V2");
    expect(details.get('[data-section="workspaces"]').text()).toContain("Connect");
  });

  it("shows the path, and each level of the path selects it again", async () => {
    const sidebar = await mountSidebar(TEST_NODES.olivier);
    const path = sidebar.findAll("[data-path-node-id]");
    expect(path.map((item) => item.text())).toEqual(["Heidrun", "DashMenu V2", "Claude", "Claude", "Olivier"]);
    await path[1].trigger("click");
    expect(mireSelectedEntry.value.nodeId).toBe("workspace:w1");
  });

  it("shows the coverage notices: Claude Code not observed with the place of the option, and unmatched", async () => {
    const sidebar = await mountSidebar("heidrun");
    expect(sidebar.get('[data-coverage="claude_not_observed"]').text()).toContain("Observe Claude Code for the Mire");
    expect(sidebar.get('[data-coverage="claude_not_observed"]').text()).toContain("Settings");
    expect(sidebar.get('[data-coverage="unmatched"]').text()).toContain("1 coding agent is not linked");
    expect(sidebar.find('[data-coverage="codex_unavailable"]').exists()).toBe(false);
  });

  it("shows that the Codex server is not available, and that the observations are stale", async () => {
    const sidebar = await mountSidebar("heidrun");
    const observations = MireViewTestSupport.observations(TEST_NOW_MS - 60_000);
    observations.codex.coverage = "unavailable";
    observations.codex.unavailableReason = "no socket";
    observations.codex.threads = [];
    mireState.observations = observations;
    await nextTick();
    expect(sidebar.get('[data-coverage="codex_unavailable"]').text()).toContain("no socket");
    expect(sidebar.get('[data-coverage="stale"]').text()).toContain("The live observations are stale");
  });
});

describe("MireSidebar, workspace selected", () => {
  it("shows the status, the fixed workspace folder, the tabs, the coding agents, the nested subagents, and the messages", async () => {
    const sidebar = await mountSidebar("workspace:w1");
    const details = sidebar.get('[data-mire-details="workspace"]');
    expect(details.text()).toContain("DashMenu V2");
    expect(details.get("[data-status]").attributes("data-status")).toBe("blocked");
    expect(details.get("[data-folder]").text()).toBe("/projects/dashmenu-v2");
    const rows = details.get("[data-mire-hierarchy]").findAll("[data-select-node-id]").map((row) => row.attributes("data-select-node-id"));
    expect(rows).toEqual([
      "tab:w1:t1",
      TEST_NODES.claude,
      TEST_NODES.olivier,
      TEST_NODES.explore,
      TEST_NODES.claudeNotObserved,
      "tab:w1:t2",
      TEST_NODES.codex,
      TEST_NODES.bruno,
    ]);
    const messages = details.findAll("[data-message-id]");
    expect(messages).toHaveLength(2);
    expect(messages[0].get("[data-message-text]").text()).toBe("Content not exposed by Codex.");
    expect(messages[1].get("[data-message-text]").text()).toBe("The mock-ups are ready.");
  });

  it("says that the workspace folder needs recovery when it is missing", async () => {
    const sidebar = await mountSidebar("workspace:w2");
    expect(sidebar.find("[data-folder]").exists()).toBe(false);
    expect(sidebar.get("[data-folder-missing]").text()).toBe("The workspace folder needs recovery.");
  });
});

describe("MireSidebar, coding agent selected", () => {
  it("shows the status, the last prompt label, the question, the subagents, a read-only terminal preview, and the messages", async () => {
    const sidebar = await mountSidebar(TEST_NODES.claude);
    const details = sidebar.get('[data-mire-details="coding_agent"]');
    expect(details.get("[data-tab-name]").text()).toBe("Claude");
    expect(details.get("[data-badge]").classes()).toContain("bi-claude");
    expect(details.get("[data-badge]").attributes("aria-label")).toBe("Claude Code");
    expect(details.get("[data-status]").attributes("data-status")).toBe("working");
    expect(details.text()).not.toContain("Current task");
    expect(details.get('[data-section="attention"]').text()).toContain("Two options for the schema");
    expect(details.get('[data-section="subagents"]').text()).toContain("Olivier");
    expect(details.get("[data-terminal-preview]").text()).toContain("48 tests pass");
    expect(details.get("[data-terminal-preview]").attributes("tabindex")).toBeUndefined();
    expect(invoke).toHaveBeenCalledWith("herdr_request", { method: "pane.read", params: { pane_id: "p1", source: "recent_unwrapped", lines: 30 } });
    expect(invoke.mock.calls.some((call) => call[0] === "pty_resize")).toBe(false);
    expect(details.get('[data-section="messages"]').text()).toContain("The mock-ups are ready.");
    expect(details.find("[data-approve]").exists()).toBe(false);
  });

  it("shows the unavailable fields of a coding agent that is not observed", async () => {
    const sidebar = await mountSidebar(TEST_NODES.claudeNotObserved);
    const details = sidebar.get('[data-mire-details="coding_agent"]');
    expect(details.findAll("[data-unavailable]").length).toBeGreaterThanOrEqual(3);
    expect(details.get("[data-no-task-text]").text()).toBe("Not available: this coding agent is not observed.");
    expect(details.get("[data-notices]").text()).toContain("Not observed");
  });

  it("shows the exact pane in the main window with the button Open in Heidrun Code", async () => {
    const sidebar = await mountSidebar(TEST_NODES.codex);
    await sidebar.get("[data-open-in-heidrun-code]").trigger("click");
    await flushPromises();
    expect(state.selectedWorkspaceId).toBe("w1");
    expect(state.selectedTabId).toBe("w1:t2");
    expect(state.selectedPaneId).toBe("p3");
    expect(sidebar.emitted("openedInHeidrunCode")).toHaveLength(1);
    expect(sidebar.find("[data-open-failure]").exists()).toBe(false);
  });

  it("says that the pane is gone, and changes nothing, when the new Herdr snapshot has no such pane", async () => {
    const sidebar = await mountSidebar(TEST_NODES.codex);
    state.selectedPaneId = null;
    const snapshot = MireViewTestSupport.snapshot();
    herdrSnapshot = { ...snapshot, panes: snapshot.panes.filter((pane) => pane.pane_id !== "p3"), agents: [] };
    await sidebar.get("[data-open-in-heidrun-code]").trigger("click");
    await flushPromises();
    expect(state.selectedPaneId).not.toBe("p3");
    expect(sidebar.emitted("openedInHeidrunCode")).toBeUndefined();
    expect(sidebar.get("[data-open-failure]").text()).toContain("It is not in the Herdr session any more: nothing was opened.");
    await sidebar.get("[data-open-failure] button").trigger("click");
    expect(sidebar.find("[data-open-failure]").exists()).toBe(false);
  });
});

describe("MireSidebar, subagent selected", () => {
  it("shows the native and the visible status, the parent, the initial instructions, and a transcript", async () => {
    const sidebar = await mountSidebar(TEST_NODES.olivier);
    const details = sidebar.get('[data-mire-details="subagent"]');
    expect(details.get("[data-native-status]").text()).toBe("Claude Code observer status: running");
    expect(details.get("[data-status]").attributes("data-status")).toBe("working");
    expect(details.get(`[data-select-node-id="${TEST_NODES.claude}"]`).text()).toBe("Claude");
    expect(details.get('[data-task-label="initial_instructions"]').text()).toContain("Draw the mock-ups of the menu screen.");
    expect(details.get('[data-section="transcript"]').text()).toContain("Transcript");
    expect(details.get('[data-section="transcript"]').text()).not.toContain("Terminal");
    expect(details.get("[data-transcript-preview]").text()).toContain("I draw the menu screen.");
    expect(invoke).toHaveBeenCalledWith("claude_session_agents", { sessionId: "s1", lines: 40 });
  });

  it("shows the pending approval of a Codex child chat, and says that Codex exposes no transcript", async () => {
    const sidebar = await mountSidebar(TEST_NODES.bruno);
    const details = sidebar.get('[data-mire-details="subagent"]');
    expect(details.get("[data-status]").attributes("data-status")).toBe("blocked");
    expect(details.get('[data-section="attention"]').text()).toContain("Approval");
    expect(details.get("[data-transcript-unavailable]").text()).toContain("Codex does not expose");
    expect(details.get('[data-section="instructions"]').text()).toContain("Not available");
  });

  it("shows a stale subagent as unknown with a stale notice", async () => {
    const sidebar = await mountSidebar(TEST_NODES.olivier);
    mireState.nowMs = TEST_NOW_MS + 60_000;
    await nextTick();
    const details = sidebar.get('[data-mire-details]');
    expect(mireSelectedEntry.value.nodeId).toBe(TEST_NODES.olivier);
    expect(details.get("[data-status]").attributes("data-status")).toBe("unknown");
    expect(details.get("[data-notices]").text()).toContain("Stale observation");
  });
});
