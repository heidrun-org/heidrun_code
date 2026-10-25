// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { RefContext } from "../lib/refs";

vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn().mockResolvedValue([]),
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));
vi.mock("../lib/refs", async (importOriginal) => {
  const original = await importOriginal<typeof import("../lib/refs")>();
  return { ...original, refContext: vi.fn() };
});

import CodeHostingPanel from "./CodeHostingPanel.vue";
import { refContext } from "../lib/refs";
import { codeHosting, CODE_HOSTING_LIMIT } from "../stores/code_hosting";
import { git, type GitStatus } from "../stores/git";
import { state } from "../stores/session";
import { savedSearchModal } from "../stores/saved_search_modal";
import { settings } from "../stores/settings";

function makeStatus(): GitStatus {
  return {
    root: "/work/heidrun",
    branch: "dev_jerome",
    upstream: "origin/dev_jerome",
    ahead: 0,
    behind: 0,
    changed: 0,
    untracked: 0,
    files: [],
    last_sha: null,
    last_subject: null,
    last_time: null,
    remote: null,
  };
}

/** The context of a repository on `forge`. */
function contextOf(forge: "github" | "gitlab", base: string | null = "https://example.com/team/app"): RefContext {
  return { base, origin: "https://example.com", forge, ticketUrl: null, ticketPrefixes: [], enabled: true };
}

/** Answers `gh` with two issues and one pull request, and answers the details of an item that has an open card. */
function answerGithub() {
  vi.mocked(refContext).mockResolvedValue(contextOf("github"));
  vi.mocked(invoke).mockImplementation(async (_command, payload) => {
    const { args } = payload as { args: string[] };
    if (args[1] === "view") {
      return JSON.stringify({
        title: "Add the Code hosting sidebar section",
        state: "OPEN",
        body: "## Problem\n\nThe lists are raw.",
        labels: [{ name: "Design", color: "1d76db" }],
        author: { login: "jeromeetienne" },
        createdAt: "2026-10-13T09:30:00Z",
      });
    }
    return JSON.stringify(
      args[0] === "issue"
        ? [
            {
              number: 370,
              title: "Add the Code hosting sidebar section",
              url: "https://github.com/o/r/issues/370",
              author: { login: "jeromeetienne" },
              createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
              labels: [{ name: "Design", color: "1d76db" }, { name: "Simple Work", color: "2ea043" }],
            },
            { number: 369, title: "Fix the status bar", url: "https://github.com/o/r/issues/369", author: null, labels: [] },
          ]
        : [
            {
              number: 371,
              title: "Move the sidebar",
              url: "https://github.com/o/r/pull/371",
              author: { login: "erictang" },
              createdAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
              isDraft: true,
              headRefName: "move-the-sidebar-251",
              baseRefName: "dev_jerome",
            },
          ],
    );
  });
}

/** The panels that a test mounted. They stay in the page until `afterEach` unmounts them. */
const mountedPanels: VueWrapper[] = [];

async function mountPanel() {
  state.selectedWorkspaceId = "w1";
  git.status = { w1: makeStatus() };
  const wrapper = mount(CodeHostingPanel, { attachTo: document.body });
  mountedPanels.push(wrapper);
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  vi.mocked(invoke).mockReset();
  vi.mocked(refContext).mockReset();
  vi.mocked(openUrl).mockReset();
  vi.mocked(openUrl).mockResolvedValue(undefined);
  codeHosting.folded.issues = false;
  codeHosting.folded.requests = false;
  codeHosting.search = { issues: "", requests: "" };
  settings.codeHostingSavedSearches = { issues: [], requests: [] };
  settings.codeHostingWorkspaceSavedSearches = {};
  savedSearchModal.open = false;
});

afterEach(() => {
  for (const wrapper of mountedPanels.splice(0)) {
    wrapper.unmount();
  }
  state.selectedWorkspaceId = null;
  state.snapshot = null;
  git.status = {};
});

