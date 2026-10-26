import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import Fs from "node:fs";
import Path from "node:path";
import type { SessionSnapshot } from "../lib/types";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("../lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/api")>();
  return {
    ...original,
    moveWorkspace: vi.fn(async () => ({})),
  };
});

/**
 * Three workspaces: scratch runs only a shell, heidrun and teamwright run an agent. The order of Herdr is the order of
 * `workspaceIds`, and Herdr numbers the workspaces in this order.
 */
function makeSnapshot(workspaceIds: string[] = ["w3", "w1", "w2"], panes?: Record<string, unknown>[]): SessionSnapshot {
  const workspaces = [
    { workspace_id: "w1", number: 1, label: "heidrun", agent_status: "idle", tab_count: 2 },
    { workspace_id: "w2", number: 2, label: "teamwright", agent_status: "blocked", tab_count: 1 },
    { workspace_id: "w3", number: 3, label: "scratch", agent_status: "idle", tab_count: 1 },
  ];
  return {
    workspaces: workspaceIds.map((id, index) => ({
      ...workspaces.find((workspace) => workspace.workspace_id === id),
      number: index + 1,
    })),
    tabs: [],
    panes: panes ?? [
      { pane_id: "p1", workspace_id: "w1", tab_id: "t1", agent: "claude", agent_status: "idle", cwd: "/work/heidrun" },
      { pane_id: "p2", workspace_id: "w2", tab_id: "t2", agent: "codex", agent_status: "blocked", cwd: "/work/teamwright" },
      { pane_id: "p3", workspace_id: "w3", tab_id: "t3" },
    ],
    agents: [],
    layouts: [],
  } as unknown as SessionSnapshot;
}

async function mountList(snapshot: SessionSnapshot = makeSnapshot()) {
  const session = await import("../stores/session");
  const api = await import("../lib/api");
  const { git } = await import("../stores/git");
  const { default: NeedsYouWorkspaces } = await import("./NeedsYouWorkspaces.vue");
  session.state.snapshot = snapshot;
  session.state.selectedWorkspaceId = "w1";
  session.state.selectedTabId = null;
  session.state.selectedPaneId = null;
  git.status = {};
  const wrapper = mount(NeedsYouWorkspaces, { attachTo: document.body });
  return { session, api, git, wrapper };
}

