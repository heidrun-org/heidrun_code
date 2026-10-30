import Fs from "node:fs";
import Path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

import MireGraph from "./MireGraph.vue";
import type { AgentInfo, SessionSnapshot } from "../../lib/types";
import type { MessageObservation, MireObservations } from "../../lib/mire/observation_types";
import { MireModelBuilder } from "../../lib/mire/mire_model_builder";
import { state } from "../../stores/session";
import { mireAnimationState } from "../../stores/mire/mire_animations";
import { mireState } from "../../stores/mire/mire_store";
import { MireViewTestSupport, TEST_NODES, TEST_NOW_MS } from "./mire_view_test_support";

const __dirname = import.meta.dirname;

/** The style sheet of the animations of the graph. */
const ANIMATIONS_CSS = Fs.readFileSync(Path.join(__dirname, "mire_graph_animations.css"), "utf8");

/** Gives the declarations of one rule of the style sheet of the animations. */
function cssRule(selector: string): string {
  const start = ANIMATIONS_CSS.indexOf(`${selector} {`);
  expect(start).toBeGreaterThanOrEqual(0);
  return ANIMATIONS_CSS.slice(start, ANIMATIONS_CSS.indexOf("}", start));
}

let wrapper: VueWrapper | null = null;

/** Gives the test snapshot with other fields for some panes. */
function snapshotWith(changes: Record<string, Partial<AgentInfo>>): SessionSnapshot {
  const snapshot = MireViewTestSupport.snapshot();
  const panes = snapshot.panes.map((pane) => ({ ...pane, ...(changes[pane.pane_id] ?? {}) }));
  return { ...snapshot, panes, agents: panes };
}

/** Gives a message of the session s1 or of a Codex chat. */
function message(id: string, fromId: string, toId: string | null, fields: Partial<MessageObservation> = {}): MessageObservation {
  return {
    id,
    atMs: TEST_NOW_MS,
    fromId,
    toId,
    text: `text ${id}`,
    contentAvailability: "available",
    delivery: "received",
    ...fields,
  };
}

/** Gives the test observations with more messages in the Claude Code session s1 and in the Codex chat t1. */
function observationsWith(claudeMessages: MessageObservation[], codexInteractions: MessageObservation[] = []): MireObservations {
  const observations = MireViewTestSupport.observations();
  observations.claude.sessions[0].messages.push(...claudeMessages);
  observations.codex.threads[0].interactions.push(...codexInteractions);
  return observations;
}

/** Mocks the media query of reduced motion. */
function mockReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn((query: string) => ({
    matches: matches && query === "(prefers-reduced-motion: reduce)",
  })) as unknown as typeof window.matchMedia;
}

