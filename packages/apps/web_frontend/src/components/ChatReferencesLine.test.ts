import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import ChatReferencesLine from "./ChatReferencesLine.vue";
import { chatReferences } from "../lib/chat_references";
import { issueView } from "../stores/issues";
import { settings } from "../stores/settings";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn(async () => {}) }));

enableAutoUnmount(afterEach);

const BASE = "https://github.com/heidrun-org/heidrun";

/** What the SQLite file holds for the issue or the pull request of a call, by number. The rows come from what `gh` printed. */
const ANSWERS: Record<string, object | "fail"> = {
  "31": { title: "Save the options", state: "OPEN", body: "## Goal\nKeep the **options**.", labels: [{ name: "Simple Work", color: "2ea043" }], author: { login: "jerome" }, createdAt: "2026-10-11T09:30:00Z" },
  "33": "fail",
  "230": { title: "Move the sidebar", state: "MERGED", body: "Now on the right.", labels: [], author: { login: "jerome" }, createdAt: "2026-10-11T09:30:00Z", headRefName: "move-it", baseRefName: "dev_jerome" },
};

/** The stored row of an issue or of a pull request, as a list of one row, or an empty list when the SQLite file has no such row. */
function storedRowOf(number: number): object[] {
  const answer = ANSWERS[String(number)];
  if (answer === undefined || answer === "fail") {
    return [];
  }
  const given = answer as {
    title: string;
    state: string;
    body: string;
    labels: { name: string; color: string }[];
    author: { login: string };
    createdAt: string;
    headRefName?: string;
    baseRefName?: string;
  };
  return [
    {
      number,
      title: given.title,
      state: given.state,
      body: given.body,
      author: given.author.login,
      labels: given.labels.map((label) => label.name),
      labelColors: Object.fromEntries(given.labels.map((label) => [label.name, label.color])),
      createdAt: given.createdAt,
      headRefName: given.headRefName,
      baseRefName: given.baseRefName,
    },
  ];
}

/** The calls of the Tauri command `chat_references_find`, which reads the stored rows. */
function findCalls(): unknown[][] {
  return vi.mocked(invoke).mock.calls.filter((call) => call[0] === "chat_references_find");
}

function mountLine(props: Partial<InstanceType<typeof ChatReferencesLine>["$props"]> = {}) {
  return mount(ChatReferencesLine, {
    attachTo: document.body,
    props: {
      text: "Issues #31 #33 · Pull request #230",
      references: chatReferences([31, 33], [230], BASE, "github"),
      folder: "/work/app",
      forge: "github",
      webBase: BASE,
      ...props,
    },
  });
}

/** Opens the card with a click on the line, and waits for the answers of the forge. */
async function openCard(wrapper: ReturnType<typeof mountLine>) {
  await wrapper.trigger("click");
  await flushPromises();
}

beforeEach(() => {
  settings.language = "en";
  vi.mocked(openUrl).mockClear();
  issueView.open = false;
  vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockImplementation(async (command, payload) => {
    if (command === "chat_references_synchronize") {
      return { repository: "heidrun-org/heidrun", codeHostingError: null };
    }
    if (command === "chat_references_find") {
      const asked = payload as { issues: number[]; pullRequests: number[] };
      return { issues: asked.issues.flatMap(storedRowOf), pullRequests: asked.pullRequests.flatMap(storedRowOf) };
    }
    const number = (payload as { args: string[] }).args[2] ?? "";
    const answer = ANSWERS[number];
    if (answer === undefined || answer === "fail") {
      throw new Error("not found");
    }
    return JSON.stringify(answer);
  });
});

