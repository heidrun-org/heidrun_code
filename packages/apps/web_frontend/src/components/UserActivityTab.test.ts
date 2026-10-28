import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({ invoke: (...args: unknown[]) => invoke(...args) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/** The calls that the chart makes to Plotly.js: jsdom cannot draw an SVG chart, so Plotly.js is replaced. */
const plotly = { react: vi.fn(), purge: vi.fn(), Plots: { resize: vi.fn() } };

/** The functions that the chart gave to Plotly.js for the events of the pointer: a test calls them as the pointer would. */
const plotlyHandlers: Record<string, (event: unknown) => void> = {};
vi.mock("plotly.js-basic-dist-min", () => ({ default: plotly }));

/** The chart reads each color from the theme: the test reads the name of the CSS variable of each color instead. */
vi.mock("../lib/chart_theme", () => ({ ChartTheme: { readColor: (token: string) => token } }));

/** One trace of Plotly.js: one part of each stacked bar. */
type Trace = { type: string; name: string; x: number[]; y: number[]; hoverinfo: string; marker: { color: string } };

/** What one call to `Plotly.react` drew. */
type Drawing = {
  data: Trace;
  traces: Trace[];
  layout: {
    barmode: string;
    showlegend: boolean;
    legend: { orientation: string; itemclick: unknown; itemdoubleclick: unknown };
    yaxis: { range?: number[]; autorange?: boolean; title: { text: string } };
    xaxis: { tickvals: number[]; ticktext: string[]; title: { text: string } };
  };
};

/** The one hour, in milliseconds. */
const HOUR_MS = 3_600_000;

/** The folder of the workspace that is open, and the folder of a workspace that is closed. */
const OPEN_FOLDER = "/work/heidrun";
const CLOSED_FOLDER = "/work/old_experiment";
const OPEN_WORKSPACES = [
  { workspace_id: "w1", number: 1, label: "Heidrun app", workspace_folder: OPEN_FOLDER },
  { workspace_id: "w2", number: 2, label: "old_experiment", workspace_folder: CLOSED_FOLDER },
];

/** Waits until the chart has called Plotly.js this number of times: the chart loads Plotly.js after it mounts. */
async function waitForDrawings(drawingCount: number): Promise<void> {
  await vi.waitFor(() => expect(plotly.react).toHaveBeenCalledTimes(drawingCount));
}

/** The last drawing that the chart gave to Plotly.js. */
function lastDrawing(): Drawing {
  const call = plotly.react.mock.calls[plotly.react.mock.calls.length - 1];
  return { data: call[1][0], traces: call[1], layout: call[2] };
}

/** The sum of the heights of the bars of a drawing, with all the parts of the stacked bars. */
function sumOfBars(): number {
  return lastDrawing().traces.reduce((total, trace) => total + trace.y.reduce((sum, value) => sum + value, 0), 0);
}

/** A record of an active period that ended `startedAgoMs` ago and lasted `durationMs`, in one workspace. */
function recordOf(workspaceFolder: string, startedAgoMs: number, durationMs: number) {
  const startedAt = Date.now() - startedAgoMs;
  return {
    workspaceFolder,
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(startedAt + durationMs).toISOString(),
  };
}

/**
 * Moves the pointer onto the bar of a slot, as Plotly.js tells the chart, and waits for the tooltip.
 *
 * @param slotIndex - The index of the slot, from the oldest slot.
 * @param pointer - The place of the pointer in the window, in pixels.
 */
async function hoverSlot(slotIndex: number, pointer = { x: 100, y: 50 }): Promise<void> {
  plotlyHandlers.plotly_hover({ points: [{ pointNumber: slotIndex }], event: { clientX: pointer.x, clientY: pointer.y } });
  await flushPromises();
}

/** The index of the first slot of the last drawing that has user activity time. */
function firstSlotWithTime(): number {
  return lastDrawing().traces.reduce((first, trace) => {
    const index = trace.y.findIndex((value) => value > 0);
    return index === -1 ? first : Math.min(first, index);
  }, Number.POSITIVE_INFINITY);
}

/** What the tooltip shows: the title, the total, and the name and the time of each workspace row. */
function tooltipOf(wrapper: VueWrapper) {
  const tooltip = wrapper.find('[role="tooltip"]');
  if (tooltip.exists() === false) {
    return null;
  }
  return {
    title: tooltip.get(".fw-semibold").text(),
    total: tooltip.get('[data-field="total"] span:last-child').text(),
    rows: tooltip.findAll('[data-field="row"]').map((row) => [row.element.children[0].textContent?.trim(), row.element.children[1].textContent]),
  };
}

/** The functions that the chart gave to the observer of its size. */
const resizeCallbacks: Array<() => void> = [];

/**
 * Mounts the tab with the records that the data layer gives, and one workspace that is open.
 *
 * @param records - The records that the data layer gives, or the error that it gives.
 * @param runningPeriodStartedAgoMs - How long ago the active period that runs now started, or `null` when no period runs.
 * @param openWorkspaceList - The workspaces that Heidrun Code currently has open.
 */
async function mountUserActivityTab(
  records: unknown[] | Error | Promise<never>,
  runningPeriodStartedAgoMs: number | null = null,
  openWorkspaceList = OPEN_WORKSPACES,
) {
  invoke.mockReset();
  if (records instanceof Error) {
    invoke.mockRejectedValue(records);
  } else if (records instanceof Promise) {
    invoke.mockReturnValue(records);
  } else {
    invoke.mockResolvedValue(records);
  }
  const { state } = await import("../stores/session");
  state.snapshot = {
    workspaces: openWorkspaceList,
    tabs: [],
    panes: [],
    agents: [],
  } as never;
  const stores = await import("../stores/user_activity");
  stores.activePeriodStartedAt.value = runningPeriodStartedAgoMs === null ? null : Date.now() - runningPeriodStartedAgoMs;
  const { default: UserActivityTab } = await import("./UserActivityTab.vue");
  const wrapper = mount(UserActivityTab, { attachTo: document.body });
  await flushPromises();
  return { wrapper };
}

/** The buttons of a group of toggle buttons, with their text and their state. */
function buttonsOf(wrapper: VueWrapper, groupLabel: string) {
  const group = wrapper.get(`[role="group"][aria-label="${groupLabel}"]`);
  return group.findAll("label.btn-check").map((button) => ({
    text: button.text(),
    isChecked: (button.get("input").element as HTMLInputElement).checked,
    input: button.get("input"),
  }));
}

/** Clicks a radio button of the group of the slot length, and waits for the next drawing of the chart. */
async function chooseSlotLength(wrapper: VueWrapper, slotLengthId: string, drawingCount: number): Promise<void> {
  await wrapper.get(`#statistics-slot-${slotLengthId}`).setValue(true);
  await waitForDrawings(drawingCount);
}

/**
 * The workspace that runs the active period is the selected workspace: the test selects the folder of a workspace. A mock
 * that `vi.mock` builds once stays tied to the session store of the first test after `vi.resetModules`, so its list of the
 * open workspaces never changes. Each test registers the mock again, and gets a list tied to its own session store.
 */
beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.doMock("../stores/user_activity", async (importOriginal) => {
    const { ref } = await import("vue");
    return { ...(await importOriginal<typeof import("../stores/user_activity")>()), selectedWorkspaceFolder: ref("/work/heidrun") };
  });
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

describe("UserActivityTab: the slot length", () => {
  it("has a Bootstrap radio button group of slot lengths for each time range, with the default slot length chosen", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    expect(buttonsOf(wrapper, "Slot length").map((button) => [button.text, button.isChecked])).toEqual([
      ["15 minutes", false],
      ["30 minutes", false],
      ["1 hour", true],
    ]);
    await wrapper.get("#statistics-range-week").setValue(true);
    expect(buttonsOf(wrapper, "Slot length").map((button) => [button.text, button.isChecked])).toEqual([
      ["1 hour", false],
      ["6 hours", false],
      ["1 day", true],
    ]);
    await wrapper.get("#statistics-range-month").setValue(true);
    expect(buttonsOf(wrapper, "Slot length").map((button) => [button.text, button.isChecked])).toEqual([
      ["6 hours", false],
      ["1 day", true],
    ]);
    for (const button of buttonsOf(wrapper, "Slot length")) {
      expect(button.input.attributes("type")).toBe("radio");
    }
  });

  it("draws twenty-four bars of one hour at first, then ninety-six bars of fifteen minutes and forty-eight bars of thirty minutes for the last day", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await waitForDrawings(1);
    expect(lastDrawing().data.x).toHaveLength(24);
    expect(lastDrawing().layout.yaxis.range).toEqual([0, 5]);
    expect(lastDrawing().layout.yaxis.title.text).toBe("Minutes of activity in a slot of 1 hour");
    await chooseSlotLength(wrapper, "fifteen_minutes", 2);
    expect(lastDrawing().data.x).toHaveLength(96);
    expect(lastDrawing().layout.yaxis.range).toEqual([0, 5]);
    expect(lastDrawing().layout.yaxis.title.text).toBe("Minutes of activity in a slot of 15 minutes");
    await chooseSlotLength(wrapper, "thirty_minutes", 3);
    expect(lastDrawing().data.x).toHaveLength(48);
    expect(lastDrawing().layout.yaxis.range).toEqual([0, 5]);
    expect(lastDrawing().layout.yaxis.title.text).toBe("Minutes of activity in a slot of 30 minutes");
  });

  it("draws one hundred sixty-eight bars of one hour and twenty-eight bars of six hours for the last week", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await waitForDrawings(1);
    await wrapper.get("#statistics-range-week").setValue(true);
    await waitForDrawings(2);
    await chooseSlotLength(wrapper, "one_hour", 3);
    expect(lastDrawing().data.x).toHaveLength(168);
    expect(lastDrawing().layout.yaxis.range).toEqual([0, 5]);
    expect(lastDrawing().layout.yaxis.title.text).toBe("Minutes of activity in a slot of 1 hour");
    await chooseSlotLength(wrapper, "six_hours", 4);
    expect(lastDrawing().data.x).toHaveLength(28);
    expect(lastDrawing().layout.yaxis.range).toEqual([0, 1]);
    expect(lastDrawing().layout.yaxis.title.text).toBe("Hours of activity in a slot of 6 hours");
  });

  it("draws thirty bars of one day at first, and one hundred twenty bars of six hours, for the last month", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await waitForDrawings(1);
    await wrapper.get("#statistics-range-month").setValue(true);
    await waitForDrawings(2);
    expect(lastDrawing().data.x).toHaveLength(30);
    expect(lastDrawing().layout.yaxis.autorange).toBe(false);
    expect(lastDrawing().layout.yaxis.range).toEqual([0, 1]);
    expect(lastDrawing().layout.yaxis.title.text).toBe("Hours of activity in a slot of 1 day");
    await chooseSlotLength(wrapper, "six_hours", 3);
    expect(lastDrawing().data.x).toHaveLength(120);
    expect(lastDrawing().layout.yaxis.range).toEqual([0, 1]);
    expect(lastDrawing().layout.yaxis.title.text).toBe("Hours of activity in a slot of 6 hours");
    await chooseSlotLength(wrapper, "one_day", 4);
    expect(lastDrawing().data.x).toHaveLength(30);
  });

  it("goes back to the default slot length of a time range each time that the time range changes", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await waitForDrawings(1);
    await chooseSlotLength(wrapper, "thirty_minutes", 2);
    await wrapper.get("#statistics-range-week").setValue(true);
    expect(buttonsOf(wrapper, "Slot length").map((button) => button.isChecked)).toEqual([false, false, true]);
    await waitForDrawings(3);
    expect(lastDrawing().data.x).toHaveLength(7);
    await chooseSlotLength(wrapper, "six_hours", 4);
    await wrapper.get("#statistics-range-month").setValue(true);
    expect(buttonsOf(wrapper, "Slot length").map((button) => button.isChecked)).toEqual([false, true]);
    await waitForDrawings(5);
    expect(lastDrawing().data.x).toHaveLength(30);
    await wrapper.get("#statistics-range-day").setValue(true);
    expect(buttonsOf(wrapper, "Slot length").map((button) => button.isChecked)).toEqual([false, false, true]);
    await waitForDrawings(6);
    expect(lastDrawing().data.x).toHaveLength(24);
  });

  it("gives the same total of user activity time to every slot length of the last day", async () => {
    const { wrapper } = await mountUserActivityTab([recordOf(OPEN_FOLDER, 20 * 60_000, 4 * 60_000 + 30_000)]);
    await waitForDrawings(1);
    expect(sumOfBars()).toBeCloseTo(4.5, 5);
    await chooseSlotLength(wrapper, "thirty_minutes", 2);
    expect(sumOfBars()).toBeCloseTo(4.5, 5);
    await chooseSlotLength(wrapper, "fifteen_minutes", 3);
    expect(sumOfBars()).toBeCloseTo(4.5, 5);
  });

  it("labels the horizontal axis with at most thirteen labels, and labels the days of the last week with slots of one hour", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await waitForDrawings(1);
    await wrapper.get("#statistics-range-week").setValue(true);
    await chooseSlotLength(wrapper, "one_hour", 3);
    const { tickvals, ticktext } = lastDrawing().layout.xaxis;
    expect(tickvals.length).toBeLessThanOrEqual(13);
    expect(tickvals).toHaveLength(ticktext.length);
    expect(tickvals.length).toBeGreaterThanOrEqual(6);
    expect(lastDrawing().layout.xaxis.title.text).toBe("Start of the slot");
  });

  it("labels every third day of the last month, with ten labels for slots of one day and for slots of six hours", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await waitForDrawings(1);
    await wrapper.get("#statistics-range-month").setValue(true);
    await waitForDrawings(2);
    expect(lastDrawing().layout.xaxis.tickvals).toHaveLength(10);
    expect(lastDrawing().layout.xaxis.tickvals[9]).toBe(29);
    expect(lastDrawing().layout.xaxis.title.text).toBe("Day");
    await chooseSlotLength(wrapper, "six_hours", 3);
    expect(lastDrawing().layout.xaxis.tickvals).toHaveLength(10);
    expect(lastDrawing().layout.xaxis.tickvals).toHaveLength(lastDrawing().layout.xaxis.ticktext.length);
    expect(lastDrawing().layout.xaxis.title.text).toBe("Start of the slot");
  });

  it("writes the day and the clock in the tooltip of a slot of six hours of the last month", async () => {
    const { wrapper } = await mountUserActivityTab([recordOf(OPEN_FOLDER, 2 * HOUR_MS, 30 * 60_000)]);
    await waitForDrawings(1);
    await wrapper.get("#statistics-range-month").setValue(true);
    await chooseSlotLength(wrapper, "six_hours", 3);
    await hoverSlot(firstSlotWithTime());
    expect(tooltipOf(wrapper)?.title).toMatch(/^.+, .+ to .+$/);
    expect(tooltipOf(wrapper)?.total).toMatch(/^\d+ h \d+ min$/);
  });

  it("writes the day and the clock in the tooltip of a slot of one hour of the last week, and the hours in the tooltip of a slot of six hours", async () => {
    const { wrapper } = await mountUserActivityTab([recordOf(OPEN_FOLDER, 2 * HOUR_MS, 30 * 60_000)]);
    await waitForDrawings(1);
    await wrapper.get("#statistics-range-week").setValue(true);
    await chooseSlotLength(wrapper, "one_hour", 3);
    await hoverSlot(firstSlotWithTime());
    expect(tooltipOf(wrapper)?.title).toMatch(/^.+, .+ to .+$/);
    expect(tooltipOf(wrapper)?.total).toMatch(/^\d+ min \d+ s$/);
    await chooseSlotLength(wrapper, "six_hours", 4);
    await hoverSlot(firstSlotWithTime());
    expect(tooltipOf(wrapper)?.title).toMatch(/^.+ to .+$/);
    expect(tooltipOf(wrapper)?.total).toMatch(/^\d+ h \d+ min$/);
  });

  it("reads the data layer only once for all the choices, from the start of the oldest slot of any choice", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await waitForDrawings(1);
    await chooseSlotLength(wrapper, "thirty_minutes", 2);
    await wrapper.get("#statistics-range-week").setValue(true);
    await chooseSlotLength(wrapper, "six_hours", 4);
    const calls = invoke.mock.calls.filter((call) => call[0] === "user_activity_records_in_range");
    expect(calls).toHaveLength(1);
    const { since, until } = calls[0][1] as { since: string; until: string };
    expect(Date.parse(until) - Date.parse(since)).toBeGreaterThanOrEqual(713 * HOUR_MS);
  });
});