/** Gives every row a box of 32 pixels, one under the other, because jsdom has no layout. */
function giveRowsABox(rows: HTMLElement[]): void {
  rows.forEach((row, rowIndex) => {
    row.getBoundingClientRect = () =>
      ({ left: 0, right: 200, top: rowIndex * 32, bottom: rowIndex * 32 + 32, width: 200, height: 32, x: 0, y: rowIndex * 32 }) as DOMRect;
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("NeedsYouWorkspaces list", () => {
  it("has a separator line, the title Workspaces, and one row for each workspace", async () => {
    const { wrapper } = await mountList();
    expect(wrapper.classes()).toContain("border-top");
    expect(wrapper.get(".title").text()).toBe("Workspaces");
    expect(wrapper.get("[role=group]").attributes("aria-label")).toBe("Workspaces");
    expect(wrapper.findAll(".workspace-row")).toHaveLength(3);
  });

  it("shows the workspaces in the order of Herdr, the same list as the workspace status bar section, and not grouped by agent", async () => {
    const { wrapper, session } = await mountList();
    const names = wrapper.findAll(".workspace-row .name").map((name) => name.text());
    expect(names).toEqual(["scratch", "heidrun", "teamwright"]);
    expect(names).toEqual(session.workspaces.value.map((workspace) => workspace.label));
  });

  it("never changes the order when the status of an agent changes: start, block, finish, and stop", async () => {
    const { wrapper, session } = await mountList();
    const names = () => wrapper.findAll(".workspace-row .name").map((name) => name.text());
    const order = ["scratch", "heidrun", "teamwright"];
    expect(names()).toEqual(order);
    const withStatus = (status: string) => [
      { pane_id: "p1", workspace_id: "w1", tab_id: "t1", agent: "claude", agent_status: status, cwd: "/work/heidrun" },
      { pane_id: "p2", workspace_id: "w2", tab_id: "t2", agent: "codex", agent_status: status, cwd: "/work/teamwright" },
      { pane_id: "p3", workspace_id: "w3", tab_id: "t3", agent: "claude", agent_status: status, cwd: "/work/scratch" },
    ];
    for (const status of ["idle", "working", "blocked", "done"]) {
      session.state.snapshot = makeSnapshot(["w3", "w1", "w2"], withStatus(status));
      await wrapper.vm.$nextTick();
      expect(names()).toEqual(order);
    }
    session.state.snapshot = makeSnapshot(["w3", "w1", "w2"], [
      { pane_id: "p3", workspace_id: "w3", tab_id: "t3", agent: "claude", agent_status: "working", cwd: "/work/scratch" },
    ]);
    await wrapper.vm.$nextTick();
    expect(names()).toEqual(order);
    session.state.snapshot = makeSnapshot(["w3", "w1", "w2"], []);
    await wrapper.vm.$nextTick();
    expect(names()).toEqual(order);
  });

  it("shows the same order as the information card of the workspace status bar section, and follows a change of the order", async () => {
    const { session, wrapper } = await mountList();
    const { default: WorkspaceStatusSummary } = await import("./WorkspaceStatusSummary.vue");
    const summary = mount(WorkspaceStatusSummary, { attachTo: document.body });
    await summary.get(".workspace-status").trigger("click");
    const cardNames = () => summary.findAll(".popover .workspace-row .name").map((name) => name.text());
    const listNames = () => wrapper.findAll(".workspace-row .name").map((name) => name.text());
    expect(listNames()).toEqual(cardNames());
    session.state.snapshot = makeSnapshot(["w2", "w3", "w1"]);
    await wrapper.vm.$nextTick();
    expect(listNames()).toEqual(["teamwright", "scratch", "heidrun"]);
    expect(listNames()).toEqual(cardNames());
  });

  it("gives every workspace a dot: a ring when no agent runs, and a colored dot for the status of the agents", async () => {
    const { wrapper } = await mountList();
    const dots = wrapper.findAll(".workspace-row .dot");
    expect(dots).toHaveLength(3);
    expect(dots.map((dot) => dot.classes("blocked"))).toEqual([false, false, true]);
    expect(dots.map((dot) => dot.classes("quiet"))).toEqual([true, false, false]);
  });

  it("marks the selected workspace, and moves the mark when the selection changes", async () => {
    const { wrapper, session } = await mountList();
    expect(wrapper.findAll(".workspace-row").map((row) => row.classes("active"))).toEqual([false, true, false]);
    expect(wrapper.findAll(".workspace-main").map((row) => row.attributes("aria-current"))).toEqual(["false", "true", "false"]);
    session.selectWorkspace("w3");
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".workspace-row").map((row) => row.classes("active"))).toEqual([true, false, false]);
  });

  it("selects the workspace after a click on a row", async () => {
    const { wrapper, session } = await mountList();
    await wrapper.findAll(".workspace-main")[2].trigger("click");
    expect(session.state.selectedWorkspaceId).toBe("w2");
    expect(wrapper.findAll(".workspace-row").map((row) => row.classes("active"))).toEqual([false, false, true]);
  });

  it("shows nothing when Herdr has no workspace", async () => {
    const { wrapper } = await mountList({ workspaces: [], tabs: [], panes: [], agents: [], layouts: [] } as unknown as SessionSnapshot);
    expect(wrapper.find(".title").exists()).toBe(false);
    expect(wrapper.find(".workspace-row").exists()).toBe(false);
  });

  it("has no button to rename or to close a workspace: the information card keeps them", async () => {
    const { wrapper } = await mountList();
    expect(wrapper.findAll("button")).toHaveLength(3);
    expect(wrapper.find(".row-actions").exists()).toBe(false);
  });
});

describe("NeedsYouWorkspaces Git branch", () => {
  it("shows the current Git branch of each workspace after its name, and nothing for a workspace without a branch", async () => {
    const { wrapper, git } = await mountList();
    expect(wrapper.findAll(".branch")).toHaveLength(0);
    git.status = {
      w1: { branch: "dev_jerome" },
      w2: { branch: "main" },
      w3: null,
    } as unknown as typeof git.status;
    await wrapper.vm.$nextTick();
    const rows = wrapper.findAll(".workspace-row");
    expect(rows.map((row) => row.find(".branch").exists())).toEqual([false, true, true]);
    expect(rows.slice(1).map((row) => row.get(".branch").text())).toEqual(["dev_jerome", "main"]);
    const children = Array.from(rows[1].get(".workspace-main").element.children);
    expect(children.map((child) => child.className.split(" ")[0])).toEqual(["dot", "name", "branch"]);
  });

  it("follows a change of the branch", async () => {
    const { wrapper, git } = await mountList();
    git.status = { w1: { branch: "dev_jerome" } } as unknown as typeof git.status;
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".branch").text()).toBe("dev_jerome");
    git.status = { w1: { branch: "fix-417" } } as unknown as typeof git.status;
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".branch").text()).toBe("fix-417");
  });

  it("gives the whole name of the branch as the tooltip, and selects the workspace after a click on the branch", async () => {
    const { wrapper, git, session } = await mountList();
    git.status = { w2: { branch: "a-very-long-branch-name-that-does-not-fit" } } as unknown as typeof git.status;
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".branch").attributes("title")).toBe("a-very-long-branch-name-that-does-not-fit");
    await wrapper.get(".branch").trigger("click");
    expect(session.state.selectedWorkspaceId).toBe("w2");
  });

  it("puts the branch at the right end of the row, and cuts a long branch with an ellipsis", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "NeedsYouWorkspaces.vue"), "utf8");
    expect(sourceText).toMatch(/\.branch \{[^}]*margin-left: auto;/);
    expect(sourceText).toMatch(/\.branch \{[^}]*max-width: 50%;/);
    expect(sourceText).toMatch(/\.branch \{[^}]*text-overflow: ellipsis;/);
  });
});

