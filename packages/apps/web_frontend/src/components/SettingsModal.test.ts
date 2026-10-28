import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => []) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn(async () => "/home") }));
vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

/** Mounts the Settings window. */
async function mountSettings() {
  const { settingsModal } = await import("../stores/settings");
  const { default: SettingsModal } = await import("./SettingsModal.vue");
  settingsModal.open = true;
  const wrapper = mount(SettingsModal, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe("SettingsModal: sections", () => {
  it("lists the twelve sections in the sidebar, by topic (issues #556, #596, #638, and #662), and without the old sections New tab, Mouse, Finished items, Needs you, and Past chats", async () => {
    const wrapper = await mountSettings();
    const entries = wrapper.findAll("nav .nav-link").map((entry) => entry.text());
    expect(entries).toEqual(["General", "Color themes", "Terminal", "Text detection", "Coding agents", "Confirmations", "Guards", "Notifications", "Sidebars", "Dynamic topics", "Mobile access", "Voice input"]);
    wrapper.unmount();
  });

  it("marks the open section as the active link of the Bootstrap nav, and moves the mark when another link is clicked", async () => {
    const wrapper = await mountSettings();
    const links = wrapper.findAll("nav .nav-link");
    expect(links.map((link) => link.classes().includes("active"))).toEqual([true, false, false, false, false, false, false, false, false, false, false, false]);
    expect(links[0].attributes("aria-current")).toBe("page");
    await links[5].trigger("click");
    expect(wrapper.get("h3").text()).toBe("Confirmations");
    expect(links.map((link) => link.classes().includes("active"))).toEqual([false, false, false, false, false, true, false, false, false, false, false, false]);
    expect(links[5].attributes("aria-current")).toBe("page");
    expect(links[0].attributes("aria-current")).toBeUndefined();
    wrapper.unmount();
  });
});

describe("SettingsModal: section Text detection (issue #638)", () => {
  it("opens its own section after the section Terminal, with its own icon, and keeps it out of the section Terminal", async () => {
    const { settingsModal } = await import("../stores/settings");
    const wrapper = await mountSettings();
    const links = wrapper.findAll("nav .nav-link");
    expect(links[3].text()).toBe("Text detection");
    expect(links[3].get("i").classes()).toContain("bi-regex");
    await links[3].trigger("click");
    expect(settingsModal.section).toBe("textDetection");
    expect(wrapper.get("section h3").text()).toBe("Text detection");
    expect(wrapper.find('[data-option="textDetection"]').exists()).toBe(true);
    settingsModal.section = "terminal";
    await flushPromises();
    expect(wrapper.find('[data-option="textDetection"]').exists()).toBe(false);
    wrapper.unmount();
  });
});

describe("SettingsModal: section Sidebars (issues #442 and #556)", () => {
  it("opens the section Sidebars with one heading for each sidebar section: Needs you, Past chats, and Source control", async () => {
    const { settingsModal } = await import("../stores/settings");
    settingsModal.section = "sidebars";
    const wrapper = await mountSettings();
    expect(wrapper.get("section h3").text()).toBe("Sidebars");
    expect(wrapper.findAll("section h4").map((heading) => heading.text())).toEqual(["Needs you", "Past chats", "Source control"]);
    wrapper.unmount();
  });

  it("opens the section Guards when the confirmation window asks for the section by its identifier guards (issue #596)", async () => {
    const { openSettings, settingsModal } = await import("../stores/settings");
    openSettings("guards");
    const wrapper = await mountSettings();
    expect(settingsModal.section).toBe("guards");
    expect(wrapper.get("section h3").text()).toBe("Guards");
    expect(wrapper.find('[data-field="no-project"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("opens the section Coding agents when another part of the application asks for the section by its identifier agents", async () => {
    const { openSettings, settingsModal } = await import("../stores/settings");
    openSettings("agents");
    const wrapper = await mountSettings();
    expect(settingsModal.section).toBe("agents");
    expect(wrapper.get("section h3").text()).toBe("Coding agents");
    wrapper.unmount();
  });
});

describe("SettingsModal: frame (issue #412)", () => {
  it("is a Bootstrap dialog with a header, a title, a body, and a close button", async () => {
    const wrapper = await mountSettings();
    const dialog = wrapper.get("dialog");
    expect(dialog.classes()).toEqual(expect.arrayContaining(["dialog", "dialog-lg", "dialog-instant", "dialog-nonmodal"]));
    expect(dialog.attributes("aria-labelledby")).toBe("settings-title");
    expect(wrapper.get("#settings-title").text()).toBe("Settings");
    expect(wrapper.get("#settings-title").classes()).toContain("dialog-title");
    expect(wrapper.find(".dialog-header button.btn").exists()).toBe(true);
    expect(wrapper.find(".dialog-body nav.nav").exists()).toBe(true);
    wrapper.unmount();
  });

  it("closes the window with the close button and with a click on the dark layer, and stays open for a click inside the dialog", async () => {
    const wrapper = await mountSettings();
    const { settingsModal } = await import("../stores/settings");
    await wrapper.get("dialog").trigger("mousedown");
    expect(settingsModal.open).toBe(true);
    await wrapper.get(".overlay").trigger("mousedown");
    expect(settingsModal.open).toBe(false);
    settingsModal.open = true;
    await wrapper.get(".dialog-header button").trigger("click");
    expect(settingsModal.open).toBe(false);
    wrapper.unmount();
  });

  it("draws the close button as a big X with no border and no background of its own, and not as the square Bootstrap close button", async () => {
    const wrapper = await mountSettings();
    const closeButton = wrapper.get(".dialog-header button");
    expect(closeButton.classes()).toEqual(expect.arrayContaining(["btn", "border-0", "fs-4"]));
    expect(closeButton.classes()).not.toContain("btn-close");
    expect(wrapper.findComponent({ name: "DialogCloseButton" }).exists()).toBe(true);
    expect(closeButton.find(".bi-x-lg").exists()).toBe(true);
    expect(closeButton.text()).toBe("");
    wrapper.unmount();
  });

  it("names the close button for the screen reader", async () => {
    const wrapper = await mountSettings();
    expect(wrapper.get(".dialog-header button").attributes("aria-label")).toBe("Close (Escape)");
    expect(wrapper.get(".dialog-header button").attributes("title")).toBe("Close the window (Escape)");
    wrapper.unmount();
  });
});

describe("SettingsModal: key Escape", () => {
  it("closes the Settings window on the key Escape", async () => {
    const wrapper = await mountSettings();
    const { settingsModal } = await import("../stores/settings");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(settingsModal.open).toBe(false);
    wrapper.unmount();
  });

  it("leaves the Settings window open on the key Escape while the guard window is open over it (issue #596)", async () => {
    const wrapper = await mountSettings();
    const { settingsModal } = await import("../stores/settings");
    const { closeGuardWindow, openNewGuardWindow } = await import("../stores/guard_window");
    openNewGuardWindow();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(settingsModal.open).toBe(true);
    closeGuardWindow();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(settingsModal.open).toBe(false);
    wrapper.unmount();
  });

  it("closes only the open information card of the section Dynamic topics on the first key Escape, and the window on the second", async () => {
    const { settingsModal } = await import("../stores/settings");
    const wrapper = await mountSettings();
    settingsModal.section = "dynamicTopics";
    await flushPromises();
    const mark = wrapper.findAll(".information-card-part")[0];
    await mark.trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(true);
    await mark.trigger("keydown", { key: "Escape" });
    expect(wrapper.find(".popover").exists()).toBe(false);
    expect(settingsModal.open).toBe(true);
    await mark.trigger("keydown", { key: "Escape" });
    expect(settingsModal.open).toBe(false);
    wrapper.unmount();
  });
});

describe("SettingsModal: status item", () => {
  it("shows a switch for the status item in the section Notifications, switched on by default", async () => {
    const wrapper = await mountSettings();
    const { settingsModal } = await import("../stores/settings");
    settingsModal.section = "notifications";
    await flushPromises();
    const label = wrapper.findAll("label").find((candidate) => candidate.text() === "Show the status item in the macOS menu bar");
    expect(label).toBeDefined();
    const checkbox = wrapper.get(`input[id="${label!.attributes("for")}"]`);
    expect(checkbox.attributes("role")).toBe("switch");
    expect((checkbox.element as HTMLInputElement).checked).toBe(true);
    await checkbox.setValue(false);
    const { settings } = await import("../stores/settings");
    expect(settings.showStatusItem).toBe(false);
    wrapper.unmount();
  });
});

describe("SettingsModal: heading Needs you of the section Sidebars (issues #417 and #556)", () => {
  it("shows a switch for the list of workspaces, switched on by default, and saves the choice", async () => {
    const wrapper = await mountSettings();
    const { settings, settingsModal } = await import("../stores/settings");
    settingsModal.section = "sidebars";
    await flushPromises();
    expect(wrapper.get("section h3").text()).toBe("Sidebars");
    const label = wrapper.findAll("label").find((candidate) => candidate.text() === "Show the workspaces");
    expect(label).toBeDefined();
    const checkbox = wrapper.get(`input[id="${label!.attributes("for")}"]`);
    expect(checkbox.attributes("role")).toBe("switch");
    expect((checkbox.element as HTMLInputElement).checked).toBe(true);
    expect(settings.showWorkspacesInNeedsYou).toBe(true);
    await checkbox.setValue(false);
    expect(settings.showWorkspacesInNeedsYou).toBe(false);
    expect(JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}").showWorkspacesInNeedsYou).toBe(false);
    wrapper.unmount();
  });

  it("uses a different icon for the section Sidebars than for the section Notifications, because the bell is the icon of the Needs you sidebar section", async () => {
    const wrapper = await mountSettings();
    const icons = wrapper.findAll("nav .nav-link").map((entry) => entry.get("i").classes().find((name) => name.startsWith("bi-")));
    const sidebarsIcon = icons[8];
    const notificationsIcon = icons[7];
    expect(sidebarsIcon).toBe("bi-layout-sidebar-inset-reverse");
    expect(notificationsIcon).toBe("bi-bell");
    wrapper.unmount();
  });
});

describe('SettingsModal: Color themes', () => {
  it('applies a named color theme throughout the application and remembers it after closing Settings', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
    }));
    const { settings, settingsModal } = await import('../stores/settings');
    await import('../stores/theme');
    const { ThemePalette } = await import('../design/theme_palette');
    settings.theme = 'light';
    settingsModal.section = 'designReview';
    let wrapper = await mountSettings();
    expect(wrapper.get('h3').text()).toBe('Color themes');
    expect(wrapper.text()).toContain('Cool blue actions, links, and selections.');
    const oceanTheme = wrapper.findAll('[data-option="colorTheme"] button').find((button) => button.text().includes('Ocean'));
    expect(oceanTheme).toBeDefined();
    await oceanTheme?.trigger('click');
    expect(document.documentElement.style.getPropertyValue('--action-bg')).toBe('#145bb8');
    expect(document.documentElement.style.getPropertyValue('--link')).toBe('#175caa');
    expect(document.documentElement.style.getPropertyValue('--working')).toBe('');
    wrapper.unmount();
    settings.theme = 'dark';
    await flushPromises();
    wrapper = await mountSettings();
    expect(ThemePalette.state.mode).toBe('dark');
    expect(ThemePalette.selectedTheme.value).toBe('ocean');
    expect(document.documentElement.style.getPropertyValue('--action-bg')).toBe('#2767c8');
    expect(wrapper.findAll('[data-option="colorTheme"] button')[1].attributes('aria-pressed')).toBe('true');
    wrapper.unmount();
    vi.unstubAllGlobals();
  });

  it('shows the description of the selected color theme in the text color of the main action', async () => {
    const { settingsModal } = await import('../stores/settings');
    settingsModal.section = 'designReview';
    const wrapper = await mountSettings();
    const rowList = wrapper.findAll('[data-option="colorTheme"] .list-group-item');
    expect(rowList.filter((row) => row.classes().includes('active'))).toHaveLength(1);
    for (const row of rowList) {
      const isSelected = row.classes().includes('active');
      expect(row.findAll('span')[1].classes().includes('text-body-secondary')).toBe(isSelected === false);
    }
    wrapper.unmount();
  });
});
