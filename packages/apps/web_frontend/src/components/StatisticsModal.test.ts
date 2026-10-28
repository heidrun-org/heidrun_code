import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";

const invoke = vi.fn();

/** The channel of Tauri, which the tab "Work of one person" gives to the command `person_work_synchronize`. */
const { FakeChannel } = vi.hoisted(() => ({
  FakeChannel: class<T> {
    onmessage: (message: T) => void = () => {};
  },
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args), Channel: FakeChannel }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/** The calls that the chart makes to Plotly.js: jsdom cannot draw an SVG chart, so Plotly.js is replaced. */
const plotly = { react: vi.fn(), purge: vi.fn(), Plots: { resize: vi.fn() } };

/** The functions that the chart gave to Plotly.js for the events of the pointer: a test calls them as the pointer would. */
const plotlyHandlers: Record<string, (event: unknown) => void> = {};
vi.mock("plotly.js-basic-dist-min", () => ({ default: plotly }));

/** The tab "Work of one person" reads the repository of a workspace that is open: the test opens one workspace and selects it. */
vi.mock("../stores/user_activity", async (importOriginal) => {
  const { ref } = await import("vue");
  return {
    ...(await importOriginal<typeof import("../stores/user_activity")>()),
    selectedWorkspaceFolder: ref("/work/heidrun"),
    selectedWorkspaceId: ref("workspace-1"),
    openWorkspaces: ref([{ workspaceId: "workspace-1", label: "heidrun", folder: "/work/heidrun" }]),
  };
});

/** What one call to `Plotly.react` drew. */
type Drawing = {
  data: { type: string; x: number[]; y: number[] };
  layout: { yaxis: { range?: number[]; autorange?: boolean } };
};

/** Waits until the chart has called Plotly.js this number of times: the chart loads Plotly.js after it mounts. */
async function waitForDrawings(drawingCount: number): Promise<void> {
  await vi.waitFor(() => expect(plotly.react).toHaveBeenCalledTimes(drawingCount));
}

/** The last drawing that the chart gave to Plotly.js. */
function lastDrawing(): Drawing {
  const call = plotly.react.mock.calls[plotly.react.mock.calls.length - 1];
  return { data: call[1][0], layout: call[2] };
}

/** The sum of the heights of the bars of a drawing. */
function sumOfBars(drawing: Drawing): number {
  return drawing.data.y.reduce((total, value) => total + value, 0);
}

/** The calls that asked the data layer for the records: the other stores also call `invoke` when they load. */
function recordRangeCalls(): unknown[][] {
  return invoke.mock.calls.filter((call) => call[0] === "user_activity_records_in_range");
}

/** The functions that the chart gave to the observer of its size: a test calls them to change the size. */
const resizeCallbacks: Array<() => void> = [];

/** Mounts the window with the records that the data layer gives. */
async function mountStatisticsModal(records: unknown[] | Error) {
  invoke.mockReset();
  if (records instanceof Error) {
    invoke.mockRejectedValue(records);
  } else {
    invoke.mockResolvedValue(records);
  }
  const { statisticsModal, openStatisticsModal } = await import("../stores/statistics_modal");
  const { default: StatisticsModal } = await import("./StatisticsModal.vue");
  openStatisticsModal();
  const wrapper = mount(StatisticsModal, { attachTo: document.body });
  await flushPromises();
  return { wrapper, statisticsModal };
}

/** Clicks the radio button of a time range, and waits for the next drawing of the chart. */
async function chooseRange(wrapper: VueWrapper, rangeId: "day" | "week" | "month", drawingCount: number): Promise<void> {
  await wrapper.get(`#statistics-range-${rangeId}`).setValue(true);
  await waitForDrawings(drawingCount);
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.useRealTimers();
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: () => {} }));
  resizeCallbacks.length = 0;
  plotly.Plots.resize.mockReset();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  for (const name of Object.keys(plotlyHandlers)) {
    delete plotlyHandlers[name];
  }
  plotly.react.mockReset();
  plotly.react.mockImplementation((element: { on?: unknown }) => {
    element.on = (name: string, callback: (event: unknown) => void) => {
      plotlyHandlers[name] = callback;
    };
  });
  plotly.purge.mockReset();
  document.body.innerHTML = "";
});

