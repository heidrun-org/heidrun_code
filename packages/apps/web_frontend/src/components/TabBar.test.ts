import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import Fs from "node:fs";
import Path from "node:path";
import type { SessionSnapshot } from "../lib/types";
import { answerConfirm, confirmDialog } from "../stores/confirm";
import { NewPane } from "../stores/new_pane";
import { settings } from "../stores/settings";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("../stores/new_pane", () => ({ NewPane: { onNewPaneClick: vi.fn() } }));
vi.mock("../lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/api")>();
  return {
    ...original,
    renameTab: vi.fn(async () => ({})),
    closeTab: vi.fn(async () => ({})),
    moveTab: vi.fn(async () => ({})),
  };
});

const SNAPSHOT = {
  workspaces: [
    { workspace_id: "w1", number: 1, label: "heidrun", agent_status: "idle" },
    { workspace_id: "w2", number: 2, label: "teamwright", agent_status: "idle" },
  ],
  tabs: [
    { tab_id: "t1", workspace_id: "w1", number: 1, label: "build", focused: true, pane_count: 1, agent_status: "working" },
    { tab_id: "t2", workspace_id: "w1", number: 2, label: "review", focused: false, pane_count: 2, agent_status: "blocked" },
    { tab_id: "t3", workspace_id: "w1", number: 3, label: "", focused: false, pane_count: 1, agent_status: "idle" },
    { tab_id: "t4", workspace_id: "w2", number: 1, label: "other workspace", focused: false, pane_count: 1, agent_status: "idle" },
  ],
  panes: [
    { pane_id: "p1", workspace_id: "w1", tab_id: "t1", agent_status: "working" },
    { pane_id: "p2", workspace_id: "w1", tab_id: "t2", agent_status: "blocked" },
    { pane_id: "p3", workspace_id: "w1", tab_id: "t2", agent_status: "idle" },
    { pane_id: "p4", workspace_id: "w1", tab_id: "t3", agent_status: "idle" },
    { pane_id: "p5", workspace_id: "w2", tab_id: "t4", agent_status: "idle" },
  ],
  agents: [],
  layouts: [],
} as unknown as SessionSnapshot;

async function mountTabBar() {
  const session = await import("../stores/session");
  const api = await import("../lib/api");
  const claude = await import("../stores/claude");
  const { default: TabBar } = await import("./TabBar.vue");
  for (const paneId of Object.keys(claude.remote.byPane)) {
    delete claude.remote.byPane[paneId];
  }
  session.state.snapshot = SNAPSHOT;
  session.state.selectedWorkspaceId = "w1";
  session.state.selectedTabId = "t1";
  session.state.renaming = null;
  const wrapper = mount(TabBar, { attachTo: document.body });
  return { session, api, wrapper };
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  confirmDialog.open = false;
  document.body.innerHTML = "";
});