describe("CodeHostingPanel on GitHub", () => {
  it("shows the title, then the list Issues above the list Pull requests, each with its number of items", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    expect(wrapper.get(".title").text()).toBe("Code hosting");
    const headers = wrapper.findAll(".group-header");
    expect(headers.map((header) => header.find(".group-toggle").text())).toEqual(["Issues", "Pull requests"]);
    expect(headers.map((header) => header.get(".count").text())).toEqual(["2", "1"]);
  });

  it("keeps only the header outside of the scroll area, and puts the search lines of the two lists inside of it", async () => {
    settings.codeHostingSavedSearches = { issues: [{ name: "Mine", query: "author:@me" }], requests: [] };
    answerGithub();
    const wrapper = await mountPanel();
    const scrollArea = wrapper.get(".scroll-area");
    const panel = wrapper.get(".code-hosting").element;
    expect(scrollArea.find("header").exists()).toBe(false);
    expect(wrapper.get("header").element.parentElement).toBe(panel);
    expect(wrapper.findAll("[role='search']")).toHaveLength(2);
    expect(scrollArea.findAll("[role='search']")).toHaveLength(2);
    expect(scrollArea.findAll("[data-saved-search='all']")).toHaveLength(1);
    expect(scrollArea.findAll(".group")).toHaveLength(2);
  });

  it("shows one row for each item, with its number and its title on the first line", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    const rows = wrapper.findAll("[data-code-hosting-item]");
    expect(rows.map((row) => row.get(".number").text())).toEqual(["#370", "#369", "#371"]);
    expect(rows.map((row) => row.get(".title-text").text())).toEqual([
      "Add the Code hosting sidebar section",
      "Fix the status bar",
      "Move the sidebar",
    ]);
  });

  it("gives every row the same three lines, the number and the title, then two small detail lines, even when a line is empty", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    for (const row of wrapper.findAll("[data-code-hosting-item]")) {
      expect(row.findAll(".item-lines > div").map((line) => line.classes()[0])).toEqual(["title-line", "detail-line", "detail-line"]);
    }
  });

  it("shows, on the two detail lines of an issue, who opened it and when, then its labels or No label", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    const rows = wrapper.findAll("[data-code-hosting-item]");
    expect(rows[0].findAll(".detail-line")[0].text()).toBe("jeromeetienne opened 3 days ago");
    expect(rows[0].findAll(".detail-line")[1].findAll(".label-badge")).toHaveLength(2);
    expect(rows[1].findAll(".detail-line").map((line) => line.text())).toEqual(["", "No label"]);
  });

  it("shows each label of an issue as a badge in its color", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    const badges = wrapper.findAll("[data-code-hosting-item]")[0].findAll(".label-badge");
    expect(badges.map((badge) => badge.text())).toEqual(["Design", "Simple Work"]);
    expect(badges[0].attributes("style")).toContain("#1d76db");
    expect(badges[1].attributes("style")).toContain("#2ea043");
    expect(wrapper.findAll("[data-code-hosting-item]")[1].find(".label-badge").exists()).toBe(false);
  });

  it("scrolls the title, and not the number, while the pointer is over a row whose title does not fit", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    const row = wrapper.findAll("[data-code-hosting-item]")[0];
    const title = row.get(".title-text");
    expect(title.attributes("data-scroll")).toBeDefined();
    expect(row.find(".number").attributes("data-scroll")).toBeUndefined();
    const text = title.element.firstElementChild as HTMLElement;
    Object.defineProperty(text, "scrollWidth", { configurable: true, value: 300 });
    Object.defineProperty(title.element, "clientWidth", { configurable: true, value: 100 });
    await row.trigger("pointerenter");
    expect(title.classes()).toContain("is-scrolling");
    expect((title.element as HTMLElement).style.getPropertyValue("--scroll-distance")).toBe("200px");
    await row.trigger("pointerleave");
    expect(title.classes()).not.toContain("is-scrolling");
  });

  it("shows, on the two detail lines of a pull request, who opened it and when with the draft mark, then its two branches", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    const row = wrapper.findAll("[data-code-hosting-item]")[2];
    expect(row.findAll(".detail-line").map((line) => line.text())).toEqual([
      "erictang opened 2 hours ago · Draft",
      "move-the-sidebar-251 → dev_jerome",
    ]);
  });

  it("shows no button in a row: the whole row is the part that opens the information card", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    expect(wrapper.findAll("[data-code-hosting-item]")).toHaveLength(3);
    expect(wrapper.findAll("[data-code-hosting-item] button")).toHaveLength(0);
    expect(wrapper.findAll("[data-code-hosting-item] i")).toHaveLength(0);
  });

  it("opens the web page of the item in the web browser from the button Open in GitHub of the information card", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    await wrapper.findAll(".row-card")[2].trigger("click");
    await flushPromises();
    await wrapper.get(".popover button[aria-label='Open in GitHub']").trigger("click");
    expect(openUrl).toHaveBeenCalledWith("https://github.com/o/r/pull/371");
  });

  it("gives each row a full-width part with the class row-card, which has no padding of its own", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    const parts = wrapper.findAll(".items .row-card");
    expect(parts).toHaveLength(3);
    expect(parts.every((part) => part.classes().includes("information-card-part"))).toBe(true);
  });

  it("does not open the web page after a click on the row, and opens an information card at the right of the row", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    await wrapper.findAll(".row-card")[0].trigger("click");
    await flushPromises();
    expect(openUrl).not.toHaveBeenCalled();
    const card = wrapper.get(".popover");
    expect(card.classes()).toContain("bs-popover-end");
    expect(card.attributes("aria-label")).toBe("Details of #370");
  });

  it("reads the details of the item from the forge when the card opens, and shows the repository, the date, the state, the description, the labels, and the author", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    await wrapper.findAll(".row-card")[0].trigger("click");
    await flushPromises();
    const call = vi.mocked(invoke).mock.calls.find(([, payload]) => (payload as { args: string[] }).args[1] === "view");
    expect(call?.[0]).toBe("forge_cli_cached");
    expect(call?.[1]).toMatchObject({
      cwd: "/work/heidrun",
      tool: "gh",
      args: ["issue", "view", "370", "--json", "title,state,body,labels,author,createdAt"],
    });
    const card = wrapper.get(".popover").text();
    expect(card).toContain("team/app on Oct 13");
    expect(card).toContain("Open");
    expect(card).toContain("The lists are raw.");
    expect(card).toContain("Design");
    expect(card).toContain("jeromeetienne opened this issue");
  });

  it("shows in the card the repository line with the four buttons, then the whole title with its number, then the state", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    await wrapper.findAll(".row-card")[0].trigger("click");
    await flushPromises();
    const card = wrapper.get(".popover");
    const line = card.get("[data-reference-repository-line]");
    expect(line.text()).toBe("team/app on Oct 13");
    expect(line.get("a").attributes("href")).toBe("https://example.com/team/app");
    expect(line.element.parentElement?.querySelectorAll(".btn-group button")).toHaveLength(4);
    expect(card.get("[data-reference-title]").text()).toBe("Add the Code hosting sidebar section #370");
    expect(card.get(".badge.state").classes()).toContain("state-open");
    await line.get("a").trigger("click");
    expect(openUrl).toHaveBeenCalledWith("https://example.com/team/app");
  });

  it("shows the number of a merge request of GitLab after its title in the card", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("gitlab"));
    vi.mocked(invoke).mockImplementation(async (_command, payload) => {
      const { args } = payload as { args: string[] };
      return JSON.stringify(
        args[1].startsWith("projects/:fullpath/issues")
          ? []
          : [{ iid: 5, title: "A merge request", web_url: "https://gitlab.com/t/a/-/merge_requests/5", author: { username: "eric" } }],
      );
    });
    const wrapper = await mountPanel();
    await wrapper.findAll(".row-card")[0].trigger("click");
    await flushPromises();
    expect(wrapper.get(".popover [data-reference-title]").text()).toBe("A merge request !5");
  });

  it("reads a pull request with gh pr view when its card opens", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    await wrapper.findAll(".row-card")[2].trigger("click");
    await flushPromises();
    const call = vi.mocked(invoke).mock.calls.find(([, payload]) => (payload as { args: string[] }).args[1] === "view");
    expect(call?.[1]).toMatchObject({ args: expect.arrayContaining(["pr", "view", "371"]) });
  });

  /** Answers like `answerGithub`, except that the details of an item wait until the test calls `finish`. */
  function answerDetailsLater() {
    answerGithub();
    const answerAll = vi.mocked(invoke).getMockImplementation();
    const control = { finish: () => {} };
    vi.mocked(invoke).mockImplementation(async (command, payload) => {
      const { args } = payload as { args: string[] };
      if (args[1] === "view") {
        await new Promise<void>((resolve) => {
          control.finish = resolve;
        });
      }
      return answerAll?.(command, payload);
    });
    return control;
  }

  const busyWheel = "[data-information-card-busy]";

  it("opens the card with everything in it at its first appearance when the details come at once, with no wheel and no Loading", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await wrapper.findAll(".row-card")[0].trigger("click");
    await vi.advanceTimersByTimeAsync(0);
    const card = wrapper.get(".popover").text();
    expect(card).toContain("The lists are raw.");
    expect(card).toContain("jeromeetienne opened this issue");
    expect(card).not.toContain("Loading");
    await vi.advanceTimersByTimeAsync(2_000);
    expect(wrapper.find(busyWheel).exists()).toBe(false);
    vi.useRealTimers();
  });

  it("does not open the card while the details are read, shows a wheel on the row after 0.3 second, and opens the full card at the end", async () => {
    const control = answerDetailsLater();
    const wrapper = await mountPanel();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const row = wrapper.findAll(".row-card")[0];
    await row.trigger("click");
    await vi.advanceTimersByTimeAsync(299);
    expect(wrapper.find(".popover").exists()).toBe(false);
    expect(wrapper.find(busyWheel).exists()).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(row.find(busyWheel).attributes("aria-label")).toBe("Reading the details of #370");
    expect(wrapper.find(".popover").exists()).toBe(false);
    control.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(wrapper.find(busyWheel).exists()).toBe(false);
    const card = wrapper.get(".popover").text();
    expect(card).toContain("The lists are raw.");
    expect(card).not.toContain("Loading");
    vi.useRealTimers();
  });

  it("cancels the opening of the card at a second click on the row, and shows no card when the details come later", async () => {
    const control = answerDetailsLater();
    const wrapper = await mountPanel();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const row = wrapper.findAll(".row-card")[0];
    await row.trigger("click");
    await vi.advanceTimersByTimeAsync(300);
    await row.trigger("click");
    expect(wrapper.find(busyWheel).exists()).toBe(false);
    control.finish();
    await vi.advanceTimersByTimeAsync(0);
    expect(wrapper.find(".popover").exists()).toBe(false);
    vi.useRealTimers();
  });

  it("folds and unfolds a list after a click on its header, and keeps the other list", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    const toggle = wrapper.findAll(".group-toggle")[0];
    expect(toggle.attributes("aria-expanded")).toBe("true");
    await toggle.trigger("click");
    expect(toggle.attributes("aria-expanded")).toBe("false");
    expect(wrapper.findAll(".item")).toHaveLength(1);
    await toggle.trigger("click");
    expect(wrapper.findAll(".item")).toHaveLength(3);
  });

  it("folds and unfolds a list after a click anywhere on its header: the empty space, the badge, the title, and the arrow", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    const header = groupOf(wrapper, "issues").get(".group-header");
    for (const part of [header, header.get(".count"), header.get(".group-toggle"), header.get(".group-toggle i")]) {
      expect(groupOf(wrapper, "issues").find("form.search").exists()).toBe(true);
      await part.trigger("click");
      expect(groupOf(wrapper, "issues").find("form.search").exists()).toBe(false);
      expect(header.get(".group-toggle").attributes("aria-expanded")).toBe("false");
      await part.trigger("click");
      expect(groupOf(wrapper, "issues").find("form.search").exists()).toBe(true);
      expect(header.get(".group-toggle").attributes("aria-expanded")).toBe("true");
    }
    expect(groupOf(wrapper, "requests").find("form.search").exists()).toBe(true);
  });

  it("reads the lists again, without the cache, after a click on the refresh button", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(vi.mocked(invoke).mock.calls.map(([, payload]) => (payload as { refresh: boolean }).refresh)).toEqual([false, false]);
    await wrapper.get("button[aria-label=Refresh]").trigger("click");
    await flushPromises();
    expect(invoke).toHaveBeenCalledTimes(4);
    expect(vi.mocked(invoke).mock.calls.slice(2).map(([, payload]) => (payload as { refresh: boolean }).refresh)).toEqual([true, true]);
  });

  it("shows the old rows under a message after a refresh that failed, and removes the message after a good refresh (issue #890)", async () => {
    answerGithub();
    const wrapper = await mountPanel();
    const answerAll = vi.mocked(invoke).getMockImplementation();
    vi.mocked(invoke).mockImplementation(async (command, payload) => {
      const output = (await answerAll?.(command, payload)) as string;
      return {
        output,
        failure: "gh: no network",
        keptAt: Date.now() - 60_000,
      };
    });
    await wrapper.get("button[aria-label=Refresh]").trigger("click");
    await flushPromises();
    const notice = groupOf(wrapper, "issues").get("[data-code-hosting-notice]");
    expect(notice.text()).toMatch(/^The refresh failed\. This list is from .+\. gh: no network$/);
    expect(notice.classes()).toContain("failure");
    expect(groupOf(wrapper, "issues").findAll(".item")).toHaveLength(2);
    vi.mocked(invoke).mockImplementation(async (command, payload) => ({
      output: (await answerAll?.(command, payload)) as string,
      failure: null,
      keptAt: null,
    }));
    await wrapper.get("button[aria-label=Refresh]").trigger("click");
    await flushPromises();
    expect(wrapper.find("[data-code-hosting-notice]").exists()).toBe(false);
  });

  it("says that a list is empty, and shows no row for it", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("github"));
    vi.mocked(invoke).mockResolvedValue("[]");
    const wrapper = await mountPanel();
    expect(wrapper.findAll(".item")).toHaveLength(0);
    expect(wrapper.findAll(".empty").map((text) => text.text())).toEqual(["No open issue.", "No open pull request."]);
  });

  it("warns that a list may hold more items when it reaches the limit", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("github"));
    const many = Array.from({ length: CODE_HOSTING_LIMIT }, (_, index) => ({
      number: index + 1,
      title: `Issue ${index + 1}`,
      url: `https://github.com/o/r/issues/${index + 1}`,
    }));
    vi.mocked(invoke).mockImplementation(async (_command, payload) =>
      JSON.stringify((payload as { args: string[] }).args[0] === "issue" ? many : []),
    );
    const wrapper = await mountPanel();
    expect(wrapper.text()).toContain("The list is too long: only the first 100 are shown.");
  });
});

