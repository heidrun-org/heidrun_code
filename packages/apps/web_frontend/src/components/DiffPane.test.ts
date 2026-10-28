// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOMWrapper, enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";

const invokeMock = vi.hoisted(() => vi.fn(async (_command: string, _args: Record<string, string>): Promise<unknown> => null));
const openFileViewMock = vi.hoisted(() => vi.fn(async (_path: string) => true));
const refreshGitMock = vi.hoisted(() => vi.fn(async (_workspaceId?: string) => {}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}), revealItemInDir: vi.fn(async () => {}) }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ writeText: vi.fn(async () => {}) }));
vi.mock("../stores/theme", async () => {
  const { ref } = await import("vue");
  return { codeThemeClass: ref("github-dark") };
});
vi.mock("../stores/file_view_panes", () => ({ FileViewPanes: { open: openFileViewMock } }));
vi.mock("../stores/git", async (importOriginal) => {
  const original = await importOriginal<typeof import("../stores/git")>();
  return { ...original, refreshGit: refreshGitMock };
});

import DiffPane from "./DiffPane.vue";
import { git, type GitStatus } from "../stores/git";
import { settings } from "../stores/settings";

enableAutoUnmount(afterEach);

const LABEL = "Heidrun diff: /work/project/src/main.ts";
const DIFF = [
  "diff --git a/src/main.ts b/src/main.ts",
  "--- a/src/main.ts",
  "+++ b/src/main.ts",
  "@@ -1,2 +1,2 @@",
  " const a = 1;",
  "-const b = 2;",
  "+const b = 3;",
  "",
].join("\n");

/** The element of the header of the pane that holds the controls: the test plays the role of the pane header. */
let host: HTMLElement;

function makeStatus(files: GitStatus["files"]): GitStatus {
  return {
    root: "/work/project",
    branch: "dev_jerome",
    upstream: null,
    ahead: 0,
    behind: 0,
    changed: files.length,
    untracked: 0,
    files,
    last_sha: null,
    last_subject: null,
    last_time: null,
    remote: null,
  };
}

function mountDiffPane(label = LABEL) {
  return mount(DiffPane, {
    props: {
      pane: { pane_id: "w1:p2", terminal_id: "t2", workspace_id: "w1", tab_id: "w1:t1", focused: false, agent_status: "unknown", revision: 1, label, cwd: "/work/project" },
      controlsHost: host,
    },
  });
}

function controls() {
  return new DOMWrapper(host);
}

/** The value of one row of the open information card: the text after its label. */
function value(field: string) {
  return controls().get(`[data-field="${field}"]`).findAll(":scope > span")[1]!.text().replace(/\s+/g, " ");
}

/** Opens the menu with three dots, and gives the entry of the action, or null when the menu has no such entry. */
async function menuEntry(action: string): Promise<HTMLButtonElement | null> {
  await controls().get("button[aria-haspopup='menu']").trigger("click");
  await flushPromises();
  return document.body.querySelector<HTMLButtonElement>(`[role='menu'] [data-action='${action}']`);
}

beforeEach(() => {
  localStorage.clear();
  host = document.createElement("div");
  document.body.appendChild(host);
  invokeMock.mockReset();
  invokeMock.mockImplementation(async (command: string) => (command === "git_diff" ? DIFF : null));
  openFileViewMock.mockClear();
  refreshGitMock.mockClear();
  git.status = { w1: makeStatus([{ path: "src/main.ts", status: ".M" }]) };
  settings.diffMode = "unified";
  settings.codeWrap = false;
});

afterEach(() => {
  host.remove();
});

