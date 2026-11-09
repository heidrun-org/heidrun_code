// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { DOMWrapper, enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";

const invokeMock = vi.hoisted(() => vi.fn(async (_command: string, _args: Record<string, string>): Promise<unknown> => null));
const writeTextMock = vi.hoisted(() => vi.fn(async (_text: string) => {}));
const openUrlMock = vi.hoisted(() => vi.fn(async (_url: string) => {}));
const revealMock = vi.hoisted(() => vi.fn(async (_path: string) => {}));
const openSearchMock = vi.hoisted(() => vi.fn());
const goToLineMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
/** The handlers of the backend events, by event name: a test sends the event `file-changed` of the backend. */
const eventHandlers = vi.hoisted(() => new Map<string, Array<(event: { payload: unknown }) => void>>());
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    eventHandlers.set(name, [...(eventHandlers.get(name) ?? []), handler]);
    return () => {
      eventHandlers.set(name, (eventHandlers.get(name) ?? []).filter((each) => each !== handler));
    };
  }),
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: openUrlMock, revealItemInDir: revealMock }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ writeText: writeTextMock }));
// The theme reads the colour scheme of the browser, which jsdom does not have.
vi.mock("../stores/theme", async () => {
  const { ref } = await import("vue");
  return { codeThemeClass: ref("github-dark") };
});
// CodeMirror needs a real browser: the stub shows what the file view gives to the editor.
vi.mock("./CodeEditor.vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    default: defineComponent({
      props: { path: String, text: String, wrap: Boolean, readOnly: Boolean, line: Number, autoFocus: { type: Boolean, default: undefined } },
      emits: ["change", "save", "selection"],
      setup(props, { expose }) {
        expose({ openSearch: openSearchMock, goToLine: goToLineMock });
        return () =>
          h("div", {
            class: "code-editor-stub",
            "data-path": props.path,
            "data-read-only": String(props.readOnly),
            "data-wrap": String(props.wrap),
            "data-text": props.text,
            "data-line": String(props.line ?? ""),
            "data-auto-focus": String(props.autoFocus),
          });
      },
    }),
  };
});

import FileView from "./FileView.vue";
import { settings } from "../stores/settings";
import { fileViewEdits } from "../stores/file_view_edit_state";
import { openUrl } from "@tauri-apps/plugin-opener";
import { fileViewAnchorRequests, fileViewLineRequests, FileViewPanes } from "../stores/file_view_panes";

enableAutoUnmount(afterEach);

const LABEL = "Heidrun file view: /work/project/src/main.ts";
const MARKDOWN_LABEL = "Heidrun file view: /work/project/README.md";
const HTML_LABEL = "Heidrun file view: /work/project/reports/my report.html";
const PLAIN_MARKDOWN = "# Title\n\nSome **text**.\n";

/** The text of the Markdown file of the tests. */
let markdownContent = PLAIN_MARKDOWN;
/** The element of the header of the pane that holds the controls: the test plays the role of the pane header. */
let host: HTMLElement;

/** What the backend answers for the files of the tests. */
function answer(command: string, args: Record<string, string>) {
  if (command === "files_resolve") {
    return { root: "/work/project", path: args.path.replace("/work/project/", "") };
  }
  if (command === "git_file") {
    return args.path.endsWith(".md") ? markdownContent : "const a = 1;\n";
  }
  if (command === "file_read") {
    return { text: args.path.endsWith(".md") ? markdownContent : "const a = 1;\n", hash: "hash-1" };
  }
  if (command === "file_stat") {
    return { hash: "hash-1" };
  }
  if (command === "file_write") {
    return { hash: "hash-2" };
  }
  if (command === "file_image") {
    return "data:image/png;base64,AAAA";
  }
  if (command === "html_preview_open") {
    return { key: "secret-1", address: "http://127.0.0.1:52000/secret-1/" };
  }
  return null;
}

function mountFileView(label = LABEL) {
  return mount(FileView, {
    props: {
      pane: { pane_id: "w1:p2", terminal_id: "t2", workspace_id: "w1", tab_id: "w1:t1", focused: false, agent_status: "unknown", revision: 1, label, cwd: "/work/project" },
      controlsHost: host,
    },
  });
}

/** The stub of the code editor, to send the events of the editor. */
function editorOf(wrapper: ReturnType<typeof mountFileView>): VueWrapper {
  return wrapper.findComponent(".code-editor-stub") as unknown as VueWrapper;
}

/** The controls that the file view puts in the header of the pane. */
function controls() {
  return new DOMWrapper(host);
}

/** The button with three dots, which opens the menu. */
function menuButton() {
  return controls().get("button[aria-haspopup='menu']");
}

/** Opens the menu with a click on its button. */
async function openMenu() {
  await menuButton().trigger("click");
  await flushPromises();
}

