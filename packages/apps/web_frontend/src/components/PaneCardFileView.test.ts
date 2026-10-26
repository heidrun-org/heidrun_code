// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const invokeMock = vi.hoisted(() =>
  vi.fn(async (command: string, args: Record<string, string>): Promise<unknown> => {
    if (command === "files_resolve") {
      return { root: "/work/project", path: args.path.replace("/work/project/", "") };
    }
    if (command === "git_file") {
      return "---\ntype: project\nname: subitoflash\n---\n\n# Project\n";
    }
    return null;
  }),
);

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}), revealItemInDir: vi.fn(async () => {}) }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ writeText: vi.fn(async () => {}) }));
// The terminal and the code editor need a real browser. This file tests the header and the file view together.
vi.mock("./TerminalView.vue", () => ({ default: { template: "<div></div>" } }));
vi.mock("./CodeEditor.vue", () => ({ default: { template: '<div class="code-editor-stub"></div>' } }));
vi.mock("../stores/theme", async () => {
  const { ref } = await import("vue");
  return { codeThemeClass: ref("github-dark") };
});

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

async function mountFileViewPane() {
  const { default: PaneCard } = await import("./PaneCard.vue");
  const wrapper = mount(PaneCard, {
    props: {
      pane: {
        pane_id: "w1:p1",
        terminal_id: "t1",
        workspace_id: "w1",
        tab_id: "w1:t1",
        focused: false,
        agent_status: "unknown",
        revision: 1,
        label: "Heidrun file view: /work/project/docs/index.md",
        cwd: "/work/project",
      },
    },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

describe("PaneCard with the file view (issue #784)", () => {
  it("has one line of controls: the header holds the controls of the file, and the file view has none", async () => {
    const wrapper = await mountFileViewPane();
    expect(wrapper.findAll("header")).toHaveLength(1);
    const header = wrapper.get("header.head");
    expect(header.find(".btn-group").exists()).toBe(true);
    expect(header.find(".switch").exists()).toBe(true);
    expect(header.find("button[aria-haspopup='menu']").exists()).toBe(true);
    const fileView = wrapper.get(".file-view");
    expect(fileView.find("button").exists()).toBe(false);
    expect(fileView.find(".btn-group").exists()).toBe(false);
    expect(fileView.find(".switch").exists()).toBe(false);
    wrapper.unmount();
  });

  it("orders the header: the name, the short path, Preview and Raw, the switch, the menu, then the buttons of the pane", async () => {
    const wrapper = await mountFileViewPane();
    const header = wrapper.get("header.head").element;
    const elements = [
      header.querySelector(".name"),
      header.querySelector(".sub"),
      header.querySelector(".btn-group"),
      header.querySelector(".switch"),
      header.querySelector("button[aria-haspopup='menu']"),
      header.querySelector(".tools"),
    ];
    for (let index = 0; index < elements.length - 1; index++) {
      const isBefore = (elements[index]!.compareDocumentPosition(elements[index + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
      expect(isBefore, `element ${index} comes before element ${index + 1}`).toBe(true);
    }
    const toolLabels = Array.from(header.querySelectorAll(".tools button")).map((button) => button.getAttribute("title") ?? button.getAttribute("aria-label"));
    expect(toolLabels.length).toBeGreaterThanOrEqual(5);
    wrapper.unmount();
  });

  it("shows the front matter of the file in a card under the header", async () => {
    const wrapper = await mountFileViewPane();
    expect(wrapper.get(".front-matter-card pre").text()).toBe("type: project\nname: subitoflash");
    expect(wrapper.get(".md-doc h1").text()).toBe("Project");
    wrapper.unmount();
  });
});