describe("UserActivityTab: the workspaces", () => {
  const records = () => [
    recordOf(OPEN_FOLDER, 30 * 60_000, 3 * 60_000),
    recordOf(CLOSED_FOLDER, 20 * 60_000, 2 * 60_000),
    recordOf(OPEN_FOLDER, 10 * 60_000, 60_000),
  ];

  it("has a radio button group with All and None, then a group with a checkbox button for each workspace, all chosen at first", async () => {
    const { wrapper } = await mountUserActivityTab(records());
    const every = buttonsOf(wrapper, "All or none of the workspaces");
    expect(every.map((button) => [button.text, button.isChecked])).toEqual([
      ["All", true],
      ["None", false],
    ]);
    for (const button of every) {
      expect(button.input.attributes("type")).toBe("radio");
      expect(button.input.attributes("name")).toBe("statistics-workspace-every");
    }
    const buttons = buttonsOf(wrapper, "Workspaces");
    expect(buttons.map((button) => [button.text, button.isChecked])).toEqual([
      ["Heidrun app", true],
      ["old_experiment", true],
    ]);
    for (const button of buttons) {
      expect(button.input.attributes("type")).toBe("checkbox");
    }
    for (const label of ["All or none of the workspaces", "Workspaces"]) {
      expect(wrapper.get(`[role="group"][aria-label="${label}"]`).classes()).toEqual(expect.arrayContaining(["btn-group", "btn-group-sm"]));
    }
    expect(wrapper.get("label[title*='/work/old_experiment']").text()).toBe("old_experiment");
  });

  it("shows the user activity time of every workspace at first, and only the chosen workspaces after a choice", async () => {
    const { wrapper } = await mountUserActivityTab(records());
    await waitForDrawings(1);
    expect(sumOfBars()).toBeCloseTo(6, 5);
    await wrapper.get("#statistics-workspace-1").setValue(false);
    await waitForDrawings(2);
    expect(sumOfBars()).toBeCloseTo(4, 5);
    expect(buttonsOf(wrapper, "Workspaces").map((button) => button.isChecked)).toEqual([true, false]);
    await wrapper.get("#statistics-workspace-1").setValue(true);
    await wrapper.get("#statistics-workspace-0").setValue(false);
    await waitForDrawings(4);
    expect(sumOfBars()).toBeCloseTo(2, 5);
  });

  it("shows no workspace when None is chosen, and every workspace again when All is chosen", async () => {
    const { wrapper } = await mountUserActivityTab(records());
    await waitForDrawings(1);
    await wrapper.get("#statistics-workspace-none").setValue(true);
    expect(buttonsOf(wrapper, "Workspaces").map((button) => button.isChecked)).toEqual([false, false]);
    expect(buttonsOf(wrapper, "All or none of the workspaces").map((button) => button.isChecked)).toEqual([false, true]);
    expect(wrapper.text()).toContain("No workspace is chosen");
    expect(plotly.purge).toHaveBeenCalled();
    await wrapper.get("#statistics-workspace-all").setValue(true);
    expect(buttonsOf(wrapper, "Workspaces").map((button) => button.isChecked)).toEqual([true, true]);
    expect(buttonsOf(wrapper, "All or none of the workspaces").map((button) => button.isChecked)).toEqual([true, false]);
    expect(wrapper.text()).not.toContain("No workspace is chosen");
    await waitForDrawings(2);
    expect(sumOfBars()).toBeCloseTo(6, 5);
  });

  it("chooses every workspace again when All is clicked while a workspace is hidden, and shows neither All nor None as chosen before", async () => {
    const { wrapper } = await mountUserActivityTab(records());
    await waitForDrawings(1);
    await wrapper.get("#statistics-workspace-1").setValue(false);
    expect(buttonsOf(wrapper, "All or none of the workspaces").map((button) => button.isChecked)).toEqual([false, false]);
    await wrapper.get("#statistics-workspace-all").setValue(true);
    expect(buttonsOf(wrapper, "Workspaces").map((button) => button.isChecked)).toEqual([true, true]);
  });

  it("keeps the choice of the workspaces when the time range and the slot length change", async () => {
    const { wrapper } = await mountUserActivityTab(records());
    await waitForDrawings(1);
    await wrapper.get("#statistics-workspace-1").setValue(false);
    await wrapper.get("#statistics-range-week").setValue(true);
    await chooseSlotLength(wrapper, "six_hours", 4);
    expect(buttonsOf(wrapper, "Workspaces").map((button) => button.isChecked)).toEqual([true, false]);
    expect(sumOfBars()).toBeCloseTo(4 / 60, 5);
  });

  it("counts the running active period only while its workspace is chosen", async () => {
    const { wrapper } = await mountUserActivityTab(records(), 30_000);
    await waitForDrawings(1);
    expect(sumOfBars()).toBeCloseTo(6.5, 1);
    await wrapper.get("#statistics-workspace-0").setValue(false);
    await waitForDrawings(2);
    expect(sumOfBars()).toBeCloseTo(2, 5);
  });

  it("lists an open workspace even when it has no record", async () => {
    const { wrapper } = await mountUserActivityTab([recordOf(CLOSED_FOLDER, 20 * 60_000, 2 * 60_000)], 30_000, [OPEN_WORKSPACES[0]]);
    expect(buttonsOf(wrapper, "Workspaces").map((button) => button.text)).toEqual(["Heidrun app"]);
  });

  it("does not list a workspace that has activity records but is closed", async () => {
    const { wrapper } = await mountUserActivityTab([recordOf(CLOSED_FOLDER, 20 * 60_000, 2 * 60_000)], null, [OPEN_WORKSPACES[0]]);
    expect(buttonsOf(wrapper, "Workspaces").map((button) => button.text)).toEqual(["Heidrun app"]);
    await waitForDrawings(1);
    expect(sumOfBars()).toBe(0);
  });

  it("updates its workspace choices when the open workspace list changes", async () => {
    const { wrapper } = await mountUserActivityTab([], null, []);
    await waitForDrawings(1);
    expect(wrapper.find('[role="group"][aria-label="Workspaces"]').exists()).toBe(false);
    expect(lastDrawing().data.x).toHaveLength(24);
    const { state } = await import("../stores/session");
    state.snapshot = {
      ...state.snapshot!,
      workspaces: [OPEN_WORKSPACES[0]],
    } as never;
    await flushPromises();
    expect(buttonsOf(wrapper, "Workspaces").map((button) => button.text)).toEqual(["Heidrun app"]);
  });

  it("shows an error message when the records cannot be read", async () => {
    const { wrapper } = await mountUserActivityTab(new Error("no data layer"));
    expect(wrapper.get(".alert-danger").text()).toContain("no data layer");
    expect(plotly.react).not.toHaveBeenCalled();
  });

  it("puts a busy wheel before the message while the user activity is read", async () => {
    const { wrapper } = await mountUserActivityTab(new Promise<never>(() => {}));
    const message = wrapper.get('[role="status"]');
    expect(message.text()).toBe("Reading the user activity…");
    expect(message.element.firstElementChild?.classList.contains("spinner-border")).toBe(true);
    expect(message.get(".spinner-border").attributes("aria-hidden")).toBe("true");
  });
});