/** The entry of the open menu that has this `data-action`. */
function menuEntry(action: string) {
  return new DOMWrapper(document.body).get(`[role='menuitem'][data-action='${action}']`);
}

/** The switch of the open menu that has this `data-action`. */
function menuSwitch(action: string) {
  return new DOMWrapper(document.body).get(`[role='menuitemcheckbox'][data-action='${action}']`);
}

/** The text of every switch of the open menu, from the first to the last. */
function menuSwitchTexts(): string[] {
  return Array.from(document.body.querySelectorAll("[role='menuitemcheckbox']")).map((entry) => (entry.textContent ?? "").trim());
}

/** The text of every entry of the open menu, from the first to the last. */
function menuTexts(): string[] {
  return Array.from(document.body.querySelectorAll("[role='menuitem']")).map((entry) => (entry.textContent ?? "").trim());
}

/** Presses a key on the document, as the keyboard does while a menu is open. */
function pressKey(key: string) {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  markdownContent = PLAIN_MARKDOWN;
  invokeMock.mockReset();
  invokeMock.mockImplementation(async (command: string, args: Record<string, string>) => answer(command, args));
  writeTextMock.mockClear();
  revealMock.mockClear();
  openUrlMock.mockClear();
  openSearchMock.mockClear();
  goToLineMock.mockClear();
  for (const paneId of Object.keys(fileViewEdits)) {
    delete fileViewEdits[paneId];
  }
  for (const path of Object.keys(fileViewLineRequests)) {
    delete fileViewLineRequests[path];
  }
  for (const path of Object.keys(fileViewAnchorRequests)) {
    delete fileViewAnchorRequests[path];
  }
  vi.mocked(openUrl).mockClear();
  settings.filesMdRead = true;
  settings.codeWrap = false;
  settings.markdownWrapAt80Columns = false;
});

afterEach(() => {
  host.remove();
  document.body.innerHTML = "";
});

