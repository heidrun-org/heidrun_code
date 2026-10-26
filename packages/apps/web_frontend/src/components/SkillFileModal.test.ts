// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, type VueWrapper } from "@vue/test-utils";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => []) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}) }));

const TEXT = "---\nname: pdf\ndescription: Read PDF files.\n---\n\n# PDF skill\n\nUse **this** skill for [PDF](https://example.com) files.\n";

/** The windows mounted by a test: each one listens to the keyboard of the page until it is unmounted. */
const mounted: VueWrapper[] = [];

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount();
  }
});

/** Mounts the window with the SKILL.md file `TEXT` open. */
async function mountModal() {
  const { skills } = await import("../stores/skills");
  const { settings } = await import("../stores/settings");
  const { default: SkillFileModal } = await import("./SkillFileModal.vue");
  skills.view = { name: "pdf", originLabel: "skills.sh · anthropics/skills", text: TEXT, loading: false };
  const wrapper = mount(SkillFileModal);
  mounted.push(wrapper);
  return { wrapper, skills, settings };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  // The theme store follows the colour scheme of the system, which jsdom does not know.
  window.matchMedia = vi.fn(() => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia;
});

describe("SkillFileModal", () => {
  it("shows the name and the origin in the title", async () => {
    const { wrapper } = await mountModal();
    expect(wrapper.get("h2").text()).toBe("pdf");
    expect(wrapper.get(".origin").text()).toBe("skills.sh · anthropics/skills");
  });

  it("shows the Markdown rendered by default, without the frontmatter lines", async () => {
    const { wrapper } = await mountModal();
    expect(wrapper.get(".md-doc h1").text()).toBe("PDF skill");
    expect(wrapper.get(".md-doc strong").text()).toBe("this");
    expect(wrapper.get(".md-doc").text()).not.toContain("name: pdf");
  });

  it("shows the fields of the frontmatter above the rendered text", async () => {
    const { wrapper } = await mountModal();
    expect(wrapper.findAll(".front dt").map((node) => node.text())).toEqual(["name", "description"]);
    expect(wrapper.findAll(".front dd").map((node) => node.text())).toEqual(["pdf", "Read PDF files."]);
  });

  it("uses the whole width by default, and a column of about 80 characters with Wrap at 80 columns (issue #897)", async () => {
    const { wrapper, settings } = await mountModal();
    expect(wrapper.get(".md-doc").classes()).toContain("full");
    expect(wrapper.get(".front").classes()).toContain("full");
    settings.markdownWrapAt80Columns = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.get(".md-doc").classes()).toContain("wrap-at-80-columns");
    expect(wrapper.get(".md-doc").classes()).not.toContain("full");
    expect(wrapper.get(".front").classes()).toContain("wrap-at-80-columns");
  });

  it("shows the source with colours and line numbers when the user chooses Source", async () => {
    const { wrapper, settings } = await mountModal();
    await wrapper.findAll(".seg button")[1].trigger("click");
    expect(settings.skillsViewRendered).toBe(false);
    expect(wrapper.find(".md-doc").exists()).toBe(false);
    const rows = wrapper.findAll(".tbl tr");
    expect(rows.length).toBe(TEXT.split("\n").length);
    expect(rows[0].get(".no").text()).toBe("1");
    expect(wrapper.find(".src span").exists()).toBe(true);
  });

  it("remembers the choice of Source in the saved settings", async () => {
    const { wrapper } = await mountModal();
    await wrapper.findAll(".seg button")[1].trigger("click");
    await new Promise((resolve) => setTimeout(resolve));
    expect(JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}").skillsViewRendered).toBe(false);
  });

  it("closes with the close button", async () => {
    const { wrapper, skills } = await mountModal();
    await wrapper.get(".close").trigger("click");
    expect(skills.view).toBeNull();
  });

  it("closes with the Escape key, and the window Installed skill below stays open", async () => {
    // As in the application: the window Installed skill is open first, then the window of the SKILL.md file.
    const { installedSkillModal } = await import("../stores/skills");
    const { default: InstalledSkillModal } = await import("./InstalledSkillModal.vue");
    installedSkillModal.open = true;
    const installSkillWrapper = mount(InstalledSkillModal);
    mounted.push(installSkillWrapper);
    const { wrapper, skills } = await mountModal();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
    expect(skills.view).toBeNull();
    expect(installedSkillModal.open).toBe(true);
    expect(wrapper.exists()).toBe(true);
  });
});

describe("SkillFileModal: the differences from the installed skill", () => {
  const NEW_TEXT = "---\nname: pdf\n---\n# PDF skill\nUse the new way.\n";
  const OLD_TEXT = "---\nname: pdf\n---\n# PDF skill\nUse the old way.\n";

  /** Mounts the window with the text `NEW_TEXT`, and with `installedText` as the text of the installed skill. */
  async function mountWithInstalled(installedText: string | undefined) {
    const { skills } = await import("../stores/skills");
    const { settings } = await import("../stores/settings");
    const { default: SkillFileModal } = await import("./SkillFileModal.vue");
    skills.view = { name: "pdf", originLabel: "Local folder · /a/pdf", text: NEW_TEXT, loading: false, installedText };
    const wrapper = mount(SkillFileModal);
    mounted.push(wrapper);
    return { wrapper, skills, settings };
  }

  it("has no button Differences when no skill with this name is installed", async () => {
    const { wrapper } = await mountWithInstalled(undefined);
    expect(wrapper.findAll(".seg button").map((button) => button.text())).toEqual(["Rendered", "Source"]);
  });

  it("opens on the differences when the installed skill has another text, with the removed and the added lines", async () => {
    const { wrapper } = await mountWithInstalled(OLD_TEXT);
    expect(wrapper.findAll(".seg button").map((button) => button.text())).toEqual(["Differences", "Rendered", "Source"]);
    expect(wrapper.findAll(".seg button")[0].attributes("aria-checked")).toBe("true");
    expect(wrapper.get(".diff-help").text()).toContain("Lines with −");
    expect(wrapper.get(".d-row.del").text()).toContain("Use the old way.");
    expect(wrapper.get(".d-row.add").text()).toContain("Use the new way.");
    expect(wrapper.find(".md-doc").exists()).toBe(false);
  });

  it("opens on the rendered text when the installed skill has the same text, and says so under Differences", async () => {
    const { wrapper } = await mountWithInstalled(NEW_TEXT);
    expect(wrapper.find(".md-doc").exists()).toBe(true);
    await wrapper.findAll(".seg button")[0].trigger("click");
    expect(wrapper.get(".diff-help").text()).toBe("This skill has the same SKILL.md file as the installed skill.");
    expect(wrapper.find(".diff").exists()).toBe(false);
  });

  it("goes from the differences to the rendered text or the source, and back", async () => {
    const { wrapper, settings } = await mountWithInstalled(OLD_TEXT);
    await wrapper.findAll(".seg button")[1].trigger("click");
    expect(wrapper.find(".diff").exists()).toBe(false);
    expect(wrapper.find(".md-doc").exists()).toBe(true);
    await wrapper.findAll(".seg button")[2].trigger("click");
    expect(settings.skillsViewRendered).toBe(false);
    expect(wrapper.find(".tbl").exists()).toBe(true);
    await wrapper.findAll(".seg button")[0].trigger("click");
    expect(wrapper.find(".diff").exists()).toBe(true);
  });
});