describe("ChatReferencesLine", () => {
  it("shows the icon of the forge and the text of the line, and no card before a click", () => {
    const wrapper = mountLine();
    expect(wrapper.find(".bi-github").exists()).toBe(true);
    expect(wrapper.text()).toBe("Issues #31 #33 · Pull request #230");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("shows the plain text, with the Git icon and no card, when the repository has no forge", async () => {
    const wrapper = mountLine({ forge: null, webBase: null });
    expect(wrapper.find(".bi-git").exists()).toBe(true);
    await wrapper.trigger("click");
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("opens the card on a click on the line, with one row for each issue, then one row for each pull request", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    const rows = wrapper.findAll("[data-reference]");
    expect(rows.length).toBe(3);
    expect(rows.map((row) => row.find(".bi").classes())).toEqual([
      expect.arrayContaining(["bi-record-circle"]),
      expect.arrayContaining(["bi-record-circle"]),
      expect.arrayContaining(["bi-git"]),
    ]);
  });

  it("reads the stored rows each time the card opens, a call for each row, and never runs gh", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    expect(findCalls()).toHaveLength(3);
    expect(vi.mocked(invoke).mock.calls.some((call) => call[0] === "forge_cli_cached")).toBe(false);
    await wrapper.trigger("keydown", { key: "Escape" });
    await wrapper.trigger("click");
    await flushPromises();
    expect(findCalls()).toHaveLength(6);
  });

  it("shows the title of each row with its name and its state, and the name alone when the forge did not answer", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    const texts = wrapper.findAll("[data-reference]").map((row) => row.findAll(".scrolling-line").map((line) => line.text()));
    expect(texts).toEqual([
      ["Save the options", "Issue #31 · Open"],
      ["Issue #33", "Cannot read this from GitHub."],
      ["Move the sidebar", "Pull request #230 · Merged"],
    ]);
  });

  it("shows no details at first, and opens the details of a row on a click on the row", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    expect(wrapper.find("[data-reference-details]").exists()).toBe(false);
    const rows = wrapper.findAll("[data-reference]");
    expect(rows[0].attributes("aria-expanded")).toBe("false");
    await rows[0].trigger("click");
    expect(rows[0].attributes("aria-expanded")).toBe("true");
    const details = wrapper.get("[data-reference-details]");
    expect(details.text()).toContain("heidrun-org/heidrun on");
    expect(details.text()).toContain("Open");
    expect(details.text()).toContain("Goal");
    expect(details.text()).toContain("Keep the options.");
    expect(details.text()).toContain("Simple Work");
    expect(details.text()).toContain("jerome opened this issue");
  });

  it("shows the picture of the person who opened it, and the icon of a person when the picture does not load", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    await wrapper.findAll("[data-reference]")[0].trigger("click");
    const details = wrapper.get("[data-reference-details]");
    const avatar = details.get("img.avatar");
    expect(avatar.attributes("src")).toBe("https://github.com/jerome.png?size=48");
    expect(avatar.attributes("referrerpolicy")).toBe("no-referrer");
    expect(details.find("i.bi-person-circle").exists()).toBe(false);
    await avatar.trigger("error");
    expect(details.find("img.avatar").exists()).toBe(false);
    expect(details.find("i.bi-person-circle").exists()).toBe(true);
  });

  it("shows the two branches of a pull request, and the person who opened it", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    await wrapper.findAll("[data-reference]")[2].trigger("click");
    const details = wrapper.get("[data-reference-details]");
    expect(details.findAll(".branch").map((branch) => branch.text())).toEqual(["dev_jerome", "move-it"]);
    expect(details.text()).toContain("Merged");
    expect(details.text()).toContain("jerome opened this pull request");
  });

  it("shows the reason in the details of a row when the forge did not answer", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    await wrapper.findAll("[data-reference]")[1].trigger("click");
    expect(wrapper.get("[data-reference-details]").text()).toContain("Cannot read this from GitHub.");
  });

  it("opens one row at a time, and closes the row on a second click", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    const rows = wrapper.findAll("[data-reference]");
    await rows[0].trigger("click");
    await rows[2].trigger("click");
    expect(wrapper.findAll("[data-reference-details]").length).toBe(1);
    expect(rows.map((row) => row.attributes("aria-expanded"))).toEqual(["false", "false", "true"]);
    await rows[2].trigger("click");
    expect(wrapper.find("[data-reference-details]").exists()).toBe(false);
  });

  it("closes the details of every row when the card opens again", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    await wrapper.findAll("[data-reference]")[0].trigger("click");
    await wrapper.trigger("keydown", { key: "Escape" });
    await openCard(wrapper);
    expect(wrapper.find("[data-reference-details]").exists()).toBe(false);
  });

  it("opens the web page on the forge, and the description in Heidrun Code, from the two buttons of the details", async () => {
    const wrapper = mountLine();
    await openCard(wrapper);
    await wrapper.findAll("[data-reference]")[0].trigger("click");
    const [heidrun, forge] = wrapper.get("[data-reference-details]").findAll("button");
    expect(heidrun.attributes("title")).toBe("Open in Heidrun Code");
    expect(heidrun.find(".bi-heidrun-goat-only").exists()).toBe(true);
    expect(forge.attributes("title")).toBe("Open in GitHub");
    await forge.trigger("click");
    expect(openUrl).toHaveBeenCalledWith(`${BASE}/issues/31`);
    vi.mocked(invoke).mockClear();
    await heidrun.trigger("click");
    await flushPromises();
    expect(issueView.open).toBe(true);
    expect(issueView.url).toBe(`${BASE}/issues/31`);
  });

  it("names GitLab on the button of the forge for a repository on GitLab", async () => {
    const references = chatReferences([31], [], "https://gitlab.com/group/app", "gitlab");
    const wrapper = mountLine({ forge: "gitlab", webBase: "https://gitlab.com/group/app", references });
    await openCard(wrapper);
    await wrapper.get("[data-reference]").trigger("click");
    expect(wrapper.get("[data-reference-details]").findAll("button")[1].attributes("title")).toBe("Open in GitLab");
  });
});