describe("FileView (issue #714)", () => {
  it("resolves the file from the folder of the pane, reads it, and gives it to an editor that can change it (issue #899)", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    expect(invokeMock).toHaveBeenCalledWith("files_resolve", { cwd: "/work/project", path: "/work/project/src/main.ts", allowOutside: true });
    expect(invokeMock).toHaveBeenCalledWith("file_read", { root: "/work/project", path: "src/main.ts" });
    const editor = wrapper.get(".code-editor-stub");
    expect(editor.attributes("data-read-only")).toBe("false");
    expect(editor.attributes("data-auto-focus")).toBe("false");
    expect(editor.attributes("data-path")).toBe("src/main.ts");
    expect(editor.attributes("data-text")).toBe("const a = 1;\n");
  });

  it("has no button Save while the file has no unsaved changes, and never writes the file before a save", async () => {
    mountFileView();
    await flushPromises();
    expect(controls().findAll("button")).toHaveLength(1);
    await openMenu();
    expect(menuTexts()).toEqual(["Search", "Copy path", "Show in Finder", "Open in VS Code"]);
    const commands = invokeMock.mock.calls.map(([command]) => command);
    expect(commands.filter((command) => /write|create|rename|trash/.test(command))).toEqual([]);
  });

  it("shows a Markdown file as rendered text, with the switch to the raw file", async () => {
    const wrapper = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    expect(wrapper.find(".md-doc h1").text()).toBe("Title");
    expect(wrapper.find(".code-editor-stub").exists()).toBe(false);
    await controls().findAll("input[type='radio']")[1].setValue();
    await flushPromises();
    expect(settings.filesMdRead).toBe(false);
    expect(wrapper.get(".code-editor-stub").attributes("data-text")).toBe("# Title\n\nSome **text**.\n");
  });

  it("names the two buttons of a Markdown file Preview and Raw, and gives each one a title", async () => {
    mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    const buttons = controls().findAll(".btn-group label");
    expect(buttons.map((button) => button.text())).toEqual(["Preview", "Raw"]);
    expect(buttons[0].attributes("title")).toBe("Preview: show the rendered text, with the front matter in a card");
    expect(buttons[1].attributes("title")).toBe("Raw: show the file as it is");
  });

  it("shows no switch between Preview and Raw for a file that is not Markdown", async () => {
    mountFileView();
    await flushPromises();
    expect(controls().find(".btn-group").exists()).toBe(false);
  });

  it("gives the choice of wrapping lines to the editor, with a switch in the menu that leaves the menu open", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    expect(wrapper.get(".code-editor-stub").attributes("data-wrap")).toBe("false");
    expect(controls().find(".switch").exists()).toBe(false);
    await openMenu();
    expect(menuSwitch("wrap-lines").attributes("aria-checked")).toBe("false");
    await menuSwitch("wrap-lines").trigger("click");
    expect(settings.codeWrap).toBe(true);
    expect(wrapper.get(".code-editor-stub").attributes("data-wrap")).toBe("true");
    expect(menuSwitch("wrap-lines").attributes("aria-checked")).toBe("true");
    expect(menuSwitch("wrap-lines").get("input").element.checked).toBe(true);
    expect(document.body.querySelector("[role='menu']")).not.toBeNull();
  });

  it("shows the Markdown preview on the whole width of the pane by default (issue #897)", async () => {
    const wrapper = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    expect(wrapper.get(".md-doc").classes()).toContain("full");
    expect(wrapper.get(".md-doc").classes()).not.toContain("wrap-at-80-columns");
  });

  it("gives a switch Wrap at 80 columns after Wrap lines, which keeps the preview in a narrow column (issue #897)", async () => {
    const wrapper = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    await openMenu();
    expect(menuSwitchTexts()).toEqual(["Wrap lines", "Wrap at 80 columns"]);
    await menuSwitch("wrap-at-80-columns").trigger("click");
    expect(settings.markdownWrapAt80Columns).toBe(true);
    expect(wrapper.get(".md-doc").classes()).toContain("wrap-at-80-columns");
    expect(wrapper.get(".md-doc").classes()).not.toContain("full");
  });

  it("shows no switch Wrap at 80 columns for a file that is not Markdown (issue #897)", async () => {
    mountFileView();
    await flushPromises();
    await openMenu();
    expect(menuSwitchTexts()).toEqual(["Wrap lines"]);
  });

  it("opens the search panel of the editor with the entry Search of the menu, and closes the menu", async () => {
    mountFileView();
    await flushPromises();
    await openMenu();
    await menuEntry("search").trigger("click");
    expect(openSearchMock).toHaveBeenCalledTimes(1);
    expect(document.body.querySelector("[role='menu']")).toBeNull();
  });

  it("has no entry Search in the menu while the file is shown as rendered Markdown, and has it in Raw", async () => {
    mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    await openMenu();
    expect(menuTexts()).toEqual(["Copy path", "Show in Finder", "Open in VS Code"]);
    await menuButton().trigger("click");
    await controls().findAll("input[type='radio']")[1].setValue();
    await flushPromises();
    await openMenu();
    expect(menuTexts()).toEqual(["Search", "Copy path", "Show in Finder", "Open in VS Code"]);
  });

  it("copies the path inside the project, and the absolute path with the key Option", async () => {
    mountFileView();
    await flushPromises();
    await openMenu();
    await menuEntry("copy-path").trigger("click");
    expect(writeTextMock).toHaveBeenLastCalledWith("src/main.ts");
    await openMenu();
    await menuEntry("copy-path").trigger("click", { altKey: true });
    expect(writeTextMock).toHaveBeenLastCalledWith("/work/project/src/main.ts");
  });

  it("shows the file in the Finder, and opens it in VS Code", async () => {
    mountFileView();
    await flushPromises();
    await openMenu();
    await menuEntry("show-in-finder").trigger("click");
    expect(revealMock).toHaveBeenCalledWith("/work/project/src/main.ts");
    await openMenu();
    await menuEntry("open-in-visual-studio-code").trigger("click");
    expect(invokeMock).toHaveBeenCalledWith("file_open_external", { root: "/work/project", path: "src/main.ts" });
  });

  it("shows an image as a picture", async () => {
    const wrapper = mountFileView("Heidrun file view: /work/project/logo.png");
    await flushPromises();
    expect(wrapper.get(".img img").attributes("src")).toBe("data:image/png;base64,AAAA");
    expect(wrapper.find(".code-editor-stub").exists()).toBe(false);
  });

  it("shows the error of the backend when the file cannot be read", async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === "files_resolve") {
        throw "no such file";
      }
      return null;
    });
    const wrapper = mountFileView();
    await flushPromises();
    expect(wrapper.get(".err").text()).toBe("no such file");
    expect(wrapper.find(".code-editor-stub").exists()).toBe(false);
  });

  it("reads the new file when the label of the pane changes", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    await wrapper.setProps({ pane: { ...wrapper.props("pane"), label: "Heidrun file view: /work/project/src/other.ts" } });
    await flushPromises();
    expect(invokeMock).toHaveBeenCalledWith("file_read", { root: "/work/project", path: "src/other.ts" });
    expect(wrapper.get(".code-editor-stub").attributes("data-path")).toBe("src/other.ts");
  });
});

