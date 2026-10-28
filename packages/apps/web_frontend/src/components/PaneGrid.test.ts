import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import type { PaneLayoutSnapshot } from "../lib/types";
import paneGridSource from "./PaneGrid.vue?raw";

const mocks = await vi.hoisted(async () => {
  const { computed, ref } = await import("vue");
  const gridLayout = ref<unknown>(null);
  const gridPanes = ref<unknown[]>([]);
  const hiddenTabs = ref<unknown[]>([]);
  return {
    gridLayout,
    gridPanes,
    /** The tabs that the developer opened before the selected tab, as the store gives them. */
    hiddenTabs,
    keptTabs: computed(() => [
      ...hiddenTabs.value,
      { tabId: "selected", isSelected: true, panes: gridPanes.value, layout: gridLayout.value },
    ]),
    setSplitRatios: vi.fn(),
  };
});

vi.mock("../stores/session", () => ({
  setSplitRatios: mocks.setSplitRatios,
}));

vi.mock("../stores/pinned_panes", () => ({
  gridLayout: mocks.gridLayout,
  gridPanes: mocks.gridPanes,
  keptTabs: mocks.keptTabs,
}));

// The panes show terminals, which need a real browser: the lines between the panes are the subject of these tests.
vi.mock("./PaneCard.vue", () => ({ default: { template: "<div></div>" } }));

import PaneGrid from "./PaneGrid.vue";
import { PaneMoveDrag } from "../stores/pane_move";

const AREA = { x: 0, y: 0, width: 120, height: 40 };

/** Two panes side by side, and the second pane split in two panes, one above the other. Like Herdr 0.9.3 sends it. */
const THREE_PANES: PaneLayoutSnapshot = {
  workspace_id: "w1",
  tab_id: "w1:t1",
  zoomed: false,
  area: AREA,
  focused_pane_id: "w1:p1",
  panes: [
    { pane_id: "w1:p1", focused: true, rect: { x: 0, y: 0, width: 60, height: 40 } },
    { pane_id: "w1:p2", focused: false, rect: { x: 60, y: 0, width: 60, height: 20 } },
    { pane_id: "w1:p3", focused: false, rect: { x: 60, y: 20, width: 60, height: 20 } },
  ],
  splits: [
    { id: "split_0_root", direction: "right", ratio: 0.5, rect: AREA },
    { id: "split_1_1", direction: "down", ratio: 0.5, rect: { x: 60, y: 0, width: 60, height: 40 } },
  ],
};

const OUTER_EDGES = { left: true, right: true };
const NO_OUTER_EDGES = { left: false, right: false };

/** The screen is 1200 pixels wide and 800 pixels high, so one cell of Herdr is 10 pixels wide and 20 pixels high. */
function mountPaneGrid(layout: PaneLayoutSnapshot, outerEdges = NO_OUTER_EDGES) {
  mocks.gridLayout.value = layout;
  mocks.gridPanes.value = layout.panes.map((layoutPane) => ({ pane_id: layoutPane.pane_id }));
  const wrapper = mount(PaneGrid, {
    props: { outerEdges },
    attachTo: document.body,
  });
  wrapper.element.getBoundingClientRect = () =>
    ({ x: 0, y: 0, left: 0, top: 0, right: 1200, bottom: 800, width: 1200, height: 800 }) as DOMRect;
  return wrapper;
}

/** Moves the pointer on the window, like a drag does. */
function movePointer(clientX: number, clientY: number) {
  window.dispatchEvent(new MouseEvent("pointermove", { clientX, clientY }));
}

function releasePointer() {
  window.dispatchEvent(new MouseEvent("pointerup"));
}

beforeEach(() => {
  mocks.setSplitRatios.mockClear();
  mocks.gridLayout.value = null;
  mocks.gridPanes.value = [];
  mocks.hiddenTabs.value = [];
  document.body.innerHTML = "";
});