describe("StatisticsModal", () => {
  it("has the title Statistics and a close button", async () => {
    const { wrapper } = await mountStatisticsModal([]);
    expect(wrapper.get(".dialog-title").text()).toBe("Statistics");
    expect(wrapper.find("button[aria-label='Close (Escape)']").exists()).toBe(true);
  });

  it("has two tabs, User activity and Work of one person, built as a Bootstrap button group in the title bar, and User activity is the selected tab", async () => {
    const { wrapper } = await mountStatisticsModal([]);
    const tabList = wrapper.get('[role="tablist"]');
    expect(tabList.classes()).toContain("btn-group");
    expect(tabList.attributes("aria-label")).toBe("Kinds of statistics");
    expect(wrapper.get(".dialog-header").find('[role="tablist"]').exists()).toBe(true);
    expect(wrapper.get(".dialog-body").find('[role="tablist"]').exists()).toBe(false);
    expect(wrapper.find(".nav-tabs").exists()).toBe(false);
    expect(wrapper.find(".nav-pills").exists()).toBe(false);
    const tabs = tabList.findAll('[role="tab"]');
    expect(tabs.map((tab) => tab.text())).toEqual(["User activity", "Work of one person"]);
    for (const tab of tabs) {
      expect(tab.classes()).toEqual(expect.arrayContaining(["btn", "btn-sm", "btn-outline", "theme-secondary"]));
      expect(tab.element.parentElement).toBe(tabList.element);
    }
    expect(tabs.map((tab) => tab.attributes("aria-selected"))).toEqual(["true", "false"]);
    expect(tabs[0].classes()).toContain("active");
    expect(tabs[1].classes()).not.toContain("active");
    const panes = wrapper.findAll('[role="tabpanel"]');
    expect(panes).toHaveLength(2);
    expect(panes[0].classes()).toEqual(expect.arrayContaining(["tab-pane", "active"]));
    expect(panes[1].classes()).not.toContain("active");
    for (const [index, pane] of panes.entries()) {
      expect(pane.attributes("id")).toBe(tabs[index].attributes("aria-controls"));
      expect(pane.attributes("aria-labelledby")).toBe(tabs[index].attributes("id"));
    }
  });

  it("takes the whole screen: a Bootstrap full screen dialog, with no margin, no border, and the whole height", async () => {
    const { wrapper } = await mountStatisticsModal([]);
    const dialog = wrapper.get("dialog");
    expect(dialog.classes()).toContain("dialog-fullscreen");
    expect(dialog.classes()).not.toContain("dialog-xl");
    expect(dialog.attributes("style")).toContain("height: 100vh");
    expect(dialog.attributes("style")).not.toContain("--dialog-width");
  });

  it("does not close when the pointer is pressed outside the dialog, because the dialog has no outside", async () => {
    const { wrapper, statisticsModal } = await mountStatisticsModal([]);
    await wrapper.get(".overlay").trigger("mousedown");
    expect(statisticsModal.open).toBe(true);
  });

  it("has a thin title bar: the title at the left, then at the right the two tab buttons and a small close button", async () => {
    const { wrapper } = await mountStatisticsModal([]);
    const header = wrapper.get(".dialog-header");
    expect(header.attributes("style")).toContain("--dialog-header-padding");
    expect(header.attributes("style")).toContain("0.375rem 84px");
    const children = Array.from(header.element.children);
    expect(children[0].classList.contains("dialog-title")).toBe(true);
    expect(children[0].classList.contains("me-auto")).toBe(true);
    expect(children[1].getAttribute("role")).toBe("tablist");
    expect(children[2].getAttribute("aria-label")).toBe("Close (Escape)");
    expect(children[2].classList.contains("btn-sm")).toBe(true);
    expect(children[2].classList.contains("fs-4")).toBe(false);
  });

  it("shows a card with the look of an information card under each tab button when the pointer stays over it, and hides it when the pointer leaves", async () => {
    const { wrapper } = await mountStatisticsModal([]);
    const tabs = wrapper.get('[role="tablist"]').findAll('[role="tab"]');
    const card = () => document.body.querySelector(".popover");
    const blocksOf = () => Array.from(card()?.querySelectorAll("[data-help-block]") ?? []).map((block) => block.querySelector(".fw-medium")?.textContent);
    expect(card()).toBeNull();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await tabs[0].trigger("pointerenter");
    await vi.advanceTimersByTimeAsync(100);
    expect(card()).toBeNull();
    await vi.advanceTimersByTimeAsync(1400);
    await flushPromises();
    expect(card()?.querySelector(".list-group-item")?.textContent?.trim()).toBe("User activity");
    expect(blocksOf()).toEqual(["What it is", "How it works"]);
    expect(card()?.querySelector(".tooltip")).toBeNull();
    expect(tabs[0].attributes("aria-describedby")).toBe(card()?.getAttribute("id"));
    await tabs[0].trigger("pointerleave");
    expect(card()).toBeNull();
    expect(tabs[0].attributes("aria-describedby")).toBeUndefined();
    await tabs[1].trigger("pointerenter");
    await vi.advanceTimersByTimeAsync(1600);
    await flushPromises();
    vi.useRealTimers();
    expect(card()?.querySelector(".list-group-item")?.textContent?.trim()).toBe("Work of one person");
    expect(blocksOf()).toEqual(["What it is", "Git history", "AI cost"]);
  });

  it("reads the work of the people only when the tab Work of one person is shown, and only once while the window stays open", async () => {
    const { wrapper } = await mountStatisticsModal([]);
    const noWork = { repository: "heidrun-org/heidrun", commits: [], pullRequests: [], issues: [], codeHostingError: null };
    invoke.mockImplementation(async (command: string) => (command === "person_work_in_range" ? noWork : []));
    const personWorkCalls = () => invoke.mock.calls.filter((call) => call[0] === "person_work_in_range");
    expect(personWorkCalls()).toHaveLength(0);
    const tabs = wrapper.findAll('[role="tab"]');
    await tabs[1].trigger("click");
    await flushPromises();
    expect(tabs[1].classes()).toContain("active");
    expect(wrapper.findAll('[role="tabpanel"]')[1].classes()).toContain("active");
    expect(personWorkCalls()).toHaveLength(1);
    await tabs[0].trigger("click");
    await tabs[1].trigger("click");
    await flushPromises();
    expect(personWorkCalls()).toHaveLength(1);
  });

  it("has a Bootstrap radio button group with Last day, Last week, and Last month, and Last day is chosen at first", async () => {
    const { wrapper } = await mountStatisticsModal([]);
    const group = wrapper.get('.btn-group[aria-label="Time range"]');
    const buttons = group.findAll("label.btn-check.btn-outline.theme-secondary");
    expect(buttons.map((button) => button.text())).toEqual(["Last day", "Last week", "Last month"]);
    for (const button of buttons) {
      expect(button.attributes("title")).not.toBe("");
      expect(button.get("input").attributes("type")).toBe("radio");
    }
    const checked = buttons.map((button) => (button.get("input").element as HTMLInputElement).checked);
    expect(checked).toEqual([true, false, false]);
  });

  it("reads the records of the last month through the data layer each time that it opens", async () => {
    const first = await mountStatisticsModal([]);
    expect(recordRangeCalls()).toHaveLength(1);
    const { since, until } = recordRangeCalls()[0][1] as { since: string; until: string };
    const range = Date.parse(until) - Date.parse(since);
    expect(range).toBeGreaterThanOrEqual(29 * 24 * 3_600_000 - 3_600_000);
    expect(range).toBeLessThanOrEqual(30 * 24 * 3_600_000 + 3_600_000);
    first.wrapper.unmount();
    vi.resetModules();
    await mountStatisticsModal([]);
    expect(recordRangeCalls()).toHaveLength(1);
  });

  it("draws one histogram at first, the last day: twenty-four bars, and a vertical axis in minutes that fits the highest bar", async () => {
    await mountStatisticsModal([]);
    await waitForDrawings(1);
    const drawing = lastDrawing();
    expect(drawing.data.type).toBe("bar");
    expect(drawing.data.x).toHaveLength(24);
    expect(drawing.layout.yaxis.range).toEqual([0, 5]);
    expect(drawing.layout.yaxis.autorange).toBe(false);
    expect(plotly.react).toHaveBeenCalledTimes(1);
  });

  it("draws the last week when Last week is chosen: seven bars, and a vertical axis in hours that fits the highest bar", async () => {
    const { wrapper } = await mountStatisticsModal([]);
    await waitForDrawings(1);
    await chooseRange(wrapper, "week", 2);
    const drawing = lastDrawing();
    expect(drawing.data.x).toHaveLength(7);
    expect(drawing.layout.yaxis.autorange).toBe(false);
    expect(drawing.layout.yaxis.range).toEqual([0, 1]);
  });

  it("draws the last month when Last month is chosen: thirty bars, and a vertical axis in hours that fits the highest bar", async () => {
    const { wrapper } = await mountStatisticsModal([]);
    await waitForDrawings(1);
    await chooseRange(wrapper, "month", 2);
    const drawing = lastDrawing();
    expect(drawing.data.x).toHaveLength(30);
    expect(drawing.layout.yaxis.autorange).toBe(false);
    expect(drawing.layout.yaxis.range).toEqual([0, 1]);
  });

  it("gives the same period to the three time ranges, in minutes for the last day, and in hours for the last week and the last month", async () => {
    const now = Date.now();
    const record = { workspaceFolder: "/work/heidrun", startedAt: new Date(now - 60_000).toISOString(), endedAt: new Date(now - 30_000).toISOString() };
    const { wrapper } = await mountStatisticsModal([record]);
    await waitForDrawings(1);
    expect(sumOfBars(lastDrawing())).toBeCloseTo(0.5, 5);
    await chooseRange(wrapper, "week", 2);
    expect(sumOfBars(lastDrawing())).toBeCloseTo(0.5 / 60, 5);
    await chooseRange(wrapper, "month", 3);
    expect(sumOfBars(lastDrawing())).toBeCloseTo(0.5 / 60, 5);
    await chooseRange(wrapper, "day", 4);
    expect(sumOfBars(lastDrawing())).toBeCloseTo(0.5, 5);
  });

  it("shows the tooltip of the last day with the start, the end, and the minutes and seconds, and the tooltip of the last week with the day, the hours, and the minutes", async () => {
    const now = Date.now();
    const record = { workspaceFolder: "/work/heidrun", startedAt: new Date(now - 3_600_000).toISOString(), endedAt: new Date(now - 60_000).toISOString() };
    const { wrapper } = await mountStatisticsModal([record]);
    await waitForDrawings(1);
    plotlyHandlers.plotly_hover({ points: [{ pointNumber: 3 }], event: { clientX: 100, clientY: 50 } });
    await flushPromises();
    expect(wrapper.get('[role="tooltip"] .fw-semibold').text()).toMatch(/^.+ to .+$/);
    expect(wrapper.get('[role="tooltip"] [data-field="total"] span:last-child').text()).toMatch(/^\d+ min \d+ s$/);
    await chooseRange(wrapper, "week", 2);
    expect(wrapper.find('[role="tooltip"]').exists()).toBe(false);
    plotlyHandlers.plotly_hover({ points: [{ pointNumber: 3 }], event: { clientX: 100, clientY: 50 } });
    await flushPromises();
    expect(wrapper.get('[role="tooltip"] .fw-semibold').text()).not.toContain(" to ");
    expect(wrapper.get('[role="tooltip"] [data-field="total"] span:last-child').text()).toMatch(/^\d+ h \d+ min$/);
  });

  it("draws the chart again at its new size when the window changes size", async () => {
    await mountStatisticsModal([]);
    await waitForDrawings(1);
    expect(resizeCallbacks).toHaveLength(1);
    resizeCallbacks[0]();
    expect(plotly.Plots.resize).toHaveBeenCalledTimes(1);
  });

  it("draws the chart again when the theme changes", async () => {
    const { settings } = await import("../stores/settings");
    await mountStatisticsModal([]);
    await waitForDrawings(1);
    settings.theme = settings.theme === "dark" ? "light" : "dark";
    await vi.waitFor(() => expect(plotly.react.mock.calls.length).toBeGreaterThan(1));
  });

  it("shows an error message when the records cannot be read", async () => {
    const { wrapper } = await mountStatisticsModal(new Error("no data layer"));
    expect(wrapper.get(".alert-danger").text()).toContain("no data layer");
    expect(plotly.react).not.toHaveBeenCalled();
  });

  it("closes when the key Escape is pressed and when the close button is clicked", async () => {
    const { wrapper, statisticsModal } = await mountStatisticsModal([]);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(statisticsModal.open).toBe(false);
    statisticsModal.open = true;
    await wrapper.get("button[aria-label='Close (Escape)']").trigger("click");
    expect(statisticsModal.open).toBe(false);
  });
});

