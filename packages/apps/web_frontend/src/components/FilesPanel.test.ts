import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import path from "node:path";

const invokeMock = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const copyMock = vi.hoisted(() => vi.fn(async () => {}));
const chatAboutFileMock = vi.hoisted(() => vi.fn(async (_absolutePath: string, _label: string, _folder: string | null) => {}));
// False means that no pane could show the file: the Files window then opens it.
const openFileViewMock = vi.hoisted(() => vi.fn(async (_absolutePath: string) => false));
vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("../stores/file_view_panes", () => ({ FileViewPanes: { open: openFileViewMock } }));
vi.mock("../lib/clipboard", () => ({ copy: copyMock }));
vi.mock("../stores/chat_open", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../stores/chat_open")>()),
  chatAboutFile: chatAboutFileMock,
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));

import FilesPanel from "./FilesPanel.vue";
import { git, type GitStatus } from "../stores/git";
import { files, filesPanelIgnoredChildren, filesPanelNewFolders, filesPanelSelections } from "../stores/files";
import { state } from "../stores/session";
import { settings } from "../stores/settings";

function makeStatus(): GitStatus {
  return {
    root: "/work/heidrun",
    branch: "dev_jerome",
    upstream: null,
    ahead: 0,
    behind: 0,
    changed: 1,
    untracked: 0,
    files: [{ path: "src/main.ts", status: ".M" }],
    last_sha: null,
    last_subject: null,
    last_time: null,
    remote: null,
  };
}

async function mountPanel() {
  state.selectedWorkspaceId = "w1";
  git.status = { w1: makeStatus() };
  const wrapper = mount(FilesPanel);
  await vi.waitFor(() => expect(files.root).toBe("/work/heidrun"));
  await wrapper.vm.$nextTick();
  return wrapper;
}

beforeEach(() => {
  openFileViewMock.mockClear();
  chatAboutFileMock.mockClear();
  openFileViewMock.mockResolvedValue(false);
  invokeMock.mockImplementation(async (command: string, args: { paths: string[]; path: string }) => {
    if (command === "file_full_path") {
      return `/work/heidrun/${args.path}`;
    }
    if (command === "files_list") {
      return {
        root: "/work/heidrun",
        git: true,
        files: ["README.md", "src/main.ts", "src/lib/util.ts"],
        status: { "src/main.ts": "M" },
        truncated: false,
      };
    }
    if (command === "dirs_existing") {
      return args.paths;
    }
    return null;
  });
});

afterEach(() => {
  settings.filesPanelIndent = "medium";
  settings.filesPanelRowHeight = "comfortable";
  settings.filesPanelIndentGuides = true;
  settings.filesShowIgnored = false;
  state.selectedWorkspaceId = null;
  state.toast = "";
  git.status = {};
  git.modal.open = false;
  git.modal.path = null;
  files.open = false;
  files.tabs = [];
  files.active = null;
  files.root = "";
  files.ignored = [];
  files.submodules = [];
  files.expanded = new Set();
  for (const folder of Object.keys(filesPanelIgnoredChildren)) {
    delete filesPanelIgnoredChildren[folder];
  }
  for (const root of Object.keys(filesPanelNewFolders)) {
    delete filesPanelNewFolders[root];
  }
  for (const workspaceId of Object.keys(filesPanelSelections)) {
    delete filesPanelSelections[workspaceId];
  }
  vi.clearAllMocks();
});