describe("PaneGrid lines between panes", () => {
  it("shows one line for each split, a horizontal one for a split down and a vertical one for a split right", () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    const lines = wrapper.findAll(".separator");
    expect(lines.map((line) => line.attributes("aria-orientation"))).toEqual(["vertical", "horizontal"]);
    expect(lines.map((line) => line.attributes("role"))).toEqual(["separator", "separator"]);
  });

  it("shows no line when a pane is zoomed", () => {
    const wrapper = mountPaneGrid({ ...THREE_PANES, zoomed: true });
    expect(wrapper.findAll(".separator").length).toBe(0);
  });

  it("shows no line when Herdr sends no split", () => {
    const wrapper = mountPaneGrid({ ...THREE_PANES, splits: undefined });
    expect(wrapper.findAll(".separator").length).toBe(0);
  });

  it("sends the new share of a split after a drag of the horizontal line, one cell for each 20 pixels", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    const line = wrapper.find(".separator.down");
    await line.trigger("pointerdown", { clientX: 900, clientY: 400 });
    movePointer(900, 440);
    releasePointer();
    expect(mocks.setSplitRatios).toHaveBeenCalledTimes(1);
    const [changes] = mocks.setSplitRatios.mock.calls[0];
    expect(changes).toHaveLength(1);
    expect(changes[0].tabId).toBe("w1:t1");
    expect(changes[0].path).toEqual([true]);
    expect(changes[0].ratio).toBeCloseTo(0.55);
  });

  it("sends the new share of a split after a drag of the vertical line, one cell for each 10 pixels", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    await wrapper.find(".separator.right").trigger("pointerdown", { clientX: 600, clientY: 400 });
    movePointer(480, 400);
    releasePointer();
    const [changes] = mocks.setSplitRatios.mock.calls[0];
    expect(changes[0].path).toEqual([]);
    expect(changes[0].ratio).toBeCloseTo(0.4);
  });

  it("sends nothing while the pointer stays inside the same cell", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    await wrapper.find(".separator.down").trigger("pointerdown", { clientX: 900, clientY: 400 });
    movePointer(900, 405);
    movePointer(900, 392);
    releasePointer();
    expect(mocks.setSplitRatios).not.toHaveBeenCalled();
  });

  it("does not follow the pointer any more after the pointer is released", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    await wrapper.find(".separator.down").trigger("pointerdown", { clientX: 900, clientY: 400 });
    releasePointer();
    movePointer(900, 500);
    expect(mocks.setSplitRatios).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.paneDragCursor).toBeUndefined();
  });

  it("asks for the cursor with arrows up and down during the drag of the horizontal line", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    await wrapper.find(".separator.down").trigger("pointerdown", { clientX: 900, clientY: 400 });
    expect(document.documentElement.dataset.paneDragCursor).toBe("row-resize");
    releasePointer();
    expect(document.documentElement.dataset.paneDragCursor).toBeUndefined();
  });

  it("asks for the cursor with arrows left and right during the drag of the vertical line", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    await wrapper.find(".separator.right").trigger("pointerdown", { clientX: 600, clientY: 400 });
    expect(document.documentElement.dataset.paneDragCursor).toBe("col-resize");
    releasePointer();
    expect(document.documentElement.dataset.paneDragCursor).toBeUndefined();
  });

  it("shares the room evenly after a double-click", async () => {
    const wrapper = mountPaneGrid({
      ...THREE_PANES,
      splits: [THREE_PANES.splits![0], { ...THREE_PANES.splits![1], ratio: 0.8 }],
    });
    await wrapper.find(".separator.down").trigger("dblclick");
    expect(mocks.setSplitRatios).toHaveBeenCalledWith([{ tabId: "w1:t1", path: [true], ratio: 0.5 }]);
  });

  it("moves a line by one cell with the arrow keys, and by four cells with the key Shift", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    const line = wrapper.find(".separator.down");
    await line.trigger("keydown", { key: "ArrowDown" });
    await line.trigger("keydown", { key: "ArrowUp", shiftKey: true });
    await line.trigger("keydown", { key: "ArrowLeft" });
    expect(mocks.setSplitRatios).toHaveBeenCalledTimes(2);
    expect(mocks.setSplitRatios.mock.calls[0][0][0].ratio).toBeCloseTo(0.525);
    expect(mocks.setSplitRatios.mock.calls[1][0][0].ratio).toBeCloseTo(0.4);
  });
});