describe("UserActivityTab: the stacked bars", () => {
  /** The length of a slot of the last day at first: one hour. */
  const SLOT_MS = HOUR_MS;

  /**
   * A record of an active period inside a slot before the current slot, so that no slot limit cuts it.
   *
   * @param workspaceFolder - The folder of the workspace of the record.
   * @param offsetInSeconds - The start of the period, in seconds after the start of the slot.
   * @param durationInSeconds - The length of the period, in seconds.
   * @param slotsBefore - How many slots before the current slot: 1 is the slot just before the current slot.
   */
  function recordInPreviousSlot(workspaceFolder: string, offsetInSeconds: number, durationInSeconds: number, slotsBefore = 1) {
    const currentSlotStartedAt = new Date();
    currentSlotStartedAt.setMinutes(0, 0, 0);
    const startedAt = currentSlotStartedAt.getTime() - slotsBefore * SLOT_MS + offsetInSeconds * 1000;
    return {
      workspaceFolder,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(startedAt + durationInSeconds * 1000).toISOString(),
    };
  }

  /** The records of two workspaces: "Heidrun app" has 4 minutes in total, and "old_experiment" has 2 minutes. */
  const records = () => [
    recordOf(OPEN_FOLDER, 30 * 60_000, 3 * 60_000),
    recordOf(CLOSED_FOLDER, 20 * 60_000, 2 * 60_000),
    recordOf(OPEN_FOLDER, 10 * 60_000, 60_000),
  ];

  /** The sum of the heights of the parts of one trace of the last drawing. */
  function sumOfTrace(index: number): number {
    return lastDrawing().traces[index].y.reduce((total, value) => total + value, 0);
  }

  it("stacks the bars, with one part for each chosen workspace, and a legend", async () => {
    await mountUserActivityTab(records());
    await waitForDrawings(1);
    const { traces, layout } = lastDrawing();
    expect(layout.barmode).toBe("stack");
    expect(layout.showlegend).toBe(true);
    expect(traces.map((trace) => trace.name)).toEqual(["Heidrun app", "old_experiment"]);
    expect(traces.every((trace) => trace.type === "bar" && trace.x.length === 24)).toBe(true);
    expect(sumOfTrace(0)).toBeCloseTo(4, 5);
    expect(sumOfTrace(1)).toBeCloseTo(2, 5);
  });

  it("gives each workspace its own color, in the order of the buttons", async () => {
    await mountUserActivityTab(records());
    await waitForDrawings(1);
    expect(lastDrawing().traces.map((trace) => trace.marker.color)).toEqual(["--blue-500", "--orange-500"]);
  });

  it("keeps the color of a workspace when another workspace is hidden, and when the time range changes", async () => {
    const { wrapper } = await mountUserActivityTab(records());
    await waitForDrawings(1);
    await wrapper.get("#statistics-workspace-0").setValue(false);
    await waitForDrawings(2);
    expect(lastDrawing().traces.map((trace) => [trace.name, trace.marker.color])).toEqual([["old_experiment", "--orange-500"]]);
    await wrapper.get("#statistics-range-week").setValue(true);
    await waitForDrawings(3);
    expect(lastDrawing().traces.map((trace) => [trace.name, trace.marker.color])).toEqual([["old_experiment", "--orange-500"]]);
  });

  it("shows no dot of color on the buttons of the workspaces, because the legend of the chart gives the colors", async () => {
    const { wrapper } = await mountUserActivityTab(records());
    expect(wrapper.find('[role="group"][aria-label="Workspaces"] [aria-hidden="true"]').exists()).toBe(false);
  });

  it("draws one part with the user activity time of the only workspace", async () => {
    await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90)], null, [OPEN_WORKSPACES[0]]);
    await waitForDrawings(1);
    const { traces } = lastDrawing();
    expect(traces).toHaveLength(1);
    expect(traces[0].marker.color).toBe("--blue-500");
    expect(sumOfTrace(0)).toBeCloseTo(1.5, 5);
  });

  it("draws one part of height 0 for each slot when there is no workspace", async () => {
    await mountUserActivityTab([], null, []);
    await waitForDrawings(1);
    const { traces } = lastDrawing();
    expect(traces).toHaveLength(1);
    expect(traces[0].y).toEqual(new Array(24).fill(0));
  });

  it("gives the legend of the colors above the bars, and no way to hide a part from the legend", async () => {
    await mountUserActivityTab(records());
    await waitForDrawings(1);
    const { layout, traces } = lastDrawing();
    expect(layout.showlegend).toBe(true);
    expect(layout.legend.orientation).toBe("h");
    expect(layout.legend.itemclick).toBe(false);
    expect(layout.legend.itemdoubleclick).toBe(false);
    expect(traces.map((trace) => trace.name)).toEqual(["Heidrun app", "old_experiment"]);
  });

  it("gives no legend when there is no workspace", async () => {
    await mountUserActivityTab([], null, []);
    await waitForDrawings(1);
    expect(lastDrawing().layout.showlegend).toBe(false);
  });

  it("turns off the tooltip of Plotly.js, because the tooltip is HTML of the page", async () => {
    await mountUserActivityTab(records());
    await waitForDrawings(1);
    expect(lastDrawing().traces.every((trace) => trace.hoverinfo === "none")).toBe(true);
    expect(Object.keys(plotlyHandlers).sort()).toEqual(["plotly_hover", "plotly_unhover"]);
  });

  it("shows no tooltip until the pointer is over a bar", async () => {
    const { wrapper } = await mountUserActivityTab(records());
    await waitForDrawings(1);
    expect(tooltipOf(wrapper)).toBeNull();
  });

  it("shows the title and the total in the tooltip of a slot of the only workspace, and no row", async () => {
    const { wrapper } = await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90)], null, [OPEN_WORKSPACES[0]]);
    await waitForDrawings(1);
    await hoverSlot(22);
    const tooltip = tooltipOf(wrapper);
    expect(tooltip?.title).toMatch(/^.+ to .+$/);
    expect(tooltip?.total).toBe("1 min 30 s");
    expect(tooltip?.rows).toEqual([]);
  });

  it("shows one row for each workspace that has time in the slot, with the total above the rows", async () => {
    const { wrapper } = await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90), recordInPreviousSlot(CLOSED_FOLDER, 180, 30)]);
    await waitForDrawings(1);
    await hoverSlot(22);
    const tooltip = tooltipOf(wrapper);
    expect(tooltip?.total).toBe("2 min 0 s");
    expect(tooltip?.rows).toEqual([
      ["Heidrun app", "1 min 30 s"],
      ["old_experiment", "0 min 30 s"],
    ]);
  });

  it("shows the color of each workspace in the rows of the tooltip", async () => {
    const { wrapper } = await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90), recordInPreviousSlot(CLOSED_FOLDER, 180, 30)]);
    await waitForDrawings(1);
    await hoverSlot(22);
    const dots = wrapper.findAll('[role="tooltip"] [data-field="row"] span[aria-hidden="true"]');
    expect(dots.map((dot) => dot.attributes("style"))).toEqual([
      expect.stringContaining("var(--blue-500)"),
      expect.stringContaining("var(--orange-500)"),
    ]);
  });

  it("leaves a workspace out of the rows of a slot where it has no time", async () => {
    const { wrapper } = await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90), recordInPreviousSlot(CLOSED_FOLDER, 60, 30, 2)]);
    await waitForDrawings(1);
    await hoverSlot(22);
    expect(tooltipOf(wrapper)?.rows).toEqual([["Heidrun app", "1 min 30 s"]]);
  });

  it("shows a total of 0 min 0 s, and no row, for a slot with no time", async () => {
    const { wrapper } = await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90), recordInPreviousSlot(CLOSED_FOLDER, 180, 30)]);
    await waitForDrawings(1);
    await hoverSlot(21);
    expect(tooltipOf(wrapper)?.total).toBe("0 min 0 s");
    expect(tooltipOf(wrapper)?.rows).toEqual([]);
  });

  it("writes the time of each workspace in hours and minutes in the tooltip of a slot of six hours", async () => {
    const { wrapper } = await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90), recordInPreviousSlot(CLOSED_FOLDER, 180, 30)]);
    await waitForDrawings(1);
    await wrapper.get("#statistics-range-week").setValue(true);
    await chooseSlotLength(wrapper, "six_hours", 3);
    await hoverSlot(firstSlotWithTime());
    const tooltip = tooltipOf(wrapper);
    expect(tooltip?.total).toMatch(/^\d+ h \d+ min$/);
    expect(tooltip?.rows.map((row) => row[0])).toEqual(["Heidrun app", "old_experiment"]);
    expect(tooltip?.rows.every((row) => /^\d+ h \d+ min$/.test(row[1] ?? ""))).toBe(true);
  });

  it("writes the name of a workspace as text, so a sign '<' of a folder does not make markup, in the tooltip and in the legend", async () => {
    const markupWorkspace = { workspace_id: "w3", number: 3, label: "a<b>&c", workspace_folder: "/work/a<b>&c" };
    const { wrapper } = await mountUserActivityTab(
      [recordInPreviousSlot(OPEN_FOLDER, 60, 90), recordInPreviousSlot("/work/a<b>&c", 180, 30)],
      null,
      [OPEN_WORKSPACES[0], markupWorkspace],
    );
    await waitForDrawings(1);
    await hoverSlot(22);
    expect(tooltipOf(wrapper)?.rows[0][0]).toBe("a<b>&c");
    expect(wrapper.find('[role="tooltip"] a').exists()).toBe(false);
    expect(lastDrawing().traces[0].name).toBe("a&lt;b&gt;&amp;c");
  });

  it("hides the tooltip when the pointer leaves the bar, and when the time range changes", async () => {
    const { wrapper } = await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90)]);
    await waitForDrawings(1);
    await hoverSlot(22);
    expect(tooltipOf(wrapper)).not.toBeNull();
    plotlyHandlers.plotly_unhover({});
    await flushPromises();
    expect(tooltipOf(wrapper)).toBeNull();
    await hoverSlot(22);
    await wrapper.get("#statistics-range-week").setValue(true);
    await waitForDrawings(2);
    await flushPromises();
    expect(tooltipOf(wrapper)).toBeNull();
  });

  it("puts the tooltip beside the column, on the side that has room, with an arrow at the height of the pointer", async () => {
    const box = { left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, x: 0, y: 0, toJSON: () => ({}) };
    const boxSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(box);
    const { wrapper } = await mountUserActivityTab([recordInPreviousSlot(OPEN_FOLDER, 60, 90)]);
    await waitForDrawings(1);
    await hoverSlot(22, { x: 100, y: 50 });
    const rightColumn = wrapper.get('[role="tooltip"]');
    expect(rightColumn.classes()).toContain("bs-popover-start");
    expect(rightColumn.classes()).not.toContain("bs-popover-end");
    expect(rightColumn.attributes("style")).toContain("right: calc(");
    expect(rightColumn.attributes("style")).not.toContain("left:");
    expect(rightColumn.attributes("style")).toContain("top: 50px");
    expect(rightColumn.attributes("style")).toContain("pointer-events: none");
    expect(rightColumn.get(".popover-arrow").attributes("style")).toContain("top:");
    await hoverSlot(1, { x: 350, y: 250 });
    const leftColumn = wrapper.get('[role="tooltip"]');
    expect(leftColumn.classes()).toContain("bs-popover-end");
    expect(leftColumn.classes()).not.toContain("bs-popover-start");
    expect(leftColumn.attributes("style")).toContain("left: calc(");
    expect(leftColumn.attributes("style")).not.toContain("right:");
    expect(leftColumn.attributes("style")).toContain("top: 250px");
    boxSpy.mockRestore();
  });
});

