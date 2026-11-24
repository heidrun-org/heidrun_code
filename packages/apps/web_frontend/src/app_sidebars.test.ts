import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, shallowMount } from "@vue/test-utils";
import type { SessionSnapshot } from "./lib/types";

vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("./components/TerminalView.vue", () => ({ default: { render: () => null } }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ onDragDropEvent: vi.fn(async () => () => {}) }) }));
vi.mock("./stores/session", async (importOriginal) => ({ ...(await importOriginal<typeof import("./stores/session")>()), start: vi.fn() }));
vi.mock("./stores/project", async (importOriginal) => ({ ...(await importOriginal<typeof import("./stores/project")>()), startProjects: vi.fn() }));
vi.mock("./stores/git", async (importOriginal) => ({ ...(await importOriginal<typeof import("./stores/git")>()), startGit: vi.fn() }));
vi.mock("./stores/alerts", async (importOriginal) => ({ ...(await importOriginal<typeof import("./stores/alerts")>()), startAlerts: vi.fn() }));
vi.mock("./stores/statusItem", async (importOriginal) => ({ ...(await importOriginal<typeof import("./stores/statusItem")>()), startStatusItem: vi.fn() }));
vi.mock("./stores/history", async (importOriginal) => ({ ...(await importOriginal<typeof import("./stores/history")>()), loadHistory: vi.fn() }));
vi.mock("./stores/mobile", async (importOriginal) => ({ ...(await importOriginal<typeof import("./stores/mobile")>()), startMobile: vi.fn() }));
vi.mock("./stores/claude", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./stores/claude")>()),
  loadClaudeLink: vi.fn(),
  startRemoteWatch: vi.fn(),
}));

const SNAPSHOT = {
  workspaces: [{ workspace_id: "w1", number: 1, label: "heidrun", agent_status: "idle" }],
  tabs: [{ tab_id: "t1", workspace_id: "w1", number: 1, label: "build", agent_status: "idle" }],
  panes: [{ pane_id: "p1", workspace_id: "w1", tab_id: "t1", agent: "claude", agent_status: "idle" }],
  agents: [],
  layouts: [],
} as unknown as SessionSnapshot;

/** The windows that a test mounted: each one listens to the keys of the window, so a test unmounts them all at its end. */
const mountedWindows: { unmount: () => void }[] = [];

/** Mounts the window with its real top bar. Every other part of the window is a stub that only keeps its place. */
async function mountApp() {
  window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })) as unknown as typeof window.matchMedia;
  const session = await import("./stores/session");
  const settingsStore = await import("./stores/settings");
  const notes = await import("./stores/notes");
  const { default: App } = await import("./App.vue");
  session.state.snapshot = SNAPSHOT;
  session.state.selectedWorkspaceId = "w1";
  session.state.selectedTabId = "t1";
  session.state.selectedPaneId = "p1";
  settingsStore.settings.leftCollapsed = false;
  settingsStore.settings.rightCollapsed = false;
  settingsStore.settings.leftSidebarSection = "launchers";
  settingsStore.settings.rightSidebarSection = "toHandle";
  const wrapper = shallowMount(App, { attachTo: document.body, global: { stubs: { TopBar: false, Icon: false, MoreMenu: true, ThemeMenu: true } } });
  mountedWindows.push(wrapper);
  await flushPromises();
  return { wrapper, session, settings: settingsStore.settings, notes };
}

/** The names of the children of the area under the top bar, from the left to the right. The gap of a collapsed sidebar is named "gap". */
function bodyChildren(wrapper: Awaited<ReturnType<typeof mountApp>>["wrapper"]): string[] {
  return Array.from(wrapper.get(".body").element.children).map((child) => (child.classList.contains("sidebar-gap") ? "gap" : child.tagName.toLowerCase()));
}

/** Presses a shortcut of the window. */
function press(code: string, options: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent("keydown", { code, metaKey: true, bubbles: true, cancelable: true, ...options }));
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
});

afterEach(() => {
  for (const mountedWindow of mountedWindows.splice(0)) {
    mountedWindow.unmount();
  }
});

