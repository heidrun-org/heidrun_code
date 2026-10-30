import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

import MireGraph from "./MireGraph.vue";
import { state } from "../../stores/session";
import { MireStore, mireSelectedEntry, mireState } from "../../stores/mire/mire_store";
import { MireViewTestSupport, TEST_NODES, TEST_NOW_MS } from "./mire_view_test_support";

let wrapper: VueWrapper | null = null;

/** Mounts the graph with the test snapshot and the test observations. */
async function mountGraph(): Promise<VueWrapper> {
  state.snapshot = MireViewTestSupport.snapshot();
  mireState.observations = MireViewTestSupport.observations();
  mireState.nowMs = TEST_NOW_MS;
  wrapper = mount(MireGraph, { attachTo: document.body });
  await nextTick();
  return wrapper;
}

/** Finds the node of the graph with a node identifier. */
function node(graph: VueWrapper, nodeId: string) {
  return graph.get(`[data-node-id="${nodeId}"]`);
}

beforeEach(() => {
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

describe("MireGraph", () => {
  it("shows a plain text message and no drawing when no workspace is open", async () => {
    state.snapshot = null;
    wrapper = mount(MireGraph);
    expect(wrapper.find("[data-mire-empty]").text()).toBe("No workspace is open.");
    expect(wrapper.find("svg").exists()).toBe(false);
  });

  it("draws Heidrun with the goat, one hexagon for each workspace, one satellite for each coding agent, and the subagents", async () => {
    const graph = await mountGraph();
    expect(node(graph, "heidrun").find("image").attributes("href")).toContain("baby_goat");
    expect(graph.findAll(".mire-workspace")).toHaveLength(2);
    expect(graph.findAll(".mire-coding-agent")).toHaveLength(4);
    expect(graph.findAll(".mire-subagent").map((subagent) => subagent.attributes("data-node-id")))
      .toEqual([TEST_NODES.olivier, TEST_NODES.explore, TEST_NODES.bruno]);
    expect(graph.findAll(".mire-sector")).toHaveLength(2);
    const [x, y, width, height] = graph.get("svg").attributes("viewBox")!.split(" ").map(Number);
    expect([x, y, width]).toEqual([-height / 2, -height / 2, height]);
    expect(width).toBeLessThan(1120);
  });

  it("labels each coding agent with the exact tab name and the icon of Claude Code or of Codex (OpenAI), side by side for a split tab", async () => {
    const graph = await mountGraph();
    const labels = graph.findAll(".mire-coding-agent [data-tab-label]");
    expect(labels.map((label) => label.get("[data-label]").text())).toEqual(["Claude", "Claude", "DashStock", "a tab name that i…"]);
    expect(labels.map((label) => label.get("[data-badge]").attributes("data-badge"))).toEqual(["claude", "claude", "openai", "openai"]);
    expect(labels.map((label) => label.get("[data-badge]").text())).toEqual(["\uF914", "\uF914", "\uF915", "\uF915"]);
    expect(node(graph, TEST_NODES.codexUnmatched).get("title").text()).toContain("a tab name that is much too long for the graph");
  });

  it("gives every status a sign and a text in addition to its color, and a text for an incomplete observation", async () => {
    const graph = await mountGraph();
    const claude = node(graph, TEST_NODES.claude);
    expect(claude.classes()).toContain("mire-status-working");
    expect(claude.get(".mire-glyph").text()).toBe("▸");
    expect(claude.attributes("aria-label")).toContain("Working");
    const codex = node(graph, TEST_NODES.codex);
    expect(codex.get(".mire-glyph").text()).toBe("!");
    expect(codex.attributes("aria-label")).toContain("Blocked");
    const notObserved = node(graph, TEST_NODES.claudeNotObserved);
    expect(notObserved.classes()).toContain("mire-incomplete");
    expect(notObserved.get("[data-freshness]").text()).toBe("not observed");
    expect(node(graph, TEST_NODES.codexUnmatched).get("[data-freshness]").text()).toBe("unmatched");
    expect(node(graph, TEST_NODES.explore).get(".mire-glyph").text()).toBe("✓");
  });

  it("selects a node with a click on the node, on its label, or in the sector of its workspace", async () => {
    const graph = await mountGraph();
    await node(graph, TEST_NODES.codex).trigger("click");
    expect(mireSelectedEntry.value.nodeId).toBe(TEST_NODES.codex);
    await node(graph, TEST_NODES.claude).get("[data-tab-label]").trigger("click");
    expect(mireSelectedEntry.value.nodeId).toBe(TEST_NODES.claude);
    await graph.get('[data-sector-id="workspace:w2"]').trigger("click");
    expect(mireSelectedEntry.value.nodeId).toBe("workspace:w2");
    expect(graph.get('[data-sector-id="workspace:w2"]').classes()).toContain("mire-selected");
    expect(node(graph, "workspace:w2").attributes("aria-current")).toBe("true");
    expect(graph.findAll("[data-selection-ring]")).toHaveLength(1);
    expect(node(graph, "workspace:w2").find("[data-selection-ring]").exists()).toBe(true);
    // The dashes move at the speed of the circle of a coding agent: 8 seconds for a radius of 15.5.
    expect(node(graph, "workspace:w2").get("[data-selection-ring]").attributes("style")).toContain(`--mire-selection-turn: ${(26 / 15.5) * 8}s`);
  });

  it("draws every sector again as a new element when the selected workspace changes, so no old outline stays on the screen", async () => {
    const graph = await mountGraph();
    await graph.get('[data-sector-id="workspace:w2"]').trigger("click");
    const sectorsBefore = graph.findAll(".mire-sector").map((sector) => sector.element);
    await graph.get('[data-sector-id="workspace:w1"]').trigger("click");
    const sectorsAfter = graph.findAll(".mire-sector").map((sector) => sector.element);
    expect(sectorsAfter).toHaveLength(sectorsBefore.length);
    for (const sector of sectorsAfter) {
      expect(sectorsBefore).not.toContain(sector);
    }
    expect(graph.get('[data-sector-id="workspace:w1"]').classes()).toContain("mire-selected");
    expect(graph.get('[data-sector-id="workspace:w2"]').classes()).not.toContain("mire-selected");
  });

  it("moves the keyboard focus with the arrow keys, selects with Enter, and selects Heidrun again with Escape", async () => {
    const graph = await mountGraph();
    const heidrun = node(graph, "heidrun");
    expect(heidrun.attributes("tabindex")).toBe("0");
    (heidrun.element as SVGGElement).focus();
    await heidrun.trigger("keydown", { key: "ArrowDown" });
    await nextTick();
    expect(document.activeElement?.getAttribute("data-node-id")).toBe("workspace:w1");
    await node(graph, "workspace:w1").trigger("keydown", { key: "ArrowRight" });
    await nextTick();
    expect(document.activeElement?.getAttribute("data-node-id")).toBe("workspace:w2");
    await node(graph, "workspace:w2").trigger("keydown", { key: "Enter" });
    expect(mireSelectedEntry.value.nodeId).toBe("workspace:w2");
    await node(graph, "workspace:w2").trigger("keydown", { key: "Escape" });
    expect(mireSelectedEntry.value.nodeId).toBe("heidrun");
  });

  it("hides the nodes that do not match the filter, keeps faint ancestors, and moves nothing", async () => {
    const graph = await mountGraph();
    const before = node(graph, TEST_NODES.olivier).get("circle").attributes("cx");
    MireStore.toggleFilter("working");
    await nextTick();
    expect(graph.find(`[data-node-id="${TEST_NODES.olivier}"]`).exists()).toBe(true);
    expect(graph.find(`[data-node-id="${TEST_NODES.explore}"]`).exists()).toBe(false);
    expect(graph.find(`[data-node-id="${TEST_NODES.codex}"]`).exists()).toBe(false);
    expect(graph.find('[data-node-id="workspace:w2"]').exists()).toBe(false);
    expect(node(graph, TEST_NODES.olivier).get("circle").attributes("cx")).toBe(before);
    MireStore.toggleFilter("blocked");
    await nextTick();
    expect(node(graph, TEST_NODES.codex).classes()).not.toContain("mire-faint");
    expect(graph.find(`[data-node-id="${TEST_NODES.bruno}"]`).exists()).toBe(true);
    MireStore.toggleFilter("finished");
    await nextTick();
    expect(node(graph, TEST_NODES.claude).classes()).toContain("mire-faint");
    expect(node(graph, TEST_NODES.explore).classes()).not.toContain("mire-faint");
  });
});
