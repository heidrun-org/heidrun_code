// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { openUrl } from "@tauri-apps/plugin-opener";
import ChatReferenceDetails from "./ChatReferenceDetails.vue";
import type { ChatReferenceDetails as Details } from "../stores/chat_references";
import { settings } from "../stores/settings";
import { chatAboutReference } from "../stores/chat_open";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ writeText: vi.fn(async () => {}) }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}) }));
vi.mock("../stores/chat_open", () => ({ chatAboutReference: vi.fn(async () => {}) }));

enableAutoUnmount(afterEach);

const BASE = "https://github.com/heidrun-org/heidrun";

/** The answer of the forge for an open issue that has a description and one label. */
function detailsOf(changes: Partial<Details> = {}): Details {
  return {
    title: "Add an information card",
    rawState: "open",
    body: "Intent\n\nEvery option has a card.",
    labels: [{ name: "Design", color: "1d76db" }],
    author: "jeromeetienne",
    authorAvatarUrl: null,
    createdAt: Date.parse("2026-10-16T09:30:00Z"),
    headBranch: null,
    baseBranch: null,
    ...changes,
  };
}

/** Mounts the card details of an issue, with the answer of the forge and the whole title. */
function mountDetails(props: Partial<InstanceType<typeof ChatReferenceDetails>["$props"]> = {}) {
  return mount(ChatReferenceDetails, {
    attachTo: document.body,
    props: {
      reference: { kind: "issue", number: 608, url: `${BASE}/issues/608` },
      details: detailsOf(),
      folder: "/work/heidrun",
      forge: "github",
      webBase: BASE,
      title: "Add an information card with a circled question mark to every option of the Settings window",
      name: "#608",
      ...props,
    },
  });
}

beforeEach(() => {
  settings.language = "en";
  vi.mocked(openUrl).mockClear();
  vi.mocked(writeText).mockReset();
});

describe("ChatReferenceDetails, the repository line", () => {
  it("shows the name of the repository and the date of the creation on the first line", () => {
    const wrapper = mountDetails();
    expect(wrapper.get("[data-reference-repository-line]").text()).toBe("heidrun-org/heidrun on Oct 16");
  });

  it("makes the name of the repository a link to its web page, which opens in the web browser", async () => {
    const wrapper = mountDetails();
    const link = wrapper.get("[data-reference-repository-line] a");
    expect(link.text()).toBe("heidrun-org/heidrun");
    expect(link.attributes("href")).toBe(BASE);
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.element.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(openUrl).toHaveBeenCalledWith(BASE);
  });

  it("puts the two buttons that open the item, the button that copies its web address, and the chat button at the right of the same line", () => {
    const wrapper = mountDetails();
    const line = wrapper.get("[data-reference-repository-line]").element.parentElement as HTMLElement;
    expect(line.querySelector(".btn-group")).not.toBeNull();
    expect(Array.from(line.querySelectorAll(".btn-group button")).map((button) => button.getAttribute("title"))).toEqual([
      "Open in Heidrun Code",
      "Open in GitHub",
      "Copy the GitHub web address",
      "Let's chat about this issue",
    ]);
    expect((wrapper.element as HTMLElement).firstElementChild).toBe(line);
  });

  it("shows no link, and keeps the four buttons, when the address of the repository is not known", () => {
    const wrapper = mountDetails({ webBase: null });
    expect(wrapper.find("[data-reference-repository-line] a").exists()).toBe(false);
    expect(wrapper.findAll(".btn-group button")).toHaveLength(4);
  });

  it("shows the name of the repository alone while the forge has not given the date", () => {
    const wrapper = mountDetails({ details: undefined });
    expect(wrapper.get("[data-reference-repository-line]").text()).toBe("heidrun-org/heidrun");
  });
});