describe("PaneGrid corners", () => {
  it("shows a corner where the vertical line meets the horizontal line", () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    expect(wrapper.findAll(".corner").length).toBe(1);
  });

  it("moves both lines with one drag of the corner", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    await wrapper.find(".corner").trigger("pointerdown", { clientX: 600, clientY: 400 });
    movePointer(480, 440);
    releasePointer();
    const [changes] = mocks.setSplitRatios.mock.calls[0];
    expect(changes.map((change: { path: boolean[] }) => change.path)).toEqual([[true], []]);
    expect(changes[0].ratio).toBeCloseTo(0.55);
    expect(changes[1].ratio).toBeCloseTo(0.4);
  });

  it("asks for the cursor with four arrows during the drag of a corner, and only then", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    expect(document.documentElement.dataset.paneDragCursor).toBeUndefined();
    await wrapper.find(".corner").trigger("pointerdown", { clientX: 600, clientY: 400 });
    expect(document.documentElement.dataset.paneDragCursor).toBe("move");
    releasePointer();
    expect(document.documentElement.dataset.paneDragCursor).toBeUndefined();
  });

  it("asks for the cursor with four arrows during the drag of a corner that touches a column of the window", async () => {
    const wrapper = mountPaneGrid(THREE_PANES, OUTER_EDGES);
    await wrapper.findAll(".corner")[1].trigger("pointerdown", { clientX: 1200, clientY: 400 });
    expect(document.documentElement.dataset.paneDragCursor).toBe("move");
    releasePointer();
  });

  it("shows a corner at each side that has a column of the window against it", () => {
    const wrapper = mountPaneGrid(THREE_PANES, OUTER_EDGES);
    expect(wrapper.findAll(".corner").length).toBe(2);
  });

  it("tells the parent to move the column that sits against the corner, with the move of the pointer", async () => {
    const wrapper = mountPaneGrid(THREE_PANES, OUTER_EDGES);
    await wrapper.findAll(".corner")[1].trigger("pointerdown", { clientX: 1200, clientY: 400 });
    movePointer(1150, 440);
    releasePointer();
    expect(wrapper.emitted("outerStart")).toEqual([["right"]]);
    expect(wrapper.emitted("outerMove")).toEqual([["right", -50]]);
    const [changes] = mocks.setSplitRatios.mock.calls[0];
    expect(changes).toHaveLength(1);
    expect(changes[0].path).toEqual([true]);
  });

  it("draws every line of a corner in colour while the pointer is on the corner, and only then", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    expect(wrapper.findAll(".separator.lit").length).toBe(0);
    await wrapper.find(".corner").trigger("pointerenter");
    expect(wrapper.findAll(".separator.lit").length).toBe(2);
    await wrapper.find(".corner").trigger("pointerleave");
    expect(wrapper.findAll(".separator.lit").length).toBe(0);
  });

  it("tells the parent to draw the column that sits against the corner in colour, while the pointer is on it", async () => {
    const wrapper = mountPaneGrid(THREE_PANES, OUTER_EDGES);
    const rightCorner = wrapper.findAll(".corner")[1];
    await rightCorner.trigger("pointerenter");
    await rightCorner.trigger("pointerleave");
    expect(wrapper.emitted("outerHighlight")).toEqual([["right"], [null]]);
  });

  it("keeps the lines of a corner in colour during the drag, also when the pointer leaves the corner", async () => {
    const wrapper = mountPaneGrid(THREE_PANES, OUTER_EDGES);
    const rightCorner = wrapper.findAll(".corner")[1];
    await rightCorner.trigger("pointerdown", { clientX: 1200, clientY: 400 });
    await rightCorner.trigger("pointerleave");
    expect(wrapper.findAll(".separator.lit").length).toBe(1);
    expect(wrapper.emitted("outerHighlight")).toEqual([["right"]]);
    releasePointer();
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".separator.lit").length).toBe(0);
    expect(wrapper.emitted("outerHighlight")).toEqual([["right"], [null]]);
  });

  it("keeps the corner element while the lines move, so that the drag goes on", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    const corner = wrapper.find(".corner").element;
    await wrapper.find(".corner").trigger("pointerdown", { clientX: 600, clientY: 400 });
    const moved: PaneLayoutSnapshot = {
      ...THREE_PANES,
      panes: [
        { pane_id: "w1:p1", focused: true, rect: { x: 0, y: 0, width: 48, height: 40 } },
        { pane_id: "w1:p2", focused: false, rect: { x: 48, y: 0, width: 72, height: 22 } },
        { pane_id: "w1:p3", focused: false, rect: { x: 48, y: 22, width: 72, height: 18 } },
      ],
      splits: [
        { id: "split_0_root", direction: "right", ratio: 0.4, rect: AREA },
        { id: "split_1_1", direction: "down", ratio: 0.55, rect: { x: 48, y: 0, width: 72, height: 40 } },
      ],
    };
    mocks.gridLayout.value = moved;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".corner").element).toBe(corner);
    releasePointer();
  });
});

describe("PaneGrid panes that touch", () => {
  const cellStyles = (wrapper: ReturnType<typeof mountPaneGrid>) =>
    wrapper.findAll(".cell").map((cell) => {
      const style = (cell.element as HTMLElement).style;
      return { left: style.left, top: style.top, width: style.width, height: style.height };
    });

  it("starts a pane that has a neighbour on its left or above it 1 pixel early, so that the borders of two panes make one line", () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    expect(cellStyles(wrapper)).toEqual([
      { left: "0px", top: "0px", width: "50%", height: "100%" },
      { left: "calc(50% - 1px)", top: "0px", width: "calc(50% + 1px)", height: "50%" },
      { left: "calc(50% - 1px)", top: "calc(50% - 1px)", width: "calc(50% + 1px)", height: "calc(50% + 1px)" },
    ]);
  });
});

