import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

import HeidrunCodeDashboardCounters from "./HeidrunCodeDashboardCounters.vue";
import { state } from "../../stores/session";
import { heidrunCodeDashboardState } from "../../stores/heidrun_code_dashboard/heidrun_code_dashboard_store";
import { HeidrunCodeDashboardViewTestSupport, TEST_NOW_MS } from "./heidrun_code_dashboard_view_test_support";

let wrapper: VueWrapper | null = null;

/** Mounts the counters with the test snapshot and the test observations. */
function mountCounters(): VueWrapper {
  state.snapshot = HeidrunCodeDashboardViewTestSupport.snapshot();
  heidrunCodeDashboardState.observations = HeidrunCodeDashboardViewTestSupport.observations();
  heidrunCodeDashboardState.nowMs = TEST_NOW_MS;
  wrapper = mount(HeidrunCodeDashboardCounters);
  return wrapper;
}

/** The numbers of the counters, by status. */
function counts(counters: VueWrapper): Record<string, string> {
  const result: Record<string, string> = {};
  for (const button of counters.findAll("[data-filter]")) {
    result[button.attributes("data-filter") as string] = button.get("[data-count]").text();
  }
  return result;
}

beforeEach(() => {
  heidrunCodeDashboardState.filter = null;
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  state.snapshot = null;
  heidrunCodeDashboardState.observations = null;
});

describe("HeidrunCodeDashboardCounters", () => {
  it("counts each coding agent and each subagent once, by status, with a text next to each color", () => {
    const counters = mountCounters();
    expect(counts(counters)).toEqual({ working: "2", blocked: "2", finished: "2", idle: "1", unknown: "0" });
    expect(counters.get('[data-filter="working"] [data-detail]').text()).toBe("Coding agents: 1 · subagents: 1");
    expect(counters.get('[data-filter="blocked"]').text()).toContain("Blocked");
  });

  it("filters with a click, keeps the totals, and clears the filter with a second click or with All", async () => {
    const counters = mountCounters();
    const before = counts(counters);
    await counters.get('[data-filter="working"]').trigger("click");
    expect(heidrunCodeDashboardState.filter).toBe("working");
    expect(counters.get('[data-filter="working"]').attributes("aria-pressed")).toBe("true");
    expect(counters.get("[data-filter-state]").text()).toBe("Filter: Working");
    expect(counts(counters)).toEqual(before);
    await counters.get('[data-filter="working"]').trigger("click");
    expect(heidrunCodeDashboardState.filter).toBeNull();
    await counters.get('[data-filter="blocked"]').trigger("click");
    expect(heidrunCodeDashboardState.filter).toBe("blocked");
    await counters.get("[data-filter-all]").trigger("click");
    expect(heidrunCodeDashboardState.filter).toBeNull();
    expect(counters.get("[data-filter-all]").attributes("aria-pressed")).toBe("true");
  });
});