describe("DiffPane (issue #885)", () => {
  it("reads the diff of the file of the label, with the path inside the Git repository of the workspace", async () => {
    const wrapper = mountDiffPane();
    await flushPromises();
    expect(invokeMock).toHaveBeenCalledWith("git_diff", { root: "/work/project", path: "src/main.ts" });
    expect(wrapper.findAll("tr.add")).toHaveLength(1);
    expect(wrapper.findAll("tr.del")).toHaveLength(1);
    expect(wrapper.get("td.hunk").text()).toBe("@@ -1,2 +1,2 @@");
  });

  it("puts Diff and Side by side, Wrap lines, and the menu with three dots in the header, and nothing in the body", async () => {
    const wrapper = mountDiffPane();
    await flushPromises();
    expect(controls().findAll(".btn-group label").map((label) => label.text())).toEqual(["Diff", "Side by side"]);
    expect(controls().find(".switch").exists()).toBe(true);
    expect(controls().findAll("button").map((button) => button.attributes("aria-label"))).toEqual(["More actions"]);
    expect(wrapper.find("button").exists()).toBe(false);
  });

  it("lists Refresh, Open the file, Copy path, Show in Finder, and Open in VS Code in the menu, and no Search", async () => {
    mountDiffPane();
    await flushPromises();
    await menuEntry("refresh");
    const actions = Array.from(document.body.querySelectorAll("[role='menu'] [role='menuitem']")).map((entry) => entry.getAttribute("data-action"));
    expect(actions).toEqual(["refresh", "open-file", "copy-path", "show-in-finder", "open-in-visual-studio-code"]);
  });

  it("opens a card with the file, the staged status, the numbers of lines, and the last commit after a click on the circled question mark", async () => {
    git.status = {
      w1: {
        ...makeStatus([{ path: "src/main.ts", status: "MM" }]),
        last_sha: "f853124abcdef",
        last_subject: "Merge pull request #294",
        last_time: Date.now() / 1000 - 120,
      },
    };
    mountDiffPane();
    await flushPromises();
    expect(controls().element.firstElementChild?.classList.contains("information-card-part")).toBe(true);
    expect(controls().find(".popover").exists()).toBe(false);
    await controls().get(".information-card-part").trigger("click");
    await flushPromises();
    const field = (name: string) => value(name);
    expect(field("file")).toBe("src/main.ts");
    expect(field("staged")).toBe("Modified");
    expect(field("not-staged")).toBe("Modified");
    expect(field("added")).toBe("+1");
    expect(field("removed")).toBe("−1");
    expect(field("last-commit")).toBe("f853124 Merge pull request #294");
    expect(field("last-commit-date")).toBe("2 min ago");
  });

  it("says No for a group that does not hold the file, and shows an untracked file as Untracked", async () => {
    git.status = { w1: makeStatus([{ path: "src/main.ts", status: "??" }]) };
    mountDiffPane();
    await flushPromises();
    await controls().get(".information-card-part").trigger("click");
    await flushPromises();
    expect(value("staged")).toBe("No");
    expect(value("not-staged")).toBe("Untracked");
    expect(value("last-commit")).toBe("No commit yet");
    expect(controls().find('[data-field="last-commit-date"]').exists()).toBe(false);
  });

  it("shows the diff side by side after a click on Side by side, and saves the choice in the setting diffMode", async () => {
    const wrapper = mountDiffPane();
    await flushPromises();
    await controls().get('input[value="split"]').setValue(true);
    expect(settings.diffMode).toBe("split");
    expect(wrapper.findAll(".side")).toHaveLength(2);
  });

  it("reads the diff and the Git status again after a click on Refresh", async () => {
    mountDiffPane();
    await flushPromises();
    (await menuEntry("refresh"))!.click();
    await flushPromises();
    expect(invokeMock.mock.calls.filter(([command]) => command === "git_diff")).toHaveLength(2);
    expect(refreshGitMock).toHaveBeenCalledWith("w1");
  });

  it("opens the file in a file view pane after a click on Open the file", async () => {
    mountDiffPane();
    await flushPromises();
    (await menuEntry("open-file"))!.click();
    await flushPromises();
    expect(openFileViewMock).toHaveBeenCalledWith("/work/project/src/main.ts");
  });

  it("has no entry Open the file for a deleted file", async () => {
    git.status = { w1: makeStatus([{ path: "src/main.ts", status: "D." }]) };
    mountDiffPane();
    await flushPromises();
    expect(await menuEntry("open-file")).toBeNull();
    expect(document.body.querySelector("[role='menu'] [data-action='refresh']")).not.toBeNull();
  });

  it("says that there is no change when the diff is empty", async () => {
    invokeMock.mockImplementation(async () => "");
    const wrapper = mountDiffPane();
    await flushPromises();
    expect(wrapper.get(".empty").text()).toContain("No text change compared to the last commit");
  });

  it("waits for the Git status of the workspace before it reads the diff", async () => {
    git.status = {};
    const wrapper = mountDiffPane();
    await flushPromises();
    expect(invokeMock).not.toHaveBeenCalled();
    expect(wrapper.get(".empty").text()).toBe("Loading…");
    git.status.w1 = makeStatus([{ path: "src/main.ts", status: ".M" }]);
    await flushPromises();
    expect(invokeMock).toHaveBeenCalledWith("git_diff", { root: "/work/project", path: "src/main.ts" });
  });

  it("shows an error when the workspace is not a Git repository", async () => {
    git.status = { w1: null };
    const wrapper = mountDiffPane();
    await flushPromises();
    expect(wrapper.get(".err").text()).toContain("not a Git repository");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("shows an error when the file is outside the Git repository of the workspace", async () => {
    const outside = mountDiffPane("Heidrun diff: /elsewhere/notes.md");
    await flushPromises();
    expect(outside.get(".err").text()).toContain("/elsewhere/notes.md");
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