describe("TabBar entries", () => {
  it("marks each tab with its identifier, so that a pane dragged over a tab selects it", async () => {
    const { wrapper } = await mountTabBar();
    expect(wrapper.findAll("[data-tab-id]").map((entry) => entry.attributes("data-tab-id"))).toEqual(["t1", "t2", "t3"]);
  });

  it("shows one entry for each tab of the selected workspace, and no tab of another workspace", async () => {
    const { wrapper } = await mountTabBar();
    const tabs = wrapper.findAll("[role=tab]");
    expect(tabs.map((tab) => tab.text())).toEqual(["build", "review", "tab 3"]);
    expect(wrapper.text()).not.toContain("other workspace");
  });

  it("shows the tabs of the other workspace after the selected workspace changes", async () => {
    const { wrapper, session } = await mountTabBar();
    session.state.selectedWorkspaceId = "w2";
    await flushPromises();
    expect(wrapper.findAll("[role=tab]").map((tab) => tab.text())).toEqual(["other workspace"]);
  });

  it("shows the status dot of each tab", async () => {
    const { wrapper } = await mountTabBar();
    const dotClasses = wrapper.findAll("[role=tab] .dot").map((dot) => dot.classes());
    expect(dotClasses[0]).toContain("working");
    expect(dotClasses[1]).toContain("blocked");
    expect(dotClasses[2]).toEqual(["dot"]);
  });

  it("shows an icon between the status dot and the name of each tab: the icon of the agent that decides the dot, or a terminal", async () => {
    const { wrapper, session } = await mountTabBar();
    session.state.snapshot = {
      ...SNAPSHOT,
      panes: [
        { pane_id: "p1", workspace_id: "w1", tab_id: "t1", agent: "claude", agent_status: "working" },
        { pane_id: "p2", workspace_id: "w1", tab_id: "t2", agent: "claude", agent_status: "idle" },
        { pane_id: "p3", workspace_id: "w1", tab_id: "t2", agent: "codex", agent_status: "blocked" },
        { pane_id: "p4", workspace_id: "w1", tab_id: "t3", agent_status: "idle" },
      ],
    } as unknown as SessionSnapshot;
    await flushPromises();
    expect(wrapper.findAll("[role=tab] .tab-icon").map((icon) => icon.element.className)).toEqual([
      "bi bi-claude tab-icon",
      "bi bi-openai tab-icon",
      "bi bi-terminal tab-icon",
    ]);
    const children = Array.from(wrapper.get("[role=tab]").element.children);
    expect(children.map((child) => child.classList[0])).toEqual(["dot", "bi", "tab-label"]);
  });

  it("marks the selected tab", async () => {
    const { wrapper } = await mountTabBar();
    expect(wrapper.findAll("[role=tab]").map((tab) => tab.attributes("aria-selected"))).toEqual(["true", "false", "false"]);
    expect(wrapper.findAll(".nav-link").map((tab) => tab.classes("active"))).toEqual([true, false, false]);
  });

  it("is a list of tabs with an accessible name", async () => {
    const { wrapper } = await mountTabBar();
    expect(wrapper.get("[role=tablist]").attributes("aria-label")).toBe("Tabs of the workspace");
  });

  it("is a Bootstrap nav with tabs: one nav-item for each tab, and the class active on the link of the selected tab", async () => {
    const { wrapper } = await mountTabBar();
    expect(wrapper.get("[role=tablist]").classes()).toEqual(expect.arrayContaining(["nav", "nav-tabs"]));
    expect(wrapper.findAll(".nav-item")).toHaveLength(3);
    expect(wrapper.findAll(".nav-item .nav-link").map((link) => link.classes("active"))).toEqual([true, false, false]);
  });

  it("has a close button on every tab, and no menu button with three dots", async () => {
    const { wrapper } = await mountTabBar();
    expect(wrapper.findAll(".nav-link .confirm")).toHaveLength(3);
    expect(wrapper.find(".bi-three-dots-vertical").exists()).toBe(false);
    expect(wrapper.find(".nav-tabs [aria-haspopup=menu]").exists()).toBe(false);
  });

  it("shows the close button of the selected tab always, and the close button of another tab only when the mouse is over it", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "TabBar.vue"), "utf8");
    expect(sourceText).toContain(".nav-link:not(.active) .confirm { opacity: 0; }");
    expect(sourceText).toContain(".nav-link:not(.active):hover .confirm");
  });

  it("makes the whole tab clickable: the button that selects the tab covers the tab, and the close button sits over it", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "TabBar.vue"), "utf8");
    expect(sourceText).toContain('.tab-main::after { content: ""; position: absolute; top: 0; right: 0; bottom: 0; left: 0; }');
    expect(sourceText).toMatch(/\.nav-link \.confirm \{\s*position: relative; z-index: 1;/);
  });

  it("puts the close button 6px from the right border of the tab, and keeps the padding of the tab that is being renamed", async () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "TabBar.vue"), "utf8");
    expect(sourceText).toContain(".nav-tabs .nav-link.tab-closable { padding-right: 5px; }");
    const { wrapper, session } = await mountTabBar();
    expect(wrapper.findAll(".nav-link").map((tab) => tab.classes("tab-closable"))).toEqual([true, true, true]);
    session.state.renaming = "tab:t2";
    await flushPromises();
    expect(wrapper.findAll(".nav-link").map((tab) => tab.classes("tab-closable"))).toEqual([true, false, true]);
  });

  it("shows the badge RC on the tab that holds a pane with Remote Control connected", async () => {
    const { wrapper } = await mountTabBar();
    const claude = await import("../stores/claude");
    claude.remote.byPane["p3"] = "active";
    await flushPromises();
    expect(wrapper.findAll(".nav-link").map((tab) => tab.find(".rc").exists())).toEqual([false, true, false]);
  });
});

