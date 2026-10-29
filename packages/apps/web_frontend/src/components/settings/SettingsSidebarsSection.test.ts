import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import SettingsSidebarsSection from "./SettingsSidebarsSection.vue";
import { settings } from "../../stores/settings";

beforeEach(() => {
  settings.language = "en";
  settings.chatsRefreshSeconds = 10;
  settings.finishedTtl = 15;
  settings.gitFetchMinutes = 5;
});

/** Opens the information card whose circled question mark is named `label`, and returns the text of the card. */
async function openCardText(wrapper: ReturnType<typeof mount>, label: string): Promise<string> {
  const mark = wrapper.findAll(".information-card-part").find((part) => part.get('[role="img"]').attributes("aria-label") === label);
  expect(mark, label).toBeDefined();
  await mark!.trigger("click");
  return wrapper.get(".popover").text();
}

/** Finds the button group that has the given label. */
function getGroup(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.get(`.btn-group[aria-label="${label}"]`);
}

describe("SettingsSidebarsSection, the headings (issue #556)", () => {
  it("shows one heading for each sidebar section: Needs you, then Past chats, then Source control, then Code hosting", () => {
    const wrapper = mount(SettingsSidebarsSection);
    expect(wrapper.findAll("h4").map((heading) => heading.text())).toEqual(["Needs you", "Past chats", "Source control", "Code hosting"]);
  });

  it("shows, under each heading, the settings of that sidebar section and no other setting", () => {
    const wrapper = mount(SettingsSidebarsSection);
    const blocks = wrapper.findAll("h4").map((heading) => heading.element.parentElement as HTMLElement);
    expect(blocks[0].textContent).toContain("Show the workspaces");
    expect(blocks[0].textContent).toContain("Hide the finished items after");
    expect(blocks[1].textContent).toContain("Read the chats again every");
    expect(blocks[2].textContent).toContain("Fetch the remote repository in the background");
  });
});