describe("CodeHostingPanel on GitLab", () => {
  it("names the second list Merge requests, and writes ! before the number of a merge request", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("gitlab"));
    vi.mocked(invoke).mockImplementation(async (_command, payload) => {
      const { args } = payload as { args: string[] };
      return JSON.stringify(
        args[1].startsWith("projects/:fullpath/issues")
          ? [{ iid: 12, title: "An issue", web_url: "https://gitlab.com/t/a/-/issues/12", author: { username: "jerome" }, labels: [{ name: "bug", color: "#d73a4a" }] }]
          : [
              {
                iid: 5,
                title: "A merge request",
                web_url: "https://gitlab.com/t/a/-/merge_requests/5",
                author: { username: "eric" },
                source_branch: "fix-5",
                target_branch: "main",
              },
            ],
      );
    });
    const wrapper = await mountPanel();
    expect(wrapper.findAll(".group-toggle").map((toggle) => toggle.text())).toEqual(["Issues", "Merge requests"]);
    expect(wrapper.findAll(".item .number").map((number) => number.text())).toEqual(["#12", "!5"]);
    expect(wrapper.findAll(".item-lines").map((lines) => lines.findAll(".detail-line")[1].text())).toEqual(["bug", "fix-5 → main"]);
    expect(wrapper.get(".label-badge").attributes("style")).toContain("#d73a4a");
    await wrapper.findAll(".row-card")[1].trigger("click");
    await flushPromises();
    await wrapper.get(".popover button[aria-label='Open in GitLab']").trigger("click");
    expect(openUrl).toHaveBeenCalledWith("https://gitlab.com/t/a/-/merge_requests/5");
  });
});

