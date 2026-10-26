import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/webview", () => ({ getCurrentWebview: () => ({ setZoom: vi.fn(async () => {}) }) }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => ({})) }));

async function mountSection() {
  const { settings } = await import("../../stores/settings");
  const { default: SettingsDynamicTopicsSection } = await import("./SettingsDynamicTopicsSection.vue");
  const clusters = await import("../../stores/topic_clusters");
  const { languageModelStatus } = await import("../../stores/language_model_topics");
  return { wrapper: mount(SettingsDynamicTopicsSection), settings, languageModelStatus, ...clusters };
}

/** Finds the circled question mark whose name for the screen reader is `label`. */
function findMark(wrapper: Awaited<ReturnType<typeof mountSection>>["wrapper"], label: string) {
  const mark = wrapper.findAll(".information-card-part").find((part) => part.get('[role="img"]').attributes("aria-label") === label);
  if (mark === undefined) {
    throw new Error(`No circled question mark is named ${label}`);
  }
  return mark;
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.mocked(invoke).mockClear();
});

describe("SettingsDynamicTopicsSection, the option Enable dynamic topics", () => {
  it("shows a Bootstrap switch Enable dynamic topics, switched on at first", async () => {
    const { wrapper, settings } = await mountSection();
    const switchInput = wrapper.findAll('input[role="switch"]')[0];
    expect(wrapper.get(`label[for="${switchInput.attributes("id")}"]`).text()).toBe("Enable dynamic topics");
    expect(switchInput.element.parentElement?.classList.contains("switch")).toBe(true);
    expect((switchInput.element as HTMLInputElement).checked).toBe(true);
    expect(settings.dynamicTopics).toBe(true);
  });

  it("is the first control of the section, above the title Extraction method, and has no title of its own", async () => {
    const { wrapper } = await mountSection();
    const switchInput = wrapper.findAll('input[role="switch"]')[0];
    const extractionTitle = wrapper.get("h4");
    expect(extractionTitle.text()).toBe("Extraction method");
    expect(wrapper.find("input, button, select")?.element).toBe(switchInput.element);
    expect(switchInput.element.compareDocumentPosition(extractionTitle.element) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(wrapper.findAll("h4").map((title) => title.text())).toEqual(["Extraction method", "Clustered dynamic topics"]);
  });

  it("saves the state of the switch in the option, and shows the saved state at the next start", async () => {
    const first = await mountSection();
    await first.wrapper.findAll('input[role="switch"]')[0].setValue(false);
    expect(first.settings.dynamicTopics).toBe(false);
    const second = await mountSection();
    expect(second.settings.dynamicTopics).toBe(false);
    expect((second.wrapper.findAll('input[role="switch"]')[0].element as HTMLInputElement).checked).toBe(false);
  });

  it("does not change the other controls of the section while the option is off", async () => {
    const { wrapper, settings } = await mountSection();
    await wrapper.findAll('input[role="switch"]')[0].setValue(false);
    expect(settings.dynamicTopics).toBe(false);
    expect(wrapper.findAll("h4").map((title) => title.text())).toEqual(["Extraction method", "Clustered dynamic topics"]);
    expect(wrapper.findAll("input[type=radio]").map((radio) => radio.attributes("disabled"))).toEqual([undefined, undefined]);
    expect((wrapper.findAll('input[role="switch"]')[1].element as HTMLInputElement).disabled).toBe(false);
    expect(wrapper.findAll(".information-card-part")).toHaveLength(4);
  });
});

describe("SettingsDynamicTopicsSection", () => {
  it("shows the title Extraction method above a Bootstrap button group of two radio inputs, Keyword and Language model", async () => {
    const { wrapper } = await mountSection();
    expect(wrapper.get("h4").text()).toBe("Extraction method");
    const group = wrapper.get(".btn-group");
    expect(group.attributes("role")).toBe("group");
    expect(group.attributes("aria-label")).toBe("Extraction method");
    const labels = group.findAll("label");
    expect(labels.map((label) => label.text())).toEqual(["Keyword", "Language model"]);
    for (const label of labels) {
      expect(label.classes()).toEqual(expect.arrayContaining(["btn-check", "btn-outline", "theme-secondary"]));
    }
    expect(group.findAll("input[type=radio]")).toHaveLength(2);
  });

  it("checks the radio button Keyword at first", async () => {
    const { wrapper, settings } = await mountSection();
    expect(settings.dynamicTopicExtraction).toBe("keyword");
    expect(wrapper.findAll("input[type=radio]").map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([true, false]);
  });

  it("enables the radio button Language model, with a title that names the coding agents, and a click chooses it", async () => {
    const { wrapper, settings } = await mountSection();
    const languageModel = wrapper.findAll("input[type=radio]")[1];
    const languageModelLabel = wrapper.findAll(".btn-group label")[1];
    expect(languageModel.attributes("disabled")).toBeUndefined();
    expect(languageModelLabel.attributes("title")).toContain("codex or claude");
    expect(languageModelLabel.attributes("title")).not.toContain("Not ready yet");
    await languageModel.setValue(true);
    expect(settings.dynamicTopicExtraction).toBe("languageModel");
    expect(wrapper.findAll("input[type=radio]").map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([false, true]);
  });

  it("chooses Keyword again with a click on the radio button Keyword", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ dynamicTopicExtraction: "languageModel" }));
    const { wrapper, settings } = await mountSection();
    await wrapper.findAll("input[type=radio]")[0].setValue(true);
    expect(settings.dynamicTopicExtraction).toBe("keyword");
  });

  it("checks the radio button of the saved method", async () => {
    localStorage.setItem("heidrun.settings", JSON.stringify({ dynamicTopicExtraction: "languageModel" }));
    const { wrapper } = await mountSection();
    expect(wrapper.findAll("input[type=radio]").map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([false, true]);
  });

  it("has no help paragraph under the controls", async () => {
    const { wrapper } = await mountSection();
    expect(wrapper.findAll(".form-text")).toHaveLength(0);
    expect(wrapper.text()).not.toContain("Nothing leaves this computer");
    expect(wrapper.text()).not.toContain("not ready yet");
  });

  it("shows a circled question mark just after the title Extraction method, and no information card at first", async () => {
    const { wrapper } = await mountSection();
    const row = wrapper.get("h4").element.parentElement as HTMLElement;
    const mark = findMark(wrapper, "About the extraction method");
    expect(row.contains(mark.element)).toBe(true);
    expect(mark.find("svg, i, span[role=img]").exists()).toBe(true);
    expect(mark.get('[role="img"]').attributes("aria-label")).toBe("About the extraction method");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("opens an information card below the circled question mark, with one block for Keyword and one for Language model", async () => {
    const { wrapper } = await mountSection();
    await findMark(wrapper, "About the extraction method").trigger("click");
    const card = wrapper.get(".popover");
    expect(card.classes()).toContain("bs-popover-bottom");
    expect(card.attributes("aria-label")).toBe("About the extraction method");
    expect(card.text()).toContain("Extraction method");
    const blocks = card.findAll("[data-help-block]").map((block) => block.text());
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain("Keyword");
    expect(blocks[0]).toContain("Nothing leaves this computer");
    expect(blocks[1]).toContain("Language model");
    expect(blocks[1]).toContain("A language model finds the topics");
    expect(blocks[1]).toContain("the title and the first messages that you typed");
    expect(blocks[1]).toContain("and nothing else");
    expect(blocks[1]).toContain("codex or claude");
    expect(blocks[1]).not.toContain("not ready yet");
  });

  it("closes the information card of the extraction method on a second click and on the key Escape", async () => {
    const { wrapper } = await mountSection();
    const mark = findMark(wrapper, "About the extraction method");
    await mark.trigger("click");
    await mark.trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(false);
    await mark.trigger("click");
    await mark.trigger("keydown", { key: "Escape" });
    expect(wrapper.find(".popover").exists()).toBe(false);
  });
});

describe("SettingsDynamicTopicsSection, the method Language model", () => {
  it("says nothing under the choice while the last call gave topics, and while the method is Keyword", async () => {
    const { wrapper, settings, languageModelStatus } = await mountSection();
    languageModelStatus.error = "failed";
    await wrapper.vm.$nextTick();
    expect(settings.dynamicTopicExtraction).toBe("keyword");
    expect(wrapper.findAll("[role=status]")).toHaveLength(0);
    settings.dynamicTopicExtraction = "languageModel";
    languageModelStatus.error = null;
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll("[role=status]")).toHaveLength(0);
  });

  it("says, under the choice, why the last call gave no topic, only while the method is Language model", async () => {
    const { wrapper, settings, languageModelStatus } = await mountSection();
    settings.dynamicTopicExtraction = "languageModel";
    await wrapper.vm.$nextTick();
    languageModelStatus.error = "noCodingAgent";
    await wrapper.vm.$nextTick();
    const status = wrapper.get("[role=status]");
    expect(status.text()).toContain("Neither codex nor claude is installed");
    expect(status.classes()).toContain("form-text");
    expect(status.element.previousElementSibling).toBe(wrapper.get(".btn-group").element);
    languageModelStatus.error = "wrongAnswer";
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[role=status]").text()).toContain("answer that Heidrun Code cannot use");
    languageModelStatus.error = "failed";
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[role=status]").text()).toContain("did not answer");
  });

  it("keeps the line of the clustered dynamic topics apart from the line of the method Language model", async () => {
    const { wrapper, settings, languageModelStatus, topicClusterStatus } = await mountSection();
    settings.dynamicTopicExtraction = "languageModel";
    settings.clusteredDynamicTopics = true;
    await wrapper.vm.$nextTick();
    languageModelStatus.error = "failed";
    topicClusterStatus.error = "noCodingAgent";
    await wrapper.vm.$nextTick();
    const lines = wrapper.findAll("[role=status]").map((line) => line.text());
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("language model found no new topic");
    expect(lines[1]).toContain("Neither codex nor claude is installed");
  });
});

describe("SettingsDynamicTopicsSection, clustered dynamic topics", () => {
  it("shows a switch Enable clustered dynamic topics under the choice of the method, switched off at first", async () => {
    const { wrapper, settings } = await mountSection();
    expect(wrapper.findAll("h4").map((title) => title.text())).toEqual(["Extraction method", "Clustered dynamic topics"]);
    const switchInput = wrapper.findAll('input[role="switch"]')[1];
    expect(wrapper.get(`label[for="${switchInput.attributes("id")}"]`).text()).toBe("Enable clustered dynamic topics");
    expect(switchInput.element.parentElement?.classList.contains("switch")).toBe(true);
    expect((switchInput.element as HTMLInputElement).checked).toBe(false);
    expect(settings.clusteredDynamicTopics).toBe(false);
  });

  it("saves the state of the switch in the option, and shows the saved state at the next start", async () => {
    const first = await mountSection();
    await first.wrapper.findAll('input[role="switch"]')[1].setValue(true);
    expect(first.settings.clusteredDynamicTopics).toBe(true);
    const second = await mountSection();
    expect((second.wrapper.findAll('input[role="switch"]')[1].element as HTMLInputElement).checked).toBe(true);
  });

  it("shows a circled question mark just after the label of the switch, and no help paragraph under it", async () => {
    const { wrapper } = await mountSection();
    const switchInput = wrapper.findAll('input[role="switch"]')[1];
    const row = wrapper.get(`label[for="${switchInput.attributes("id")}"]`).element.closest(".d-flex") as HTMLElement;
    const mark = findMark(wrapper, "About the clustered dynamic topics");
    expect(row.contains(mark.element)).toBe(true);
    expect(mark.get('[role="img"]').attributes("aria-label")).toBe("About the clustered dynamic topics");
    expect(wrapper.findAll(".form-text")).toHaveLength(0);
  });

  it("opens an information card with three blocks: what it is, what Heidrun Code sends, and what happens when the option is off", async () => {
    const { wrapper } = await mountSection();
    await findMark(wrapper, "About the clustered dynamic topics").trigger("click");
    const card = wrapper.get(".popover");
    expect(card.classes()).toContain("bs-popover-bottom");
    const blocks = card.findAll("[data-help-block]").map((block) => block.text());
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toContain("What it is");
    expect(blocks[0]).toContain("the name of a group of dynamic topics that have a close meaning");
    expect(blocks[1]).toContain("What Heidrun Code sends");
    expect(blocks[1]).toContain("only the short labels of the raw dynamic topics");
    expect(blocks[1]).toContain("never the text of a chat");
    expect(blocks[1]).toContain("codex or claude");
    expect(blocks[2]).toContain("When the option is off");
    expect(blocks[2]).toContain("makes no call");
  });

  it("opens only one information card at a time", async () => {
    const { wrapper } = await mountSection();
    await findMark(wrapper, "About the extraction method").trigger("click");
    expect(wrapper.findAll(".popover")).toHaveLength(1);
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await wrapper.vm.$nextTick();
    await findMark(wrapper, "About the clustered dynamic topics").trigger("click");
    expect(wrapper.findAll(".popover")).toHaveLength(1);
    expect(wrapper.get(".popover").attributes("aria-label")).toBe("About the clustered dynamic topics");
  });

  it("shows the Bootstrap button Rebuild the clusters, disabled and faded while the option is off", async () => {
    const { wrapper } = await mountSection();
    const button = wrapper.get("button.btn");
    expect(button.text()).toBe("Rebuild the clusters");
    expect(button.attributes("disabled")).toBeDefined();
    expect(button.classes()).toContain("opacity-50");
    await button.trigger("click");
    expect(invoke).not.toHaveBeenCalledWith("topic_clusters_write", expect.anything());
  });

  it("enables the button when the option is on, and a click empties the translation table on the disk", async () => {
    const { wrapper, settings } = await mountSection();
    settings.clusteredDynamicTopics = true;
    await wrapper.vm.$nextTick();
    const button = wrapper.get("button.btn");
    expect(button.attributes("disabled")).toBeUndefined();
    expect(button.classes()).not.toContain("opacity-50");
    await button.trigger("click");
    expect(invoke).toHaveBeenCalledWith("topic_clusters_write", { rows: {} });
  });

  it("shows a spinning wheel and disables the button while a call runs", async () => {
    const { wrapper, settings, topicClusterStatus } = await mountSection();
    settings.clusteredDynamicTopics = true;
    topicClusterStatus.isRunning = true;
    await wrapper.vm.$nextTick();
    expect(wrapper.find("button.btn .spinner-border").exists()).toBe(true);
    expect(wrapper.get("button.btn").attributes("disabled")).toBeDefined();
  });

  it("says why the call gave no cluster, only while the option is on", async () => {
    const { wrapper, settings, topicClusterStatus } = await mountSection();
    topicClusterStatus.error = "noCodingAgent";
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll("[role=status]")).toHaveLength(0);
    settings.clusteredDynamicTopics = true;
    await wrapper.vm.$nextTick();
    topicClusterStatus.error = "noCodingAgent";
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[role=status]").text()).toContain("Neither codex nor claude is installed");
    topicClusterStatus.error = "wrongAnswer";
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[role=status]").text()).toContain("answer that Heidrun Code cannot use");
    topicClusterStatus.error = "failed";
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[role=status]").text()).toContain("did not answer");
  });
});