describe("PaneGrid without pane", () => {
  it("shows the screen with the goat, the name, and the joke, and shows no line", () => {
    mocks.gridLayout.value = null;
    mocks.gridPanes.value = [];
    const wrapper = mount(PaneGrid, { props: { outerEdges: NO_OUTER_EDGES } });
    expect(wrapper.find(".empty .empty-tab-screen").exists()).toBe(true);
    expect(wrapper.get(".empty-tab-title").text()).toBe("Heidrun Code");
    expect(wrapper.findAll(".separator").length).toBe(0);
  });

  it("does not show the screen when the tab has a pane", () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    expect(wrapper.find(".empty-tab-screen").exists()).toBe(false);
  });
});

describe("PaneGrid tab switch", () => {
  /** The tab two of the store tests: one pane that fills the area. */
  const SECOND_TAB: PaneLayoutSnapshot = {
    workspace_id: "w1",
    tab_id: "w1:t2",
    zoomed: false,
    area: AREA,
    focused_pane_id: "w1:p4",
    panes: [{ pane_id: "w1:p4", focused: true, rect: AREA }],
    splits: [],
  };

  /** Selects the second tab: the first tab stays in the list of the opened tabs, and the grid shows the second tab. */
  function selectSecondTab(wrapper: ReturnType<typeof mountPaneGrid>) {
    mocks.hiddenTabs.value = [
      {
        tabId: "first",
        isSelected: false,
        panes: THREE_PANES.panes.map((layoutPane) => ({ pane_id: layoutPane.pane_id })),
        layout: THREE_PANES,
      },
    ];
    mocks.gridLayout.value = SECOND_TAB;
    mocks.gridPanes.value = [{ pane_id: "w1:p4" }];
    return wrapper.vm.$nextTick();
  }

  it("keeps the elements of the panes of the old tab, so that their terminals stay alive", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    const oldCells = wrapper.findAll(".cell").map((cell) => cell.element);
    await selectSecondTab(wrapper);
    const cells = wrapper.findAll(".cell");
    expect(cells.length).toBe(4);
    expect(cells.slice(0, 3).map((cell) => cell.element)).toEqual(oldCells);
  });

  it("hides the panes of the old tab and shows the pane of the new tab", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    await selectSecondTab(wrapper);
    const hidden = wrapper.findAll(".cell").map((cell) => cell.classes("is-hidden"));
    expect(hidden).toEqual([true, true, true, false]);
  });

  it("shows the old panes again, with the same elements, when the old tab is selected again", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    const oldCells = wrapper.findAll(".cell").map((cell) => cell.element);
    await selectSecondTab(wrapper);
    mocks.hiddenTabs.value = [];
    mocks.gridLayout.value = THREE_PANES;
    mocks.gridPanes.value = THREE_PANES.panes.map((layoutPane) => ({ pane_id: layoutPane.pane_id }));
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".cell").map((cell) => cell.element)).toEqual(oldCells);
    expect(wrapper.findAll(".cell").map((cell) => cell.classes("is-hidden"))).toEqual([false, false, false]);
  });

  it("gives each pane of a hidden tab the place that its own tab gives it", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    await selectSecondTab(wrapper);
    const style = (wrapper.findAll(".cell")[1].element as HTMLElement).style;
    expect({ left: style.left, top: style.top, height: style.height }).toEqual({
      left: "calc(50% - 1px)",
      top: "0px",
      height: "50%",
    });
  });

  it("shows the empty screen when the selected tab has no pane, whatever the hidden tabs hold", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    await selectSecondTab(wrapper);
    mocks.gridPanes.value = [];
    mocks.gridLayout.value = null;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".empty .empty-tab-screen").exists()).toBe(true);
  });
});

describe("PaneGrid preview of a pane move", () => {
  afterEach(() => {
    PaneMoveDrag.state.previewBox = null;
  });

  it("shows no preview while no pane is dragged", () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    expect(wrapper.find(".move-preview").exists()).toBe(false);
  });

  it("shows the half of the destination pane where the dragged pane goes, in the pixels of the grid", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    PaneMoveDrag.state.previewBox = { left: 100, top: 40, right: 400, bottom: 240 };
    await wrapper.vm.$nextTick();
    const style = (wrapper.get(".move-preview").element as HTMLElement).style;
    expect({ left: style.left, top: style.top, width: style.width, height: style.height }).toEqual({
      left: "100px",
      top: "40px",
      width: "300px",
      height: "200px",
    });
  });

  it("lets the pointer through the preview, so the pane under it keeps receiving the pointer", () => {
    expect(paneGridSource).toMatch(/\.move-preview \{[^}]*pointer-events: none/);
  });

  it("removes the preview when the pointer leaves every pane", async () => {
    const wrapper = mountPaneGrid(THREE_PANES);
    PaneMoveDrag.state.previewBox = { left: 100, top: 40, right: 400, bottom: 240 };
    await wrapper.vm.$nextTick();
    PaneMoveDrag.state.previewBox = null;
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".move-preview").exists()).toBe(false);
  });
});