describe("TabBar selection", () => {
  it("selects the tab after a click on its entry", async () => {
    const { wrapper, session } = await mountTabBar();
    await wrapper.findAll("[role=tab]")[1].trigger("click");
    expect(session.state.selectedTabId).toBe("t2");
    expect(wrapper.findAll(".nav-link").map((tab) => tab.classes("active"))).toEqual([false, true, false]);
  });

  it("follows the shortcut Option+Command+Right arrow, which selects the next tab, and wraps around", async () => {
    const { wrapper, session } = await mountTabBar();
    session.cycleTab(1);
    await flushPromises();
    expect(session.state.selectedTabId).toBe("t2");
    session.cycleTab(1);
    session.cycleTab(1);
    await flushPromises();
    expect(session.state.selectedTabId).toBe("t1");
    expect(wrapper.findAll(".nav-link").map((tab) => tab.classes("active"))).toEqual([true, false, false]);
  });

  it("follows the shortcut Option+Command+Left arrow, which selects the previous tab, and wraps around", async () => {
    const { wrapper, session } = await mountTabBar();
    session.cycleTab(-1);
    await flushPromises();
    expect(session.state.selectedTabId).toBe("t3");
    expect(wrapper.findAll(".nav-link").map((tab) => tab.classes("active"))).toEqual([false, false, true]);
  });
});