describe("window with the two sidebars", () => {
  it("shows the left sidebar, the viewport, and the right sidebar, with a line to drag between each pair", async () => {
    const { wrapper } = await mountApp();
    expect(bodyChildren(wrapper)).toEqual(["sidebar-stub", "resizer-stub", "main", "resizer-stub", "right-panel-stub"]);
  });

  it("has no hide button for a sidebar in the top bar", async () => {
    const { wrapper } = await mountApp();
    expect(wrapper.find(".top [aria-pressed]").exists()).toBe(false);
		const buttons = wrapper.findAll('.top button:not([aria-hidden="true"])');
		expect(buttons.map((button) => button.attributes('title'))).toEqual(['Search or run a command']);
  });
});

describe("the shortcut Command+B", () => {
  it("collapses the left sidebar to the sidebar icon bar, without its line to drag", async () => {
    const { wrapper, settings } = await mountApp();
    press("KeyB");
    await wrapper.vm.$nextTick();
    expect(settings.leftCollapsed).toBe(true);
    expect(bodyChildren(wrapper)).toEqual(["sidebar-stub", "gap", "main", "resizer-stub", "right-panel-stub"]);
  });

  it("expands the left sidebar again with a second press", async () => {
    const { wrapper, settings } = await mountApp();
    press("KeyB");
    await wrapper.vm.$nextTick();
    press("KeyB");
    await wrapper.vm.$nextTick();
    expect(settings.leftCollapsed).toBe(false);
    expect(bodyChildren(wrapper)).toEqual(["sidebar-stub", "resizer-stub", "main", "resizer-stub", "right-panel-stub"]);
  });

  it("does not change the right sidebar", async () => {
    const { wrapper, settings } = await mountApp();
    press("KeyB");
    await wrapper.vm.$nextTick();
    expect(settings.rightCollapsed).toBe(false);
  });
});

describe("the shortcut Option+Command+B", () => {
  it("collapses the right sidebar to the sidebar icon bar, without its line to drag", async () => {
    const { wrapper, settings } = await mountApp();
    press("KeyB", { altKey: true });
    await wrapper.vm.$nextTick();
    expect(settings.rightCollapsed).toBe(true);
    expect(bodyChildren(wrapper)).toEqual(["sidebar-stub", "resizer-stub", "main", "gap", "right-panel-stub"]);
  });

  it("expands the right sidebar again with a second press", async () => {
    const { wrapper, settings } = await mountApp();
    press("KeyB", { altKey: true });
    await wrapper.vm.$nextTick();
    press("KeyB", { altKey: true });
    await wrapper.vm.$nextTick();
    expect(settings.rightCollapsed).toBe(false);
    expect(bodyChildren(wrapper)).toEqual(["sidebar-stub", "resizer-stub", "main", "resizer-stub", "right-panel-stub"]);
  });

  it("does not change the left sidebar", async () => {
    const { wrapper, settings } = await mountApp();
    press("KeyB", { altKey: true });
    await wrapper.vm.$nextTick();
    expect(settings.leftCollapsed).toBe(false);
  });
});

describe("collapsing both sidebars", () => {
  it("keeps the two sidebar icon bars, and the viewport takes the rest of the width", async () => {
    const { wrapper } = await mountApp();
    press("KeyB");
    press("KeyB", { altKey: true });
    await wrapper.vm.$nextTick();
    expect(bodyChildren(wrapper)).toEqual(["sidebar-stub", "gap", "main", "gap", "right-panel-stub"]);
    expect(wrapper.find("resizer-stub").exists()).toBe(false);
  });

  it("keeps the tab bar and the panes in the viewport", async () => {
    const { wrapper, settings } = await mountApp();
    settings.leftCollapsed = true;
    settings.rightCollapsed = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.get("main").find("tab-bar-stub").exists()).toBe(true);
    expect(wrapper.get("main").find("pane-grid-stub").exists()).toBe(true);
  });
});

