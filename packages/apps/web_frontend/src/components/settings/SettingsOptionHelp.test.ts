import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import SettingsOptionHelp from "./SettingsOptionHelp.vue";
import { settings } from "../../stores/settings";

const BLOCKS = [
  { titleKey: "settingsHelp.whatTitle", textKey: "settingsHelp.agent.what" },
  { titleKey: "settingsHelp.onTitle", textKey: "settingsHelp.agent.on" },
  { titleKey: "settingsHelp.offTitle", textKey: "settingsHelp.agent.off" },
] as const;

function mountHelp() {
  return mount(SettingsOptionHelp, {
    props: { titleKey: "settingsHelp.agent.title", blocks: BLOCKS, params: { name: "Codex" } },
  });
}

beforeEach(() => {
  settings.language = "en";
});

afterEach(() => {
  settings.language = "en";
});

describe("SettingsOptionHelp (issue #608)", () => {
  it("shows a circled question mark named after the option, and no information card at first", () => {
    const wrapper = mountHelp();
    expect(wrapper.find(".information-card-part").exists()).toBe(true);
    expect(wrapper.get('[role="img"]').attributes("aria-label")).toBe("About the option “Codex”");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("opens an information card below the question mark, with the name of the option and one block for each subject", async () => {
    const wrapper = mountHelp();
    await wrapper.get(".information-card-part").trigger("click");
    await flushPromises();
    const card = wrapper.get(".popover");
    expect(card.classes()).toContain("bs-popover-bottom");
    expect(card.attributes("aria-label")).toBe("About the option “Codex”");
    expect(card.get(".list-group-item").text()).toBe("Codex");
    const blocks = card.findAll("[data-help-block]").map((block) => block.text());
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toContain("What it is");
    expect(blocks[1]).toContain("When the option is on");
    expect(blocks[2]).toContain("When the option is off");
  });

  it("puts the values of the parameters in the texts of the blocks", async () => {
    const wrapper = mountHelp();
    await wrapper.get(".information-card-part").trigger("click");
    await flushPromises();
    const blocks = wrapper.findAll("[data-help-block]").map((block) => block.text());
    expect(blocks[0]).toContain("tells Heidrun Code that you can use Codex");
    expect(blocks[0]).not.toContain("{name}");
    expect(blocks[2]).toContain("does not offer the skills of Codex");
  });

  it("writes the card in the language of the Settings window", async () => {
    settings.language = "fr";
    const wrapper = mountHelp();
    expect(wrapper.get('[role="img"]').attributes("aria-label")).toBe("À propos de l’option « Codex »");
    await wrapper.get(".information-card-part").trigger("click");
    await flushPromises();
    expect(wrapper.findAll("[data-help-block]")[0].text()).toContain("Ce que c’est");
  });

  it("closes the card on a second click on the question mark", async () => {
    const wrapper = mountHelp();
    await wrapper.get(".information-card-part").trigger("click");
    await flushPromises();
    await wrapper.get(".information-card-part").trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });
});