describe("CodeHostingPanel without lists", () => {
  it("asks to select a workspace when none is selected", async () => {
    state.selectedWorkspaceId = null;
    const wrapper = mount(CodeHostingPanel);
    await flushPromises();
    expect(wrapper.text()).toBe("Select a workspace.");
  });

  it("says that the workspace is not a Git repository when Git has no status for it", async () => {
    state.selectedWorkspaceId = "w1";
    git.status = { w1: null };
    const wrapper = mount(CodeHostingPanel);
    await flushPromises();
    expect(wrapper.text()).toBe("This workspace is not a Git repository.");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("says that the repository is not on GitHub or GitLab when it has no remote address", async () => {
    vi.mocked(refContext).mockResolvedValue({ ...contextOf("github"), base: null, forge: null });
    const wrapper = await mountPanel();
    expect(wrapper.text()).toContain("This repository has no remote address, so it is not on GitHub or GitLab.");
    expect(wrapper.find(".group").exists()).toBe(false);
  });

  it("shows the failure of gh or glab in each list, under its search line, instead of its rows", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("github"));
    vi.mocked(invoke).mockRejectedValue("gh: not logged in");
    const wrapper = await mountPanel();
    expect(wrapper.findAll(".failure").map((failure) => failure.text())).toEqual(["gh: not logged in", "gh: not logged in"]);
    expect(wrapper.findAll("[data-code-hosting-item]")).toHaveLength(0);
    expect(wrapper.findAll("form.search")).toHaveLength(2);
  });

  it("shows the failure of the remote address instead of the lists", async () => {
    vi.mocked(refContext).mockRejectedValue("git: not a repository");
    const wrapper = await mountPanel();
    expect(wrapper.get(".failure").text()).toBe("git: not a repository");
    expect(wrapper.find(".group").exists()).toBe(false);
  });
});

/**
 * The searches that `gh` received for one list, in order: the text after `--search` of each call.
 * @param command - "issue" for the list of issues, "pr" for the list of pull requests
 */
function searchesOf(command: "issue" | "pr"): (string | null)[] {
  return vi
    .mocked(invoke)
    .mock.calls.map(([, payload]) => (payload as { args: string[] }).args)
    .filter((args) => args[0] === command && args[1] === "list")
    .map((args) => (args.includes("--search") ? args[args.indexOf("--search") + 1] : null));
}

/** The searches that `gh` received for the list of issues. */
function issueSearches(): (string | null)[] {
  return searchesOf("issue");
}

/** The searches that `gh` received for the list of pull requests. */
function pullRequestSearches(): (string | null)[] {
  return searchesOf("pr");
}

/**
 * Answers `gh` with one issue for no search, "label:bug", or "is:issue", and one pull request for no search, "is:draft", or
 * "is:pr".
 */
function answerSearches() {
  vi.mocked(refContext).mockResolvedValue(contextOf("github"));
  vi.mocked(invoke).mockImplementation(async (_command, payload) => {
    const { args } = payload as { args: string[] };
    const search = args.includes("--search") ? args[args.indexOf("--search") + 1] : null;
    if (args[0] === "issue" && (search === null || search === "label:bug" || search === "is:issue")) {
      return JSON.stringify([{ number: 7, title: "A bug", url: "https://github.com/o/r/issues/7", author: { login: "eric" } }]);
    }
    if (args[0] === "pr" && (search === null || search === "is:draft" || search === "is:pr")) {
      return JSON.stringify([{ number: 8, title: "A change", url: "https://github.com/o/r/pull/8", author: { login: "eric" } }]);
    }
    return "[]";
  });
}

/** The two lists of the panel by their group: "issues" or "requests". */
type PanelWrapper = Awaited<ReturnType<typeof mountPanel>>;

/** The part of the panel for one list. */
function groupOf(wrapper: PanelWrapper, group: "issues" | "requests") {
  return wrapper.get(`section[data-group='${group}']`);
}

/** The value of the search field of one list. */
function fieldValue(wrapper: PanelWrapper, group: "issues" | "requests"): string {
  return (groupOf(wrapper, group).get("form.search input").element as HTMLInputElement).value;
}

/** Writes a text in the search field of a list and presses the key Enter. */
async function search(wrapper: PanelWrapper, group: "issues" | "requests", text: string) {
  await groupOf(wrapper, group).get("form.search input").setValue(text);
  await groupOf(wrapper, group).get("form.search").trigger("submit");
  await flushPromises();
}

describe("CodeHostingPanel header", () => {
  it("keeps only the title Code hosting and the button Refresh, with no button group", async () => {
    answerSearches();
    const wrapper = await mountPanel();
    const header = wrapper.get("header");
    expect(header.get(".title").text()).toBe("Code hosting");
    expect(header.findAll("button").map((button) => button.attributes("aria-label"))).toEqual(["Refresh"]);
    expect(header.find(".btn-group").exists()).toBe(false);
    expect(header.find("[data-save-search]").exists()).toBe(false);
    expect(header.find("[data-edit-saved-search]").exists()).toBe(false);
    expect(header.get("button i").classes()[1]).toBe("bi-arrow-clockwise");
  });

  it("keeps the button Refresh for a repository without a remote address", async () => {
    vi.mocked(refContext).mockResolvedValue({ ...contextOf("github"), base: null, forge: null });
    const wrapper = await mountPanel();
    expect(wrapper.get("header").findAll("button").map((button) => button.attributes("aria-label"))).toEqual(["Refresh"]);
  });
});

