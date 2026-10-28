import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));

async function mountSection() {
  const { settings } = await import("../../stores/settings");
  const { default: SettingsAgentsSection } = await import("./SettingsAgentsSection.vue");
  // The click on a label reaches its switch only when the label is in the page.
  return { wrapper: mount(SettingsAgentsSection, { attachTo: document.body }), settings };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("SettingsAgentsSection", () => {
  it("starts with quota monitoring enabled", async () => {
    const { settings } = await mountSection();
    expect(settings.quotaMonitoring).toBe(true);
  });

  it("lists every coding agent, one Bootstrap list group row for each", async () => {
    const { wrapper } = await mountSection();
    expect(wrapper.find(".list-group").exists()).toBe(true);
    expect(wrapper.findAll(".list-group-item").map((row) => row.text())).toEqual(["Claude Code", "Codex", "Antigravity"]);
  });

  it("starts with every agent switched off", async () => {
    const { wrapper, settings } = await mountSection();
    expect(settings.ownedAgents).toEqual([]);
    expect(wrapper.findAll(".list-group input[role=switch]").map((node) => (node.element as HTMLInputElement).checked)).toEqual([false, false, false]);
  });

  it("draws each switch with the Bootstrap class switch", async () => {
    const { wrapper } = await mountSection();
    for (const switchInput of wrapper.findAll("input[role=switch]")) {
      expect(switchInput.element.parentElement?.classList.contains("switch")).toBe(true);
    }
  });

  it("switches an agent on and off", async () => {
    const { wrapper, settings } = await mountSection();
    await wrapper.findAll("input[role=switch]")[1].setValue(true);
    expect(settings.ownedAgents).toEqual(["codex"]);
    await wrapper.findAll("input[role=switch]")[0].setValue(true);
    expect(settings.ownedAgents).toEqual(["codex", "claude"]);
    await wrapper.findAll("input[role=switch]")[1].setValue(false);
    expect(settings.ownedAgents).toEqual(["claude"]);
  });

  it("makes the whole row of an agent the label of its switch", async () => {
    const { wrapper } = await mountSection();
    const rows = wrapper.findAll(".list-group-item");
    expect(rows.map((row) => row.element.tagName)).toEqual(["LABEL", "LABEL", "LABEL"]);
    expect(rows.map((row) => row.find("input[role=switch]").exists())).toEqual([true, true, true]);
    expect(rows[0].classes()).toContain("list-group-item-action");
  });

  it("switches an agent when the click is on the name or on the empty space of the row", async () => {
    const { wrapper, settings } = await mountSection();
    const row = wrapper.findAll(".list-group-item")[0];
    await row.get("span").trigger("click");
    expect(settings.ownedAgents).toEqual(["claude"]);
    await row.trigger("click");
    expect(settings.ownedAgents).toEqual([]);
  });

  it("switches the focused switch with the key Enter, as the key Space does", async () => {
    const { wrapper, settings } = await mountSection();
    const switchInput = wrapper.findAll("input[role=switch]")[1];
    await switchInput.trigger("keydown", { key: "Enter" });
    expect(settings.ownedAgents).toEqual(["codex"]);
    expect((switchInput.element as HTMLInputElement).checked).toBe(true);
    await switchInput.trigger("keydown", { key: "Enter" });
    expect(settings.ownedAgents).toEqual([]);
    await switchInput.trigger("keydown", { key: "a" });
    expect(settings.ownedAgents).toEqual([]);
  });

  it("does not switch again while the key Enter stays pressed", async () => {
    const { wrapper, settings } = await mountSection();
    const switchInput = wrapper.findAll("input[role=switch]")[0];
    await switchInput.trigger("keydown", { key: "Enter" });
    await switchInput.trigger("keydown", { key: "Enter", repeat: true });
    expect(settings.ownedAgents).toEqual(["claude"]);
  });

  it("names each switch after its agent, because the label of the row holds the name", async () => {
    const { wrapper } = await mountSection();
    const row = wrapper.get(".list-group-item");
    expect(row.text()).toBe("Claude Code");
    expect(row.element.contains(row.get("input[role=switch]").element)).toBe(true);
  });

  it("saves the choice and restores it at the next start", async () => {
    const first = await mountSection();
    await first.wrapper.findAll("input[role=switch]")[0].setValue(true);
    await new Promise((resolve) => setTimeout(resolve));
    expect(JSON.parse(localStorage.getItem("heidrun.settings") ?? "{}").ownedAgents).toEqual(["claude"]);
    vi.resetModules();
    const second = await mountSection();
    expect(second.settings.ownedAgents).toEqual(["claude"]);
    expect(second.wrapper.findAll(".list-group input[role=switch]").map((node) => (node.element as HTMLInputElement).checked)).toEqual([true, false, false]);
  });
});

describe("SettingsAgentsSection, the settings that moved here from other sections (issue #556)", () => {
  it("holds, after the list of coding agents, the heading Default command of a new tab, then the heading Quit", async () => {
    const { wrapper } = await mountSection();
    expect(wrapper.findAll("h4").map((heading) => heading.text())).toEqual(["Default command of a new tab", "Quit"]);
  });

  it("places Antigravity quota tracking in Settings and explains that the development app cannot change the shared status line", async () => {
    const { wrapper } = await mountSection();
    const option = wrapper.get('[data-option="antigravityQuotaTracking"]');
    expect(option.find('input[role="switch"]').exists()).toBe(true);
    const mark = option.get(".information-card-part");
    await mark.trigger("click");
    expect(wrapper.get(".popover").text()).toContain("Heidrun Code Development cannot change the shared Antigravity status line");
  });

  it("shows only Terminal when all coding agents are switched off", async () => {
    const { wrapper, settings } = await mountSection();
    const group = wrapper.get('.btn-group[aria-label="Default command of a new tab"]');
    expect(group.attributes("role")).toBe("group");
    const labels = group.findAll("label");
    expect(labels.map((label) => label.text())).toEqual(["Terminal"]);
    for (const label of labels) {
      expect(label.classes()).toEqual(expect.arrayContaining(["btn-check", "btn-outline", "theme-secondary"]));
    }
    expect(group.findAll("input[type=radio]").map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([true]);
    expect(settings.newTabCommand).toBe("terminal");
  });

  it.each([
    ["claude", "claude", "Claude Code"],
    ["codex", "codex", "Codex"],
    ["antigravity", "agy", "Antigravity"],
  ] as const)("shows Terminal and %s when only that coding agent is switched on, and saves the command %s", async (agent, command, label) => {
    const { settings } = await import("../../stores/settings");
    settings.ownedAgents = [agent];
    const { wrapper } = await mountSection();
    const radios = wrapper.get('.btn-group[aria-label="Default command of a new tab"]').findAll("input[type=radio]");
    expect(wrapper.get('.btn-group[aria-label="Default command of a new tab"]').findAll("label").map((item) => item.text())).toEqual(["Terminal", label]);
    const radio = radios.find((item) => (item.element as HTMLInputElement).value === command)!;
    await radio.setValue(true);
    expect(settings.newTabCommand).toBe(command);
    expect(radios.find((item) => (item.element as HTMLInputElement).checked)?.element).toBe(radio.element);
  });

  it("shows only the enabled coding agents as new-tab commands and saves the selected command", async () => {
    const { wrapper, settings } = await mountSection();
    const group = wrapper.get('.btn-group[aria-label="Default command of a new tab"]');

    await wrapper.findAll("input[role=switch]")[0].setValue(true);
    await wrapper.findAll("input[role=switch]")[1].setValue(true);
    await nextTick();
    expect(group.findAll("label").map((label) => label.text())).toEqual(["Terminal", "Claude Code", "Codex"]);

    await group.findAll("input[type=radio]")[2].setValue(true);
    expect(settings.newTabCommand).toBe("codex");
  });

  it("shows enabled coding agent commands and resets the choice when the selected agent is switched off", async () => {
    const { wrapper, settings } = await mountSection();
    const group = wrapper.get('.btn-group[aria-label="Default command of a new tab"]');

    await wrapper.findAll("input[role=switch]")[0].setValue(true);
    await wrapper.findAll("input[role=switch]")[1].setValue(true);
    await wrapper.findAll("input[role=switch]")[2].setValue(true);
    await nextTick();
    expect(group.findAll("label").map((label) => label.text())).toEqual(["Terminal", "Claude Code", "Codex", "Antigravity"]);

    await group.findAll("input[type=radio]")[1].setValue(true);
    await wrapper.findAll("input[role=switch]")[0].setValue(false);
    await nextTick();
    expect(settings.newTabCommand).toBe("terminal");
    expect(group.findAll("label").map((label) => label.text())).toEqual(["Terminal", "Codex", "Antigravity"]);

    await group.findAll("input[type=radio]")[1].setValue(true);
    await wrapper.findAll("input[role=switch]")[1].setValue(false);
    await nextTick();
    expect(settings.newTabCommand).toBe("terminal");
    expect(group.findAll("label").map((label) => label.text())).toEqual(["Terminal", "Antigravity"]);

    await group.findAll("input[type=radio]")[1].setValue(true);
    await wrapper.findAll("input[role=switch]")[2].setValue(false);
    await nextTick();
    expect(settings.newTabCommand).toBe("terminal");
    expect(group.findAll("label").map((label) => label.text())).toEqual(["Terminal"]);
  });

  it("shows the switch Keep agents running after quit as a Bootstrap switch, switched on by default, linked to its setting", async () => {
    const { wrapper, settings } = await mountSection();
    const label = wrapper.findAll("label").find((candidate) => candidate.text() === "Keep agents running after quit");
    expect(label).toBeDefined();
    const switchInput = wrapper.get(`input[id="${label!.attributes("for")}"]`);
    expect(switchInput.element.parentElement?.classList.contains("switch")).toBe(true);
    expect((switchInput.element as HTMLInputElement).checked).toBe(true);
    await switchInput.setValue(false);
    expect(settings.keepAgentsRunningAfterQuit).toBe(false);
  });

  it("explains the switch Keep agents running after quit in an information card that opens from a circled question mark, and does not switch when the question mark is clicked", async () => {
    const { wrapper, settings } = await mountSection();
    const mark = wrapper.findAll(".information-card-part").find((part) => part.get('[role="img"]').attributes("aria-label") === "What does this setting do?")!;
    expect(mark.get('[role="img"]').attributes("aria-label")).toBe("What does this setting do?");
    expect(wrapper.find(".popover").exists()).toBe(false);
    await mark.trigger("click");
    const card = wrapper.get(".popover");
    expect(card.classes()).toContain("bs-popover-bottom");
    expect(card.text()).toContain("Heidrun Code stops its Herdr session");
    expect(settings.keepAgentsRunningAfterQuit).toBe(true);
  });
});


describe('composition bar setting (issue #726)', () => {
	it('defaults to off and saves and restores both choices through the switch', async () => {
		const first = await mountSection();
		const switchInput = first.wrapper.get('[data-option="compositionBarOnAgentStart"] input[role="switch"]');
		expect((switchInput.element as HTMLInputElement).checked).toBe(false);
		expect(first.settings.isCompositionBarShownOnAgentStart).toBe(false);
		await switchInput.setValue(true);
		await nextTick();
		expect(JSON.parse(localStorage.getItem('heidrun.settings') ?? '{}').isCompositionBarShownOnAgentStart).toBe(true);
		first.wrapper.unmount();
		vi.resetModules();
		const second = await mountSection();
		const restoredInput = second.wrapper.get('[data-option="compositionBarOnAgentStart"] input[role="switch"]');
		expect((restoredInput.element as HTMLInputElement).checked).toBe(true);
		expect(second.settings.isCompositionBarShownOnAgentStart).toBe(true);
		await restoredInput.setValue(false);
		await nextTick();
		second.wrapper.unmount();
		vi.resetModules();
		const third = await mountSection();
		expect(third.settings.isCompositionBarShownOnAgentStart).toBe(false);
		third.wrapper.unmount();
	});
});