describe("NeedsYouWorkspaces drag and drop", () => {
  it("moves a workspace to the gap where the pointer is released, like the information card", async () => {
    const { wrapper, api } = await mountList();
    const rows = wrapper.findAll(".workspace-row");
    giveRowsABox(rows.map((row) => row.element as HTMLElement));
    await rows[0].trigger("pointerdown", { button: 0, clientX: 20, clientY: 16 });
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 20, clientY: 40 }));
    await wrapper.vm.$nextTick();
    expect(rows[0].classes("dragging")).toBe(true);
    expect(rows[1].classes("drop-before")).toBe(true);
    expect(rows[2].classes("drop-after")).toBe(false);
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 20, clientY: 90 }));
    await wrapper.vm.$nextTick();
    expect(rows[1].classes("drop-before")).toBe(false);
    expect(rows[2].classes("drop-after")).toBe(true);
    window.dispatchEvent(new MouseEvent("pointerup", { clientX: 20, clientY: 90 }));
    await wrapper.vm.$nextTick();
    expect(api.moveWorkspace).toHaveBeenCalledTimes(1);
    expect(api.moveWorkspace).toHaveBeenCalledWith("w3", 3);
    expect(rows[0].classes("dragging")).toBe(false);
  });

  it("does not select the workspace that the developer drags", async () => {
    const { wrapper, session } = await mountList();
    const rows = wrapper.findAll(".workspace-row");
    giveRowsABox(rows.map((row) => row.element as HTMLElement));
    await rows[2].trigger("pointerdown", { button: 0, clientX: 20, clientY: 80 });
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 20, clientY: 5 }));
    window.dispatchEvent(new MouseEvent("pointerup", { clientX: 20, clientY: 5 }));
    await wrapper.findAll(".workspace-main")[2].trigger("click");
    expect(session.state.selectedWorkspaceId).toBe("w1");
  });

  it("keeps the selection and moves nothing after a short press, which is a click", async () => {
    const { wrapper, api } = await mountList();
    const rows = wrapper.findAll(".workspace-row");
    giveRowsABox(rows.map((row) => row.element as HTMLElement));
    await rows[0].trigger("pointerdown", { button: 0, clientX: 20, clientY: 16 });
    window.dispatchEvent(new MouseEvent("pointerup", { clientX: 20, clientY: 16 }));
    expect(api.moveWorkspace).not.toHaveBeenCalled();
  });
});

