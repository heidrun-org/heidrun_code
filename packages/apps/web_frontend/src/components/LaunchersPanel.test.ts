import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => null) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

/** Gives the panel launchers of the user level, as the file launchers.json holds them. */
async function setUserLaunchers(launchers: { id: string; label: string; command: string }[]) {
  const { userLaunchers } = await import("../stores/user_launchers");
  userLaunchers.list = launchers;
}

async function mountPanel() {
  const { state } = await import("../stores/session");
  const { project } = await import("../stores/project");
  const { default: LaunchersPanel } = await import("./LaunchersPanel.vue");
  state.selectedWorkspaceId = "w1";
  project.byWorkspace["w1"] = {
    root: "/Users/me/webwork/heidrun",
    config_path: "/Users/me/webwork/heidrun/.heidrun/config.json",
    config: {
      version: 1,
      launchers: [{ id: "dev", label: "start the server", command: "make dev" }],
    },
    detected: [
      { label: "pnpm install", command: "pnpm install", source: "package.json" },
      { label: "pnpm dev", command: "pnpm dev", source: "package.json" },
    ],
  } as never;
  const wrapper = mount(LaunchersPanel);
  await flushPromises();
  return wrapper;
}

describe("LaunchersPanel", () => {
  it("has the title Launchers, a button Import, and a plus button, on one line, and no section", async () => {
    const wrapper = await mountPanel();
    const header = wrapper.get("header");
    expect(header.get(".title").text()).toBe("Launchers");
    expect(header.get("button.import").attributes("aria-label")).toBe("Import the launchers of the project");
    expect(header.get("button.create").attributes("aria-label")).toBe("Create a custom launcher");
    expect(wrapper.find(".section-head").exists()).toBe(false);
    expect(wrapper.text()).not.toMatch(/Custom Launchers|Existing Launchers|Recent/);
    expect(wrapper.text()).toContain("start the server");
  });

  it("does not use the words Actions, Scripts, or Suggestions", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.text()).not.toMatch(/action|script/i);
    expect(wrapper.text()).not.toMatch(/suggestion/i);
  });

  it("does not show the path of the configuration file", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.text()).not.toContain("config.json");
    expect(wrapper.find(".path").exists()).toBe(false);
  });

  it("has no drag and drop and no drag handle", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.text()).not.toContain("Drag to reorder");
    expect(wrapper.find(".grip").exists()).toBe(false);
    expect(wrapper.findAll("[draggable]")).toHaveLength(0);
  });

  it("opens the window Create a custom launcher when the person clicks the plus button", async () => {
    const wrapper = await mountPanel();
    const { newCustomLauncherModal } = await import("../stores/newCustomLauncher");
    expect(newCustomLauncherModal.open).toBe(false);
    await wrapper.get("header button.create").trigger("click");
    expect(newCustomLauncherModal.open).toBe(true);
  });

  it("opens the window Import launchers when the person clicks the button Import", async () => {
    const wrapper = await mountPanel();
    const { importLaunchersModal } = await import("../stores/importLaunchers");
    expect(importLaunchersModal.open).toBe(false);
    await wrapper.get("header button.import").trigger("click");
    expect(importLaunchersModal.open).toBe(true);
  });

  it("has no dashed button and no form inside the tab: the windows replace them", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.text()).not.toContain("Add a launcher");
    expect(wrapper.find(".dashed").exists()).toBe(false);
    expect(wrapper.find("form").exists()).toBe(false);
    expect(wrapper.find("input").exists()).toBe(false);
  });

  it("draws a card: the status dot before the name, the menu of three dots on the right, the description, then the state and the button Run", async () => {
    const wrapper = await mountPanel();
    const card = wrapper.get(".launcher");
    const top = card.get(".top");
    expect(top.element.children[0].classList.contains("dot")).toBe(true);
    expect(top.get(".label").text()).toBe("start the server");
    expect(top.find("button[aria-haspopup=menu]").exists()).toBe(true);
    expect(card.get(".desc").text()).toBe("make dev");
    expect(card.get(".state").text()).toBe("Not running");
    expect(card.get(".bottom .btn").text()).toBe("Run");
  });

  it("shows the description of the launcher instead of the command line when there is one", async () => {
    const wrapper = await mountPanel();
    const { project } = await import("../stores/project");
    project.byWorkspace["w1"]!.config.launchers[0].description = "Starts the development server.";
    await flushPromises();
    expect(wrapper.get(".desc").text()).toBe("Starts the development server.");
  });

  it("shows only the first 120 characters of a long command line when the launcher has no description", async () => {
    const wrapper = await mountPanel();
    const { project } = await import("../stores/project");
    project.byWorkspace["w1"]!.config.launchers[0].command = "x".repeat(300);
    await flushPromises();
    expect(wrapper.get(".desc").text()).toBe("x".repeat(120));
  });

  it("has the items Edit and Delete, with an icon each, in the menu of three dots of a card", async () => {
    const wrapper = await mountPanel();
    await wrapper.get(".launcher button[aria-haspopup=menu]").trigger("click");
    await flushPromises();
    const items = Array.from(document.body.querySelectorAll("[role=menuitem]")).map((item) => item.textContent?.trim());
    expect(items).toEqual(["Edit", "Delete"]);
    expect(document.body.querySelectorAll("[role=separator]")).toHaveLength(1);
    expect(document.body.querySelector("[role=menuitem].theme-danger")?.textContent?.trim()).toBe("Delete");
    expect(document.body.querySelectorAll("[role=menuitem] i.bi-pencil, [role=menuitem] i.bi-trash")).toHaveLength(2);
  });

  it("never shows the words Run again", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.html()).not.toMatch(/run again/i);
    await wrapper.get(".launcher button[aria-haspopup=menu]").trigger("click");
    await flushPromises();
    expect(document.body.textContent).not.toMatch(/run again/i);
  });

  it("opens the window in edit mode when the person chooses Edit", async () => {
    document.body.innerHTML = "";
    const wrapper = await mountPanel();
    const { newCustomLauncherModal } = await import("../stores/newCustomLauncher");
    await wrapper.get(".launcher button[aria-haspopup=menu]").trigger("click");
    await flushPromises();
    const edit = Array.from(document.body.querySelectorAll<HTMLElement>("[role=menuitem]")).find((item) => item.textContent?.trim() === "Edit");
    edit!.click();
    await flushPromises();
    expect(newCustomLauncherModal.open).toBe(true);
    expect(newCustomLauncherModal.editedId).toBe("dev");
  });

  it("runs a launcher only when the person clicks the button Run, not when the person clicks the card", async () => {
    const wrapper = await mountPanel();
    const { invoke } = await import("@tauri-apps/api/core");
    vi.mocked(invoke).mockClear();
    const card = wrapper.get(".launcher");
    await card.trigger("click");
    await card.get(".label").trigger("click");
    await card.get(".desc").trigger("click");
    await flushPromises();
    expect(card.find("button.label, button.desc").exists()).toBe(false);
    expect(vi.mocked(invoke).mock.calls).toHaveLength(0);
  });
  it("shows the launchers of the user level first, then the launchers of the workspace level", async () => {
    await setUserLaunchers([{ id: "everywhere", label: "in every workspace", command: "make everywhere" }]);
    const wrapper = await mountPanel();
    expect(wrapper.findAll(".launcher .label").map((label) => label.text())).toEqual(["in every workspace", "start the server"]);
  });

  it("tells the level User on the card of a launcher of the user level only", async () => {
    await setUserLaunchers([{ id: "everywhere", label: "in every workspace", command: "make everywhere" }]);
    const wrapper = await mountPanel();
    const cards = wrapper.findAll(".launcher");
    expect(cards[0].get(".level").text()).toBe("User level");
    expect(cards[0].get(".level").attributes("title")).toBe("This custom launcher shows in every workspace.");
    expect(cards[1].find(".level").exists()).toBe(false);
  });

  it("does not say that there is no launcher while the user level has one and the workspace level has none", async () => {
    await setUserLaunchers([{ id: "everywhere", label: "in every workspace", command: "make everywhere" }]);
    const wrapper = await mountPanel();
    const { project } = await import("../stores/project");
    project.byWorkspace["w1"]!.config.launchers = [];
    await flushPromises();
    expect(wrapper.find(".empty").exists()).toBe(false);
    expect(wrapper.findAll(".launcher")).toHaveLength(1);
  });

  it("opens the window on a launcher of the user level from the menu Edit", async () => {
    await setUserLaunchers([{ id: "everywhere", label: "in every workspace", command: "make everywhere" }]);
    const wrapper = await mountPanel();
    const { newCustomLauncherModal } = await import("../stores/newCustomLauncher");
    await wrapper.findAll(".launcher")[0].get("button.tool").trigger("click");
    await flushPromises();
    const edit = Array.from(document.body.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Edit");
    edit?.click();
    await flushPromises();
    expect(newCustomLauncherModal.editedId).toBe("everywhere");
  });
});