describe("CodeHostingPanel search lines", () => {
  it("shows a search line under the title of each list, with a field named for its list", async () => {
    answerSearches();
    const wrapper = await mountPanel();
    for (const group of ["issues", "requests"] as const) {
      const field = groupOf(wrapper, group).get("form.search input");
      expect(field.attributes("placeholder")).toBe("Search");
      expect(field.attributes("title")).toBe("Write a search, for example: author:@me label:bug");
    }
    expect(groupOf(wrapper, "issues").get("form.search input").attributes("aria-label")).toBe("Search the issues");
    expect(groupOf(wrapper, "requests").get("form.search input").attributes("aria-label")).toBe("Search the pull requests");
  });

  it("names the field of the second list for the merge requests on GitLab", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("gitlab"));
    vi.mocked(invoke).mockResolvedValue("[]");
    const wrapper = await mountPanel();
    expect(groupOf(wrapper, "requests").get("form.search input").attributes("aria-label")).toBe("Search the merge requests");
  });

  it("puts, in each list, the title, then the search line, then the saved searches, then a separator, then the rows", async () => {
    settings.codeHostingSavedSearches = {
      issues: [{ name: "Bugs", query: "label:bug" }],
      requests: [{ name: "Drafts", query: "is:draft" }],
    };
    answerSearches();
    const wrapper = await mountPanel();
    for (const group of ["issues", "requests"] as const) {
      const parts = Array.from(groupOf(wrapper, group).element.children).map((part) => part.classList[0]);
      expect(parts).toEqual(["group-header", "search", "saved", "list-separator", "items"]);
    }
  });

  it("puts Search, Save this search, and Edit the saved search beside each field", async () => {
    answerSearches();
    const wrapper = await mountPanel();
    for (const group of ["issues", "requests"] as const) {
      const form = groupOf(wrapper, group).get("form.search");
      expect(Array.from(form.element.children).map((part) => part.tagName)).toEqual(["INPUT", "BUTTON", "BUTTON", "BUTTON"]);
      expect(form.findAll("button").map((button) => button.attributes("aria-label"))).toEqual([
        "Search",
        "Save this search",
        "Edit the saved search",
      ]);
      expect(form.findAll("button i").map((icon) => icon.classes()[1])).toEqual([
        "bi-search", "bi-bookmark-plus", "bi-pencil",
      ]);
      expect(form.findAll("button").every((button) => button.text() === "")).toBe(true);
    }
  });

  it("shows no line of saved searches in a list that has none, and only its own saved searches in a list that has some", async () => {
    settings.codeHostingSavedSearches = { issues: [{ name: "Bugs", query: "label:bug" }], requests: [] };
    answerSearches();
    const wrapper = await mountPanel();
    expect(groupOf(wrapper, "issues").get(".saved").findAll("button").map((button) => button.text())).toEqual(["All", "Bugs"]);
    expect(groupOf(wrapper, "requests").find(".saved").exists()).toBe(false);
    settings.codeHostingSavedSearches.requests.push({ name: "Drafts", query: "is:draft" });
    await flushPromises();
    expect(groupOf(wrapper, "requests").get(".saved").findAll("button").map((button) => button.text())).toEqual(["All", "Drafts"]);
    expect(groupOf(wrapper, "issues").get(".saved").findAll("button").map((button) => button.text())).toEqual(["All", "Bugs"]);
  });

  it("hides the search line, the saved searches, and the separator of a folded list, and keeps them in the other list", async () => {
    settings.codeHostingSavedSearches = {
      issues: [{ name: "Bugs", query: "label:bug" }],
      requests: [{ name: "Drafts", query: "is:draft" }],
    };
    answerSearches();
    const wrapper = await mountPanel();
    await groupOf(wrapper, "issues").get(".group-toggle").trigger("click");
    const folded = groupOf(wrapper, "issues");
    expect(folded.find("form.search").exists()).toBe(false);
    expect(folded.find(".saved").exists()).toBe(false);
    expect(folded.find(".list-separator").exists()).toBe(false);
    expect(groupOf(wrapper, "requests").find("form.search").exists()).toBe(true);
    expect(groupOf(wrapper, "requests").find(".saved").exists()).toBe(true);
    await folded.get(".group-toggle").trigger("click");
    expect(groupOf(wrapper, "issues").find("form.search").exists()).toBe(true);
  });

  it("shows no search line for a repository without a remote address", async () => {
    vi.mocked(refContext).mockResolvedValue({ ...contextOf("github"), base: null, forge: null });
    const wrapper = await mountPanel();
    expect(wrapper.find("form.search").exists()).toBe(false);
  });
});

