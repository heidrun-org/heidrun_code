import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

const openDiffMock = vi.hoisted(() => vi.fn(async (_path: string) => true));

vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("../stores/diff_panes", () => ({ DiffPanes: { open: openDiffMock } }));
vi.mock("../stores/source_control", async (importOriginal) => {
  const original = await importOriginal<typeof import("../stores/source_control")>();
  return { ...original, stageFiles: vi.fn(), unstageFiles: vi.fn(), discardFiles: vi.fn(), commit: vi.fn() };
});

import SourceControlPanel from "./SourceControlPanel.vue";
import { git, type GitStatus } from "../stores/git";
import { commit, discardFiles, sourceControl, stageFiles, unstageFiles } from "../stores/source_control";
import { state } from "../stores/session";

function makeStatus(): GitStatus {
  return {
    root: "/work/heidrun",
    branch: "dev_jerome",
    upstream: "origin/dev_jerome",
    ahead: 0,
    behind: 0,
    changed: 2,
    untracked: 0,
    files: [
      { path: "docs/agents_rules/user_interface.md", status: "M." },
      { path: "CHANGELOG.md", status: ".M" },
    ],
    last_sha: null,
    last_subject: null,
    last_time: null,
    remote: null,
  };
}

function mountPanel() {
  state.selectedWorkspaceId = "w1";
  git.status = { w1: makeStatus() };
  return mount(SourceControlPanel);
}