/** Mounts the graph with the test snapshot and the test observations. */
async function mountGraph(): Promise<VueWrapper> {
  state.snapshot = MireViewTestSupport.snapshot();
  mireState.observations = MireViewTestSupport.observations();
  mireState.nowMs = TEST_NOW_MS;
  wrapper = mount(MireGraph, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

function node(graph: VueWrapper, nodeId: string) {
  return graph.get(`[data-node-id="${nodeId}"]`);
}

beforeEach(() => {
  mockReducedMotion(false);
  mireAnimationState.isPaused = false;
  mireState.filter = null;
  mireState.selectedPath = ["heidrun"];
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  state.snapshot = null;
  mireState.observations = null;
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("MireGraph animations", () => {
  it("animates Working and Blocked, keeps Finished and Idle still, and animates Heidrun", async () => {
    const graph = await mountGraph();
    expect(graph.get("svg").classes()).toContain("mire-animated");
    expect(node(graph, TEST_NODES.claude).find("[data-orbit]").exists()).toBe(true);
    expect(node(graph, TEST_NODES.claude).get(".mire-orbit-dot").attributes("r")).toBe("2.5");
    expect(node(graph, TEST_NODES.olivier).get(".mire-orbit-dot").attributes("r")).toBe("2");
    // The gold glow: an SVG filter with two blurs made more opaque, on the small dot and on the drops. The region of the drops is the
    // whole view box, so that the drops of a straight line still show.
    expect(node(graph, TEST_NODES.claude).get(".mire-orbit-dot").attributes("filter")).toBe("url(#mire-gold-glow-dot)");
    expect(graph.get("[data-drops]").attributes("filter")).toBe("url(#mire-gold-glow-drops)");
    expect(graph.get("[data-drops]").attributes("pathLength")).toBeUndefined();
    expect(graph.get("#mire-gold-glow-dot").findAll("feGaussianBlur").map((blur) => blur.attributes("stdDeviation"))).toEqual(["2.5", "7"]);
    expect(graph.get("#mire-gold-glow-dot").findAll("feFuncA").map((alpha) => alpha.attributes("slope"))).toEqual(["4", "8"]);
    const [x, y, width, height] = graph.get("svg").attributes("viewBox")!.split(" ");
    const dropsGlow = graph.get("#mire-gold-glow-drops");
    expect([dropsGlow.attributes("x"), dropsGlow.attributes("y"), dropsGlow.attributes("width"), dropsGlow.attributes("height")]).toEqual([x, y, width, height]);
    expect(node(graph, TEST_NODES.olivier).find("[data-orbit]").exists()).toBe(true);
    expect(node(graph, TEST_NODES.codex).find("[data-waves]").exists()).toBe(true);
    expect(node(graph, TEST_NODES.bruno).find("[data-waves]").exists()).toBe(true);
    for (const stillNodeId of [TEST_NODES.explore, TEST_NODES.claudeNotObserved, TEST_NODES.codexUnmatched]) {
      expect(node(graph, stillNodeId).find("[data-orbit]").exists()).toBe(false);
      expect(node(graph, stillNodeId).find("[data-waves]").exists()).toBe(false);
    }
    expect(node(graph, "workspace:w1").find("[data-hexagon-glow]").exists()).toBe(true);
    expect(node(graph, "workspace:w2").find("[data-hexagon-glow]").exists()).toBe(false);
    expect(graph.findAll("[data-drops]").length).toBeGreaterThan(0);
    expect(node(graph, "heidrun").find("[data-sight-ring]").exists()).toBe(true);
    expect(node(graph, "heidrun").find("[data-heidrun-glow]").exists()).toBe(true);
    expect(node(graph, "heidrun").get(".mire-heidrun-ring").attributes("class")).not.toMatch(/status/);
    expect(node(graph, "heidrun").get("[data-keyboard]").attributes("data-key-period-ms")).toBe("1600");
  });

  it("gives the dots of a working item a gold color with a gold glow and a fast move", () => {
    expect(cssRule(".mire-orbit-dot")).toContain("fill: var(--heidrun-gold)");
    expect(cssRule(".mire-gold-flood")).toContain("flood-color: var(--heidrun-gold)");
    expect(cssRule(".mire-drops")).toContain("stroke: var(--heidrun-gold)");
    expect(cssRule(".mire-drops")).toContain("stroke-width: 4");
    // The same spacing and the same speed on every line: 50 units of the drawing, with no length of the line.
    expect(cssRule(".mire-drops")).toContain("stroke-dasharray: 0.1 49.9");
    expect(ANIMATIONS_CSS).toContain("to { stroke-dashoffset: -50; }");
    expect(cssRule(".mire-animated .mire-orbit-turn")).toContain("mire-turn 1s linear");
    expect(cssRule(".mire-animated .mire-drops")).toContain("mire-drops 0.5s linear");
  });

  it("makes the keyboard of Heidrun faster with more working coding agents, and still with none", async () => {
    const graph = await mountGraph();
    state.snapshot = snapshotWith({ p2: { agent_status: "working" }, p3: { agent_status: "working" }, p4: { agent_status: "working" } });
    await flushPromises();
    expect(node(graph, "heidrun").get("[data-keyboard]").attributes("data-key-period-ms")).toBe("400");
    state.snapshot = snapshotWith({ p1: { agent_status: "idle" } });
    await flushPromises();
    expect(node(graph, "heidrun").get("[data-keyboard]").attributes("data-key-period-ms")).toBeUndefined();
    expect(node(graph, "heidrun").get("[data-keyboard]").classes()).not.toContain("mire-keyboard-active");
  });

  it("stops every animation with the pause button while the data keeps updating", async () => {
    const graph = await mountGraph();
    const button = graph.get("[data-mire-pause]");
    expect(button.text()).toBe("Pause");
    await button.trigger("click");
    expect(graph.get("svg").classes()).not.toContain("mire-animated");
    expect(graph.findAll("[data-orbit], [data-waves], [data-drops], [data-hexagon-glow]")).toHaveLength(0);
    expect(button.text()).toBe("Resume");
    state.snapshot = snapshotWith({ p1: { agent_status: "done" } });
    await flushPromises();
    expect(node(graph, TEST_NODES.claude).classes()).toContain("mire-status-finished");
    expect(graph.findAll("[data-effect]")).toHaveLength(0);
    await button.trigger("click");
    expect(graph.get("svg").classes()).toContain("mire-animated");
    expect(graph.findAll("[data-effect]")).toHaveLength(0);
  });

  it("starts paused when the system asks for reduced motion", async () => {
    mockReducedMotion(true);
    const graph = await mountGraph();
    expect(graph.get("svg").classes()).not.toContain("mire-animated");
    expect(graph.get("[data-mire-pause]").text()).toBe("Resume");
    expect(graph.findAll("[data-orbit]")).toHaveLength(0);
  });

  it("draws a single burst for a real completion, none at the first render, and removes it at the end of its animation", async () => {
    const graph = await mountGraph();
    expect(graph.findAll("[data-effect]")).toHaveLength(0);
    state.snapshot = snapshotWith({ p1: { agent_status: "done" } });
    await flushPromises();
    const bursts = graph.findAll('[data-effect="burst"]');
    expect(bursts.map((burst) => burst.attributes("data-effect-node-id"))).toEqual([TEST_NODES.claude]);
    await bursts[0].trigger("animationend");
    expect(graph.findAll("[data-effect]")).toHaveLength(0);
    state.snapshot = snapshotWith({ p1: { agent_status: "done" } });
    await flushPromises();
    expect(graph.findAll("[data-effect]")).toHaveLength(0);
  });

  it("draws a red flash for a new blocked item", async () => {
    const graph = await mountGraph();
    state.snapshot = snapshotWith({ p2: { agent_status: "blocked" } });
    await flushPromises();
    expect(graph.findAll('[data-effect="flash"]').map((flash) => flash.attributes("data-effect-node-id")))
      .toEqual([TEST_NODES.claudeNotObserved]);
  });

  it("travels only the new messages between resolved ends, dashed when queued and solid when received", async () => {
    const graph = await mountGraph();
    expect(graph.findAll("[data-effect]")).toHaveLength(0);
    mireState.observations = observationsWith(
      [message("m2", "a1", "s1"), message("m3", "s1", "a1", { delivery: "queued" })],
      [message("i2", "t1", "t1c", { text: null, contentAvailability: "not_exposed", delivery: "received" })],
    );
    await flushPromises();
    const travels = graph.findAll('[data-effect="travel"]');
    expect(travels.map((travel) => travel.attributes("data-delivery"))).toEqual(["received", "queued", "received"]);
    expect(travels[1].classes()).toContain("mire-delivery-queued");
    expect(travels[0].find("[data-arrival]").exists()).toBe(true);
    expect(travels[1].find("[data-arrival]").exists()).toBe(false);
    expect(travels[0].get("title").text()).toBe("Message: Olivier → Claude · Received · text m2");
    expect(travels[2].get("title").text()).toContain("Content not exposed by Codex.");
    expect(travels[2].get("title").text()).not.toContain("null");
  });

  it("marks only the resolved end of a message whose other end is unmatched, and never links by name", async () => {
    const graph = await mountGraph();
    mireState.observations = observationsWith([message("m2", "a1", "Explore"), message("m3", "peer-a", "peer-b")]);
    await flushPromises();
    expect(graph.findAll('[data-effect="travel"]')).toHaveLength(0);
    const ends = graph.findAll('[data-effect="end"]');
    expect(ends).toHaveLength(1);
    expect(ends[0].attributes("transform")).toBe(node(graph, TEST_NODES.olivier).find("[data-orbit]").attributes("transform"));
    expect(ends[0].get("title").text()).toContain("Explore (unmatched)");
  });

  it("never draws a line between two subagents with the same name in two workspaces", async () => {
    state.snapshot = snapshotWith({
      p4: { agent_session: { source: "herdr", agent: "codex", kind: "thread", value: "t2" } },
    });
    const observations = MireViewTestSupport.observations();
    observations.codex.threads.push(
      { ...observations.codex.threads[0], threadId: "t2", rootThreadId: "t2", interactions: [] },
      { ...observations.codex.threads[1], threadId: "t2c", parentThreadId: "t2", rootThreadId: "t2", nickname: "Olivier", activeFlags: [] },
    );
    mireState.observations = observations;
    mireState.nowMs = TEST_NOW_MS;
    wrapper = mount(MireGraph, { attachTo: document.body });
    await flushPromises();
    const sameName = MireModelBuilder.codexSubagentNodeId("t2c");
    expect(wrapper.find(`[data-node-id="${sameName}"]`).exists()).toBe(true);
    const links = wrapper.findAll(".mire-link").map((line) => [line.attributes("data-link-from"), line.attributes("data-link-to")]);
    expect(links.filter(([from, to]) => [from, to].includes(sameName))).toEqual([[MireModelBuilder.codingAgentNodeId({ terminal_id: "term4", agent: "codex" }), sameName]]);
    expect(links.filter(([from, to]) => [from, to].includes(TEST_NODES.olivier))).toEqual([[TEST_NODES.claude, TEST_NODES.olivier]]);
    expect(wrapper.findAll("[data-effect]")).toHaveLength(0);
  });

  it("leaves no timer and no effect after the unmount", async () => {
    vi.useFakeTimers();
    const graph = await mountGraph();
    state.snapshot = snapshotWith({ p1: { agent_status: "done" } });
    await flushPromises();
    expect(graph.findAll("[data-effect]")).toHaveLength(1);
    graph.unmount();
    wrapper = null;
    expect(vi.getTimerCount()).toBe(0);
    expect(mireAnimationState.effects).toEqual([]);
    state.snapshot = snapshotWith({ p1: { agent_status: "blocked" } });
    await flushPromises();
    expect(mireAnimationState.effects).toEqual([]);
  });
});