describe("CodeHostingPanel searches", () => {
  /** Answers `gh` with one issue that has the label Design for no search or "label:Design", and the details of an item. */
  function answerLabelSearches() {
    vi.mocked(refContext).mockResolvedValue(contextOf("github"));
    vi.mocked(invoke).mockImplementation(async (_command, payload) => {
      const { args } = payload as { args: string[] };
      if (args[1] === "view") {
        return JSON.stringify({ title: "A bug", state: "OPEN", body: "", labels: [{ name: "Design", color: "1d76db" }], author: null });
      }
      const search = args.includes("--search") ? args[args.indexOf("--search") + 1] : null;
      if (args[0] === "issue" && (search === null || search === "label:Design" || search === "author:@me label:Design")) {
        return JSON.stringify([
          { number: 7, title: "A bug", url: "https://github.com/o/r/issues/7", author: { login: "eric" }, labels: [{ name: "Design", color: "1d76db" }] },
        ]);
      }
      return "[]";
    });
  }

  it("adds the label of the card to the search field of the list at a click, and runs the search of this list at once", async () => {
    answerLabelSearches();
    const wrapper = await mountPanel();
    await wrapper.findAll(".row-card")[0].trigger("click");
    await flushPromises();
    const label = wrapper.get(".popover [data-reference-label]");
    expect(label.text()).toBe("Design");
    await label.trigger("click");
    await flushPromises();
    expect(fieldValue(wrapper, "issues")).toBe("label:Design");
    expect(codeHosting.search.issues).toBe("label:Design");
    expect(issueSearches()).toEqual([null, "label:Design"]);
    expect(pullRequestSearches()).toEqual([null]);
    expect(wrapper.find(".popover").exists()).toBe(false);
  });

  it("removes the label from the search field at the second click on it, and runs the search of this list at once", async () => {
    answerLabelSearches();
    const wrapper = await mountPanel();
    await wrapper.findAll(".row-card")[0].trigger("click");
    await flushPromises();
    await wrapper.get(".popover [data-reference-label]").trigger("click");
    await flushPromises();
    await wrapper.findAll(".row-card")[0].trigger("click");
    await flushPromises();
    expect(wrapper.get(".popover [data-reference-label]").attributes("aria-pressed")).toBe("true");
    await wrapper.get(".popover [data-reference-label]").trigger("click");
    await flushPromises();
    expect(fieldValue(wrapper, "issues")).toBe("");
    expect(codeHosting.search.issues).toBe("");
    expect(issueSearches()).toEqual([null, "label:Design", null]);
  });

  it("keeps the other words of the search field when a label is added, and runs the whole search", async () => {
    answerLabelSearches();
    const wrapper = await mountPanel();
    await wrapper.findAll(".row-card")[0].trigger("click");
    await flushPromises();
    await groupOf(wrapper, "issues").get("form.search input").setValue("author:@me");
    await wrapper.get(".popover [data-reference-label]").trigger("click");
    await flushPromises();
    expect(fieldValue(wrapper, "issues")).toBe("author:@me label:Design");
    expect(issueSearches()).toEqual([null, "author:@me label:Design"]);
  });

  it("puts the label in the field of the list of the card only: the other list keeps its field and its search", async () => {
    answerLabelSearches();
    const wrapper = await mountPanel();
    await wrapper.findAll(".row-card")[0].trigger("click");
    await flushPromises();
    await wrapper.get(".popover [data-reference-label]").trigger("click");
    await flushPromises();
    expect(fieldValue(wrapper, "requests")).toBe("");
    expect(codeHosting.search.requests).toBe("");
    expect(pullRequestSearches()).toEqual([null]);
  });

  it("runs the search of the list of issues when the key Enter is pressed, reads only this list, and keeps the other list", async () => {
    answerSearches();
    const wrapper = await mountPanel();
    expect(wrapper.findAll("[data-code-hosting-item]")).toHaveLength(2);
    await search(wrapper, "issues", "  label:other  ");
    expect(issueSearches()).toEqual([null, "label:other"]);
    expect(pullRequestSearches()).toEqual([null]);
    expect(codeHosting.search).toEqual({ issues: "label:other", requests: "" });
    expect(groupOf(wrapper, "issues").findAll("[data-code-hosting-item]")).toHaveLength(0);
    expect(groupOf(wrapper, "requests").findAll("[data-code-hosting-item]")).toHaveLength(1);
    expect(wrapper.findAll(".group-header").map((header) => header.get(".count").text())).toEqual(["0", "1"]);
  });

  it("runs the search of the list of pull requests when the key Enter is pressed, reads only this list, and keeps the other list", async () => {
    answerSearches();
    const wrapper = await mountPanel();
    await search(wrapper, "requests", "is:draft");
    expect(pullRequestSearches()).toEqual([null, "is:draft"]);
    expect(issueSearches()).toEqual([null]);
    expect(codeHosting.search).toEqual({ issues: "", requests: "is:draft" });
    expect(groupOf(wrapper, "issues").findAll("[data-code-hosting-item]")).toHaveLength(1);
  });

  it("runs the search at a click on the button Search of the list", async () => {
    answerSearches();
    const wrapper = await mountPanel();
    await groupOf(wrapper, "requests").get("form.search input").setValue("label:other");
    await groupOf(wrapper, "requests").get("button[data-run-search]").trigger("click");
    await flushPromises();
    expect(pullRequestSearches()).toEqual([null, "label:other"]);
  });

  it("says that no item matches the search in a list that runs a search, and says No open in a list that has none", async () => {
    answerSearches();
    const wrapper = await mountPanel();
    await search(wrapper, "issues", "label:other");
    await search(wrapper, "requests", "label:other");
    expect(wrapper.findAll(".empty").map((line) => line.text())).toEqual([
      "No issue matches the search.",
      "No pull request matches the search.",
    ]);
    await search(wrapper, "issues", "");
    expect(wrapper.findAll(".empty").map((line) => line.text())).toEqual(["No pull request matches the search."]);
    await search(wrapper, "requests", "");
    vi.mocked(invoke).mockResolvedValue({
      output: "[]",
      failure: null,
      keptAt: null,
    });
    await wrapper.get("button[aria-label='Refresh']").trigger("click");
    await flushPromises();
    expect(wrapper.findAll(".empty").map((line) => line.text())).toEqual(["No open issue.", "No open pull request."]);
  });

  it("keeps the search field and the search of each list in place when the lists are refreshed", async () => {
    answerSearches();
    const wrapper = await mountPanel();
    await search(wrapper, "issues", "label:bug");
    await search(wrapper, "requests", "is:draft");
    vi.mocked(invoke).mockClear();
    await wrapper.get("button[aria-label='Refresh']").trigger("click");
    await flushPromises();
    expect(issueSearches()).toEqual(["label:bug"]);
    expect(pullRequestSearches()).toEqual(["is:draft"]);
    expect(fieldValue(wrapper, "issues")).toBe("label:bug");
    expect(fieldValue(wrapper, "requests")).toBe("is:draft");
  });

  it("disables Save this search of a list while its field is empty, and while its text is already a saved search of this list", async () => {
    answerSearches();
    settings.codeHostingSavedSearches = { issues: [{ name: "Bugs", query: "label:bug" }], requests: [] };
    const wrapper = await mountPanel();
    const save = (group: "issues" | "requests") => groupOf(wrapper, group).get("button[data-save-search]");
    expect(save("issues").attributes("disabled")).toBeDefined();
    await groupOf(wrapper, "issues").get("form.search input").setValue("author:@me");
    expect(save("issues").attributes("disabled")).toBeUndefined();
    await groupOf(wrapper, "issues").get("form.search input").setValue("  label:bug ");
    expect(save("issues").attributes("disabled")).toBeDefined();
    await groupOf(wrapper, "requests").get("form.search input").setValue("label:bug");
    expect(save("requests").attributes("disabled")).toBeUndefined();
  });

  it("opens the window Save this search for the list of the button, with the text of its field", async () => {
    answerSearches();
    const wrapper = await mountPanel();
    await groupOf(wrapper, "requests").get("form.search input").setValue("  is:draft -author:eric ");
    await groupOf(wrapper, "requests").get("button[data-save-search]").trigger("click");
    expect(savedSearchModal).toMatchObject({ open: true, mode: "save", group: "requests", query: "is:draft -author:eric" });
    await groupOf(wrapper, "issues").get("form.search input").setValue("label:bug");
    await groupOf(wrapper, "issues").get("button[data-save-search]").trigger("click");
    expect(savedSearchModal).toMatchObject({ open: true, mode: "save", group: "issues", query: "label:bug" });
  });

  it("disables Edit the saved search of a list while no saved search runs in it: All is pressed, or the search is not saved", async () => {
    answerSearches();
    settings.codeHostingSavedSearches = { issues: [{ name: "Bugs", query: "label:bug" }], requests: [] };
    const wrapper = await mountPanel();
    const edit = () => groupOf(wrapper, "issues").get("button[data-edit-saved-search]");
    expect(edit().attributes("disabled")).toBeDefined();
    await search(wrapper, "issues", "author:@me");
    expect(edit().attributes("disabled")).toBeDefined();
  });

  it("opens the window Edit the saved search for the saved search that runs now in the list of the button", async () => {
    answerSearches();
    settings.codeHostingSavedSearches = {
      issues: [
        { name: "Mine", query: "author:@me" },
        { name: "Bugs", query: "label:bug" },
      ],
      requests: [{ name: "Drafts", query: "is:draft" }],
    };
    const wrapper = await mountPanel();
    await groupOf(wrapper, "issues").findAll(".saved-button")[2].trigger("click");
    await flushPromises();
    const edit = groupOf(wrapper, "issues").get("button[data-edit-saved-search]");
    expect(edit.attributes("disabled")).toBeUndefined();
    expect(groupOf(wrapper, "requests").get("button[data-edit-saved-search]").attributes("disabled")).toBeDefined();
    await edit.trigger("click");
    expect(savedSearchModal).toMatchObject({ open: true, mode: "edit", group: "issues", name: "Bugs" });
    await groupOf(wrapper, "requests").findAll(".saved-button")[1].trigger("click");
    await flushPromises();
    await groupOf(wrapper, "requests").get("button[data-edit-saved-search]").trigger("click");
    expect(savedSearchModal).toMatchObject({ open: true, mode: "edit", group: "requests", name: "Drafts" });
  });

  it("shows in the search field of its list a search that runs from elsewhere, such as the window Save this search", async () => {
    answerSearches();
    const wrapper = await mountPanel();
    codeHosting.search.requests = "is:draft";
    await flushPromises();
    expect(fieldValue(wrapper, "requests")).toBe("is:draft");
    expect(fieldValue(wrapper, "issues")).toBe("");
  });

  it("fills the search field of the list and runs the search of this list at a click on a saved search or on All", async () => {
    answerSearches();
    settings.codeHostingSavedSearches = {
      issues: [
        { name: "Bugs", query: "label:bug" },
        { name: "Mine", query: "author:@me" },
      ],
      requests: [{ name: "Drafts", query: "is:draft" }],
    };
    const wrapper = await mountPanel();
    const buttons = groupOf(wrapper, "issues").findAll(".saved-button");
    expect(buttons.map((button) => button.text())).toEqual(["All", "Bugs", "Mine"]);
    expect(buttons[1].attributes("title")).toBeUndefined();
    await buttons[2].trigger("click");
    await flushPromises();
    expect(fieldValue(wrapper, "issues")).toBe("author:@me");
    expect(fieldValue(wrapper, "requests")).toBe("");
    await groupOf(wrapper, "issues").findAll(".saved-button")[0].trigger("click");
    await flushPromises();
    expect(fieldValue(wrapper, "issues")).toBe("is:issue");
    expect(issueSearches()).toEqual([null, "author:@me", "is:issue"]);
    expect(pullRequestSearches()).toEqual([null]);
    await groupOf(wrapper, "requests").findAll(".saved-button")[1].trigger("click");
    await flushPromises();
    expect(pullRequestSearches()).toEqual([null, "is:draft"]);
    expect(issueSearches()).toEqual([null, "author:@me", "is:issue"]);
  });

  it("writes is:issue in the search field of the issues, and is:pr in the search field of the pull requests, at a click on All", async () => {
    answerSearches();
    settings.codeHostingSavedSearches = {
      issues: [{ name: "Bugs", query: "label:bug" }],
      requests: [{ name: "Drafts", query: "is:draft" }],
    };
    const wrapper = await mountPanel();
    await search(wrapper, "issues", "label:bug");
    await search(wrapper, "requests", "is:draft");
    await groupOf(wrapper, "issues").findAll(".saved-button")[0].trigger("click");
    await flushPromises();
    await groupOf(wrapper, "requests").findAll(".saved-button")[0].trigger("click");
    await flushPromises();
    expect(fieldValue(wrapper, "issues")).toBe("is:issue");
    expect(fieldValue(wrapper, "requests")).toBe("is:pr");
    expect(codeHosting.search).toEqual({ issues: "is:issue", requests: "is:pr" });
    expect(issueSearches()).toEqual([null, "label:bug", "is:issue"]);
    expect(pullRequestSearches()).toEqual([null, "is:draft", "is:pr"]);
    expect(groupOf(wrapper, "issues").findAll("[data-code-hosting-item]")).toHaveLength(1);
  });

  it("presses All when the search is empty, and when the search is the one that All writes, and says No open for an empty list", async () => {
    answerSearches();
    settings.codeHostingSavedSearches = { issues: [{ name: "Bugs", query: "label:bug" }], requests: [] };
    const wrapper = await mountPanel();
    const all = () => groupOf(wrapper, "issues").get("[data-saved-search='all']");
    expect(all().attributes("aria-pressed")).toBe("true");
    await search(wrapper, "issues", "label:other");
    expect(all().attributes("aria-pressed")).toBe("false");
    expect(groupOf(wrapper, "issues").get(".empty").text()).toBe("No issue matches the search.");
    await all().trigger("click");
    await flushPromises();
    expect(all().attributes("aria-pressed")).toBe("true");
    expect(all().classes()).toContain("active");
    await search(wrapper, "issues", "is:issue");
    expect(all().attributes("aria-pressed")).toBe("true");
  });

  it("writes no search at a click on All for a repository on GitLab, because GitLab cannot read is:issue", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("gitlab"));
    vi.mocked(invoke).mockResolvedValue("[]");
    settings.codeHostingSavedSearches = { issues: [{ name: "Bugs", query: "label:bug" }], requests: [{ name: "Drafts", query: "is:draft" }] };
    const wrapper = await mountPanel();
    await search(wrapper, "issues", "label:bug");
    await search(wrapper, "requests", "is:draft");
    await groupOf(wrapper, "issues").get("[data-saved-search='all']").trigger("click");
    await groupOf(wrapper, "requests").get("[data-saved-search='all']").trigger("click");
    await flushPromises();
    expect(fieldValue(wrapper, "issues")).toBe("");
    expect(fieldValue(wrapper, "requests")).toBe("");
    expect(groupOf(wrapper, "issues").find(".failure").exists()).toBe(false);
    expect(groupOf(wrapper, "requests").find(".failure").exists()).toBe(false);
  });

  it("marks the saved search that runs now in its list, and All when no search runs in this list", async () => {
    answerSearches();
    settings.codeHostingSavedSearches = {
      issues: [{ name: "Bugs", query: "label:bug" }],
      requests: [{ name: "Drafts", query: "is:draft" }],
    };
    const wrapper = await mountPanel();
    const pressed = (group: "issues" | "requests") =>
      groupOf(wrapper, group)
        .findAll(".saved-button")
        .map((button) => button.attributes("aria-pressed"));
    expect(pressed("issues")).toEqual(["true", "false"]);
    await groupOf(wrapper, "issues").findAll(".saved-button")[1].trigger("click");
    await flushPromises();
    expect(pressed("issues")).toEqual(["false", "true"]);
    expect(pressed("requests")).toEqual(["true", "false"]);
    expect(groupOf(wrapper, "issues").findAll(".saved-button")[1].classes()).toContain("active");
  });

  it("shows the message of GitLab for a word that it cannot do in the list of the search only, and keeps the search line", async () => {
    vi.mocked(refContext).mockResolvedValue(contextOf("gitlab"));
    vi.mocked(invoke).mockResolvedValue("[]");
    const wrapper = await mountPanel();
    await search(wrapper, "issues", "mentions:@me");
    expect(groupOf(wrapper, "issues").get(".failure").text()).toBe("GitLab cannot do this search: mentions:@me");
    expect(groupOf(wrapper, "requests").find(".failure").exists()).toBe(false);
    expect(fieldValue(wrapper, "issues")).toBe("mentions:@me");
    expect(groupOf(wrapper, "issues").find(".items").exists()).toBe(false);
  });

  it("shows Loading under the search line of a list while its search runs, and keeps the search line", async () => {
    answerSearches();
    const wrapper = await mountPanel();
    let answer: (text: string) => void = () => {};
    vi.mocked(invoke).mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    await groupOf(wrapper, "issues").get("form.search input").setValue("label:bug");
    await groupOf(wrapper, "issues").get("form.search").trigger("submit");
    await flushPromises();
    expect(groupOf(wrapper, "issues").get(".empty").text()).toBe("Loading…");
    expect(groupOf(wrapper, "issues").find("form.search").exists()).toBe(true);
    expect(groupOf(wrapper, "requests").findAll("[data-code-hosting-item]")).toHaveLength(1);
    answer("[]");
    await flushPromises();
  });
});