describe("TabBar plus button", () => {
  it("is after the last tab, and has an accessible name", async () => {
    const { wrapper } = await mountTabBar();
    const plus = wrapper.get("button.add");
    expect(plus.attributes("aria-label")).toBe("Create a tab with the default command of a new tab (shift click: start a terminal)");
    expect(plus.attributes("title")).toBe(plus.attributes("aria-label"));
    const tabRow = wrapper.get("[role=tablist]").element;
    expect(tabRow.compareDocumentPosition(plus.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("starts the creation of a tab when the user clicks it", async () => {
    const { wrapper } = await mountTabBar();
    await wrapper.get("button.add").trigger("click");
    expect(NewPane.onNewPaneClick).toHaveBeenCalledTimes(1);
  });

  it("is marked as the place where a dragged pane goes into a new tab, so that a pane dragged over it can be dropped", async () => {
    const { wrapper } = await mountTabBar();
    expect(wrapper.get("button.add").attributes("data-pane-move-new-tab")).toBeDefined();
  });

  it("shows the look of the layer of a drop of images only while a dragged pane is over it", async () => {
    const { wrapper } = await mountTabBar();
    const { PaneMoveDrag } = await import("../stores/pane_move");
    const plus = wrapper.get("button.add");
    expect(plus.classes()).toContain("border-0");
    expect(plus.classes()).not.toContain("pane-drop-target");
    PaneMoveDrag.state.isNewTabTargeted = true;
    await flushPromises();
    expect(plus.classes()).toContain("pane-drop-target");
    expect(plus.classes()).not.toContain("border-0");
    PaneMoveDrag.state.isNewTabTargeted = false;
    await flushPromises();
    expect(plus.classes()).toContain("border-0");
    expect(plus.classes()).not.toContain("pane-drop-target");
  });

  it("draws the drop look with a border of 3 pixels in the color --accent and a background of the same color at 12 percent", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "TabBar.vue"), "utf8");
    expect(sourceText).toContain("--btn-border-width: 3px; --btn-border-color: var(--accent);");
    expect(sourceText).toContain("--btn-bg: color-mix(in srgb, var(--accent) 12%, transparent);");
  });
});

describe("TabBar rename in place", () => {
  it("shows the rename field in place of the name after a double click, and selects the tab", async () => {
    const { wrapper, session } = await mountTabBar();
    await wrapper.findAll("[role=tab]")[1].trigger("dblclick");
    expect(session.state.renaming).toBe("tab:t2");
    expect(session.state.selectedTabId).toBe("t2");
    expect(wrapper.findAll("input.rename")).toHaveLength(1);
    expect((wrapper.get("input.rename").element as HTMLInputElement).value).toBe("review");
  });

  it("saves the new name when the user presses Enter", async () => {
    const { wrapper, api, session } = await mountTabBar();
    await wrapper.findAll("[role=tab]")[1].trigger("dblclick");
    const input = wrapper.get("input.rename");
    await input.setValue("code review");
    await input.trigger("keydown.enter");
    await flushPromises();
    expect(api.renameTab).toHaveBeenCalledWith("t2", "code review");
    expect(session.state.renaming).toBeNull();
    expect(wrapper.find("input.rename").exists()).toBe(false);
  });

  it("does not save when the user presses Escape", async () => {
    const { wrapper, api, session } = await mountTabBar();
    await wrapper.findAll("[role=tab]")[0].trigger("dblclick");
    const input = wrapper.get("input.rename");
    await input.setValue("other");
    await input.trigger("keydown.esc");
    await flushPromises();
    expect(api.renameTab).not.toHaveBeenCalled();
    expect(session.state.renaming).toBeNull();
  });

  it("shows the rename field when the command search asks to rename the tab", async () => {
    const { wrapper, session } = await mountTabBar();
    session.startRename("tab", "t3");
    await flushPromises();
    expect(wrapper.findAll("input.rename")).toHaveLength(1);
    expect(session.state.selectedTabId).toBe("t3");
  });
});

describe("TabBar close", () => {
  beforeEach(() => {
    settings.confirmTabClose = true;
  });

  it("closes the tab at once, without the confirmation dialog, when the setting confirmTabClose is off", async () => {
    settings.confirmTabClose = false;
    const { wrapper, api } = await mountTabBar();
    await wrapper.findAll(".nav-link .confirm")[1].trigger("click");
    await flushPromises();
    expect(confirmDialog.open).toBe(false);
    expect(api.closeTab).toHaveBeenCalledWith("t2");
  });

  it("asks for confirmation before it closes the tab, and does not close before the answer", async () => {
    const { wrapper, api } = await mountTabBar();
    await wrapper.findAll(".nav-link .confirm")[1].trigger("click");
    expect(confirmDialog.open).toBe(true);
    expect(confirmDialog.title).toBe("Close the tab review");
    expect(api.closeTab).not.toHaveBeenCalled();
  });

  it("closes the tab after the user confirms", async () => {
    const { wrapper, api } = await mountTabBar();
    await wrapper.findAll(".nav-link .confirm")[1].trigger("click");
    answerConfirm(true);
    await flushPromises();
    expect(api.closeTab).toHaveBeenCalledWith("t2");
  });

  it("does not close the tab when the user cancels", async () => {
    const { wrapper, api } = await mountTabBar();
    await wrapper.findAll(".nav-link .confirm")[1].trigger("click");
    answerConfirm(false);
    await flushPromises();
    expect(api.closeTab).not.toHaveBeenCalled();
  });

  it("refuses to close the last tab of a workspace, shows an error notification, and asks no confirmation", async () => {
    const { wrapper, api, session } = await mountTabBar();
    session.state.selectedWorkspaceId = "w2";
    session.state.toast = "";
    await flushPromises();
    await wrapper.findAll(".nav-link .confirm")[0].trigger("click");
    await flushPromises();
    expect(confirmDialog.open).toBe(false);
    expect(api.closeTab).not.toHaveBeenCalled();
    expect(session.state.toast).toBe("You cannot close the last tab of a workspace.");
    expect(session.state.toastKind).toBe("error");
  });

  it("refuses to close the last tab of a workspace when the setting confirmTabClose is off", async () => {
    settings.confirmTabClose = false;
    const { wrapper, api, session } = await mountTabBar();
    session.state.selectedWorkspaceId = "w2";
    session.state.toast = "";
    await flushPromises();
    await wrapper.findAll(".nav-link .confirm")[0].trigger("click");
    await flushPromises();
    expect(api.closeTab).not.toHaveBeenCalled();
    expect(session.state.toast).toBe("You cannot close the last tab of a workspace.");
    expect(session.state.toastKind).toBe("error");
  });

  it("refuses to close the last tab of a workspace when the store function closeTab is called, as the command palette does", async () => {
    const { api, session } = await mountTabBar();
    session.state.toast = "";
    await session.closeTab("t4");
    expect(api.closeTab).not.toHaveBeenCalled();
    expect(session.state.toast).toBe("You cannot close the last tab of a workspace.");
    expect(session.state.toastKind).toBe("error");
  });

  it("closes a tab when the workspace has several tabs, and shows no error notification", async () => {
    const { api, session } = await mountTabBar();
    session.state.toast = "";
    await session.closeTab("t3");
    expect(api.closeTab).toHaveBeenCalledWith("t3");
    expect(session.state.toast).toBe("");
  });
});

/** Gives each tab a box of 100 by 40 pixels, side by side, because jsdom has no layout. */
function layOutTabs(wrapper: ReturnType<typeof mount>) {
  wrapper.findAll(".nav-item").forEach((item, index) => {
    item.element.getBoundingClientRect = () =>
      ({ left: index * 100, right: index * 100 + 100, top: 0, bottom: 40, width: 100, height: 40 }) as DOMRect;
  });
}

/** Moves the pointer of the mouse in the window, as the mouse does while a button is down. */
function movePointer(x: number, y: number) {
  window.dispatchEvent(new MouseEvent("pointermove", { clientX: x, clientY: y }));
}

/** Releases the button of the mouse in the window, then waits for the end of the task that removes the guard against the click. */
async function releasePointer() {
  window.dispatchEvent(new MouseEvent("pointerup"));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("TabBar move", () => {
  it("moves a tab after the user drags it to the end of the bar", async () => {
    const { wrapper, api } = await mountTabBar();
    layOutTabs(wrapper);
    await wrapper.findAll(".nav-link")[0].trigger("pointerdown", { button: 0, clientX: 50, clientY: 20 });
    movePointer(280, 20);
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".nav-link")[0].classes()).toContain("dragging");
    expect(wrapper.findAll(".nav-link")[2].classes()).toContain("drop-after");
    await releasePointer();
    expect(api.moveTab).toHaveBeenCalledWith("t1", 3);
  });

  it("moves a tab between two other tabs", async () => {
    const { wrapper, api } = await mountTabBar();
    layOutTabs(wrapper);
    await wrapper.findAll(".nav-link")[2].trigger("pointerdown", { button: 0, clientX: 250, clientY: 20 });
    movePointer(120, 20);
    await releasePointer();
    expect(api.moveTab).toHaveBeenCalledWith("t3", 1);
  });

  it("does not move a tab dropped on its own place", async () => {
    const { wrapper, api } = await mountTabBar();
    layOutTabs(wrapper);
    await wrapper.findAll(".nav-link")[1].trigger("pointerdown", { button: 0, clientX: 150, clientY: 20 });
    movePointer(160, 20);
    await releasePointer();
    expect(api.moveTab).not.toHaveBeenCalled();
  });

  it("does not move a tab after a click that moves the pointer by less than 5 pixels", async () => {
    const { wrapper, api } = await mountTabBar();
    layOutTabs(wrapper);
    await wrapper.findAll(".nav-link")[0].trigger("pointerdown", { button: 0, clientX: 50, clientY: 20 });
    movePointer(53, 20);
    await releasePointer();
    expect(api.moveTab).not.toHaveBeenCalled();
  });

  it("does not move a tab dropped far below the tab bar", async () => {
    const { wrapper, api } = await mountTabBar();
    layOutTabs(wrapper);
    await wrapper.findAll(".nav-link")[0].trigger("pointerdown", { button: 0, clientX: 50, clientY: 20 });
    movePointer(280, 300);
    await releasePointer();
    expect(api.moveTab).not.toHaveBeenCalled();
  });

  it("cancels the move of a tab when the user presses the key Escape", async () => {
    const { wrapper, api } = await mountTabBar();
    layOutTabs(wrapper);
    await wrapper.findAll(".nav-link")[0].trigger("pointerdown", { button: 0, clientX: 50, clientY: 20 });
    movePointer(280, 20);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await releasePointer();
    expect(api.moveTab).not.toHaveBeenCalled();
  });

  it("ignores a press of the right button of the mouse", async () => {
    const { wrapper, api } = await mountTabBar();
    layOutTabs(wrapper);
    await wrapper.findAll(".nav-link")[0].trigger("pointerdown", { button: 2, clientX: 50, clientY: 20 });
    movePointer(280, 20);
    await releasePointer();
    expect(api.moveTab).not.toHaveBeenCalled();
  });

  it("keeps the blue line before the first tab and after the last tab inside the tab bar, which clips what goes out of it", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "TabBar.vue"), "utf8");
    expect(sourceText).toContain(".nav-item:first-child .nav-link.drop-before::before { left: 0; }");
    expect(sourceText).toContain(".nav-item:last-child .nav-link.drop-after::after { right: 0; }");
  });

  it("does not start a drag of the browser, because the native window would take the drop as a drop of a file", async () => {
    const { wrapper } = await mountTabBar();
    for (const tab of wrapper.findAll(".nav-link")) {
      expect(tab.attributes("draggable")).toBeUndefined();
    }
  });

  it("moves the selected tab with the shortcut Shift+Option+Command+Right arrow", async () => {
    const { session, api } = await mountTabBar();
    await session.shiftTab(1);
    expect(api.moveTab).toHaveBeenCalledWith("t1", 2);
  });

  it("moves the selected tab with the shortcut Shift+Option+Command+Left arrow", async () => {
    const { session, api } = await mountTabBar();
    session.selectTab("t3");
    await session.shiftTab(-1);
    expect(api.moveTab).toHaveBeenCalledWith("t3", 1);
  });

  it("does not move the first tab to the left", async () => {
    const { session, api } = await mountTabBar();
    await session.shiftTab(-1);
    expect(api.moveTab).not.toHaveBeenCalled();
  });
});