describe("FileView menu (issue #784)", () => {
  it("shows three vertical dots on the menu button, and the two switches under a divider after the actions (issue #897)", async () => {
    mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    expect(menuButton().find(".bi-three-dots-vertical").exists()).toBe(true);
    await openMenu();
    const children = Array.from(document.body.querySelector("[role='menu']")!.children);
    expect(children.map((child) => child.getAttribute("data-action") ?? child.getAttribute("role"))).toEqual([
      "copy-path",
      "show-in-finder",
      "open-in-visual-studio-code",
      "separator",
      "wrap-lines",
      "wrap-at-80-columns",
    ]);
  });

  it("opens with a click, moves between the entries with the arrow keys, and closes with the key Escape", async () => {
    mountFileView();
    await flushPromises();
    await openMenu();
    expect(menuButton().attributes("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(menuEntry("search").element);
    pressKey("ArrowDown");
    expect(document.activeElement).toBe(menuEntry("copy-path").element);
    pressKey("ArrowUp");
    pressKey("ArrowUp");
    expect(document.activeElement).toBe(menuSwitch("wrap-lines").element);
    pressKey("ArrowUp");
    expect(document.activeElement).toBe(menuEntry("open-in-visual-studio-code").element);
    pressKey("Home");
    expect(document.activeElement).toBe(menuEntry("search").element);
    pressKey("End");
    expect(document.activeElement).toBe(menuSwitch("wrap-lines").element);
    pressKey("Escape");
    await flushPromises();
    expect(document.body.querySelector("[role='menu']")).toBeNull();
    expect(menuButton().attributes("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(menuButton().element);
  });

  it("closes when the developer clicks outside the menu", async () => {
    mountFileView();
    await flushPromises();
    await openMenu();
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await flushPromises();
    expect(document.body.querySelector("[role='menu']")).toBeNull();
  });

  it("closes when the key Tab leaves the menu", async () => {
    mountFileView();
    await flushPromises();
    await openMenu();
    pressKey("Tab");
    await flushPromises();
    expect(document.body.querySelector("[role='menu']")).toBeNull();
  });
});

describe("FileView front matter card (issue #784)", () => {
  const FRONT_MATTER = "type: project\nname: subitoflash\nopen_questions: []\nscope_in:\n  - first\n  - second";

  /** The file `index.md` of a project: a front matter block, then a title and a paragraph. */
  function withFrontMatter(block: string): string {
    return `---\n${block}\n---\n\n# Project\n\nThe text.\n`;
  }

  it("shows the front matter block in a card above the rendered text, with the text of the block unchanged", async () => {
    markdownContent = withFrontMatter(FRONT_MATTER);
    const wrapper = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    const card = wrapper.get(".md-doc .front-matter-card");
    expect(card.get("pre").text()).toBe(FRONT_MATTER);
    expect(wrapper.get(".md-doc").element.firstElementChild).toBe(card.element);
  });

  it("does not render the block as Markdown: no horizontal rule and no paragraph made from the fields", async () => {
    markdownContent = withFrontMatter(FRONT_MATTER);
    const wrapper = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    const rendered = wrapper.get(".md-doc > div");
    expect(rendered.find("hr").exists()).toBe(false);
    expect(rendered.text()).not.toContain("type: project");
    expect(rendered.get("h1").text()).toBe("Project");
    expect(rendered.get("p").text()).toBe("The text.");
  });

  it("shows a block with an error, because the block is not parsed", async () => {
    markdownContent = withFrontMatter("type: [unclosed\n  bad: : :");
    const wrapper = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    expect(wrapper.get(".front-matter-card pre").text()).toBe("type: [unclosed\n  bad: : :");
  });

  it("shows no card for a file with no block", async () => {
    const wrapper = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    expect(wrapper.find(".front-matter-card").exists()).toBe(false);
    expect(wrapper.get(".md-doc h1").text()).toBe("Title");
  });

  it("shows no card for an empty block, and renders the file as before", async () => {
    markdownContent = "---\n---\n\n# Title\n";
    const wrapper = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    expect(wrapper.find(".front-matter-card").exists()).toBe(false);
    expect(wrapper.get(".md-doc h1").text()).toBe("Title");
  });

  it("shows no card for a first line of dashes with no closing line of dashes, and renders the file as before", async () => {
    markdownContent = "---\ntype: project\n\n# Title\n";
    const wrapper = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    expect(wrapper.find(".front-matter-card").exists()).toBe(false);
    expect(wrapper.find(".md-doc hr").exists()).toBe(true);
    expect(wrapper.text()).toContain("type: project");
  });

  it("shows the whole file as it is in Raw, with no card", async () => {
    markdownContent = withFrontMatter(FRONT_MATTER);
    const wrapper = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    await controls().findAll("input[type='radio']")[1].setValue();
    await flushPromises();
    expect(wrapper.find(".front-matter-card").exists()).toBe(false);
    expect(wrapper.get(".code-editor-stub").attributes("data-text")).toBe(`---\n${FRONT_MATTER}\n---\n\n# Project\n\nThe text.\n`);
  });
});

describe("FileView editing (issue #899)", () => {
  it("shows the button Save after a change, saves with the fingerprint that was read, and hides the button again", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    editorOf(wrapper).vm.$emit("change", "const a = 2;\n");
    await flushPromises();
    const saveButton = controls().get("button[data-action='save']");
    expect(saveButton.text()).toBe("Save");
    expect(saveButton.attributes("title")).toBe("Save the file (⌘S)");
    await saveButton.trigger("click");
    await flushPromises();
    expect(invokeMock).toHaveBeenCalledWith("file_write", { root: "/work/project", path: "src/main.ts", content: "const a = 2;\n", expected: "hash-1" });
    expect(controls().find("button[data-action='save']").exists()).toBe(false);
  });

  it("saves with the key ⌘S of the editor", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    const editor = editorOf(wrapper);
    editor.vm.$emit("change", "const b = 3;\n");
    editor.vm.$emit("save");
    await flushPromises();
    expect(invokeMock).toHaveBeenCalledWith("file_write", expect.objectContaining({ content: "const b = 3;\n" }));
  });

  it("shows a conflict when the file changed on the disk, and overwrites it only at the save after Keep my version", async () => {
    invokeMock.mockImplementation(async (command: string, args: Record<string, string>) => {
      if (command === "file_write" && (args as unknown as { expected: string }).expected === "hash-1") {
        throw "changed_on_disk";
      }
      if (command === "file_stat") {
        return { hash: "hash-disk" };
      }
      if (command === "file_read" && fileViewEdits["w1:p2"] !== undefined) {
        return { text: "const disk = 1;\n", hash: "hash-disk" };
      }
      return answer(command, args);
    });
    const wrapper = mountFileView();
    await flushPromises();
    editorOf(wrapper).vm.$emit("change", "const mine = 1;\n");
    await flushPromises();
    await controls().get("button[data-action='save']").trigger("click");
    await flushPromises();
    expect(wrapper.get(".banner.warn").text()).toContain("The file changed on disk");
    await wrapper.get(".banner.warn button[data-action='keep-mine']").trigger("click");
    await flushPromises();
    expect(wrapper.find(".banner.warn").exists()).toBe(false);
    expect(invokeMock).not.toHaveBeenCalledWith("file_write", expect.objectContaining({ expected: "hash-disk" }));
    await controls().get("button[data-action='save']").trigger("click");
    await flushPromises();
    expect(invokeMock).toHaveBeenCalledWith("file_write", { root: "/work/project", path: "src/main.ts", content: "const mine = 1;\n", expected: "hash-disk" });
    expect(invokeMock).toHaveBeenLastCalledWith("set_unsaved", { on: false });
  });

  it("drops the changes and reads the disk again with the button Load the new version of the conflict", async () => {
    invokeMock.mockImplementation(async (command: string, args: Record<string, string>) => {
      if (command === "file_write") {
        throw "changed_on_disk";
      }
      if (command === "file_stat") {
        return { hash: "hash-disk" };
      }
      if (command === "file_read" && fileViewEdits["w1:p2"] !== undefined) {
        return { text: "const disk = 1;\n", hash: "hash-disk" };
      }
      return answer(command, args);
    });
    const wrapper = mountFileView();
    await flushPromises();
    editorOf(wrapper).vm.$emit("change", "const mine = 1;\n");
    await flushPromises();
    await controls().get("button[data-action='save']").trigger("click");
    await flushPromises();
    await wrapper.get(".banner.warn button[data-action='reload']").trigger("click");
    await flushPromises();
    expect(wrapper.get(".code-editor-stub").attributes("data-text")).toBe("const disk = 1;\n");
    expect(wrapper.find(".banner.warn").exists()).toBe(false);
    expect(controls().find("button[data-action='save']").exists()).toBe(false);
  });

  it("keeps a file that cannot be edited read only, and says why", async () => {
    invokeMock.mockImplementation(async (command: string, args: Record<string, string>) => {
      if (command === "file_read") {
        throw "binary file: it cannot be edited";
      }
      return answer(command, args);
    });
    const wrapper = mountFileView();
    await flushPromises();
    expect(wrapper.get(".code-editor-stub").attributes("data-read-only")).toBe("true");
    expect(wrapper.get(".code-editor-stub").attributes("data-text")).toBe("const a = 1;");
    expect(wrapper.get(".banner.info").text()).toBe("Read only: binary file: it cannot be edited");
  });

  it("shows the unsaved changes in the Markdown preview", async () => {
    settings.filesMdRead = false;
    const wrapper = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    editorOf(wrapper).vm.$emit("change", "# Changed\n");
    await controls().findAll("input[type='radio']")[0].setValue();
    await flushPromises();
    expect(wrapper.get(".md-doc h1").text()).toBe("Changed");
  });
});

describe("FileView line (issue #898)", () => {
  it("gives the editor the line of the file name, and goes to a line asked again", async () => {
    fileViewLineRequests["/work/project/src/main.ts"] = { line: 42, sequence: 1 };
    const wrapper = mountFileView();
    await flushPromises();
    expect(wrapper.get(".code-editor-stub").attributes("data-line")).toBe("42");
    fileViewLineRequests["/work/project/src/main.ts"] = { line: 7, sequence: 2 };
    await flushPromises();
    expect(goToLineMock).toHaveBeenCalledWith(7);
  });
});

describe("FileView selected lines (issue #901)", () => {
  it("shows the actions Explain and Fix these lines under the selected lines, and hides them when nothing is selected", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    const editor = editorOf(wrapper);
    editor.vm.$emit("selection", { fromLine: 3, toLine: 5, text: "x", left: 40, bottom: 60 });
    await flushPromises();
    const bar = wrapper.get(".selection-bar");
    expect(bar.text()).toContain("lines 3–5");
    expect(bar.findAll("button").map((button) => button.text())).toEqual(["Explain", "Fix these lines"]);
    editor.vm.$emit("selection", null);
    await flushPromises();
    expect(wrapper.find(".selection-bar").exists()).toBe(false);
  });
});

describe("FileView HTML preview (issues #925 and #930)", () => {
  it("shows an HTML file in Preview as a web page in a sandboxed frame, served on the loopback address", async () => {
    const wrapper = mountFileView(HTML_LABEL);
    await flushPromises();
    const frame = wrapper.get("iframe.html-preview");
    expect(frame.attributes("sandbox")).toBe("allow-scripts allow-same-origin");
    expect(frame.attributes("src")).toBe("http://127.0.0.1:52000/secret-1/reports/my%20report.html");
    expect(wrapper.find(".code-editor-stub").exists()).toBe(false);
    expect(invokeMock.mock.calls.map(([command]) => command)).toEqual(["files_resolve", "html_preview_open", "file_watch_start"]);
    expect(invokeMock.mock.calls[1][1]).toEqual({ root: "/work/project" });
  });

  it("closes the preview when the developer chooses Raw and when the pane closes", async () => {
    const wrapper = mountFileView(HTML_LABEL);
    await flushPromises();
    const closeCalls = () => invokeMock.mock.calls.filter(([command]) => command === "html_preview_close");
    expect(closeCalls()).toEqual([]);
    await controls().findAll("input[type='radio']")[1].setValue();
    await flushPromises();
    expect(closeCalls()).toEqual([["html_preview_close", { key: "secret-1" }]]);
    await controls().findAll("input[type='radio']")[0].setValue();
    await flushPromises();
    wrapper.unmount();
    expect(closeCalls()).toEqual([
      ["html_preview_close", { key: "secret-1" }],
      ["html_preview_close", { key: "secret-1" }],
    ]);
  });

  it("closes at once a preview that opens after the pane closed", async () => {
    let finishOpen: (value: unknown) => void = () => {};
    invokeMock.mockImplementation(async (command: string, args: Record<string, string>) => {
      if (command === "html_preview_open") {
        return new Promise((resolve) => {
          finishOpen = resolve;
        });
      }
      return answer(command, args);
    });
    const wrapper = mountFileView(HTML_LABEL);
    await flushPromises();
    wrapper.unmount();
    finishOpen({ key: "late-key", address: "http://127.0.0.1:52000/late-key/" });
    await flushPromises();
    expect(invokeMock.mock.calls.filter(([command]) => command === "html_preview_close")).toEqual([
      ["html_preview_close", { key: "late-key" }],
    ]);
  });

  it("has the buttons Preview and Raw, with the title of a web page, and shows the source code in Raw", async () => {
    const wrapper = mountFileView(HTML_LABEL);
    await flushPromises();
    const group = controls().get("[role='group']");
    expect(group.attributes("aria-label")).toBe("HTML display");
    expect(group.findAll("label").map((label) => label.text())).toEqual(["Preview", "Raw"]);
    expect(group.findAll("label")[0].attributes("title")).toBe("Preview: show the rendered web page");
    await controls().findAll("input[type='radio']")[1].setValue();
    await flushPromises();
    expect(settings.filesMdRead).toBe(false);
    expect(wrapper.find("iframe").exists()).toBe(false);
    expect(wrapper.get(".code-editor-stub").attributes("data-path")).toBe("reports/my report.html");
  });

  it("opens in the browser a link to a web site that the frame sends, and ignores the messages of another window", async () => {
    const wrapper = mountFileView(HTML_LABEL);
    await flushPromises();
    const frameWindow = (wrapper.get("iframe").element as HTMLIFrameElement).contentWindow;
    const data = { type: "heidrun-html-preview-open-url", url: "https://example.com/" };
    window.dispatchEvent(new MessageEvent("message", { data, source: window }));
    expect(openUrlMock).not.toHaveBeenCalled();
    window.dispatchEvent(new MessageEvent("message", { data: { ...data, url: "file:///etc/hosts" }, source: frameWindow }));
    expect(openUrlMock).not.toHaveBeenCalled();
    window.dispatchEvent(new MessageEvent("message", { data, source: frameWindow }));
    expect(openUrlMock).toHaveBeenCalledWith("https://example.com/");
  });
});

describe("FileView Markdown links and background (issue #928)", () => {
  const LINKS_MARKDOWN = [
    "# Title",
    "",
    "[web](https://example.com/page) [notes](#notes) [rules](docs/rules.md#the-rules) [code](src/main.ts#L42)",
    "[mail](mailto:someone@example.com) [self](README.md#notes)",
    "",
    "## Notes",
    "",
    "Text.",
    "",
  ].join("\n");
  let openSpy: MockInstance<typeof FileViewPanes.open>;

  beforeEach(() => {
    markdownContent = LINKS_MARKDOWN;
    openSpy = vi.spyOn(FileViewPanes, "open").mockResolvedValue(true);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  /** Places the heading Notes 300 pixels below the top of the body of the pane, as jsdom has no layout. */
  function placeNotesHeading(wrapper: ReturnType<typeof mountFileView>) {
    const heading = wrapper.get(".md-doc h2").element as HTMLElement;
    heading.getBoundingClientRect = () => ({ top: 300 }) as DOMRect;
  }

  /** The scroll position of the body of the pane. */
  function scrollTopOf(wrapper: ReturnType<typeof mountFileView>): number {
    return (wrapper.get(".code").element as HTMLElement).scrollTop;
  }

  /** Clicks the link of the preview that has this text. */
  async function clickLink(wrapper: ReturnType<typeof mountFileView>, text: string) {
    const link = wrapper.findAll(".md-doc a").find((anchor) => anchor.text() === text);
    if (link === undefined) {
      throw new Error(`no link ${text}`);
    }
    await link.trigger("click");
    await flushPromises();
  }

  it("opens a web link in the browser", async () => {
    const wrapper = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    await clickLink(wrapper, "web");
    expect(openUrl).toHaveBeenCalledWith("https://example.com/page");
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("opens a link to a file of the project in the pane, with the heading of its anchor", async () => {
    const wrapper = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    await clickLink(wrapper, "rules");
    expect(openSpy).toHaveBeenCalledWith("/work/project/docs/rules.md", null, "the-rules");
    expect(openUrl).not.toHaveBeenCalled();
  });

  it("opens a link with a GitHub line anchor at that line", async () => {
    const wrapper = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    await clickLink(wrapper, "code");
    expect(openSpy).toHaveBeenCalledWith("/work/project/src/main.ts", 42, null);
  });

  it("shows the heading of a link that is only an anchor, and of a link to the same file", async () => {
    const wrapper = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    placeNotesHeading(wrapper);
    await clickLink(wrapper, "notes");
    expect(scrollTopOf(wrapper)).toBe(300);
    (wrapper.get(".code").element as HTMLElement).scrollTop = 0;
    await clickLink(wrapper, "self");
    expect(scrollTopOf(wrapper)).toBe(300);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("opens nothing for a link that is neither a web page nor a file", async () => {
    const wrapper = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    await clickLink(wrapper, "mail");
    expect(openUrl).not.toHaveBeenCalled();
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("shows the heading that a link of another preview asked for, once", async () => {
    const wrapper = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    placeNotesHeading(wrapper);
    fileViewAnchorRequests["/work/project/README.md"] = "notes";
    await flushPromises();
    expect(scrollTopOf(wrapper)).toBe(300);
    expect(fileViewAnchorRequests["/work/project/README.md"]).toBeUndefined();
  });

  it("gives the preview the background of a pane, and keeps the code theme for code", async () => {
    const preview = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    expect(preview.get(".code").classes()).toContain("preview");
    const code = mountFileView();
    await flushPromises();
    expect(code.get(".code").classes()).not.toContain("preview");
  });
});

describe("FileView changes on the disk (issue #931)", () => {
  /** The text and the fingerprint of the file on the fake disk. Null for the fingerprint when the file is deleted. */
  let disk: { text: string; hash: string | null };

  beforeEach(() => {
    disk = { text: "const a = 1;\n", hash: "hash-1" };
    eventHandlers.clear();
    invokeMock.mockImplementation(async (command: string, args: Record<string, string>) => {
      if (command === "file_stat") {
        return { hash: disk.hash };
      }
      if (command === "file_read") {
        return { text: args.path.endsWith(".md") ? markdownContent : disk.text, hash: disk.hash };
      }
      if (command === "git_file") {
        if (disk.hash === null) {
          throw "fichier introuvable";
        }
        return args.path.endsWith(".md") ? markdownContent : disk.text;
      }
      if (command === "file_write") {
        disk = { text: (args as unknown as { content: string }).content, hash: "hash-saved" };
        return { hash: disk.hash };
      }
      return answer(command, args);
    });
  });

  /** The identifier of the watch that the pane started. */
  function watchId(): string {
    const call = invokeMock.mock.calls.filter(([command]) => command === "file_watch_start").pop();
    return (call?.[1] as unknown as { watchId: string }).watchId;
  }

  /** Sends the event of the backend for a watch, then waits for the pane to look at the disk. */
  async function fileChanged(id = watchId()) {
    for (const handler of eventHandlers.get("file-changed") ?? []) {
      handler({ payload: { watchId: id } });
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    await flushPromises();
  }

  it("watches the file of the pane, and stops the watch when the pane closes", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    const id = watchId();
    expect(invokeMock).toHaveBeenCalledWith("file_watch_start", { watchId: id, root: "/work/project", path: "src/main.ts" });
    wrapper.unmount();
    expect(invokeMock).toHaveBeenCalledWith("file_watch_stop", { watchId: id });
    expect(eventHandlers.get("file-changed")).toEqual([]);
  });

  it("gives each drawing of a pane its own watch, so a pane drawn again keeps its watch", async () => {
    const first = mountFileView();
    await flushPromises();
    const firstId = watchId();
    const second = mountFileView();
    await flushPromises();
    expect(watchId()).not.toBe(firstId);
    first.unmount();
    expect(invokeMock).not.toHaveBeenCalledWith("file_watch_stop", { watchId: watchId() });
    second.unmount();
  });

  it("shows the new content of a file without unsaved changes, with a short message", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    disk = { text: "const agent = 1;\n", hash: "hash-agent" };
    await fileChanged();
    expect(wrapper.get(".code-editor-stub").attributes("data-text")).toBe("const agent = 1;\n");
    expect(wrapper.get("[data-state='changed-on-disk']").text()).toBe("The file changed on disk");
    expect(wrapper.find(".banner.warn").exists()).toBe(false);
  });

  it("keeps the text of the developer when the pane has unsaved changes, and loads the new version only after a click", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    editorOf(wrapper).vm.$emit("change", "const mine = 1;\n");
    await flushPromises();
    disk = { text: "const agent = 1;\n", hash: "hash-agent" };
    await fileChanged();
    expect(wrapper.get(".code-editor-stub").attributes("data-text")).toBe("const mine = 1;\n");
    const bar = wrapper.get(".banner.warn");
    expect(bar.text()).toContain("The file changed on disk");
    expect(bar.findAll("button").map((button) => button.text())).toEqual(["Load the new version", "Keep my version"]);
    expect(wrapper.find("[data-state='changed-on-disk']").exists()).toBe(false);
    await bar.get("button[data-action='reload']").trigger("click");
    await flushPromises();
    expect(wrapper.get(".code-editor-stub").attributes("data-text")).toBe("const agent = 1;\n");
    expect(wrapper.find(".banner.warn").exists()).toBe(false);
  });

  it("shows nothing after a save of the pane", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    editorOf(wrapper).vm.$emit("change", "const mine = 1;\n");
    editorOf(wrapper).vm.$emit("save");
    await flushPromises();
    await fileChanged();
    expect(wrapper.find("[data-state='changed-on-disk']").exists()).toBe(false);
    expect(wrapper.find(".banner.warn").exists()).toBe(false);
    expect(wrapper.get(".code-editor-stub").attributes("data-text")).toBe("const mine = 1;\n");
  });

  it("does nothing for the event of another watch", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    disk = { text: "const agent = 1;\n", hash: "hash-agent" };
    await fileChanged("file-view-other");
    expect(wrapper.get(".code-editor-stub").attributes("data-text")).toBe("const a = 1;\n");
  });

  it("shows the new content in the Markdown preview, at the same scroll position", async () => {
    const wrapper = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    const body = wrapper.get(".code").element as HTMLElement;
    body.scrollTop = 120;
    markdownContent = "# New title\n";
    disk = { text: markdownContent, hash: "hash-agent" };
    await fileChanged();
    expect(wrapper.get(".md-doc h1").text()).toBe("New title");
    expect(body.scrollTop).toBe(120);
    expect(wrapper.get("[data-state='changed-on-disk']").text()).toBe("The file changed on disk");
  });

  it("says that the file was deleted, in the code editor and in the Markdown preview", async () => {
    const code = mountFileView();
    await flushPromises();
    const codeWatchId = watchId();
    const preview = mountFileView(MARKDOWN_LABEL);
    await flushPromises();
    disk = { text: "", hash: null };
    await fileChanged(codeWatchId);
    await fileChanged();
    expect(code.get(".banner.warn").text()).toContain("The file was deleted");
    expect(preview.get("[data-state='deleted']").text()).toBe("The file was deleted");
    expect(preview.get(".md-doc h1").text()).toBe("Title");
  });
});