describe('CodeHostingPanel search help', () => {
	it.each(['github', 'gitlab'] as const)('explains %s searches without changing or running either search', async (forge) => {
		answerSearches();
		vi.mocked(refContext).mockResolvedValue(contextOf(forge));
		if (forge === 'gitlab') {
			vi.mocked(invoke).mockResolvedValue('[]');
		}
		const wrapper = await mountPanel();
		await groupOf(wrapper, 'issues').get('input').setValue('label:bug');
		await groupOf(wrapper, 'requests').get('input').setValue('author:@me');
		const calls = vi.mocked(invoke).mock.calls.length;
		const searchBefore = {
			...codeHosting.search,
		};
		for (const group of ['issues', 'requests'] as const) {
			const section = groupOf(wrapper, group);
			const header = section.get('.group-header');
			const button = header.get('[data-search-help]');
			expect(section.find('form [data-search-help]').exists()).toBe(false);
			expect(Array.from(header.element.children).map((element) => element.classList[0])).toEqual([
				'group-toggle', 'information-card-part', 'badge',
			]);
			const title = group === 'issues' ? 'Issues' : forge === 'github' ? 'Pull requests' : 'Merge requests';
			expect(button.attributes('aria-label')).toBe(`Search help for ${title}`);
			expect(button.attributes('type')).toBe('button');
			expect(button.classes()).toEqual(expect.arrayContaining(['btn', 'icon']));
			expect((button.element as HTMLButtonElement).tabIndex).toBe(0);
			await button.trigger('click');
			await flushPromises();
			expect(codeHosting.folded[group]).toBe(false);
			const card = section.get('.popover');
			expect(card.attributes('aria-label')).toBe(`Search help for ${title}`);
			expect(card.text()).toContain(`${forge === 'github' ? 'GitHub' : 'GitLab'} search — ${title}`);
			expect(card.text()).toContain('Press Enter in the search field to search only ' + title);
			expect(card.find('ul').exists()).toBe(false);
			expect(card.text()).not.toContain('label:"simple-work"');
			if (forge === 'github') {
				const link = card.get('a');
				const documentation = 'https://docs.github.com/en/issues/tracking-your-work-with-issues/'
					+ 'using-issues/filtering-and-searching-issues-and-pull-requests';
				expect(link.attributes('href')).toBe(documentation);
				expect(link.text()).toBe('GitHub Docs');
				await link.trigger('click');
				expect(openUrl).toHaveBeenLastCalledWith(documentation);
				expect(section.find('.popover').exists()).toBe(true);
			} else {
				expect(card.find('a').exists()).toBe(false);
				expect(card.text()).toContain('The full GitHub search language does not work here.');
				for (const expression of ['milestone:', 'no:label', 'no:assignee', 'no:milestone', 'OR', 'sort:']) {
					expect(card.text()).toContain(expression);
				}
				expect(card.text().includes('review-requested:@me')).toBe(group === 'requests');
			}
			await button.trigger('keydown', {
				key: 'Escape',
			});
			expect(section.find('.popover').exists()).toBe(false);
		}
		expect(fieldValue(wrapper, 'issues')).toBe('label:bug');
		expect(fieldValue(wrapper, 'requests')).toBe('author:@me');
		expect(codeHosting.search).toEqual(searchBefore);
		expect(invoke).toHaveBeenCalledTimes(calls);
	});
});