describe("SettingsSidebarsSection, the heading Needs you (issues #417 and #556)", () => {
  it("shows the switch Show the workspaces as a Bootstrap switch, switched on by default, and saves the choice", async () => {
    const wrapper = mount(SettingsSidebarsSection);
    const label = wrapper.findAll("label").find((candidate) => candidate.text() === "Show the workspaces");
    expect(label).toBeDefined();
    const switchInput = wrapper.get(`input[id="${label!.attributes("for")}"]`);
    expect(switchInput.attributes("role")).toBe("switch");
    expect((switchInput.element as HTMLInputElement).checked).toBe(true);
    await switchInput.setValue(false);
    expect(settings.showWorkspacesInNeedsYou).toBe(false);
  });

  it("shows the four delays after which the finished items disappear, as a Bootstrap button group of radio inputs, and saves the one that is chosen", async () => {
    const wrapper = mount(SettingsSidebarsSection);
    const group = getGroup(wrapper, "Hide the finished items after");
    expect(group.findAll("label").map((label) => label.text())).toEqual(["5 min", "15 min", "1 h", "Never"]);
    expect(group.findAll("input[type=radio]").map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([false, true, false, false]);
    for (const label of group.findAll("label")) {
      expect(label.classes()).toEqual(expect.arrayContaining(["btn-check", "btn-outline", "theme-secondary"]));
    }
    await group.findAll("input[type=radio]")[3].setValue(true);
    expect(settings.finishedTtl).toBe(0);
    await group.findAll("input[type=radio]")[0].setValue(true);
    expect(settings.finishedTtl).toBe(5);
  });
});

describe("SettingsSidebarsSection, the heading Past chats, the delay between two reads of the chats (issue #442)", () => {
  it("shows the four delays as a Bootstrap button group of radio inputs, with 10 seconds checked at first", () => {
    const wrapper = mount(SettingsSidebarsSection);
    const group = getGroup(wrapper, "Read the chats again every");
    expect(group.findAll("label").map((label) => label.text())).toEqual(["5 seconds", "10 seconds", "30 seconds", "1 minute"]);
    expect(group.findAll("input[type=radio]").map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([
      false,
      true,
      false,
      false,
    ]);
    expect(group.findAll("label").every((label) => label.classes().includes("btn-check"))).toBe(true);
  });

  it("saves the delay of the radio input that is chosen, in seconds", async () => {
    const wrapper = mount(SettingsSidebarsSection);
    const radios = getGroup(wrapper, "Read the chats again every").findAll("input[type=radio]");
    await radios[3].setValue(true);
    expect(settings.chatsRefreshSeconds).toBe(60);
    await radios[0].setValue(true);
    expect(settings.chatsRefreshSeconds).toBe(5);
  });

  it("tells in an information card what the delay does, and shows no help paragraph", async () => {
    const wrapper = mount(SettingsSidebarsSection);
    expect(wrapper.findAll(".form-text")).toHaveLength(0);
    const text = await openCardText(wrapper, "About the option “Read the chats again every”");
    expect(text).toContain("reads the files of the chats again after this delay");
  });
});

describe("SettingsSidebarsSection, the heading Source control, the fetch in the background (issues #432 and #556)", () => {
  it("shows the name of the option, then a Bootstrap button group of five radio inputs", () => {
    const wrapper = mount(SettingsSidebarsSection);
    const group = getGroup(wrapper, "Fetch the remote repository in the background");
    expect(group.element.previousElementSibling?.firstElementChild?.textContent).toBe("Fetch the remote repository in the background");
    expect(group.findAll("label").map((label) => label.text())).toEqual(["Off", "1 minute", "5 minutes", "10 minutes", "30 minutes"]);
    for (const label of group.findAll("label")) {
      expect(label.classes()).toEqual(expect.arrayContaining(["btn-check", "btn-outline", "theme-secondary"]));
    }
  });

  it("checks the radio input of 5 minutes, which is the default, and the radio input of the saved delay", () => {
    const wrapper = mount(SettingsSidebarsSection);
    const radios = getGroup(wrapper, "Fetch the remote repository in the background").findAll("input[type=radio]");
    expect(radios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([false, false, true, false, false]);
    settings.gitFetchMinutes = 10;
    const second = mount(SettingsSidebarsSection);
    const secondRadios = getGroup(second, "Fetch the remote repository in the background").findAll("input[type=radio]");
    expect(secondRadios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([false, false, false, true, false]);
  });

  it("saves the delay, in minutes, of the radio input that is chosen, and 0 for Off", async () => {
    const wrapper = mount(SettingsSidebarsSection);
    const radios = getGroup(wrapper, "Fetch the remote repository in the background").findAll("input[type=radio]");
    await radios[4].setValue(true);
    expect(settings.gitFetchMinutes).toBe(30);
    await radios[1].setValue(true);
    expect(settings.gitFetchMinutes).toBe(1);
    await radios[0].setValue(true);
    expect(settings.gitFetchMinutes).toBe(0);
  });

  it("explains in an information card that the counts of the Git branch section stay true, and that a failed fetch shows nothing", async () => {
    const wrapper = mount(SettingsSidebarsSection);
    const help = await openCardText(wrapper, "About the option “Fetch the remote repository in the background”");
    expect(help).toContain("the two counts of the Git branch section of the status bar stay true");
    expect(help).toContain("A fetch that fails shows nothing");
  });
});

describe("SettingsSidebarsSection, the permanent branches of the merge (issue #570)", () => {
  it("shows the names separated by commas, and saves the names that the developer writes", async () => {
    settings.mergePermanentBranches = ["main", "dev_*"];
    const wrapper = mount(SettingsSidebarsSection);
    const input = wrapper.get("#merge-permanent-branches");
    expect((input.element as HTMLInputElement).value).toBe("main, dev_*");
    await input.setValue(" main , release ,, dev_* ");
    await input.trigger("change");
    expect(settings.mergePermanentBranches).toEqual(["main", "release", "dev_*"]);
  });
});