describe("UserActivityTab: the memory of the choices (issue 707)", () => {
  /** The settings of the run, as the tab and the settings store share them. */
  async function currentSettings() {
    return (await import("../stores/settings")).settings;
  }

  /** The texts of the buttons that are checked in a group of toggle buttons. */
  function checkedTexts(wrapper: VueWrapper, groupLabel: string): string[] {
    return buttonsOf(wrapper, groupLabel).filter((button) => button.isChecked).map((button) => button.text);
  }

  /** Closes the Statistics window and opens it again: the tab is built again, and the settings store stays. */
  async function reopen(wrapper: VueWrapper, openWorkspaceList = OPEN_WORKSPACES) {
    wrapper.unmount();
    plotly.react.mockClear();
    return mountUserActivityTab([], null, openWorkspaceList);
  }

  /** Starts Heidrun Code again: every module is loaded again, and the settings are read from `localStorage`. */
  async function restart(wrapper: VueWrapper, openWorkspaceList = OPEN_WORKSPACES) {
    await flushPromises();
    wrapper.unmount();
    plotly.react.mockClear();
    vi.resetModules();
    return mountUserActivityTab([], null, openWorkspaceList);
  }

  it("starts with the last day, one hour, and every workspace when nothing is saved", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    expect(checkedTexts(wrapper, "Time range")).toEqual(["Last day"]);
    expect(checkedTexts(wrapper, "Slot length")).toEqual(["1 hour"]);
    expect(checkedTexts(wrapper, "Workspaces")).toEqual(["Heidrun app", "old_experiment"]);
  });

  it("saves the slot length as soon as it changes, and starts with it when the window opens again", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await wrapper.get("#statistics-slot-fifteen_minutes").setValue(true);
    expect((await currentSettings()).statisticsUserActivitySlotLength).toBe("fifteen_minutes");
    const { wrapper: reopened } = await reopen(wrapper);
    expect(checkedTexts(reopened, "Time range")).toEqual(["Last day"]);
    expect(checkedTexts(reopened, "Slot length")).toEqual(["15 minutes"]);
    await waitForDrawings(1);
    expect(lastDrawing().data.x).toHaveLength(96);
  });

  it("saves the time range and its slot length, and starts with both when the window opens again", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await wrapper.get("#statistics-range-week").setValue(true);
    await wrapper.get("#statistics-slot-six_hours").setValue(true);
    const { wrapper: reopened } = await reopen(wrapper);
    expect(checkedTexts(reopened, "Time range")).toEqual(["Last week"]);
    expect(checkedTexts(reopened, "Slot length")).toEqual(["6 hours"]);
  });

  it("saves the slot length that a new time range goes back to", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await wrapper.get("#statistics-slot-fifteen_minutes").setValue(true);
    await wrapper.get("#statistics-range-month").setValue(true);
    const settings = await currentSettings();
    expect(settings.statisticsUserActivityRange).toBe("month");
    expect(settings.statisticsUserActivitySlotLength).toBe("one_day");
    const { wrapper: reopened } = await reopen(wrapper);
    expect(checkedTexts(reopened, "Time range")).toEqual(["Last month"]);
    expect(checkedTexts(reopened, "Slot length")).toEqual(["1 day"]);
  });

  it("keeps the choices after Heidrun Code starts again", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await wrapper.get("#statistics-range-week").setValue(true);
    await wrapper.get("#statistics-slot-one_hour").setValue(true);
    await wrapper.get("#statistics-workspace-1").setValue(false);
    const { wrapper: restarted } = await restart(wrapper);
    expect(checkedTexts(restarted, "Time range")).toEqual(["Last week"]);
    expect(checkedTexts(restarted, "Slot length")).toEqual(["1 hour"]);
    expect(checkedTexts(restarted, "Workspaces")).toEqual(["Heidrun app"]);
  });

  it("starts with the slot length that the saved time range starts with when it does not offer the saved slot length", async () => {
    localStorage.setItem(
      "heidrun.settings",
      JSON.stringify({ statisticsUserActivityRange: "month", statisticsUserActivitySlotLength: "fifteen_minutes" }),
    );
    const { wrapper } = await mountUserActivityTab([]);
    expect(checkedTexts(wrapper, "Time range")).toEqual(["Last month"]);
    expect(checkedTexts(wrapper, "Slot length")).toEqual(["1 day"]);
  });

  it("starts with the default choices when the saved values are corrupted", async () => {
    localStorage.setItem(
      "heidrun.settings",
      JSON.stringify({ statisticsUserActivityRange: "year", statisticsUserActivitySlotLength: 7, statisticsUserActivityWorkspaces: "all" }),
    );
    const { wrapper } = await mountUserActivityTab([]);
    expect(checkedTexts(wrapper, "Time range")).toEqual(["Last day"]);
    expect(checkedTexts(wrapper, "Slot length")).toEqual(["1 hour"]);
    expect(checkedTexts(wrapper, "Workspaces")).toEqual(["Heidrun app", "old_experiment"]);
  });

  it("saves the chosen workspaces, and starts with them when the window opens again", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await wrapper.get("#statistics-workspace-1").setValue(false);
    expect((await currentSettings()).statisticsUserActivityWorkspaces).toEqual({
      isEveryWorkspaceChosen: false,
      folders: [OPEN_FOLDER],
    });
    const { wrapper: reopened } = await reopen(wrapper);
    expect(checkedTexts(reopened, "Workspaces")).toEqual(["Heidrun app"]);
    expect(checkedTexts(reopened, "All or none of the workspaces")).toEqual([]);
  });

  it("saves the button None, and starts with no workspace chosen when the window opens again", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await wrapper.get("#statistics-workspace-none").setValue(true);
    expect((await currentSettings()).statisticsUserActivityWorkspaces).toEqual({ isEveryWorkspaceChosen: false, folders: [] });
    const { wrapper: reopened } = await reopen(wrapper);
    expect(checkedTexts(reopened, "Workspaces")).toEqual([]);
    expect(checkedTexts(reopened, "All or none of the workspaces")).toEqual(["None"]);
  });

  it("saves the button All, and chooses a workspace that opens later", async () => {
    const { wrapper } = await mountUserActivityTab([], null, [OPEN_WORKSPACES[0]]);
    await wrapper.get("#statistics-workspace-0").setValue(false);
    await wrapper.get("#statistics-workspace-all").setValue(true);
    expect((await currentSettings()).statisticsUserActivityWorkspaces.isEveryWorkspaceChosen).toBe(true);
    const { wrapper: reopened } = await reopen(wrapper, OPEN_WORKSPACES);
    expect(checkedTexts(reopened, "Workspaces")).toEqual(["Heidrun app", "old_experiment"]);
  });

  it("chooses a workspace that opened after the choice when the choice was every workspace, even when the developer made it with the buttons of the workspaces", async () => {
    const { wrapper } = await mountUserActivityTab([], null, [OPEN_WORKSPACES[0]]);
    await wrapper.get("#statistics-workspace-none").setValue(true);
    await wrapper.get("#statistics-workspace-0").setValue(true);
    expect((await currentSettings()).statisticsUserActivityWorkspaces).toEqual({ isEveryWorkspaceChosen: true, folders: [OPEN_FOLDER] });
    const { wrapper: reopened } = await reopen(wrapper, OPEN_WORKSPACES);
    expect(checkedTexts(reopened, "Workspaces")).toEqual(["Heidrun app", "old_experiment"]);
  });

  it("chooses every workspace when no saved workspace is open any more", async () => {
    localStorage.setItem(
      "heidrun.settings",
      JSON.stringify({ statisticsUserActivityWorkspaces: { isEveryWorkspaceChosen: false, folders: ["/work/closed"] } }),
    );
    const { wrapper } = await mountUserActivityTab([]);
    expect(checkedTexts(wrapper, "Workspaces")).toEqual(["Heidrun app", "old_experiment"]);
  });

  it("keeps the saved workspaces when a workspace closes and opens again while the window stays open", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await wrapper.get("#statistics-workspace-0").setValue(false);
    const { state } = await import("../stores/session");
    const snapshot = state.snapshot!;
    state.snapshot = { ...snapshot, workspaces: [OPEN_WORKSPACES[1]] } as never;
    await flushPromises();
    state.snapshot = { ...snapshot, workspaces: OPEN_WORKSPACES } as never;
    await flushPromises();
    expect((await currentSettings()).statisticsUserActivityWorkspaces).toEqual({
      isEveryWorkspaceChosen: false,
      folders: [CLOSED_FOLDER],
    });
  });

  it("does not save anything when the window opens and the developer changes nothing", async () => {
    const { wrapper } = await mountUserActivityTab([]);
    await flushPromises();
    wrapper.unmount();
    expect(JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}").statisticsUserActivityWorkspaces).toEqual({
      isEveryWorkspaceChosen: true,
      folders: [],
    });
  });
});