describe("CodeHostingPanel, the level of a saved search", () => {
  /** The delay of the information card tooltip, in milliseconds. */
  const TOOLTIP_DELAY = 1500;

  /** Selects the workspace "w1", which has a folder and a name, and the workspace "w2", which is another one. */
  function selectWorkspaceWithFolder() {
    state.snapshot = {
      workspaces: [
        { workspace_id: "w1", workspace_folder: "/work/heidrun", number: 1, label: "heidrun", agent_status: "idle" },
        { workspace_id: "w2", workspace_folder: "/work/other", number: 2, label: "other", agent_status: "idle" },
      ],
      tabs: [],
      panes: [],
      agents: [],
      layouts: [],
    } as unknown as typeof state.snapshot;
  }

  /** The saved searches of the two levels: one of each level in the list of issues. */
  function saveBothLevels() {
    settings.codeHostingSavedSearches = { issues: [{ name: "Mine", query: "author:@me" }], requests: [] };
    settings.codeHostingWorkspaceSavedSearches = {
      "/work/heidrun": { issues: [{ name: "Bugs", query: "label:bug" }], requests: [{ name: "Drafts", query: "is:draft" }] },
      "/work/other": { issues: [{ name: "Elsewhere", query: "label:other" }], requests: [] },
    };
  }

  /** The tooltip that is open in the page, or null. */
  function openTooltip(): HTMLElement | null {
    return document.body.querySelector<HTMLElement>("[role='tooltip']");
  }

  it("shows the saved searches of the user level, then the ones of the selected workspace, and no other workspace", async () => {
    answerSearches();
    selectWorkspaceWithFolder();
    saveBothLevels();
    const wrapper = await mountPanel();
    const buttons = groupOf(wrapper, "issues").findAll("[data-saved-search]:not([data-saved-search='all'])");
    expect(buttons.map((button) => button.text())).toEqual(["Mine", "Bugs"]);
    expect(buttons.map((button) => button.attributes("data-saved-search-level"))).toEqual(["user", "workspace"]);
    expect(groupOf(wrapper, "requests").findAll(".saved-button").map((button) => button.text())).toEqual(["All", "Drafts"]);
  });

  it("shows only the saved searches of the user level when the workspace has no folder", async () => {
    answerSearches();
    saveBothLevels();
    const wrapper = await mountPanel();
    expect(groupOf(wrapper, "issues").findAll(".saved-button").map((button) => button.text())).toEqual(["All", "Mine"]);
  });

  it("opens an information card tooltip after the delay, with the name, the search, the level User, and the list", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      answerSearches();
      selectWorkspaceWithFolder();
      saveBothLevels();
      const wrapper = await mountPanel();
      const mine = groupOf(wrapper, "issues").get("[data-saved-search-level='user']");
      await mine.trigger("pointerenter");
      await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY - 1);
      expect(openTooltip()).toBeNull();
      await vi.advanceTimersByTimeAsync(1);
      await flushPromises();
      const text = openTooltip()?.textContent ?? "";
      expect(text).toContain("Mine");
      expect(text).toContain("author:@me");
      expect(text).toContain("User: the saved search shows in every workspace.");
      expect(text).toContain("Issues");
      await mine.trigger("pointerleave");
      expect(openTooltip()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("names the workspace in the information card tooltip of a saved search of the workspace level", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      answerSearches();
      selectWorkspaceWithFolder();
      saveBothLevels();
      const wrapper = await mountPanel();
      await groupOf(wrapper, "requests").get("[data-saved-search-level='workspace']").trigger("pointerenter");
      await vi.advanceTimersByTimeAsync(TOOLTIP_DELAY);
      await flushPromises();
      const text = openTooltip()?.textContent ?? "";
      expect(text).toContain("Drafts");
      expect(text).toContain("is:draft");
      expect(text).toContain("Workspace heidrun: the saved search shows only in this workspace.");
      expect(text).toContain("Pull requests");
      await groupOf(wrapper, "requests").get("[data-saved-search-level='workspace']").trigger("pointerleave");
    } finally {
      vi.useRealTimers();
    }
  });

  it("opens the window Edit the saved search with the level of the saved search that runs now", async () => {
    answerSearches();
    selectWorkspaceWithFolder();
    saveBothLevels();
    const wrapper = await mountPanel();
    await groupOf(wrapper, "issues").get("[data-saved-search-level='workspace']").trigger("click");
    await flushPromises();
    await groupOf(wrapper, "issues").get("button[data-edit-saved-search]").trigger("click");
    expect(savedSearchModal).toMatchObject({ open: true, mode: "edit", group: "issues", name: "Bugs", level: "workspace" });
  });
});