describe("SourceControlPanel", () => {
  it('uses Arrow 90deg left for both discard buttons and keeps the Refresh icon', () => {
	const wrapper = mountPanel();
	const discardAll = wrapper.get('button[aria-label="Discard all the changes"]');
	const discard = wrapper.get('button[aria-label="Discard the changes"]');
	const refresh = wrapper.get('button[aria-label="Refresh"]');
	expect(discardAll.get('i').classes()).toContain('bi-arrow-90deg-left');
	expect(discard.get('i').classes()).toContain('bi-arrow-90deg-left');
	expect(refresh.get('i').classes()).toContain('bi-arrow-clockwise');
  });

  it("shows the More actions menu as three vertical dots on an icon button with no border", () => {
    const menuButton = mountPanel().get('button[aria-label="More actions"]');
    expect(menuButton.classes()).toEqual(expect.arrayContaining(["btn", "icon"]));
    expect(menuButton.get("i").classes()).toContain("bi-three-dots-vertical");
  });

  afterEach(() => {
    state.selectedWorkspaceId = null;
    git.status = {};
    sourceControl.folded.staged = false;
    sourceControl.folded.changes = false;
    vi.clearAllMocks();
  });

  it("shows the title, the message box with the branch, and the commit button", () => {
    const wrapper = mountPanel();
    expect(wrapper.get(".title").text()).toBe("Source Control");
    expect(wrapper.get("textarea").attributes("placeholder")).toBe('Message (⌘Enter to commit on "dev_jerome")');
    expect(wrapper.get(".btn-primary").text()).toBe("Commit");
  });

  it("puts the sparkle button beside the message box, outside of it, and not on top of it", () => {
    const message = mountPanel().get(".message");
    const textarea = message.get("textarea");
    const sparkle = message.get('button[aria-label="Write the commit message with a coding agent"]');
    expect(textarea.element.contains(sparkle.element)).toBe(false);
    expect(textarea.element.nextElementSibling).toBe(sparkle.element);
    expect(message.classes()).toContain("d-flex");
    expect(sparkle.classes()).not.toContain("position-absolute");
  });

  it("centers the label of the commit button", () => {
    const commitButton = mountPanel().get(".btn-primary");
    expect(commitButton.classes()).toContain("justify-content-center");
  });

  it("shows the groups Staged Changes and Changes with the number of files", () => {
    const headers = mountPanel().findAll(".group-header");
    expect(headers[0].text()).toContain("Staged Changes");
    expect(headers[0].get(".count").text()).toBe("1");
    expect(headers[1].text()).toContain("Changes");
    expect(headers[1].get(".count").text()).toBe("1");
  });

  it("shows the file name, the folder in grey, and the status letter, with no folder for a file at the root", () => {
    const files = mountPanel().findAll(".file");
    expect(files[0].get(".name").text()).toBe("user_interface.md");
    expect(files[0].get(".folder").text()).toBe("docs/agents_rules");
    expect(files[0].get(".letter").text()).toBe("M");
    expect(files[1].get(".name").text()).toBe("CHANGELOG.md");
    expect(files[1].find(".folder").exists()).toBe(false);
    expect(files[1].attributes("title")).toBe("/work/heidrun/CHANGELOG.md • Modified");
  });

  it("shows the group Staged Changes above Changes with 0 files when no file is staged", () => {
    state.selectedWorkspaceId = "w1";
    git.status = { w1: { ...makeStatus(), files: [{ path: "CHANGELOG.md", status: ".M" }] } };
    const headers = mount(SourceControlPanel).findAll(".group-header");
    expect(headers).toHaveLength(2);
    expect(headers[0].text()).toContain("Staged Changes");
    expect(headers[0].get(".count").text()).toBe("0");
    expect(headers[1].text()).toContain("Changes");
    expect(headers[1].get(".count").text()).toBe("1");
  });

  it("shows the two groups with 0 files when nothing changed", () => {
    state.selectedWorkspaceId = "w1";
    git.status = { w1: { ...makeStatus(), files: [] } };
    const headers = mount(SourceControlPanel).findAll(".group-header");
    expect(headers.map((header) => header.get(".count").text())).toEqual(["0", "0"]);
    expect(headers[0].get('button[aria-label="Unstage all the changes"]').attributes("disabled")).toBeDefined();
  });

  it("stages, discards, and unstages a file with the buttons of its line", async () => {
    const files = mountPanel().findAll(".file");
    await files[1].get('button[aria-label="Stage the changes"]').trigger("click");
    expect(stageFiles).toHaveBeenCalledWith(["CHANGELOG.md"]);
    await files[1].get('button[aria-label="Discard the changes"]').trigger("click");
    expect(discardFiles).toHaveBeenCalledWith(["CHANGELOG.md"]);
    await files[0].get('button[aria-label="Unstage the changes"]').trigger("click");
    expect(unstageFiles).toHaveBeenCalledWith(["docs/agents_rules/user_interface.md"]);
  });

  it("opens the changes of a file in a diff pane after a click on its line (issue #885)", async () => {
    openDiffMock.mockClear();
    git.modal.open = false;
    const files = mountPanel().findAll(".file");
    await files[1].get(".file-main").trigger("click");
    await flushPromises();
    expect(openDiffMock).toHaveBeenCalledWith("/work/heidrun/CHANGELOG.md");
    expect(git.modal.open).toBe(false);
  });

  it("opens the large Git window on the file when no pane can show the diff (issue #885)", async () => {
    openDiffMock.mockClear();
    openDiffMock.mockResolvedValueOnce(false);
    git.modal.open = false;
    const files = mountPanel().findAll(".file");
    await files[1].get(".file-main").trigger("click");
    await flushPromises();
    expect(git.modal.open).toBe(true);
    expect(git.modal.path).toBe("CHANGELOG.md");
  });

  it("stages every change with the button of the header of Changes", async () => {
    const headers = mountPanel().findAll(".group-header");
    await headers[1].get('button[aria-label="Stage all the changes"]').trigger("click");
    expect(stageFiles).toHaveBeenCalledWith(["CHANGELOG.md"]);
  });

  it("commits with the keys ⌘Enter in the message box", async () => {
    await mountPanel().get("textarea").trigger("keydown", { key: "Enter", metaKey: true });
    expect(commit).toHaveBeenCalledWith("commit");
  });

  it("folds a group after a click on its title", async () => {
    const wrapper = mountPanel();
    await wrapper.findAll(".group-toggle")[1].trigger("click");
    expect(wrapper.findAll(".file")).toHaveLength(1);
    await wrapper.findAll(".group-toggle")[1].trigger("click");
    expect(wrapper.findAll(".file")).toHaveLength(2);
  });

  it("folds and unfolds a group after a click anywhere on its header line, even a group with 0 files", async () => {
    const wrapper = mountPanel();
    await wrapper.findAll(".group-header")[1].trigger("click");
    expect(wrapper.findAll(".file")).toHaveLength(1);
    await wrapper.findAll(".group-header")[1].get(".count").trigger("click");
    expect(wrapper.findAll(".file")).toHaveLength(2);
    git.status = { w1: { ...makeStatus(), files: [] } };
    await wrapper.vm.$nextTick();
    await wrapper.findAll(".group-header")[0].trigger("click");
    expect(sourceControl.folded.staged).toBe(true);
  });

  it("does not fold a group after a click on a button of its header line", async () => {
    const wrapper = mountPanel();
    await wrapper.findAll(".group-header")[1].get('button[aria-label="Stage all the changes"]').trigger("click");
    expect(stageFiles).toHaveBeenCalledWith(["CHANGELOG.md"]);
    expect(sourceControl.folded.changes).toBe(false);
  });
});
