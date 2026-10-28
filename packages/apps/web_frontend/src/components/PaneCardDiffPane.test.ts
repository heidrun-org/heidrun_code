// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const invokeMock = vi.hoisted(() =>
  vi.fn(async (command: string): Promise<unknown> => {
    if (command === "git_diff") {
      return "@@ -1 +1 @@\n-old\n+new\n";
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
// The terminal needs a real browser. This file tests the header and the diff pane together.
vi.mock("./TerminalView.vue", () => ({ default: { template: '<div class="terminal-stub"></div>' } }));
vi.mock("../stores/theme", async () => {
  const { ref } = await import("vue");
  return { codeThemeClass: ref("github-dark") };
});

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

async function mountDiffPane() {
  const { git } = await import("../stores/git");
  git.status = {
    w1: {
      root: "/work/project",
      branch: "dev_jerome",
      upstream: null,
      ahead: 0,
      behind: 0,
      changed: 1,
      untracked: 0,
      files: [{ path: "docs/index.md", status: ".M" }],
      last_sha: null,
      last_subject: null,
      last_time: null,
      remote: null,
    },
  };
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
        label: "Heidrun diff: /work/project/docs/index.md",
        cwd: "/work/project",
      },
    },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

describe("PaneCard with the diff pane (issue #885)", () => {
  it("shows the diff in place of the terminal, with the name and the short path of the file in the header", async () => {
    const wrapper = await mountDiffPane();
    expect(wrapper.find(".terminal-stub").exists()).toBe(false);
    expect(wrapper.find(".diff-pane").exists()).toBe(true);
    expect(wrapper.get("header .name").text()).toBe("index.md");
    expect(wrapper.get("header .name").attributes("title")).toBe("/work/project/docs/index.md");
    expect(wrapper.findAll("tr.add")).toHaveLength(1);
    wrapper.unmount();
  });

  it("has one line of controls in the header, and no button for the composition bar and no macro menu", async () => {
    const wrapper = await mountDiffPane();
    expect(wrapper.findAll("header")).toHaveLength(1);
    const header = wrapper.get("header.head");
    expect(header.find(".btn-group").exists()).toBe(true);
    expect(header.find(".switch").exists()).toBe(true);
    expect(header.find("button[aria-haspopup='menu']").exists()).toBe(true);
    expect(header.find('button[aria-label="Composition bar"]').exists()).toBe(false);
    expect(wrapper.get(".diff-pane").find("button").exists()).toBe(false);
    wrapper.unmount();
  });
});