describe("TabBar height", () => {
  it("gives a tab a fixed height, and a rename field that fits in it, so that the rename does not make the tab bar higher", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "TabBar.vue"), "utf8");
    const heightOfTab = /\.nav-tabs \.nav-link \{[^}]*height: (\d+)px/.exec(sourceText);
    const heightOfField = /\.nav-link \.tab-rename \{[^}]*height: (\d+)px/.exec(sourceText);
    expect(heightOfTab).not.toBeNull();
    expect(heightOfField).not.toBeNull();
    expect(Number(heightOfField![1])).toBeLessThanOrEqual(Number(heightOfTab![1]) - 2);
  });

  it("gives a tab 18px of horizontal padding and a width of 170px at least, so that the tabs are not tightly packed", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "TabBar.vue"), "utf8");
    expect(sourceText).toContain("--nav-link-padding-x: 18px;");
    expect(sourceText).toContain(".nav-item { flex: 0 1 auto; min-width: 170px; max-width: 260px; }");
  });

  it("gives the rename field the class tab-rename", async () => {
    const { wrapper } = await mountTabBar();
    await wrapper.findAll("[role=tab]")[0].trigger("dblclick");
    expect(wrapper.get("input.rename").classes()).toContain("tab-rename");
  });
});

describe("TabBar join with the panes", () => {
  it("has no gap above the panes: the bar goes 1 pixel over them, and the selected tab is 1 pixel higher than the other tabs", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "TabBar.vue"), "utf8");
    expect(sourceText).toMatch(/\.tab-bar \{[^}]*margin-bottom: -1px/);
    expect(sourceText).not.toMatch(/\.tab-bar \{[^}]*margin-bottom: var\(--pane-gap\)/);
    const heightOfTab = /\.nav-tabs \.nav-link \{[^}]*height: (\d+)px/.exec(sourceText);
    const heightOfSelectedTab = /\.nav-tabs \.nav-link\.active \{[^}]*height: (\d+)px/.exec(sourceText);
    expect(Number(heightOfSelectedTab![1]) - Number(heightOfTab![1])).toBe(1);
  });

  it("draws the outline of the selected tab with the color of the ring of the selected pane, and has no border at its bottom", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "TabBar.vue"), "utf8");
    expect(sourceText).toContain(
      "--nav-tabs-link-active-border-color: var(--pane-ring-selected) var(--pane-ring-selected) var(--bg);",
    );
    expect(sourceText).toMatch(/\.nav-tabs \.nav-link\.active \{[^}]*border-bottom-width: 0/);
  });

  it("draws the ring of the selected pane and of a blocked pane with the top border of the pane, so that it joins the selected tab", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "PaneCard.vue"), "utf8");
    expect(sourceText).toMatch(/\.pane\.selected \{ border-top-color: var\(--pane-ring-selected\);[^}]*\}/);
    expect(sourceText).toMatch(/\.pane\.blocked \{ border-top-color: var\(--pane-ring-blocked\);[^}]*\}/);
    expect(sourceText).toMatch(/\.pane\.blocked\.selected \{ border-top-color: var\(--pane-ring-blocked-selected\);[^}]*\}/);
    expect(sourceText).not.toMatch(/\.pane[^{]*\{[^}]*box-shadow: inset/);
  });

  it("draws the ring of the selected pane and of a blocked pane on the left, on the right, and at the bottom just inside the border, because the viewport hides the border there", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "PaneCard.vue"), "utf8");
    expect(sourceText).toMatch(/\.pane::after \{[^}]*inset: 0;[^}]*pointer-events: none;[^}]*border-width: 0 1px 1px;/);
    expect(sourceText).toMatch(/\.pane\.selected::after \{ border-color: var\(--pane-ring-selected\); \}/);
    expect(sourceText).toMatch(/\.pane\.blocked::after \{ border-color: var\(--pane-ring-blocked\); \}/);
    expect(sourceText).toMatch(/\.pane\.blocked\.selected::after \{ border-color: var\(--pane-ring-blocked-selected\); \}/);
  });
});

describe("TabBar without the workspace selector", () => {
  it("starts with the tabs, at the left edge of the panes, and has no workspace button: the status bar has the workspace selector", async () => {
    const { wrapper } = await mountTabBar();
    const children = Array.from(wrapper.get(".tab-bar").element.children);
    expect(children[0].classList.contains("nav-tabs")).toBe(true);
    expect(children[1].classList.contains("add")).toBe(true);
    expect(wrapper.find(".workspace-button").exists()).toBe(false);
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "TabBar.vue"), "utf8");
    expect(sourceText).not.toContain("WorkspaceButton");
    expect(sourceText).toMatch(/\.tab-bar \{[^}]*padding: 4px var\(--pane-radius\) 0 0;/);
  });
});

describe("TabBar place in the window", () => {
  it("sits on top of the viewport: the file App.vue shows the tab bar before the viewport", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "../App.vue"), "utf8");
    const tabBarIndex = sourceText.indexOf("<TabBar ");
    expect(tabBarIndex).toBeGreaterThan(-1);
    expect(tabBarIndex).toBeLessThan(sourceText.indexOf('<div class="stage"'));
  });
});