describe("UserActivityTab: the vertical axis (issue 683)", () => {
  /**
   * A record of an active period inside the hour slot that started `hoursBefore` hours before the current hour, so that no slot
   * limit cuts it.
   *
   * @param workspaceFolder - The folder of the workspace of the record.
   * @param offsetInMinutes - The start of the period, in minutes after the start of the hour slot.
   * @param durationInMinutes - The length of the period, in minutes.
   * @param hoursBefore - How many hours before the current hour the slot starts.
   */
  function recordInHourSlot(workspaceFolder: string, offsetInMinutes: number, durationInMinutes: number, hoursBefore = 2) {
    const slotStartedAt = new Date();
    slotStartedAt.setMinutes(0, 0, 0);
    const startedAt = slotStartedAt.getTime() - hoursBefore * HOUR_MS + offsetInMinutes * 60_000;
    return {
      workspaceFolder,
      startedAt: new Date(startedAt).toISOString(),
      endedAt: new Date(startedAt + durationInMinutes * 60_000).toISOString(),
    };
  }

  /** The top of the vertical axis of the last drawing, and its title. */
  function axisOf() {
    const { yaxis } = lastDrawing().layout;
    return { range: yaxis.range, title: yaxis.title.text, autorange: yaxis.autorange };
  }

  it("fits the top of the axis to the highest bar: a short activity in a slot of one hour is readable", async () => {
    const { wrapper } = await mountUserActivityTab([recordInHourSlot(OPEN_FOLDER, 10, 15)]);
    await waitForDrawings(1);
    expect(axisOf()).toEqual({ range: [0, 30], title: "Minutes of activity in a slot of 1 hour", autorange: false });
    expect(sumOfBars()).toBeCloseTo(15, 5);
    await wrapper.get("#statistics-range-week").setValue(true);
    await waitForDrawings(2);
    await chooseSlotLength(wrapper, "one_hour", 3);
    expect(axisOf()).toEqual({ range: [0, 30], title: "Minutes of activity in a slot of 1 hour", autorange: false });
    expect(sumOfBars()).toBeCloseTo(15, 5);
  });

  it("gives the same axis for the same slot length, however many times the slot length changes between 1 day and 1 hour", async () => {
    const { wrapper } = await mountUserActivityTab([recordInHourSlot(OPEN_FOLDER, 10, 15)]);
    await waitForDrawings(1);
    await wrapper.get("#statistics-range-week").setValue(true);
    await waitForDrawings(2);
    expect(axisOf()).toEqual({ range: [0, 1], title: "Hours of activity in a slot of 1 day", autorange: false });
    let drawingCount = 2;
    for (let turn = 0; turn < 3; turn += 1) {
      drawingCount += 1;
      await chooseSlotLength(wrapper, "one_hour", drawingCount);
      expect(axisOf()).toEqual({ range: [0, 30], title: "Minutes of activity in a slot of 1 hour", autorange: false });
      drawingCount += 1;
      await chooseSlotLength(wrapper, "one_day", drawingCount);
      expect(axisOf()).toEqual({ range: [0, 1], title: "Hours of activity in a slot of 1 day", autorange: false });
    }
  });

  it("never goes over the length of the slot", async () => {
    await mountUserActivityTab([recordInHourSlot(OPEN_FOLDER, 0, 59)]);
    await waitForDrawings(1);
    expect(axisOf().range).toEqual([0, 60]);
  });

  it("fits the top to the stacked bar, which holds the time of every chosen workspace", async () => {
    await mountUserActivityTab([recordInHourSlot(OPEN_FOLDER, 0, 20), recordInHourSlot(CLOSED_FOLDER, 25, 20)]);
    await waitForDrawings(1);
    expect(axisOf().range).toEqual([0, 60]);
    expect(lastDrawing().traces).toHaveLength(2);
  });

  it("fits the top again when the developer hides the workspace that has the highest bar", async () => {
    const { wrapper } = await mountUserActivityTab([recordInHourSlot(OPEN_FOLDER, 0, 40), recordInHourSlot(CLOSED_FOLDER, 45, 5)]);
    await waitForDrawings(1);
    expect(axisOf().range).toEqual([0, 60]);
    await wrapper.get("#statistics-workspace-0").setValue(false);
    await waitForDrawings(2);
    expect(axisOf().range).toEqual([0, 10]);
  });

  it("draws a bar of height 0 and the lowest top when there is no activity", async () => {
    await mountUserActivityTab([]);
    await waitForDrawings(1);
    expect(axisOf().range).toEqual([0, 5]);
    expect(sumOfBars()).toBe(0);
  });
});