describe("StatisticsModal: the memory of the selections (issue 707)", () => {
  /** The texts of the buttons that are checked in a group of toggle buttons. */
  function checkedTexts(root: Pick<VueWrapper, "get">, groupLabel: string): string[] {
    return root
      .get(`[role="group"][aria-label="${groupLabel}"]`)
      .findAll("label.btn-check")
      .filter((button) => (button.get("input").element as HTMLInputElement).checked)
      .map((button) => button.text());
  }

  it("keeps the slot length of the tab User activity when the window is closed and opened again", async () => {
    const first = await mountStatisticsModal([]);
    await first.wrapper.get("#statistics-slot-fifteen_minutes").setValue(true);
    first.wrapper.unmount();
    plotly.react.mockClear();
    const second = await mountStatisticsModal([]);
    expect(checkedTexts(second.wrapper, "Slot length")).toEqual(["15 minutes"]);
    await waitForDrawings(1);
    expect(lastDrawing().data.x).toHaveLength(96);
  });

  it("keeps the selections of the tab Work of one person, and of the tab User activity apart, when the window is closed and opened again", async () => {
    const noWork = { repository: "heidrun-org/heidrun", commits: [], pullRequests: [], issues: [], codeHostingError: null };
    const first = await mountStatisticsModal([]);
    invoke.mockImplementation(async (command: string) => (command === "person_work_in_range" ? noWork : []));
    await first.wrapper.get("#statistics-range-week").setValue(true);
    await first.wrapper.findAll('[role="tab"]')[1].trigger("click");
    await flushPromises();
    await first.wrapper.get("#statistics-person-period-thirty_days").setValue(true);
    await first.wrapper.get("#statistics-person-slot-6").setValue(true);
    first.wrapper.unmount();
    const second = await mountStatisticsModal([]);
    invoke.mockImplementation(async (command: string) => (command === "person_work_in_range" ? noWork : []));
    await second.wrapper.findAll('[role="tab"]')[1].trigger("click");
    await flushPromises();
    const userActivityPane = second.wrapper.get("#statistics-tab-user_activity-pane");
    const personWorkPane = second.wrapper.get("#statistics-tab-person_work-pane");
    expect(checkedTexts(userActivityPane, "Time range")).toEqual(["Last week"]);
    expect(checkedTexts(userActivityPane, "Slot length")).toEqual(["1 day"]);
    expect(checkedTexts(personWorkPane, "Time range")).toEqual(["30 days"]);
    expect(checkedTexts(personWorkPane, "Slot length")).toEqual(["6 hours"]);
  });
});
