// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DOMWrapper, enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";

const invokeMock = vi.hoisted(() => vi.fn(async (_command: string, _args: Record<string, string>): Promise<unknown> => null));
const writeTextMock = vi.hoisted(() => vi.fn(async (_text: string) => {}));
const revealMock = vi.hoisted(() => vi.fn(async (_path: string) => {}));
const openSearchMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}), revealItemInDir: revealMock }));
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
      props: { path: String, text: String, wrap: Boolean, readOnly: Boolean },
      setup(props, { expose }) {
        expose({ openSearch: openSearchMock });
        return () =>
          h("div", {
            class: "code-editor-stub",
            "data-path": props.path,
            "data-read-only": String(props.readOnly),
            "data-wrap": String(props.wrap),
            "data-text": props.text,
          });
      },
    }),
  };
});

import FileView from "./FileView.vue";
import { settings } from "../stores/settings";

enableAutoUnmount(afterEach);

const LABEL = "Heidrun file view: /work/project/src/main.ts";
const MARKDOWN_LABEL = "Heidrun file view: /work/project/README.md";
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
  if (command === "file_image") {
    return "data:image/png;base64,AAAA";
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
  openSearchMock.mockClear();
  settings.filesMdRead = true;
  settings.codeWrap = false;
});

afterEach(() => {
  host.remove();
  document.body.innerHTML = "";
});

describe("FileView (issue #714)", () => {
  it("resolves the file from the folder of the pane, reads it, and gives it to a read only editor", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    expect(invokeMock).toHaveBeenCalledWith("files_resolve", { cwd: "/work/project", path: "/work/project/src/main.ts" });
    expect(invokeMock).toHaveBeenCalledWith("git_file", { root: "/work/project", path: "src/main.ts", rev: null });
    const editor = wrapper.get(".code-editor-stub");
    expect(editor.attributes("data-read-only")).toBe("true");
    expect(editor.attributes("data-path")).toBe("src/main.ts");
    expect(editor.attributes("data-text")).toBe("const a = 1;");
  });

  it("has no button to edit or to save, and never calls a command that writes", async () => {
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
    expect(wrapper.get(".code-editor-stub").attributes("data-text")).toBe("# Title\n\nSome **text**.");
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

  it("gives the choice of wrapping lines to the editor, with a switch", async () => {
    const wrapper = mountFileView();
    await flushPromises();
    expect(wrapper.get(".code-editor-stub").attributes("data-wrap")).toBe("false");
    expect(controls().get(".switch + label").text()).toBe("Wrap lines");
    await controls().get("input[role='switch']").setValue(true);
    expect(settings.codeWrap).toBe(true);
    expect(wrapper.get(".code-editor-stub").attributes("data-wrap")).toBe("true");
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
    expect(invokeMock).toHaveBeenCalledWith("git_file", { root: "/work/project", path: "src/other.ts", rev: null });
    expect(wrapper.get(".code-editor-stub").attributes("data-path")).toBe("src/other.ts");
  });
});

describe("FileView menu (issue #784)", () => {
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
    expect(document.activeElement).toBe(menuEntry("open-in-visual-studio-code").element);
    pressKey("Home");
    expect(document.activeElement).toBe(menuEntry("search").element);
    pressKey("End");
    expect(document.activeElement).toBe(menuEntry("open-in-visual-studio-code").element);
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
    expect(wrapper.get(".code-editor-stub").attributes("data-text")).toBe(`---\n${FRONT_MATTER}\n---\n\n# Project\n\nThe text.`);
  });
});