describe("NeedsYouWorkspaces look", () => {
  it("stays at the bottom: it does not shrink, and its rows are 40 pixels tall", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "NeedsYouWorkspaces.vue"), "utf8");
    expect(sourceText).toMatch(/\.needs-you-workspaces \{[^}]*flex-shrink: 0;/);
    expect(sourceText).toMatch(/\.workspace-row \{[^}]*min-height: 40px;/);
    expect(sourceText).toMatch(/\.workspace-main \{[^}]*align-self: stretch;/);
  });

  it("touches the left, the right, and the bottom border of the sidebar section, with space only above the title", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "NeedsYouWorkspaces.vue"), "utf8");
    expect(sourceText).toMatch(/\.needs-you-workspaces \{[^}]*padding: 12px 0 0;/);
  });

  it("gives the highlight of a row no rounded corner and no space between two rows", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "NeedsYouWorkspaces.vue"), "utf8");
    expect(sourceText).toMatch(/\.workspace-row \{[^}]*border-radius: 0;/);
    expect(sourceText).toMatch(/\.workspace-main \{[^}]*border-radius: 0;/);
    expect(sourceText).not.toMatch(/\.workspace-row(:hover|:focus-within|\.active)[^{]*\{[^}]*border-radius/);
  });

  it("puts the title and the status dot at the same distance from the left border as the first character of the message of the cards", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "NeedsYouWorkspaces.vue"), "utf8");
    const panelText = Fs.readFileSync(Path.resolve(import.meta.dirname, "ToHandlePanel.vue"), "utf8");
    const cardsPadding = /\.to-handle \{[^}]*padding: \d+px (\d+)px \d+px;/.exec(panelText);
    const messagePadding = /\.empty \{[^}]*padding: (\d+)px;/.exec(panelText);
    const titlePadding = /\.title \{[^}]*padding: 0 (\d+)px \d+px;/.exec(sourceText);
    const rowPadding = /\.workspace-main \{[^}]*padding-left: (\d+)px;/.exec(sourceText);
    expect(cardsPadding).not.toBeNull();
    expect(messagePadding).not.toBeNull();
    expect(titlePadding).not.toBeNull();
    expect(rowPadding).not.toBeNull();
    const messageDistance = Number(cardsPadding![1]) + Number(messagePadding![1]);
    expect(Number(titlePadding![1])).toBe(messageDistance);
    expect(Number(rowPadding![1])).toBe(messageDistance);
  });

  it("writes its spacing in its style block, because the Bootstrap parts of the application have no utility class for it", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "NeedsYouWorkspaces.vue"), "utf8");
    const templateText = sourceText.slice(0, sourceText.indexOf("<style"));
    expect(templateText).not.toMatch(/class="[^"]*\b(px|pb|pt|ms|me)-(auto|[0-9])/);
  });
});