describe("ChatReferenceDetails, the button that copies the web address", () => {
  const PULL_REQUEST = { kind: "pull_request" as const, number: 5, url: `${BASE}/pull/5` };
  const MERGE_REQUEST = { kind: "pull_request" as const, number: 7, url: "https://gitlab.com/team/app/-/merge_requests/7" };

  /** Stands for the clipboard of the browser, which takes the text when the clipboard of Tauri refuses it. */
  function stubBrowserClipboard(write: () => Promise<void>) {
    const writeTextOfBrowser = vi.fn(write);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: writeTextOfBrowser } });
    return writeTextOfBrowser;
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("shows the button after the button Open in GitHub, in the same group, with an icon only, a title, and a label", () => {
    const wrapper = mountDetails();
    const buttons = wrapper.findAll(".btn-group > button");
    const button = wrapper.get("[data-reference-copy]");
    expect(buttons[2].element).toBe(button.element);
    expect(button.classes()).toEqual(["btn"]);
    expect(button.text()).toBe("");
    expect(button.find(".bi-clipboard").exists()).toBe(true);
    expect(button.attributes("title")).toBe("Copy the GitHub web address");
    expect(button.attributes("aria-label")).toBe("Copy the GitHub web address");
  });

  it("shows the button for a pull request of GitHub", () => {
    const wrapper = mountDetails({ reference: PULL_REQUEST, details: detailsOf({ headBranch: "fix-5", baseBranch: "dev" }) });
    expect(wrapper.get("[data-reference-copy]").attributes("title")).toBe("Copy the GitHub web address");
  });

  it("names GitLab on the button for a merge request of GitLab", () => {
    const wrapper = mountDetails({ reference: MERGE_REQUEST, forge: "gitlab", webBase: "https://gitlab.com/team/app" });
    const button = wrapper.get("[data-reference-copy]");
    expect(button.attributes("title")).toBe("Copy the GitLab web address");
    expect(button.attributes("aria-label")).toBe("Copy the GitLab web address");
  });

  it("names the forge in French when the language is French", () => {
    settings.language = "fr";
    expect(mountDetails().get("[data-reference-copy]").attributes("title")).toBe("Copier l’adresse web GitHub");
  });

  it.each([
    ["an issue", { reference: { kind: "issue" as const, number: 608, url: `${BASE}/issues/608` } }],
    ["a pull request", { reference: PULL_REQUEST }],
    ["a merge request of GitLab", { reference: MERGE_REQUEST, forge: "gitlab" as const }],
  ])("writes into the clipboard the address that the button Open in GitHub opens, for %s", async (_name, props) => {
    const wrapper = mountDetails(props);
    await wrapper.get(".btn-group > button:nth-child(2)").trigger("click");
    await wrapper.get("[data-reference-copy]").trigger("click");
    await flushPromises();
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(openUrl).toHaveBeenCalledTimes(1);
    expect(vi.mocked(writeText).mock.calls[0][0]).toBe(vi.mocked(openUrl).mock.calls[0][0]);
    expect(writeText).toHaveBeenCalledWith(props.reference.url);
  });

  it("shows a check mark for two seconds after the copy, then the clipboard icon again", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const wrapper = mountDetails();
    const button = wrapper.get("[data-reference-copy]");
    await button.trigger("click");
    await flushPromises();
    expect(button.find(".bi-clipboard-check").exists()).toBe(true);
    expect(button.attributes("title")).toBe("Web address copied");
    expect(button.attributes("aria-label")).toBe("Web address copied");
    await vi.advanceTimersByTimeAsync(1999);
    expect(button.find(".bi-clipboard-check").exists()).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(button.find(".bi-clipboard").exists()).toBe(true);
    expect(button.attributes("title")).toBe("Copy the GitHub web address");
  });

  it("copies with the clipboard of the browser when the clipboard of Tauri refuses the text", async () => {
    vi.mocked(writeText).mockRejectedValue(new Error("refused"));
    const writeTextOfBrowser = stubBrowserClipboard(async () => {});
    const wrapper = mountDetails();
    await wrapper.get("[data-reference-copy]").trigger("click");
    await flushPromises();
    expect(writeTextOfBrowser).toHaveBeenCalledWith(`${BASE}/issues/608`);
    expect(wrapper.get("[data-reference-copy]").find(".bi-clipboard-check").exists()).toBe(true);
  });

  it("shows a cross, and says that the copy failed, when both clipboards refuse the text", async () => {
    vi.mocked(writeText).mockRejectedValue(new Error("refused"));
    stubBrowserClipboard(async () => {
      throw new Error("refused");
    });
    const wrapper = mountDetails();
    const button = wrapper.get("[data-reference-copy]");
    await button.trigger("click");
    await flushPromises();
    expect(button.find(".bi-clipboard-x").exists()).toBe(true);
    expect(button.find(".bi-clipboard-check").exists()).toBe(false);
    expect(button.attributes("title")).toBe("Cannot copy the web address: the clipboard refused it.");
    expect(button.attributes("aria-label")).toBe("Cannot copy the web address: the clipboard refused it.");
  });

  it("starts with the clipboard icon again when the card shows another item", async () => {
    const wrapper = mountDetails();
    await wrapper.get("[data-reference-copy]").trigger("click");
    await flushPromises();
    await wrapper.setProps({ reference: PULL_REQUEST });
    expect(wrapper.get("[data-reference-copy]").find(".bi-clipboard").exists()).toBe(true);
  });

  it("is disabled, and writes nothing, when the item has no web address", async () => {
    const wrapper = mountDetails({ reference: { kind: "issue", number: 608, url: null } });
    const button = wrapper.get("[data-reference-copy]");
    expect(button.attributes("disabled")).toBeDefined();
    await button.trigger("click");
    await flushPromises();
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe("ChatReferenceDetails, the button that starts a chat", () => {
  const PULL_REQUEST = { kind: "pull_request" as const, number: 5, url: `${BASE}/pull/5` };

  beforeEach(() => {
    vi.mocked(chatAboutReference).mockClear();
  });

  it("shows the button after the copy button, in the same group, with an icon only, a title, and a label", () => {
    const wrapper = mountDetails();
    const buttons = wrapper.findAll(".btn-group > button");
    const button = wrapper.get("[data-reference-chat]");
    expect(buttons).toHaveLength(4);
    expect(buttons[3].element).toBe(button.element);
    expect(button.text()).toBe("");
    expect(button.find(".bi-chat-dots").exists()).toBe(true);
    expect(button.attributes("title")).toBe("Let's chat about this issue");
    expect(button.attributes("aria-label")).toBe("Let's chat about this issue");
  });

  it("names a pull request on the button of a pull request", () => {
    const wrapper = mountDetails({ reference: PULL_REQUEST, details: detailsOf({ headBranch: "fix-5", baseBranch: "dev" }) });
    expect(wrapper.get("[data-reference-chat]").attributes("title")).toBe("Let's chat about this pull request");
  });

  it("shows the title in French when the language is French", () => {
    settings.language = "fr";
    expect(mountDetails().get("[data-reference-chat]").attributes("title")).toBe("Discutons de cette issue");
  });

  it("starts a chat about the web address of the issue, in a tab named after its number, in the folder", async () => {
    const wrapper = mountDetails();
    await wrapper.get("[data-reference-chat]").trigger("click");
    expect(chatAboutReference).toHaveBeenCalledWith(`${BASE}/issues/608`, "#608", "/work/heidrun");
  });

  it("is disabled when the item has no web address", async () => {
    const wrapper = mountDetails({ reference: { kind: "issue", number: 608, url: null } });
    const button = wrapper.get("[data-reference-chat]");
    expect(button.attributes("disabled")).toBeDefined();
    await button.trigger("click");
    expect(chatAboutReference).not.toHaveBeenCalled();
  });
});

describe("ChatReferenceDetails, the title", () => {
  it("shows the whole title, then its number, under the repository line", () => {
    const wrapper = mountDetails();
    const title = wrapper.get("[data-reference-title]");
    expect(title.text()).toBe("Add an information card with a circled question mark to every option of the Settings window #608");
    expect(title.find("[data-scroll]").exists()).toBe(false);
    expect(wrapper.get("[data-reference-repository-line]").element.parentElement?.nextElementSibling).toBe(title.element);
  });

  it("shows no title when the row above the card already shows it", () => {
    const wrapper = mountDetails({ title: null, name: null });
    expect(wrapper.find("[data-reference-title]").exists()).toBe(false);
  });

  it("shows the title without a number when no number is given", () => {
    const wrapper = mountDetails({ title: "Only a title", name: null });
    expect(wrapper.get("[data-reference-title]").text()).toBe("Only a title");
  });
});

describe("ChatReferenceDetails, the state", () => {
  it("shows the state under the title, in a pill with a strong green for an open issue", () => {
    const wrapper = mountDetails();
    const pill = wrapper.get(".badge.state");
    expect(pill.text()).toBe("Open");
    expect(pill.classes()).toContain("state-open");
    expect(wrapper.get("[data-reference-title]").element.nextElementSibling).toBe(pill.element);
  });

  it("shows a closed pull request in red, and a merged pull request in purple", () => {
    const reference = { kind: "pull_request" as const, number: 5, url: `${BASE}/pull/5` };
    expect(mountDetails({ reference, details: detailsOf({ rawState: "closed" }) }).get(".badge.state").classes()).toContain("state-closed");
    expect(mountDetails({ reference, details: detailsOf({ rawState: "merged" }) }).get(".badge.state").classes()).toContain("state-done");
  });

  it("shows no pill while the forge has not answered", () => {
    expect(mountDetails({ details: undefined }).find(".badge.state").exists()).toBe(false);
    expect(mountDetails({ details: null }).find(".badge.state").exists()).toBe(false);
  });
});

describe("ChatReferenceDetails, the separators and the body", () => {
  it("shows, in this order, the repository line, the title, the state, a separator, the description, the labels, a separator, and the author", () => {
    const wrapper = mountDetails();
    const parts = Array.from((wrapper.element as HTMLElement).children).map((part) => {
      if (part.hasAttribute("data-reference-title")) {
        return "title";
      }
      if (part.classList.contains("badge")) {
        return "state";
      }
      if (part.classList.contains("separator")) {
        return "separator";
      }
      if (part.classList.contains("excerpt")) {
        return "description";
      }
      if (part.querySelector(".label") !== null) {
        return "labels";
      }
      if (part.textContent?.includes("opened this issue") === true) {
        return "author";
      }
      return "line";
    });
    expect(parts).toEqual(["line", "title", "state", "separator", "description", "labels", "separator", "author"]);
  });

  it("shows the beginning of the description, and the labels in their colors", () => {
    const wrapper = mountDetails();
    expect(wrapper.get(".excerpt").text()).toContain("Every option has a card.");
    expect(wrapper.get(".label").text()).toBe("Design");
    expect(wrapper.get(".label").attributes("style")).toContain("#1d76db");
  });

  it("shows the two branches of a pull request in place of the labels", () => {
    const wrapper = mountDetails({
      reference: { kind: "pull_request", number: 5, url: `${BASE}/pull/5` },
      details: detailsOf({ headBranch: "fix-5", baseBranch: "dev_jerome" }),
    });
    expect(wrapper.findAll(".branch").map((branch) => branch.text())).toEqual(["dev_jerome", "fix-5"]);
    expect(wrapper.find(".label").exists()).toBe(false);
    expect(wrapper.text()).toContain("jeromeetienne opened this pull request");
  });

  it("shows the login of the person who opened it, and never the word You", () => {
    const wrapper = mountDetails();
    expect(wrapper.text()).toContain("jeromeetienne opened this issue");
    expect(wrapper.text()).not.toContain("You opened");
  });

  it("shows one separator and no author while the forge has not answered, and Loading under it", () => {
    const wrapper = mountDetails({ details: undefined });
    expect(wrapper.findAll(".separator")).toHaveLength(1);
    expect(wrapper.text()).toContain("Reading from GitHub");
  });

  it("shows one separator, and that the forge cannot be read, when the forge did not answer", () => {
    const wrapper = mountDetails({ details: null });
    expect(wrapper.findAll(".separator")).toHaveLength(1);
    expect(wrapper.text()).toContain("GitHub");
  });

  it("shows no second separator when the person who opened it is not known", () => {
    const wrapper = mountDetails({ details: detailsOf({ author: null }) });
    expect(wrapper.findAll(".separator")).toHaveLength(1);
  });
});

describe("ChatReferenceDetails, the labels as buttons", () => {
  const TWO_LABELS = [
    { name: "enhancement", color: "a2eeef" },
    { name: "Simple Work", color: "2ea043" },
  ];

  it("shows each label as a pill that is not a button when no search is given", () => {
    const wrapper = mountDetails({ details: detailsOf({ labels: TWO_LABELS }) });
    const labels = wrapper.findAll("[data-reference-label]");
    expect(labels.map((label) => label.text())).toEqual(["enhancement", "Simple Work"]);
    expect(labels.every((label) => label.element.tagName === "SPAN")).toBe(true);
  });

  it("shows each label as a button when a search is given, and tells the label that the search holds", () => {
    const wrapper = mountDetails({ details: detailsOf({ labels: TWO_LABELS }), search: "label:enhancement" });
    const labels = wrapper.findAll("[data-reference-label]");
    expect(labels.every((label) => label.element.tagName === "BUTTON")).toBe(true);
    expect(labels.map((label) => label.attributes("aria-pressed"))).toEqual(["true", "false"]);
  });

  it("asks to toggle the label that was clicked, with its name", async () => {
    const wrapper = mountDetails({ details: detailsOf({ labels: TWO_LABELS }), search: "" });
    await wrapper.findAll("[data-reference-label]")[1].trigger("click");
    expect(wrapper.emitted("toggleLabel")).toEqual([["Simple Work"]]);
  });
});