describe("opening a sidebar section while its sidebar is collapsed", () => {
  it("expands the right sidebar, with the Clipboard sidebar section, when the shortcut Shift+Command+P pins a text", async () => {
    const { wrapper, settings, notes } = await mountApp();
    settings.rightCollapsed = true;
    await wrapper.vm.$nextTick();
    expect(bodyChildren(wrapper)).toEqual(["sidebar-stub", "resizer-stub", "main", "gap", "right-panel-stub"]);
    notes.selectionReaders.set("p1", () => "text to keep");
    press("KeyP", { shiftKey: true });
    await wrapper.vm.$nextTick();
    expect(settings.rightCollapsed).toBe(false);
    expect(settings.rightSidebarSection).toBe("notes");
    expect(bodyChildren(wrapper)).toEqual(["sidebar-stub", "resizer-stub", "main", "resizer-stub", "right-panel-stub"]);
  });

  it("does not expand the left sidebar when the right sidebar holds the sidebar section", async () => {
    const { wrapper, settings, notes } = await mountApp();
    settings.leftCollapsed = true;
    settings.rightCollapsed = true;
    await wrapper.vm.$nextTick();
    notes.selectionReaders.set("p1", () => "text to keep");
    press("KeyP", { shiftKey: true });
    await wrapper.vm.$nextTick();
    expect(settings.leftCollapsed).toBe(true);
    expect(bodyChildren(wrapper)).toEqual(["sidebar-stub", "gap", "main", "resizer-stub", "right-panel-stub"]);
  });
});

describe("texts that name a sidebar", () => {
  it.each(["en", "fr"] as const)("say sidebar, and never panel, for the two sidebars in the language %s", async (language) => {
    const settingsStore = await import("./stores/settings");
    const { t } = await import("./i18n/index");
    settingsStore.settings.language = language;
    const keys = [
      "commandPalette.leftSidebar",
      "commandPalette.rightSidebar",
      "resizer.leftWidth",
      "resizer.rightWidth",
      "rightPanel.label",
      "sidebar.navigationBarLabel",
      "shortcuts.action.collapseSidebars",
    ];
    const word = language === "en" ? /sidebar/i : /barre latérale/i;
    for (const key of keys) {
      const text = t(key);
      expect(text, key).toMatch(word);
      expect(text, key).not.toMatch(/panel|panneau/i);
    }
    settingsStore.settings.language = "en";
  });
});

describe("collapsing a sidebar to the sidebar icon bar", () => {
  it("keeps the collapsed left sidebar, without its line to drag", async () => {
    const { wrapper, settings } = await mountApp();
    settings.leftCollapsed = true;
    await wrapper.vm.$nextTick();
    expect(bodyChildren(wrapper)).toEqual(["sidebar-stub", "gap", "main", "resizer-stub", "right-panel-stub"]);
  });

  it("keeps the collapsed right sidebar, without its line to drag", async () => {
    const { wrapper, settings } = await mountApp();
    settings.rightCollapsed = true;
    await wrapper.vm.$nextTick();
    expect(bodyChildren(wrapper)).toEqual(["sidebar-stub", "resizer-stub", "main", "gap", "right-panel-stub"]);
  });

  it("keeps the gap between the viewport and each collapsed sidebar, as wide as the line to drag", async () => {
    const { wrapper, settings } = await mountApp();
    const widthsBefore = bodyChildren(wrapper).filter((name) => name === "resizer-stub" || name === "gap").length;
    settings.leftCollapsed = true;
    settings.rightCollapsed = true;
    await wrapper.vm.$nextTick();
    const widthsAfter = bodyChildren(wrapper).filter((name) => name === "resizer-stub" || name === "gap").length;
    expect(widthsBefore).toBe(2);
    expect(widthsAfter).toBe(2);
    expect(wrapper.findAll(".sidebar-gap")).toHaveLength(2);
  });

  it("remembers the collapsed sidebars for the next start", async () => {
    const { wrapper, settings } = await mountApp();
    settings.leftCollapsed = true;
    settings.rightCollapsed = true;
    await wrapper.vm.$nextTick();
    await new Promise((resolve) => setTimeout(resolve, 600));
    const saved = JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}");
    expect(saved.leftCollapsed).toBe(true);
    expect(saved.rightCollapsed).toBe(true);
  });
});