describe("NeedsYouWorkspaces height (issue #807)", () => {
  /** Mounts the list in a Needs you sidebar section of 900 pixels, with a list of `height` pixels, because jsdom has no layout. */
  async function mountInSection(height = 200) {
    const mounted = await mountList();
    const element = mounted.wrapper.get(".needs-you-workspaces").element as HTMLElement;
    const section = document.createElement("div");
    element.parentElement!.insertBefore(section, element);
    section.appendChild(element);
    section.getBoundingClientRect = () => ({ top: 0, bottom: 900, height: 900, left: 0, right: 300, width: 300, x: 0, y: 0 }) as DOMRect;
    element.getBoundingClientRect = () => ({ top: 900 - height, bottom: 900, height, left: 0, right: 300, width: 300, x: 0, y: 900 - height }) as DOMRect;
    const { settings } = await import("../stores/settings");
    settings.needsYouWorkspacesHeight = 0;
    await mounted.wrapper.vm.$nextTick();
    return { ...mounted, settings, resizer: mounted.wrapper.get(".workspaces-resizer") };
  }

  it("has a line to drag above the title, with the title of the other lines to drag", async () => {
    const { wrapper, resizer } = await mountInSection();
    expect(resizer.attributes("role")).toBe("separator");
    expect(resizer.attributes("aria-orientation")).toBe("horizontal");
    expect(resizer.attributes("tabindex")).toBe("0");
    expect(resizer.attributes("title")).toBe("Drag to resize · double-click to go back to the default size");
    const children = Array.from(wrapper.get(".needs-you-workspaces").element.children).map((child) => child.className.split(" ")[0]);
    expect(children.slice(0, 2)).toEqual(["workspaces-resizer", "title"]);
  });

  it("keeps the default height until the developer drags the line", async () => {
    const { wrapper, settings } = await mountInSection();
    expect(settings.needsYouWorkspacesHeight).toBe(0);
    expect(wrapper.get(".needs-you-workspaces").attributes("style") ?? "").not.toContain("height");
  });

  it("makes the list taller when the line is dragged up, and smaller when it is dragged down", async () => {
    const { wrapper, settings, resizer } = await mountInSection(200);
    await resizer.trigger("pointerdown", { clientY: 700, pointerId: 1 });
    await resizer.trigger("pointermove", { clientY: 600, pointerId: 1 });
    expect(wrapper.get(".needs-you-workspaces").attributes("style")).toContain("height: 300px");
    await resizer.trigger("pointermove", { clientY: 750, pointerId: 1 });
    expect(wrapper.get(".needs-you-workspaces").attributes("style")).toContain("height: 150px");
    // The setting is saved once, when the drag ends, and not on each move.
    expect(settings.needsYouWorkspacesHeight).toBe(0);
    await resizer.trigger("pointerup", { pointerId: 1 });
    expect(settings.needsYouWorkspacesHeight).toBe(150);
    await resizer.trigger("pointermove", { clientY: 100, pointerId: 1 });
    expect(settings.needsYouWorkspacesHeight).toBe(150);
  });

  it("never makes the list smaller than the title and one row, nor taller than the section minus 80 pixels for the cards", async () => {
    const { settings, resizer } = await mountInSection(200);
    await resizer.trigger("pointerdown", { clientY: 700, pointerId: 1 });
    await resizer.trigger("pointermove", { clientY: 899, pointerId: 1 });
    await resizer.trigger("pointerup", { pointerId: 1 });
    expect(settings.needsYouWorkspacesHeight).toBe(84);
    await resizer.trigger("pointerdown", { clientY: 700, pointerId: 1 });
    await resizer.trigger("pointermove", { clientY: 0, pointerId: 1 });
    await resizer.trigger("pointerup", { pointerId: 1 });
    expect(settings.needsYouWorkspacesHeight).toBe(820);
  });

  it("saves the height in the settings, and reads it back after a restart", async () => {
    const { resizer } = await mountInSection(200);
    await resizer.trigger("pointerdown", { clientY: 700, pointerId: 1 });
    await resizer.trigger("pointermove", { clientY: 650, pointerId: 1 });
    await resizer.trigger("pointerup", { pointerId: 1 });
    // The settings are saved after the change, in a watcher.
    await new Promise((resolve) => setTimeout(resolve, 0));
    vi.resetModules();
    const restarted = await import("../stores/settings");
    expect(restarted.settings.needsYouWorkspacesHeight).toBe(250);
  });

  it("gives the cursor back when the list disappears during a drag", async () => {
    const { session, wrapper, resizer } = await mountInSection(200);
    await resizer.trigger("pointerdown", { clientY: 700, pointerId: 1 });
    expect(document.body.style.cursor).toBe("row-resize");
    session.state.snapshot = { ...session.state.snapshot!, workspaces: [] };
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".needs-you-workspaces").exists()).toBe(false);
    expect(document.body.style.cursor).toBe("");
  });

  it("goes back to the default height after a double click on the line", async () => {
    const { wrapper, settings, resizer } = await mountInSection(200);
    settings.needsYouWorkspacesHeight = 400;
    await resizer.trigger("dblclick");
    expect(settings.needsYouWorkspacesHeight).toBe(0);
    expect(wrapper.get(".needs-you-workspaces").attributes("style") ?? "").not.toContain("height");
  });

  it("changes the height with the up and down arrow keys, by 10 pixels, and by 40 pixels with Shift", async () => {
    const { settings, resizer } = await mountInSection(200);
    await resizer.trigger("keydown", { key: "ArrowUp" });
    expect(settings.needsYouWorkspacesHeight).toBe(210);
    await resizer.trigger("keydown", { key: "ArrowDown", shiftKey: true });
    expect(settings.needsYouWorkspacesHeight).toBe(160);
  });

  it("keeps the last 80 pixels for the cards also when the window gets smaller after the drag", async () => {
    const { wrapper, settings } = await mountInSection(200);
    settings.needsYouWorkspacesHeight = 400;
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".needs-you-workspaces").attributes("style")).toContain("max-height: calc(100% - 80px)");
  });

  it("scrolls only the rows when they do not fit, so that the title stays", () => {
    const sourceText = Fs.readFileSync(Path.resolve(import.meta.dirname, "NeedsYouWorkspaces.vue"), "utf8");
    expect(sourceText).toMatch(/\.workspace-rows \{[^}]*min-height: 0;[^}]*overflow-y: auto;/);
    expect(sourceText).toMatch(/\.title \{[^}]*flex-shrink: 0;/);
    expect(sourceText).not.toMatch(/\.needs-you-workspaces \{[^}]*overflow-y: auto;/);
  });

  it("keeps the smallest height only for a chosen height, so that the default height stays the height of the rows", async () => {
    const { wrapper, settings } = await mountInSection(200);
    expect(wrapper.get(".needs-you-workspaces").attributes("style") ?? "").not.toContain("min-height");
    settings.needsYouWorkspacesHeight = 300;
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".needs-you-workspaces").attributes("style")).toContain("min-height: 84px");
  });
});

describe("NeedsYouWorkspaces recording icon (issue 762)", () => {
  it("shows the recording icon on the row of the workspace whose pane records", async () => {
    const { settings } = await import("../stores/settings");
    const { voiceInput } = await import("../stores/voice_input");
    const { wrapper } = await mountList();
    settings.voiceInput = true;
    voiceInput.ownerPaneId = "p2";
    voiceInput.state = "recording";
    try {
      await wrapper.vm.$nextTick();
      const rows = wrapper.findAll(".workspace-row");
      expect(rows.map((row) => row.find(".name").text())).toEqual(["scratch", "heidrun", "teamwright"]);
      expect(rows.map((row) => row.find(".voice-recording-icon").exists())).toEqual([false, false, true]);
      voiceInput.state = "idle";
      await wrapper.vm.$nextTick();
      expect(wrapper.find(".voice-recording-icon").exists()).toBe(false);
    } finally {
      voiceInput.ownerPaneId = null;
      voiceInput.state = "idle";
      settings.voiceInput = false;
    }
  });
});