describe("FilesPanel", () => {

	it('browses submodules, opens nested files, and refreshes while keeping folders unfolded', async () => {
		let paths = ['modules/example/src/main.ts'];
		invokeMock.mockImplementation(async (command: string) => {
			if (command === 'files_list') {
				return {
					root: '/work/heidrun',
					git: true,
					files: paths,
					submodules: ['modules/example', 'modules/empty'],
					ignored: [],
					status: {},
					truncated: false,
				};
			}
			return null;
		});
		const wrapper = await mountPanel();
		await wrapper.get('[title="modules"]').trigger('click');
		const submodule = wrapper.get('[title="modules/example"]');
		expect(submodule.attributes('aria-expanded')).toBe('false');
		expect(submodule.find('svg.bi-file-submodule').exists()).toBe(true);
		expect(wrapper.get('[title="modules"]').find('.bi-folder2-open').exists()).toBe(true);
		expect(wrapper.get('[title="modules/empty"]').attributes('aria-expanded')).toBe('false');
		await submodule.trigger('click');
		await wrapper.get('[title="modules/example/src"]').trigger('click');
		await wrapper.get('[title="modules/example/src/main.ts"]').trigger('click');
		expect(files.active).toBe('modules/example/src/main.ts');
		expect(files.open).toBe(true);
		paths = [...paths, 'modules/example/src/new.txt'];
		await wrapper.get('[aria-label="Refresh"]').trigger('click');
		await vi.waitFor(() => expect(wrapper.find('[title="modules/example/src/new.txt"]').exists()).toBe(true));
		expect(wrapper.get('[title="modules/example"]').attributes('aria-expanded')).toBe('true');
		await wrapper.get('[title="modules/example"]').trigger('click');
		expect(wrapper.find('[title="modules/example/src"]').exists()).toBe(false);
		expect(wrapper.get('[title="modules/example"]').find('svg.bi-file-submodule').exists()).toBe(true);
		wrapper.unmount();
	});

  it("shows the title and the folders first, then the files, and folds the folders at the start", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.get(".title").text()).toBe("File explorer");
    expect(wrapper.findAll(".row .name").map((name) => name.text())).toEqual(["src", "README.md"]);
  });

  it("unfolds a folder after a click on it, and does not open the large Git window", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[0].trigger("click");
    expect(wrapper.findAll(".row .name").map((name) => name.text())).toEqual(["src", "lib", "main.ts", "README.md"]);
    expect(git.modal.open).toBe(false);
  });

  it("opens a file in a file view pane, and not in the Files window, after a click on it (issue #714)", async () => {
    openFileViewMock.mockResolvedValue(true);
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[1].trigger("click");
    await vi.waitFor(() => expect(openFileViewMock).toHaveBeenCalledWith("/work/heidrun/README.md"));
    expect(files.open).toBe(false);
    expect(git.modal.open).toBe(false);
  });

  it("opens a file in the Files window, and not in the large Git window, after a click when no pane can show it", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[1].trigger("click");
    await vi.waitFor(() => expect(files.active).toBe("README.md"));
    expect(files.open).toBe(true);
    expect(files.tabs).toContain("README.md");
    expect(git.modal.open).toBe(false);
  });

  it("shows a status letter on a changed file", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[0].trigger("click");
    const row = wrapper.findAll(".row").find((candidate) => candidate.text().includes("main.ts"));
    expect(row?.get(".letter").text()).toBe("M");
  });

  it("has no button to rename, move, delete, or edit a file", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.findAll("header button").map((button) => button.attributes("aria-label"))).toEqual([
      "New file", "New folder", "Refresh", "Collapse all folders", "More options",
    ]);
  });

  it("folds every folder with the button Collapse all folders", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[0].trigger("click");
    expect(wrapper.findAll(".row")).toHaveLength(4);
    await wrapper.get("[aria-label='Collapse all folders']").trigger("click");
    expect(wrapper.findAll(".row .name").map((name) => name.text())).toEqual(["src", "README.md"]);
  });

  it("has no button Expand all folders", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.find("[aria-label='Expand all folders']").exists()).toBe(false);
  });

  it("selects the row that was clicked, a folder or a file, and only that row, and keeps it after the Files window closes", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.findAll(".row.selected")).toHaveLength(0);
    await wrapper.findAll(".row")[0].trigger("click");
    expect(wrapper.findAll(".row.selected").map((row) => row.text())).toEqual(["src•"]);
    await wrapper.findAll(".row")[3].trigger("click");
    expect(wrapper.findAll(".row.selected").map((row) => row.text())).toEqual(["README.md"]);
    files.open = false;
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".row.selected")).toHaveLength(1);
  });

  it("selects nothing after a click on the empty space of the section, and then a new file goes to the root", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[0].trigger("click");
    expect(wrapper.findAll(".row.selected")).toHaveLength(1);
    await wrapper.get(".files-panel").trigger("click");
    expect(wrapper.findAll(".row.selected")).toHaveLength(0);
    await wrapper.get("[aria-label='New file']").trigger("click");
    expect(wrapper.findAll("ul.rows > li")[0].classes()).toContain("naming-row");
  });

  it("keeps a selected row for each workspace: the selection of a workspace comes back after the developer visits another workspace", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[1].trigger("click");
    expect(wrapper.findAll(".row.selected").map((row) => row.text())).toEqual(["README.md"]);
    state.selectedWorkspaceId = "w2";
    git.status = { ...git.status, w2: { ...makeStatus(), root: "/work/other" } };
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".row.selected")).toHaveLength(0);
    await wrapper.findAll(".row")[0].trigger("click");
    expect(filesPanelSelections.w2.path).toBe("src");
    state.selectedWorkspaceId = "w1";
    await wrapper.vm.$nextTick();
    expect(filesPanelSelections.w1.path).toBe("README.md");
    expect(wrapper.findAll(".row.selected").map((row) => row.text())).toEqual(["README.md"]);
  });

  it("unselects only in the selected workspace after a click on the empty space", async () => {
    const wrapper = await mountPanel();
    filesPanelSelections.w2 = { path: "docs", isFolder: true };
    await wrapper.findAll(".row")[1].trigger("click");
    await wrapper.get(".files-panel").trigger("click");
    expect(filesPanelSelections.w1).toBeUndefined();
    expect(filesPanelSelections.w2.path).toBe("docs");
  });

  it("keeps the selected row when the sidebar section is shown again", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[1].trigger("click");
    wrapper.unmount();
    const again = await mountPanel();
    expect(again.findAll(".row.selected").map((row) => row.text())).toEqual(["README.md"]);
  });

  it("shows the name box as the first child of the selected folder, and the new file goes into that folder", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[0].trigger("click");
    await wrapper.get("[aria-label='New file']").trigger("click");
    const items = wrapper.findAll("ul.rows > li");
    expect(items[0].text()).toContain("src");
    expect(items[1].classes()).toContain("naming-row");
    const input = wrapper.get(".naming-row input");
    expect((input.element as HTMLInputElement).value).toBe("");
    await input.setValue("new_file.ts");
    await input.trigger("keydown", { key: "Enter" });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("file_create", { root: "/work/heidrun", path: "src/new_file.ts", dir: false }));
    await vi.waitFor(() => expect(git.modal.path).toBe("src/new_file.ts"));
    expect(git.modal.open).toBe(true);
    expect(wrapper.find(".naming-row").exists()).toBe(false);
  });

  it("puts a new file in the same folder as the selected file", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[0].trigger("click");
    const mainRow = wrapper.findAll(".row").find((row) => row.text().includes("main.ts"));
    await mainRow?.trigger("click");
    git.modal.open = false;
    await wrapper.get("[aria-label='New file']").trigger("click");
    await wrapper.get(".naming-row input").setValue("other.ts");
    await wrapper.get(".naming-row input").trigger("keydown", { key: "Enter" });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("file_create", { root: "/work/heidrun", path: "src/other.ts", dir: false }));
  });

  it("puts a new folder inside the selected folder, and in the same folder as the selected file", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[0].trigger("click");
    await wrapper.get("[aria-label='New folder']").trigger("click");
    await wrapper.get(".naming-row input").setValue("assets");
    await wrapper.get(".naming-row input").trigger("keydown", { key: "Enter" });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("file_create", { root: "/work/heidrun", path: "src/assets", dir: true }));
    expect(git.modal.open).toBe(false);
    await vi.waitFor(() => expect(wrapper.findAll(".row .name").map((name) => name.text())).toContain("assets"));
    invokeMock.mockClear();
    const readme = wrapper.findAll(".row").find((row) => row.text().includes("README.md"));
    await readme?.trigger("click");
    await wrapper.get("[aria-label='New folder']").trigger("click");
    await wrapper.get(".naming-row input").setValue("top");
    await wrapper.get(".naming-row input").trigger("keydown", { key: "Enter" });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("file_create", { root: "/work/heidrun", path: "top", dir: true }));
  });

  it("shows a new empty folder in the tree, although Git does not list it", async () => {
    const wrapper = await mountPanel();
    await wrapper.get("[aria-label='New folder']").trigger("click");
    await wrapper.get(".naming-row input").setValue("empty_folder");
    await wrapper.get(".naming-row input").trigger("keydown", { key: "Enter" });
    await vi.waitFor(() => expect(wrapper.findAll(".row .name").map((name) => name.text())).toEqual(["empty_folder", "src", "README.md"]));
  });

  it("forgets a new empty folder that does not exist any more on the disk, after the button Refresh", async () => {
    const wrapper = await mountPanel();
    await wrapper.get("[aria-label='New folder']").trigger("click");
    await wrapper.get(".naming-row input").setValue("blabla");
    await wrapper.get(".naming-row input").trigger("keydown", { key: "Enter" });
    await vi.waitFor(() => expect(wrapper.findAll(".row .name").map((name) => name.text())).toContain("blabla"));
    const previous = invokeMock.getMockImplementation();
    invokeMock.mockImplementation(async (command: string, args: { paths: string[] }) => (command === "dirs_existing" ? [] : previous?.(command, args)));
    await wrapper.get("[aria-label='Refresh']").trigger("click");
    await vi.waitFor(() => expect(wrapper.findAll(".row .name").map((name) => name.text())).not.toContain("blabla"));
  });

  it("cancels the new name with the key Escape or when the box loses the focus, and creates nothing", async () => {
    const wrapper = await mountPanel();
    await wrapper.get("[aria-label='New file']").trigger("click");
    await wrapper.get(".naming-row input").trigger("keydown", { key: "Escape" });
    expect(wrapper.find(".naming-row").exists()).toBe(false);
    await wrapper.get("[aria-label='New file']").trigger("click");
    await wrapper.get(".naming-row input").trigger("blur");
    expect(wrapper.find(".naming-row").exists()).toBe(false);
    expect(invokeMock).not.toHaveBeenCalledWith("file_create", expect.anything());
  });

  it("refuses a name with a slash, and creates nothing", async () => {
    const wrapper = await mountPanel();
    await wrapper.get("[aria-label='New file']").trigger("click");
    await wrapper.get(".naming-row input").setValue("a/b.ts");
    await wrapper.get(".naming-row input").trigger("keydown", { key: "Enter" });
    expect(state.toast).toContain("cannot contain");
    expect(invokeMock).not.toHaveBeenCalledWith("file_create", expect.anything());
    expect(wrapper.find(".naming-row").exists()).toBe(true);
  });

  it("keeps the name box open when the backend refuses the name", async () => {
    const wrapper = await mountPanel();
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "file_create") {
        throw new Error("already exists");
      }
      return { root: "/work/heidrun", git: true, files: ["README.md"], status: {}, truncated: false };
    });
    await wrapper.get("[aria-label='New file']").trigger("click");
    await wrapper.get(".naming-row input").setValue("README.md");
    await wrapper.get(".naming-row input").trigger("keydown", { key: "Enter" });
    await vi.waitFor(() => expect(state.toast).toContain("already exists"));
    expect(wrapper.find(".naming-row").exists()).toBe(true);
    expect(git.modal.open).toBe(false);
  });

  it("gives a row the full width of the sidebar section, so its background is not limited to the file name", () => {
    const source = readFileSync(path.join(import.meta.dirname, "FilesPanel.vue"), "utf8");
    const rule = source.match(/\n\.row \{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toContain("width: 100%");
  });

  it("gives a row under the pointer a background that shows in the dark theme and in the light theme", () => {
    const panel = readFileSync(path.join(import.meta.dirname, "FilesPanel.vue"), "utf8");
    expect(panel).toMatch(/\.row:hover \{ background: var\(--files-row-hover\); \}/);
    const styles = readFileSync(path.join(import.meta.dirname, "..", "styles.css"), "utf8");
    const lightStart = styles.indexOf(':root[data-theme="light"]');
    const themes = { dark: styles.slice(0, lightStart), light: styles.slice(lightStart) };
    for (const theme of [themes.dark, themes.light]) {
      const hover = theme.match(/--files-row-hover: #([0-9a-fA-F]{6});/)?.[1] ?? "";
      const side = theme.match(/--side: #([0-9a-fA-F]{6});/)?.[1] ?? "";
      expect(hover).not.toBe("");
      const channels = (color: string) => [0, 2, 4].map((index) => parseInt(color.slice(index, index + 2), 16));
      const difference = Math.max(...channels(hover).map((value, index) => Math.abs(value - channels(side)[index])));
      expect(difference).toBeGreaterThanOrEqual(10);
    }
  });

  it("keeps the header at the top while the rows scroll: the rule of the header sticks it, with its own background", () => {
    const source = readFileSync(path.join(import.meta.dirname, "FilesPanel.vue"), "utf8");
    const rule = source.match(/\.panel-header \{([^}]*)\}/)?.[1] ?? "";
    expect(rule).toContain("position: sticky");
    expect(rule).toContain("top: 0");
    expect(rule).toContain("background:");
  });

  it("gives a file and a folder of the same level the same space at the left, so their names line up", async () => {
    const wrapper = await mountPanel();
    const folderRow = wrapper.findAll(".row")[0];
    const fileRow = wrapper.findAll(".row")[1];
    expect(folderRow.findAll(".arrow")).toHaveLength(1);
    expect(fileRow.findAll(".arrow")).toHaveLength(1);
    expect(fileRow.get(".arrow").findAll("i")).toHaveLength(0);
  });

  it("draws one indent guide for each level of depth, and none when the guides are hidden", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[0].trigger("click");
    await wrapper.findAll(".row")[1].trigger("click");
    expect(wrapper.findAll(".row")[0].findAll(".guide")).toHaveLength(0);
    expect(wrapper.findAll(".row")[1].findAll(".guide")).toHaveLength(1);
    expect(wrapper.findAll(".row")[2].findAll(".guide")).toHaveLength(2);
    settings.filesPanelIndentGuides = false;
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll(".guide")).toHaveLength(0);
  });

  it("sets the space of each level and the height of a row from the options", async () => {
    const wrapper = await mountPanel();
    expect(wrapper.get(".rows").attributes("style")).toContain("--indent-width: 20px");
    expect(wrapper.get(".rows").attributes("style")).toContain("--row-height: 30px");
    settings.filesPanelIndent = "small";
    settings.filesPanelRowHeight = "compact";
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".rows").attributes("style")).toContain("--indent-width: 12px");
    expect(wrapper.get(".rows").attributes("style")).toContain("--row-height: 24px");
  });

  it("changes the options with the menu of the three dots, and marks the choice that is on", async () => {
    const wrapper = await mountPanel();
    await wrapper.get("[aria-label='More options']").trigger("click");
    const items = () => Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]"));
    expect(items().map((item) => item.textContent?.trim())).toEqual([
      "Indentation", "Small", "✓ Medium", "Large",
      "Row height", "Compact", "✓ Comfortable",
      "Indent guides", "✓ Show", "Hide",
      "Ignored files", "Show", "✓ Hide",
    ]);
    items()[3].click();
    expect(settings.filesPanelIndent).toBe("large");
    wrapper.unmount();
  });

  it("puts a separator line between two groups of the menu of the three dots, and nowhere else", async () => {
    const wrapper = await mountPanel();
    await wrapper.get("[aria-label='More options']").trigger("click");
    const menu = document.body.querySelector("[role=menu]") as HTMLElement;
    const separators = Array.from(menu.querySelectorAll("[role=separator]"));
    expect(separators).toHaveLength(3);
    expect(separators.map((separator) => separator.nextElementSibling?.textContent?.trim())).toEqual(["Row height", "Indent guides", "Ignored files"]);
    wrapper.unmount();
  });

  it("turns the option Ignored files on and off with the menu, and reads the list of files again each time", async () => {
    const wrapper = await mountPanel();
    expect(settings.filesShowIgnored).toBe(false);
    invokeMock.mockClear();
    await wrapper.get("[aria-label='More options']").trigger("click");
    const items = () => Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]"));
    items()[11].click();
    expect(settings.filesShowIgnored).toBe(true);
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("files_list", { cwd: "/work/heidrun", ignored: true }));
    await wrapper.get("[aria-label='More options']").trigger("click");
    expect(items().map((item) => item.textContent?.trim()).slice(-3)).toEqual(["Ignored files", "✓ Show", "Hide"]);
    items()[12].click();
    expect(settings.filesShowIgnored).toBe(false);
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("files_list", { cwd: "/work/heidrun", ignored: false }));
    wrapper.unmount();
  });

  it("opens a context menu with two copy items, a separator, and the item Chat about this file after a right click on the row of a file", async () => {
    const wrapper = await mountPanel();
    expect(document.body.querySelector("[role=menu]")).toBeNull();
    await wrapper.findAll(".row")[1].trigger("contextmenu", { clientX: 40, clientY: 60 });
    const children = Array.from(document.body.querySelector("[role=menu]")?.children ?? []);
    expect(children.map((child) => child.getAttribute("role"))).toEqual(["menuitem", "menuitem", "separator", "menuitem"]);
    const items = Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role=menu] [role=menuitem]"));
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      "Copy absolute path",
      "Copy relative path",
      "Chat about this file",
    ]);
    expect(git.modal.open).toBe(false);
    wrapper.unmount();
  });

  it("opens the same context menu after a right click on the row of a folder, and hides the default context menu of the web view", async () => {
    const wrapper = await mountPanel();
    const folderRow = wrapper.findAll(".row")[0];
    expect(folderRow.attributes("aria-expanded")).toBeDefined();
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 40, clientY: 60 });
    folderRow.element.dispatchEvent(event);
    await wrapper.vm.$nextTick();
    expect(event.defaultPrevented).toBe(true);
    const items = Array.from(document.body.querySelectorAll<HTMLButtonElement>("[role=menu] [role=menuitem]"));
    expect(items.map((item) => item.textContent?.trim())).toEqual([
      "Copy absolute path",
      "Copy relative path",
      "Chat about this file",
    ]);
    wrapper.unmount();
  });

  it("copies the absolute path and the relative path of a folder with the context menu of the row of the folder", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[0].trigger("contextmenu");
    document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]")[0].click();
    await vi.waitFor(() => expect(copyMock).toHaveBeenCalledWith("/work/heidrun/src"));
    expect(invokeMock).toHaveBeenCalledWith("file_full_path", { root: "/work/heidrun", path: "src" });
    await wrapper.findAll(".row")[0].trigger("contextmenu");
    document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]")[1].click();
    await vi.waitFor(() => expect(copyMock).toHaveBeenCalledWith("src"));
    expect(state.toast).toBe("Copied: src");
    expect(document.body.querySelector("[role=menu]")).toBeNull();
    wrapper.unmount();
  });

  it("copies the absolute path of the file with the item Copy absolute path, and closes the context menu", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[0].trigger("click");
    await wrapper.findAll(".row")[2].trigger("contextmenu");
    document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]")[0].click();
    await vi.waitFor(() => expect(copyMock).toHaveBeenCalledWith("/work/heidrun/src/main.ts"));
    expect(invokeMock).toHaveBeenCalledWith("file_full_path", { root: "/work/heidrun", path: "src/main.ts" });
    expect(state.toast).toBe("Copied: /work/heidrun/src/main.ts");
    expect(document.body.querySelector("[role=menu]")).toBeNull();
    wrapper.unmount();
  });

  it("copies the path relative to the folder of the workspace with the item Copy relative path", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[0].trigger("click");
    await wrapper.findAll(".row")[2].trigger("contextmenu");
    document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]")[1].click();
    await vi.waitFor(() => expect(copyMock).toHaveBeenCalledWith("src/main.ts"));
    expect(state.toast).toBe("Copied: src/main.ts");
    expect(document.body.querySelector("[role=menu]")).toBeNull();
    wrapper.unmount();
  });

  it("starts a chat about the file with the item Chat about this file, and closes the context menu", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[0].trigger("click");
    await wrapper.findAll(".row")[2].trigger("contextmenu");
    document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]")[2].click();
    await vi.waitFor(() => expect(chatAboutFileMock).toHaveBeenCalledWith("/work/heidrun/src/main.ts", "main.ts", "/work/heidrun"));
    expect(invokeMock).toHaveBeenCalledWith("file_full_path", { root: "/work/heidrun", path: "src/main.ts" });
    expect(document.body.querySelector("[role=menu]")).toBeNull();
    expect(copyMock).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("starts a chat about nothing and shows the error when the absolute path cannot be read", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[0].trigger("click");
    await wrapper.findAll(".row")[2].trigger("contextmenu");
    invokeMock.mockImplementationOnce(async () => {
      throw new Error("no such file");
    });
    document.body.querySelectorAll<HTMLButtonElement>("[role=menuitem]")[2].click();
    await vi.waitFor(() => expect(state.toast).toContain("no such file"));
    expect(chatAboutFileMock).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("closes the context menu with the key Escape, and with a click outside it, and copies nothing", async () => {
    const wrapper = await mountPanel();
    await wrapper.findAll(".row")[1].trigger("contextmenu");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(document.body.querySelector("[role=menu]")).toBeNull();
    await wrapper.findAll(".row")[1].trigger("contextmenu");
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await wrapper.vm.$nextTick();
    expect(document.body.querySelector("[role=menu]")).toBeNull();
    expect(copyMock).not.toHaveBeenCalled();
    wrapper.unmount();
  });


  it("tells the developer to select a workspace when none is selected", () => {
    state.selectedWorkspaceId = null;
    const wrapper = mount(FilesPanel);
    expect(wrapper.text()).toBe("Select a workspace.");
  });

  it("tells the developer when the workspace is not a Git repository", () => {
    state.selectedWorkspaceId = "w1";
    git.status = { w1: null };
    const wrapper = mount(FilesPanel);
    expect(wrapper.text()).toBe("This workspace is not a Git repository.");
  });
});

describe("FilesPanel, the files and the folders that Git ignores", () => {
  /** The first level of each folder that Git ignores, as the backend gives it. A folder ends with "/". */
  let ignoredFolders: Record<string, string[]>;

  beforeEach(() => {
    ignoredFolders = {
      ".heidrun": ["config.json", "nested/"],
      ".heidrun/nested": ["deep.txt"],
      dist: ["bundle.js"],
    };
    invokeMock.mockImplementation(async (command: string, args: { ignored?: boolean; path?: string; paths?: string[] }) => {
      if (command === "files_list") {
        const ignored = args.ignored === true ? [".env", ".heidrun/", "dist/"] : [];
        return {
          root: "/work/heidrun",
          git: true,
          files: ["README.md", "src/main.ts", ...ignored],
          ignored,
          status: {},
          truncated: false,
        };
      }
      if (command === "folder_children") {
        const children = ignoredFolders[args.path ?? ""];
        if (children === undefined) {
          throw new Error("not a folder");
        }
        return children;
      }
      if (command === "dirs_existing") {
        return args.paths;
      }
      return null;
    });
  });

  /** The row whose name is `name`. */
  function rowNamed(wrapper: Awaited<ReturnType<typeof mountPanel>>, name: string) {
    return wrapper.findAll(".row").find((row) => row.get(".name").text() === name);
  }

  /** The names of the rows, from the top. */
  function rowNames(wrapper: Awaited<ReturnType<typeof mountPanel>>): string[] {
    return wrapper.findAll(".row .name").map((name) => name.text());
  }

  it("lists a folder that holds only ignored files, and its ignored file after it unfolds, both in the muted color, when the option is on", async () => {
    settings.filesShowIgnored = true;
    const wrapper = await mountPanel();
    expect(rowNames(wrapper)).toEqual([".heidrun", "dist", "src", ".env", "README.md"]);
    expect(rowNamed(wrapper, ".heidrun")?.classes()).toContain("ignored");
    await rowNamed(wrapper, ".heidrun")?.trigger("click");
    await vi.waitFor(() => expect(rowNames(wrapper)).toContain("config.json"));
    expect(invokeMock).toHaveBeenCalledWith("folder_children", { root: "/work/heidrun", path: ".heidrun" });
    expect(rowNamed(wrapper, "config.json")?.classes()).toContain("ignored");
    expect(rowNamed(wrapper, "config.json")?.find(".arrow i").exists()).toBe(false);
  });

  it("does not list a folder or a file that Git ignores when the option is off, and reads no folder", async () => {
    const wrapper = await mountPanel();
    expect(rowNames(wrapper)).toEqual(["src", "README.md"]);
    expect(invokeMock).toHaveBeenCalledWith("files_list", { cwd: "/work/heidrun", ignored: false });
    expect(invokeMock).not.toHaveBeenCalledWith("folder_children", expect.anything());
  });

  it("shows a file that Git ignores in the muted color, and a file that Git tracks and a folder that Git tracks in the normal color", async () => {
    settings.filesShowIgnored = true;
    const wrapper = await mountPanel();
    expect(rowNamed(wrapper, ".env")?.classes()).toContain("ignored");
    expect(rowNamed(wrapper, "README.md")?.classes()).not.toContain("ignored");
    expect(rowNamed(wrapper, "src")?.classes()).not.toContain("ignored");
  });

  it("gives a row that Git ignores the muted color in the style of the sidebar section", () => {
    const source = readFileSync(path.join(import.meta.dirname, "FilesPanel.vue"), "utf8");
    expect(source).toMatch(/\.row\.ignored \{ color: var\(--muted\); \}/);
  });

  it("unfolds an ignored folder inside an ignored folder, and reads only the folders that the developer unfolds, one level each", async () => {
    settings.filesShowIgnored = true;
    const wrapper = await mountPanel();
    await rowNamed(wrapper, ".heidrun")?.trigger("click");
    await vi.waitFor(() => expect(rowNames(wrapper)).toContain("nested"));
    expect(rowNames(wrapper)).not.toContain("deep.txt");
    await rowNamed(wrapper, "nested")?.trigger("click");
    await vi.waitFor(() => expect(rowNames(wrapper)).toContain("deep.txt"));
    expect(rowNames(wrapper)).toEqual([".heidrun", "nested", "deep.txt", "config.json", "dist", "src", ".env", "README.md"]);
    const reads = invokeMock.mock.calls.filter(([command]) => command === "folder_children").map(([, args]) => args.path);
    expect(reads).toEqual([".heidrun", ".heidrun/nested"]);
  });

  it("folds an unfolded ignored folder with a click, without reading the folder again", async () => {
    settings.filesShowIgnored = true;
    const wrapper = await mountPanel();
    await rowNamed(wrapper, ".heidrun")?.trigger("click");
    await vi.waitFor(() => expect(rowNames(wrapper)).toContain("config.json"));
    await rowNamed(wrapper, ".heidrun")?.trigger("click");
    expect(rowNames(wrapper)).not.toContain("config.json");
    expect(invokeMock.mock.calls.filter(([command]) => command === "folder_children")).toHaveLength(1);
  });

  it("opens a file inside a folder that Git ignores in a file view pane after a click on it (issue #714)", async () => {
    openFileViewMock.mockResolvedValue(true);
    settings.filesShowIgnored = true;
    const wrapper = await mountPanel();
    await rowNamed(wrapper, ".heidrun")?.trigger("click");
    await vi.waitFor(() => expect(rowNames(wrapper)).toContain("config.json"));
    await rowNamed(wrapper, "config.json")?.trigger("click");
    await vi.waitFor(() => expect(openFileViewMock).toHaveBeenCalledWith("/work/heidrun/.heidrun/config.json"));
    expect(files.open).toBe(false);
  });

  it("opens a file inside a folder that Git ignores in the Files window after a click when no pane can show it", async () => {
    settings.filesShowIgnored = true;
    const wrapper = await mountPanel();
    await rowNamed(wrapper, ".heidrun")?.trigger("click");
    await vi.waitFor(() => expect(rowNames(wrapper)).toContain("config.json"));
    await rowNamed(wrapper, "config.json")?.trigger("click");
    await vi.waitFor(() => expect(files.active).toBe(".heidrun/config.json"));
    expect(files.open).toBe(true);
    expect(git.modal.open).toBe(false);
  });

  it("reads again every unfolded ignored folder after the button Refresh", async () => {
    settings.filesShowIgnored = true;
    const wrapper = await mountPanel();
    await rowNamed(wrapper, ".heidrun")?.trigger("click");
    await vi.waitFor(() => expect(rowNames(wrapper)).toContain("config.json"));
    ignoredFolders[".heidrun"] = ["config.json", "nested/", "created_outside.txt"];
    await wrapper.get("[aria-label='Refresh']").trigger("click");
    await vi.waitFor(() => expect(rowNames(wrapper)).toContain("created_outside.txt"));
    const reads = invokeMock.mock.calls.filter(([command, args]) => command === "folder_children" && args.path === "dist");
    expect(reads).toHaveLength(0);
  });

  it("keeps the folder folded and shows an error message when the folder cannot be read", async () => {
    settings.filesShowIgnored = true;
    const wrapper = await mountPanel();
    delete ignoredFolders.dist;
    await rowNamed(wrapper, "dist")?.trigger("click");
    await vi.waitFor(() => expect(state.toast).toBe("This folder cannot be read."));
    expect(wrapper.findAll(".row .name").map((name) => name.text())).toEqual([".heidrun", "dist", "src", ".env", "README.md"]);
    expect(rowNamed(wrapper, "dist")?.attributes("aria-expanded")).toBe("false");
  });

  it("shows and hides the files that Git ignores with the option of the menu, and forgets the content of the ignored folders", async () => {
    const wrapper = await mountPanel();
    expect(rowNames(wrapper)).toEqual(["src", "README.md"]);
    settings.filesShowIgnored = true;
    await vi.waitFor(() => expect(rowNames(wrapper)).toEqual([".heidrun", "dist", "src", ".env", "README.md"]));
    await rowNamed(wrapper, ".heidrun")?.trigger("click");
    await vi.waitFor(() => expect(rowNames(wrapper)).toContain("config.json"));
    settings.filesShowIgnored = false;
    await vi.waitFor(() => expect(rowNames(wrapper)).toEqual(["src", "README.md"]));
    expect(filesPanelIgnoredChildren[".heidrun"]).toBeUndefined();
  });

  it("selects nothing when the option goes off while the selected row is inside a folder that Git ignores", async () => {
    settings.filesShowIgnored = true;
    const wrapper = await mountPanel();
    await rowNamed(wrapper, ".heidrun")?.trigger("click");
    await vi.waitFor(() => expect(rowNames(wrapper)).toContain("config.json"));
    expect(filesPanelSelections.w1.path).toBe(".heidrun");
    settings.filesShowIgnored = false;
    await vi.waitFor(() => expect(filesPanelSelections.w1).toBeUndefined());
  });

  it("puts a new file inside an ignored folder, and shows it from the disk", async () => {
    settings.filesShowIgnored = true;
    const wrapper = await mountPanel();
    await rowNamed(wrapper, ".heidrun")?.trigger("click");
    await vi.waitFor(() => expect(rowNames(wrapper)).toContain("config.json"));
    await wrapper.get("[aria-label='New file']").trigger("click");
    ignoredFolders[".heidrun"] = ["config.json", "nested/", "notes.txt"];
    await wrapper.get(".naming-row input").setValue("notes.txt");
    await wrapper.get(".naming-row input").trigger("keydown", { key: "Enter" });
    await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith("file_create", { root: "/work/heidrun", path: ".heidrun/notes.txt", dir: false }));
    await vi.waitFor(() => expect(rowNames(wrapper)).toContain("notes.txt"));
    expect(rowNamed(wrapper, "notes.txt")?.classes()).toContain("ignored");
  });

  it("shows a new folder inside an ignored folder once, from the disk, and does not remember it in the list of new folders", async () => {
    settings.filesShowIgnored = true;
    const wrapper = await mountPanel();
    await rowNamed(wrapper, ".heidrun")?.trigger("click");
    await vi.waitFor(() => expect(rowNames(wrapper)).toContain("config.json"));
    await wrapper.get("[aria-label='New folder']").trigger("click");
    ignoredFolders[".heidrun"] = ["config.json", "nested/", "created/"];
    ignoredFolders[".heidrun/created"] = [];
    await wrapper.get(".naming-row input").setValue("created");
    await wrapper.get(".naming-row input").trigger("keydown", { key: "Enter" });
    await vi.waitFor(() => expect(rowNames(wrapper)).toContain("created"));
    expect(rowNames(wrapper).filter((name) => name === "created")).toHaveLength(1);
    expect(filesPanelNewFolders["/work/heidrun"] ?? []).toEqual([]);
  });
});
